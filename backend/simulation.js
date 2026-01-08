const pool = require('./db');
const { calculateState } = require('./stateMapper');

const ALPHA = 0.2;
const GAMMA = 0.9;
const ACTIONS = [0, 10, 20, 30, 50];

async function runSim() {
    console.log("🚀 MEMULAI SIMULASI PELATIHAN AI (30 HARI)");
    
    // Ambil data segar dari DB
    const batchRes = await pool.query('SELECT * FROM product_batches WHERE id = 1');
    if (batchRes.rows.length === 0) return console.log("❌ Data batch tidak ditemukan.");
    
    // Gunakan let untuk variabel yang akan berubah selama simulasi
    let currentStock = batchRes.rows[0].current_stock;
    const expiryDate = new Date(batchRes.rows[0].expiry_date);
    const productId = batchRes.rows[0].id;

    for (let day = 1; day <= 30; day++) {
        // A. HITUNG STATE SAAT INI
        const today = new Date();
        // Simulasi hari yang berjalan (menambah 'day' ke hari ini)
        const simDate = new Date(today);
        simDate.setDate(simDate.getDate() + (day - 1));
        
        const daysLeft = Math.ceil((expiryDate - simDate) / (1000 * 60 * 60 * 24));
        const state = calculateState(daysLeft, currentStock, 5, false);

        // B. AI MEMILIH AKSI (Epsilon-Greedy Sederhana: 90% Best, 10% Random)
        let qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [state]);
        if (qRow.rows.length === 0) {
            await pool.query('INSERT INTO q_table (state_id) VALUES ($1)', [state]);
            qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [state]);
        }
        
        const qValues = qRow.rows[0];
        let bestAction = 0;
        
        // Logika Epsilon-Greedy agar AI mau mencoba hal baru (Exploration)
        if (Math.random() < 0.1) {
            bestAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
        } else {
            let maxQ = -Infinity;
            ACTIONS.forEach(a => {
                if (qValues[`a_${a}`] > maxQ) {
                    maxQ = qValues[`a_${a}`];
                    bestAction = a;
                }
            });
        }

        // C. SIMULASI PASAR
        let baseDemand = 3; 
        let bonusDemand = Math.floor(bestAction / 10); 
        let sold = Math.min(currentStock, baseDemand + bonusDemand);
        currentStock -= sold;

        // D. HITUNG REWARD
        let reward = 0;
        if (sold > 0) reward += 5; // Reward per penjualan
        
        if (daysLeft <= 0 && currentStock > 0) {
            reward -= 100; // Penalti Waste
            currentStock = 0; 
        } else if (currentStock === 0 && daysLeft >= 0) {
            reward += 50; // Bonus Habis
        }

        // E. UPDATE Q-TABLE (Bellman Equation)
        const nextDaysLeft = daysLeft - 1;
        const nextState = calculateState(nextDaysLeft, currentStock, 5, false);
        
        // Pastikan nextState ada di DB agar bisa diambil Max Q-nya
        let nextQRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [nextState]);
        if (nextQRow.rows.length === 0) {
            await pool.query('INSERT INTO q_table (state_id) VALUES ($1)', [nextState]);
            nextQRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [nextState]);
        }
        
        const nQ = nextQRow.rows[0];
        const maxNextQ = Math.max(nQ.a_0, nQ.a_10, nQ.a_20, nQ.a_30, nQ.a_50);

        // Rumus Q-Learning Utuh
        const currentQ = qValues[`a_${bestAction}`];
        const newQ = currentQ + ALPHA * (reward + (GAMMA * maxNextQ) - currentQ);

        await pool.query(`UPDATE q_table SET a_${bestAction} = $1 WHERE state_id = $2`, [newQ, state]);

        console.log(`Hari ${day} | State: ${state} | Action: ${bestAction}% | Sold: ${sold} | Stock: ${currentStock}`);
        
        if (currentStock <= 0) break;
    }
    console.log("--- SIMULASI SELESAI ---");
}

runSim();