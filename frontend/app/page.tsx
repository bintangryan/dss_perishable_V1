"use client"
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// 1. Definisikan Struktur Data (Menghilangkan Error "any")
interface QValues {
  [key: string]: number | string; // Untuk state_id dan a_0, a_10, dst
}

interface RecommendData {
  product: string;
  current_state: string;
  recommendation: string;
  q_values: QValues;
}

export default function Dashboard() {
  const [data, setData] = useState<RecommendData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 2. Gunakan useCallback agar fungsi tidak dibuat ulang setiap render
  const fetchRecommend = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/recommend/1');
      setData(res.data);
    } catch (err) {
      console.error("Backend Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. useEffect sekarang aman
  useEffect(() => {
    fetchRecommend();
  }, [fetchRecommend]);

  const sendFeedback = async (type: string, custom: string | null = null) => {
    if (!data) return;
    try {
      await axios.post('http://localhost:5000/api/feedback', {
        state_id: data.current_state,
        action_taken: data.recommendation.replace('%', ''),
        feedback_type: type,
        custom_discount: custom
      });
      alert("AI telah belajar!");
      fetchRecommend();
    } catch (err) {
      alert("Gagal kirim feedback");
    }
  };

  if (loading) return <div className="p-10 text-center font-mono">Loading AI Brain...</div>;
  if (!data) return <div className="p-10 text-center">Data tidak ditemukan. Pastikan Backend & DB jalan.</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-extrabold text-slate-800">AI Decision Support System</h1>
          <p className="text-slate-500">Rekomendasi Diskon Adaptif - Produk Perishable</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* KARTU REKOMENDASI */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
            <h2 className="text-2xl font-bold mb-1">{data.product}</h2>
            <div className="mb-4">
               <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                  STATE ID: {data.current_state}
                </span>
            </div>

            <div className="my-8 py-8 bg-blue-50 rounded-2xl text-center border-2 border-dashed border-blue-200">
              <p className="text-sm text-blue-600 font-semibold uppercase tracking-wider">Rekomendasi Diskon AI</p>
              <p className="text-6xl font-black text-blue-700">{data.recommendation}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-700">Human-in-the-Loop Feedback:</p>
              <div className="flex gap-3">
                <button onClick={() => sendFeedback('APPROVE')} className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all">Approve</button>
                <button onClick={() => sendFeedback('REJECT')} className="flex-1 bg-white border-2 border-slate-900 text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-50">Reject</button>
              </div>
            </div>
          </div>

          {/* VISUALISASI Q-TABLE */}
          <div className="bg-slate-900 rounded-2xl shadow-xl p-6 text-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              Q-Table Analysis
            </h3>
            <div className="space-y-4">
              {['a_0', 'a_10', 'a_20', 'a_30', 'a_50'].map((actionKey) => {
                const val = data.q_values[actionKey] as number;
                return (
                  <div key={actionKey}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="uppercase font-mono">Action {actionKey.replace('a_', '')}%</span>
                      <span className={val >= 0 ? 'text-blue-400' : 'text-red-400'}>{val.toFixed(4)}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${val >= 0 ? 'bg-blue-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.min(Math.max(Math.abs(val) * 5, 5), 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}