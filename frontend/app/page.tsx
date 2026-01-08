"use client"
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface QValues {
  [key: string]: number | string;
}

interface ProductBatch {
  id: number;
  product_name: string;
  current_state: string;
  recommendation: string;
  q_values: QValues;
  current_stock: number;
  days_left: number;
}

export default function Dashboard() {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // State untuk menyimpan input diskon manual per batch ID
  const [customInputs, setCustomInputs] = useState<{ [key: number]: string }>({});

  const fetchAllRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:5000/api/recommend/all');
      setBatches(res.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllRecommendations();
  }, [fetchAllRecommendations]);

  const sendFeedback = async (batchId: number, stateId: string, currentRec: string, type: string) => {
    try {
      const payload: any = {
        state_id: stateId,
        action_taken: currentRec.replace('%', ''),
        feedback_type: type
      };

      // Jika user menolak (REJECT) dan mengisi input manual, kirim sebagai koreksi
      if (type === 'REJECT' && customInputs[batchId]) {
        payload.custom_discount = customInputs[batchId];
      }

      await axios.post('http://localhost:5000/api/feedback', payload);
      alert(type === 'APPROVE' ? "Rekomendasi disetujui!" : "AI telah menerima koreksi manual!");
      
      // Reset input field setelah berhasil
      setCustomInputs(prev => ({ ...prev, [batchId]: '' }));
      fetchAllRecommendations();
    } catch (err) {
      alert("Gagal mengirim feedback ke AI");
    }
  };

  if (loading) return <div className="p-10 text-center font-mono">Loading Intelligence Data...</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">DSS INVENTORY</h1>
            <p className="text-slate-500 font-medium">Adaptive Discount Recommendation Engine</p>
          </div>
          <div className="flex gap-3">
            <Link href="/inventory" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
              + Tambah Barang
            </Link>
            <Link href="/simulasi" className="bg-white border-2 border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all">
              Simulasi AI
            </Link>
          </div>
        </header>

        {batches.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400">Belum ada data barang aktif.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map((batch) => (
              <div key={batch.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{batch.product_name}</h3>
                      <p className="text-xs font-mono text-slate-400">STATE: {batch.current_state}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${batch.days_left <= 2 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {batch.days_left} Hari Lagi
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 text-center mb-6 border border-slate-50">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Rekomendasi AI</p>
                    <p className="text-5xl font-black text-blue-600">{batch.recommendation}</p>
                    <p className="text-xs text-slate-400 mt-2">Stok: {batch.current_stock} unit</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => sendFeedback(batch.id, batch.current_state, batch.recommendation, 'APPROVE')}
                        className="flex-1 bg-slate-900 text-white text-xs font-bold py-3 rounded-xl hover:opacity-90 transition-all"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => sendFeedback(batch.id, batch.current_state, batch.recommendation, 'REJECT')}
                        className="flex-1 border-2 border-slate-900 text-slate-900 text-xs font-bold py-3 rounded-xl hover:bg-slate-50 transition-all"
                      >
                        Reject
                      </button>
                    </div>

                    {/* Input Koreksi Manual */}
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="Koreksi Diskon (%)"
                        value={customInputs[batch.id] || ''}
                        onChange={(e) => setCustomInputs({...customInputs, [batch.id]: e.target.value})}
                        className="w-full bg-slate-100 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <p className="text-[9px] text-slate-400 mt-1 italic">
                        *Isi persen diskon baru lalu klik Reject untuk melatih AI.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Visualisasi Q-Table (Internal AI Logic) */}
                <div className="bg-slate-900 p-4 flex justify-between items-end h-20">
                  {['a_0', 'a_10', 'a_20', 'a_30', 'a_50'].map(a => {
                    const val = Number(batch.q_values[a]);
                    // Normalisasi tinggi bar untuk visualisasi (minimal 5%, maksimal 100%)
                    const barHeight = Math.min(Math.max(val * 2, 5), 100);
                    
                    return (
                      <div key={a} className="flex flex-col items-center flex-1">
                        <div className="w-2 bg-slate-800 rounded-full h-12 relative overflow-hidden mb-1">
                          <div 
                            className={`absolute bottom-0 w-full transition-all duration-500 ${val > 0 ? 'bg-blue-400' : 'bg-red-400'}`} 
                            style={{ height: `${Math.abs(barHeight)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-slate-500 font-mono">{a.replace('a_', '')}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}