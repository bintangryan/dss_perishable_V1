const pool = require('./db');
const { calculateState } = require('./stateMapper');

const ALPHA = 0.2;
const GAMMA = 0.9;
const ACTIONS = [0, 10, 20, 30, 50];

// Mengambil Product ID dari argument terminal (contoh: node simulation.js 1)
const targetProductId = process.argv[2] || 1; 

async function runSim(productId) {
    console.log(`🚀 MEMULAI SIMULASI PRODUK ID: ${productId}`);
    
    // 1. Ambil data batch terbaru untuk produk terpilih
    const query = `
        SELECT b.*, p.base_price, p.normal_price, p.name 
        FROM product_batches b 
        JOIN products p ON b.product_id = p.id 
        WHERE p.id = $1 AND b.current_stock > 0
        ORDER BY b.expiry_date ASC LIMIT 1
    `;
    const batchRes = await pool.query(query, [productId]);
    
    if (batchRes.rows.length === 0) {
        return console.log(`❌ Tidak ada batch aktif untuk Produk ID ${productId}`);
    }
    
    const batch = batchRes.rows[0];
    console.log(`📦 Mensimulasikan: ${batch.name} | Stok: ${batch.current_stock}`);

    let currentStock = batch.current_stock;
    const expiryDate = new Date(batch.expiry_date);
    const basePrice = parseFloat(batch.base_price);
    const normalPrice = parseFloat(batch.normal_price);

    for (let day = 1; day <= 30; day++) {
        const today = new Date();
        const simDate = new Date(today);
        simDate.setDate(simDate.getDate() + (day - 1));
        
        const daysLeft = Math.ceil((expiryDate - simDate) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) break;

        // Simulasi Tren Penjualan (V) - dinamis berdasarkan hari simulasi
        const mockSalesTrend = (day > 5 && day < 10) ? 0.7 : 1.1; 
        const state = calculateState(daysLeft, currentStock, 5, simDate.getDay() % 6 === 0, mockSalesTrend);

        // A. AI PILIH AKSI
        let qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [state]);
        if (qRow.rows.length === 0) {
            await pool.query('INSERT INTO q_table (state_id) VALUES ($1)', [state]);
            qRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [state]);
        }
        
        const qValues = qRow.rows[0];
        let bestAction = (Math.random() < 0.1) 
            ? ACTIONS[Math.floor(Math.random() * ACTIONS.length)] 
            : ACTIONS.reduce((a, b) => qValues[`a_${a}`] > qValues[`a_${b}`] ? a : b);

        // B. SIMULASI PASAR (Stokastik)
        const currentPrice = normalPrice * (1 - bestAction/100);
        let baseDemand = 4;
        let boost = Math.floor(bestAction / 10) * 1.5; 
        let noise = Math.floor(Math.random() * 3) - 1; 
        
        let sold = Math.min(currentStock, Math.max(0, Math.floor((baseDemand + boost) * mockSalesTrend) + noise));
        currentStock -= sold;

        // C. HITUNG REWARD
        let profitToday = sold * (currentPrice - basePrice);
        let reward = profitToday;

        if (daysLeft === 0 && currentStock > 0) {
            let loss = currentStock * basePrice; 
            reward -= loss; 
            console.log(`💀 WASTE! Rugi: -Rp${loss}`);
        }

        // D. UPDATE Q-TABLE
        const nextState = calculateState(daysLeft - 1, currentStock, 5, false, 1.0);
        let nextQRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [nextState]);
        if (nextQRow.rows.length === 0) {
            await pool.query('INSERT INTO q_table (state_id) VALUES ($1)', [nextState]);
            nextQRow = await pool.query('SELECT * FROM q_table WHERE state_id = $1', [nextState]);
        }
        
        const nQ = nextQRow.rows[0];
        const maxNextQ = Math.max(nQ.a_0, nQ.a_10, nQ.a_20, nQ.a_30, nQ.a_50);
        const newQ = qValues[`a_${bestAction}`] + ALPHA * (reward + (GAMMA * maxNextQ) - qValues[`a_${bestAction}`]);

        await pool.query(`UPDATE q_table SET a_${bestAction} = $1 WHERE state_id = $2`, [newQ, state]);

        console.log(`Hari ${day} | Diskon: ${bestAction}% | Laku: ${sold} | Stok: ${currentStock} | Reward: ${reward.toFixed(0)}`);
        
        if (currentStock <= 0) {
            console.log("✅ Stok Habis!");
            break;
        }
    }
    console.log(`--- SIMULASI PRODUK ${batch.name} SELESAI ---`);
}

// Jalankan simulasi berdasarkan ID yang diberikan
runSim(targetProductId);