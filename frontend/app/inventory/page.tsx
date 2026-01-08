"use client"
import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

export default function InventoryPage() {
  const [form, setForm] = useState({
    name: '', base_price: '', normal_price: '', category: 'Food', stock: '', expiry_date: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/inventory', form);
      alert("Produk Berhasil Ditambahkan!");
      setForm({ name: '', base_price: '', normal_price: '', category: 'Food', stock: '', expiry_date: '' });
    } catch (err) {
      alert("Gagal menambah produk");
    }
  };

  return (
    <main className="p-8 bg-slate-50 min-h-screen text-slate-800">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold">Input Master Inventory</h1>
            <Link href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Produk</label>
            <input type="text" required className="w-full border p-2 rounded-lg" 
              value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Contoh: Susu Ultra 1L" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Harga Modal (Rp)</label>
              <input type="number" required className="w-full border p-2 rounded-lg" 
                value={form.base_price} onChange={e => setForm({...form, base_price: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Harga Jual (Rp)</label>
              <input type="number" required className="w-full border p-2 rounded-lg" 
                value={form.normal_price} onChange={e => setForm({...form, normal_price: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Jumlah Stok</label>
              <input type="number" required className="w-full border p-2 rounded-lg" 
                value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Expired</label>
              <input type="date" required className="w-full border p-2 rounded-lg" 
                value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
            Simpan ke Database
          </button>
        </form>
      </div>
    </main>
  );
}