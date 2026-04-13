import React, { useState, useEffect } from "react";
import { printerService } from "../services/api";
import { Tag, History, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Pricing({ models = [], onRefresh, isAdmin }) {
  const [pricingHistory, setPricingHistory] = useState([]);
  
  // Todays's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    modelId: "",
    price: "",
    purchaseDate: today,
  });

  useEffect(() => {
    loadPricings();
  }, []);

  const loadPricings = async () => {
    const data = await printerService.getPricings();
    setPricingHistory(data);
  };

  // ✅ Main Logic: Auto-fill price on model change
  const handleModelChange = (modelId) => {
    const latestEntry = pricingHistory.find(
      p => p.modelId?._id === modelId
    );
    
    setForm({
      ...form,
      modelId: modelId,
      price: latestEntry ? latestEntry.price : "" // Fill if found, else empty
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.modelId || !form.price || !form.purchaseDate) {
      alert("Please fill all fields.");
      return;
    }

    try {
      await printerService.addPricing(form);
      setForm({ modelId: "", price: "", purchaseDate: today });
      loadPricings();
      if(onRefresh) onRefresh();
    } catch (error) {
      alert("Failed to add price.");
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) { alert("Access Denied."); return; }
    if (window.confirm("Delete this price record?")) {
      await printerService.deletePricing(id);
      loadPricings();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Model Pricing</h2>
        <p className="text-sm text-slate-500">Track purchase prices of models over time.</p>
      </div>

      {/* Add Price Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Tag size={16} className="text-indigo-600" /> Add/Update Purchase Price
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            {/* Model Select */}
            <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500">Model</label>
                <select 
                    className="w-full border p-2 rounded-lg mt-1 bg-slate-50 focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={form.modelId}
                    onChange={(e) => handleModelChange(e.target.value)}
                    required
                >
                    <option value="">Select a Model...</option>
                    {models.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
            </div>

            {/* Price Input */}
            <div>
                <label className="text-xs font-semibold text-slate-500">Price (INR)</label>
                <input 
                    type="number" 
                    className="w-full border p-2 rounded-lg mt-1 bg-slate-50 focus:ring-2 focus:ring-indigo-200 outline-none"
                    placeholder="e.g. 8500"
                    value={form.price}
                    onChange={(e) => setForm({...form, price: e.target.value})}
                    required
                />
            </div>
            
            {/* Date Input */}
            <div>
                <label className="text-xs font-semibold text-slate-500">Purchase Date</label>
                <input 
                    type="date"
                    className="w-full border p-2 rounded-lg mt-1 bg-slate-50 focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({...form, purchaseDate: e.target.value})}
                    required
                />
            </div>
            
            <button className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
                <Plus size={16} /> Save Entry
            </button>
        </form>
      </div>

      {/* Pricing History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2 bg-slate-50">
            <History size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-700">Pricing History</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-slate-500 text-xs uppercase border-b">
            <tr>
              <th className="p-4">Model</th>
              <th className="p-4">Price</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pricingHistory.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-700">{p.modelId?.name || "Deleted Model"}</td>
                <td className="p-4 font-bold text-emerald-600">₹ {p.price.toLocaleString('en-IN')}</td>
                <td className="p-4 text-slate-500">{format(new Date(p.purchaseDate), 'dd MMM yyyy')}</td>
                <td className="p-4 text-center">
                  {isAdmin && <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50"><Trash2 size={16} /></button>}
                </td>
              </tr>
            ))}
            {pricingHistory.length === 0 && (<tr><td colSpan="4" className="p-8 text-center text-slate-400">No pricing data found.</td></tr>)}
          </tbody>
        </table>
      </div>

    </div>
  );
}