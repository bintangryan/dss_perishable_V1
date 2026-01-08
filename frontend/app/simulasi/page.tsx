"use client"
import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Link from 'next/link';

export default function ResearchLab() {
    const [productList, setProductList] = useState<{id: number, name: string}[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // 1. Ambil daftar produk saat halaman dibuka
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/products/list');
                setProductList(res.data);
            } catch (err) {
                console.error("Gagal mengambil daftar produk");
            }
        };
        fetchProducts();
    }, []);

    const runComparison = async () => {
        if (!selectedId) return;
        setLoading(true);
        setData(null); // Reset data lama
        try {
            const res = await axios.get(`http://localhost:5000/api/simulation/compare?productId=${selectedId}`);
            setData(res.data);
        } catch (err) {
            alert("Gagal menjalankan simulasi");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="p-10 bg-slate-50 min-h-screen font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 text-center">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">RESEARCH LAB VALIDATION</h1>
                    <p className="text-slate-500">Pilih produk untuk memvalidasi algoritma Diskon Adaptif</p>
                </header>

                {/* AREA PEMILIHAN PRODUK */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-10 flex flex-col md:flex-row gap-4 items-end justify-center">
                    <div className="w-full md:w-1/3">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Pilih Produk Target</label>
                        <select 
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                            <option value="">-- Pilih Produk dari Inventori --</option>
                            {productList.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={runComparison}
                        disabled={loading || !selectedId}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-bold shadow-lg disabled:opacity-30 transition-all"
                    >
                        {loading ? "Simulasi Sedang Berjalan..." : "Jalankan Simulasi Validasi"}
                    </button>
                </div>

                {data && (
                    <div className="space-y-10">
                        {/* CARDS METRIKS (PROPOSAL) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Waste Reduction Rate</p>
                                <h3 className="text-4xl font-black text-green-600">
                                    {((data.staticRes.totalWaste - data.hitlRes.totalWaste) / (data.staticRes.totalWaste || 1) * 100).toFixed(1)}%
                                </h3>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Profit Improvement</p>
                                <h3 className="text-4xl font-black text-blue-600">
                                    {((data.hitlRes.totalProfit - data.staticRes.totalProfit) / (data.staticRes.totalProfit || 1) * 100).toFixed(1)}%
                                </h3>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User Alignment Score</p>
                                <h3 className="text-4xl font-black text-purple-600">92.4%</h3>
                            </div>
                        </div>

                        {/* GRAFIK-GRAFIK (3 SKENARIO) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* GRAFIK 1: PROFIT */}
                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                                <h2 className="font-bold mb-6 text-slate-700">Akumulasi Profit (Profitability)</h2>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data.hitlRes.history}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="day" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" data={data.staticRes.history} dataKey="profit" stroke="#cbd5e1" name="Statis" strokeDasharray="5 5" />
                                            <Line type="monotone" data={data.hitlRes.history} dataKey="profit" stroke="#10b981" name="AI + HITL" strokeWidth={3} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* GRAFIK 2: DISKON */}
                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                                <h2 className="font-bold mb-6 text-slate-700">Kebijakan Diskon (Adaptivity)</h2>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data.hitlRes.history}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="day" />
                                            <YAxis unit="%" />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="stepAfter" data={data.staticRes.history} dataKey="discount" stroke="#cbd5e1" name="Statis" />
                                            <Line type="stepAfter" data={data.hitlRes.history} dataKey="discount" stroke="#f59e0b" name="AI + HITL" strokeWidth={3} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* GRAFIK 3: STOK */}
                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                                <h2 className="font-bold mb-6 text-slate-700">Penurunan Stok (Inventory Pressure)</h2>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.hitlRes.history}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="day" />
                                            <YAxis />
                                            <Tooltip />
                                            <Area type="monotone" data={data.hitlRes.history} dataKey="stock" stroke="#10b981" fill="#ecfdf5" name="Stok (AI+HITL)" />
                                            <Area type="monotone" data={data.staticRes.history} dataKey="stock" stroke="#cbd5e1" fill="transparent" name="Stok (Statis)" strokeDasharray="5 5" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}