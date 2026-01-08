// Tambahkan parameter averageSales di fungsi utama
const calculateState = (expiryDays, stock, expectedDailySales, isWeekend, averageSales = 2) => {
    // 1. E (Remaining Shelf Life) - Tetap sama
    let E;
    if (expiryDays <= 2) E = 1;
    else if (expiryDays <= 5) E = 2;
    else E = 3;

    // 2. I (Inventory Pressure) - Tetap sama
    const pressure = stock / (expectedDailySales * expiryDays);
    let I;
    if (pressure <= 0.5) I = 1;
    else if (pressure <= 1.0) I = 2;
    else I = 3;

    // 3. Menentukan V (Sales Velocity Trend) - SEKARANG DINAMIS
    // averageSales adalah rasio perbandingan (misal: Penjualan 3 hari terakhir / 3 hari sebelumnya)
    let V;
    if (averageSales < 0.8) V = 1;      // V↓ (Menurun)
    else if (averageSales <= 1.2) V = 2; // V→ (Stabil)
    else V = 3;                         // V↑ (Meningkat)

    let T = isWeekend ? 1 : 0;
    return `E${E}-I${I}-V${V}-T${T}`;
};

module.exports = { calculateState };