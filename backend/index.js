const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { calculateState } = require('./stateMapper'); // Pindahkan ke atas
require('dotenv').config();

const app = express();

// Konfigurasi Middlewares
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// --- ROUTES ---

// 1. Cek koneksi DB
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'Koneksi Sukses!', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. API Rekomendasi
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

// 3. API Feedback (HITL)
app.post('/api/feedback', async (req, res) => {
    try {
        const { state_id, action_taken, feedback_type, custom_discount } = req.body;
        const alpha = 0.2;
        let reward = 0;

        if (feedback_type === 'APPROVE') reward = 10;
        else if (feedback_type === 'REJECT') reward = -5;

        if (custom_discount) {
            const finalAction = `a_${custom_discount}`;
            await pool.query(
                `UPDATE q_table SET ${finalAction} = ${finalAction} + $1 WHERE state_id = $2`,
                [15, state_id] 
            );
        }

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

// 4. API Simulasi
app.post('/api/run-simulation', async (req, res) => {
    try {
        let stock = 50;
        let history = [];
        const expiryDays = 10;

        for (let d = 1; d <= 15; d++) {
            const daysLeft = expiryDays - d;
            let discount = daysLeft < 3 ? 50 : (daysLeft < 6 ? 20 : 0);
            let sold = Math.min(stock, Math.floor(Math.random() * 5) + (discount/10));
            stock -= sold;
            history.push({ day: d, stock, discount, sold });
            if (stock <= 0) break;
        }
        res.json({ history });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- LISTEN (Harus Paling Bawah) ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend jalan di port ${PORT}`);
});