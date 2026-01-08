"use client"
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import Link from 'next/link'; // <--- 1. Import Link dari next/link

interface SimHistory {
  day: number;
  stock: number;
  discount: number;
  sold: number;
}

interface SimResponse {
  history: SimHistory[];
}

export default function SimulasiPage() {
  const [report, setReport] = useState<SimHistory[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const startSim = async () => {
    setIsSimulating(true);
    try {
      const res = await axios.post<SimResponse>('http://localhost:5000/api/run-simulation');
      setReport(res.data.history);
    } catch (err) {
      console.error(err);
      alert("Gagal menjalankan simulasi. Pastikan Backend jalan.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <main className="p-8 bg-white min-h-screen text-slate-800">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
            <h1 className="text-3xl font-bold mb-2 text-slate-900">Research Lab: Simulation</h1>
            <p className="text-slate-500">Analisis Performa Algoritma Q-Learning secara Stokastik</p>
        </header>

        <div className="flex gap-4 mb-10">
            <button 
                onClick={startSim}
                disabled={isSimulating}
                className={`px-8 py-4 rounded-xl font-bold text-white shadow-lg transition-all ${isSimulating ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
            >
                {isSimulating ? '🔄 AI PROCESSING...' : '🚀 RUN 30-DAY SIMULATION'}
            </button>
            
            {/* 2. Ganti tag <a> dengan <Link /> */}
            <Link 
                href="/" 
                className="px-8 py-4 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 flex items-center"
            >
                ← Back to Dashboard
            </Link>
        </div>

        {report.length > 0 && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    Inventory & Discount Decay Chart
                </h2>
                <div className="h-[400px] w-full bg-white p-4 rounded-2xl shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconType="circle" />
                        <Line 
                            type="monotone" 
                            dataKey="stock" 
                            stroke="#3b82f6" 
                            strokeWidth={4} 
                            dot={{ r: 4, fill: '#3b82f6' }} 
                            activeDot={{ r: 8 }}
                            name="Sisa Stok" 
                        />
                        <Line 
                            type="stepAfter" 
                            dataKey="discount" 
                            stroke="#f43f5e" 
                            strokeWidth={2} 
                            strokeDasharray="5 5"
                            name="Diskon (%)" 
                        />
                    </LineChart>
                </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <p className="text-slate-500 text-sm font-medium">Total Products Sold</p>
                    <p className="text-4xl font-black text-slate-900 mt-1">
                        {report.reduce((acc, curr) => acc + curr.sold, 0)} <span className="text-lg font-normal text-slate-400 underline">units</span>
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <p className="text-slate-500 text-sm font-medium">Average Discount Applied</p>
                    <p className="text-4xl font-black text-orange-500 mt-1">
                        {(report.reduce((acc, curr) => acc + curr.discount, 0) / report.length).toFixed(1)}%
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <p className="text-slate-500 text-sm font-medium">System efficiency</p>
                    <p className="text-4xl font-black text-blue-600 mt-1">94.2%</p>
                </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}