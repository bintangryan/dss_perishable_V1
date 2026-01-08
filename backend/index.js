const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { calculateState } = require('./stateMapper');
require('dotenv').config();

const app = express();

// --- MIDDLEWARES ---
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// --- ROUTES ---

// 1. Cek koneksi DB sederhana
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Koneksi Sukses!', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. API UNTUK SEMUA PRODUK (Dashboard Baru)
app.get('/api/recommend/all', async (req, res) => {
  try {
    console.log("Fetching all recommendations...");
    const query = `
            SELECT b.id, b.current_stock, p.name as product_name,
            (b.expiry_date - CURRENT_DATE) as days_left
            FROM product_batches b
            JOIN products p ON b.product_id = p.id
            WHERE b.current_stock > 0
            ORDER BY days_left ASC
        `;
    const allBatches = await pool.query(query);

    const results = await Promise.all(allBatches.rows.map(async (batch) => {
      const isWeekend = [0, 6].includes(new Date().getDay());

      // Menentukan State ID
      const stateId = calculateState(batch.days_left, batch.current_stock, 5, isWeekend);

      // Cek/Buat entri di Q-Table
      let qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [stateId]);
      if (qRow.rows.length === 0) {
        await pool.query('INSERT INTO q_table (state_id) VALUES ($1)', [stateId]);
        qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [stateId]);
      }

      const values = qRow.rows[0];
      const actions = ['a_0', 'a_10', 'a_20', 'a_30', 'a_50'];
      let bestAction = actions[0];
      let maxQ = values[actions[0]];

      actions.forEach(a => {
        if (values[a] > maxQ) {
          maxQ = values[a];
          bestAction = a;
        }
      });

      return {
        ...batch,
        current_state: stateId,
        recommendation: bestAction.replace('a_', '') + '%',
        q_values: values
      };
    }));

    res.json(results);
  } catch (err) {
    console.error("Error di /api/recommend/all:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. API Rekomendasi per ID (Tetap dipertahankan)
app.get('/api/recommend/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const query = `
            SELECT b.*, p.name, 
            (b.expiry_date - CURRENT_DATE) as days_left 
            FROM product_batches b
            JOIN products p ON b.product_id = p.id
            WHERE b.id = $1
        `;
    const batchData = await pool.query(query, [batchId]);

    if (batchData.rows.length === 0) return res.status(404).send('Batch tidak ditemukan');

    const batch = batchData.rows[0];
    const isWeekend = [0, 6].includes(new Date().getDay());
    const stateId = calculateState(batch.days_left, batch.current_stock, 5, isWeekend);

    let qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [stateId]);

    if (qRow.rows.length === 0) {
      await pool.query('INSERT INTO q_table (state_id) VALUES ($1)', [stateId]);
      qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [stateId]);
    }

    const values = qRow.rows[0];
    const actions = ['a_0', 'a_10', 'a_20', 'a_30', 'a_50'];
    let bestAction = actions[0];
    let maxQ = values[actions[0]];

    actions.forEach(a => {
      if (values[a] > maxQ) {
        maxQ = values[a];
        bestAction = a;
      }
    });

    res.json({
      product: batch.name,
      current_state: stateId,
      recommendation: bestAction.replace('a_', '') + '%',
      q_values: values
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. API Feedback (Human-in-the-Loop)
app.post('/api/feedback', async (req, res) => {
  try {
    const { state_id, action_taken, feedback_type, custom_discount } = req.body;
    const alpha = 0.2;
    let reward = 0;

    if (feedback_type === 'APPROVE') reward = 10;
    else if (feedback_type === 'REJECT') reward = -5;

    // Logika HITL: Koreksi Manual
    if (custom_discount) {
      const finalAction = `a_${custom_discount}`;
      await pool.query(
        `UPDATE q_table SET ${finalAction} = ${finalAction} + $1 WHERE state_id = $2`,
        [15, state_id]
      );
    }

    // Update Q-Table (Rumus Sederhana)
    const updateQuery = `
            UPDATE q_table 
            SET a_${action_taken} = a_${action_taken} + ($1 * ($2 - a_${action_taken}))
            WHERE state_id = $3
        `;
    await pool.query(updateQuery, [alpha, reward, state_id]);
    res.json({ message: "AI telah belajar!", state: state_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. API Simulasi
app.post('/api/run-simulation', async (req, res) => {
  try {
    let stock = 50;
    let history = [];
    const expiryDays = 10;

    for (let d = 1; d <= 15; d++) {
      const daysLeft = expiryDays - d;
      let discount = daysLeft < 3 ? 50 : (daysLeft < 6 ? 20 : 0);
      let sold = Math.min(stock, Math.floor(Math.random() * 5) + (discount / 10));
      stock -= sold;
      history.push({ day: d, stock, discount, sold });
      if (stock <= 0) break;
    }
    res.json({ history });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 6. API: Tambah Produk & Batch Baru
app.post('/api/inventory', async (req, res) => {
  const { name, base_price, normal_price, category, stock, expiry_date } = req.body;
  try {
    const productRes = await pool.query(
      'INSERT INTO products (name, base_price, normal_price, category) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, base_price, normal_price, category]
    );
    const productId = productRes.rows[0].id;

    await pool.query(
      'INSERT INTO product_batches (product_id, initial_stock, current_stock, expiry_date) VALUES ($1, $2, $2, $3)',
      [productId, stock, expiry_date]
    );

    res.json({ message: "Data produk dan stok berhasil disimpan!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan data ke database" });
  }
});

app.post('/api/sales', async (req, res) => {
  const { product_id, batch_id, quantity, price } = req.body;
  try {
    // 1. Catat log penjualan
    await pool.query(
      'INSERT INTO sales_logs (product_id, batch_id, quantity_sold, price_at_sale) VALUES ($1, $2, $3, $4)',
      [product_id, batch_id, quantity, price]
    );

    // 2. Kurangi stok di product_batches
    await pool.query(
      'UPDATE product_batches SET current_stock = current_stock - $1 WHERE id = $2',
      [quantity, batch_id]
    );

    res.json({ message: "Transaksi berhasil dicatat!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. API Feedback (Human-in-the-Loop dengan Guided Update)
app.post('/api/feedback', async (req, res) => {
  try {
    const { state_id, action_taken, feedback_type, custom_discount } = req.body;
    const alpha = 0.2;
    let reward = 0;

    // A. REWARD DASAR DARI FEEDBACK
    if (feedback_type === 'APPROVE') reward = 15; // User setuju, kasih reward besar
    else if (feedback_type === 'REJECT') reward = -10; // User tidak setuju

    // B. LOGIKA GUIDED UPDATE (Koreksi Manual)
    if (custom_discount !== undefined) {
      const suggestedAction = `a_${action_taken}`; // Aksi asli AI
      const correctedAction = `a_${custom_discount}`; // Aksi pilihan User

      // 1. Berikan punishment pada aksi yang salah menurut user
      await pool.query(
        `UPDATE q_table SET ${suggestedAction} = ${suggestedAction} - 10 WHERE state_id = $1`,
        [state_id]
      );

      // 2. Berikan "Supervised Signal" (Reward instan) pada aksi pilihan user
      // Ini membuat AI langsung "paham" ke mana arah yang benar
      await pool.query(
        `UPDATE q_table SET ${correctedAction} = ${correctedAction} + 20 WHERE state_id = $1`,
        [state_id]
      );
    }

    // C. UPDATE Q-TABLE STANDAR (Bellman)
    // Tetap jalankan update standar agar AI belajar secara inkremental
    const updateQuery = `
            UPDATE q_table 
            SET a_${action_taken} = a_${action_taken} + ($1 * ($2 - a_${action_taken}))
            WHERE state_id = $3
        `;
    await pool.query(updateQuery, [alpha, reward, state_id]);
    
    res.json({ message: "AI telah menerima arahan manusia!", state: state_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/list', async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.name 
      FROM products p 
      JOIN product_batches b ON p.id = b.product_id 
      WHERE b.current_stock > 0 
      GROUP BY p.id, p.name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API untuk menjalankan komparasi 3 skenario (Research Lab)
// backend/index.js - Update Endpoint Simulasi Komparasi
app.get('/api/simulation/compare', async (req, res) => {
    const { productId } = req.query;
    if (!productId) return res.status(400).json({ error: "Product ID diperlukan" });    
    // Ambil data produk asli dari DB agar harga modal/jual akurat
    const productData = await pool.query(`
        SELECT p.*, b.current_stock 
        FROM products p 
        JOIN product_batches b ON p.id = b.product_id 
        WHERE p.id = $1 LIMIT 1
    `, [productId]);

    if (productData.rows.length === 0) return res.status(404).send("Produk tidak ditemukan");

    const p = productData.rows[0];
    const INITIAL_STOCK = p.current_stock;
    const BASE_PRICE = parseFloat(p.base_price);
    const NORMAL_PRICE = parseFloat(p.normal_price);

    const runScenario = async (type) => {
        let stock = INITIAL_STOCK;
        let totalProfit = 0;
        let history = [];
        const DAYS = 30;

        for (let d = 1; d <= DAYS; d++) {
            let discount = 0;
            // Logika diskon (Statis vs AI) ...
            if (type === 'STATIC') {
                discount = (DAYS - d <= 3) ? 50 : (DAYS - d <= 7 ? 20 : 0);
            } else {
                // Di sini AI akan mengambil keputusan dari q_table berdasarkan state produk ini
                discount = [0, 10, 20, 30, 50][Math.floor(Math.random() * 5)]; // Placeholder logic
            }

            const currentPrice = NORMAL_PRICE * (1 - discount/100);
            let sold = Math.min(stock, Math.max(1, Math.floor(4 + (discount/10))));
            stock -= sold;
            totalProfit += (sold * (currentPrice - BASE_PRICE));

            history.push({ day: d, profit: totalProfit, stock: stock, discount: discount });
            if (stock <= 0) break;
        }
        return { totalProfit, totalWaste: stock, history };
    };

    const staticRes = await runScenario('STATIC');
    const aiRes = await runScenario('AI_ONLY');
    const hitlRes = await runScenario('AI_HITL');

    res.json({ 
        productName: p.name, 
        staticRes, aiRes, hitlRes 
    });
});

// backend/index.js

// API untuk menjalankan simulasi spesifik per produk
app.get('/api/simulation/product/:productId', async (req, res) => {
    const { productId } = req.params;
    
    try {
        // Ambil data produk & batch
        const batchRes = await pool.query(`
            SELECT b.*, p.base_price, p.normal_price, p.name 
            FROM product_batches b 
            JOIN products p ON b.product_id = p.id 
            WHERE p.id = $1 AND b.current_stock > 0
            ORDER BY b.expiry_date ASC LIMIT 1
        `, [productId]);

        if (batchRes.rows.length === 0) return res.status(404).json({ message: "Produk tidak punya stok aktif" });

        const batch = batchRes.rows[0];
        // Panggil fungsi runScenario yang sudah kita buat sebelumnya (dari tahap Research Lab)
        // Sesuaikan dengan data produk yang dinamis ini
        const result = await runScenarioWithData(batch); 

        res.json({
            productName: batch.name,
            results: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LISTEN (Wajib di Paling Bawah) ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend jalan di port ${PORT}`);
});