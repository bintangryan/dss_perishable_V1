/**
 * stateMapper.js
 * Fungsi untuk mengonversi data operasional menjadi State Diskrit untuk Q-Learning
 */

const calculateState = (expiryDays, stock, expectedDailySales, isWeekend) => {
    // 1. Menentukan E (Remaining Shelf Life)
    let E;
    if (expiryDays <= 2) E = 1;      // Sangat dekat expired
    else if (expiryDays <= 5) E = 2; // Dekat expired
    else E = 3;                      // Aman

    // 2. Menentukan I (Inventory Pressure)
    // Rumus: Stok / (Ekspektasi Penjualan Harian * Sisa Hari)
    const pressure = stock / (expectedDailySales * expiryDays);
    let I;
    if (pressure <= 0.5) I = 1;      // Rendah (stok pasti habis)
    else if (pressure <= 1.0) I = 2; // Sedang
    else I = 3;                      // Tinggi (risiko waste besar)

    // 3. Menentukan V (Sales Velocity Trend) 
    // Untuk awal kita set static 2 (Stabil), nanti bisa ditarik dari DB sales_logs
    let V = 2; 

    // 4. Menentukan T (Temporal Context)
    let T = isWeekend ? 1 : 0;

    // Menggabungkan jadi ID State
    return `E${E}-I${I}-V${V}-T${T}`;
};

module.exports = { calculateState };