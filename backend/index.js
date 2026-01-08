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

// --- LISTEN (Wajib di Paling Bawah) ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend jalan di port ${PORT}`);
});