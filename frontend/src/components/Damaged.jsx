import React, { useState } from "react";
import { 
  AlertTriangle, Wrench, Trash2, Search, X, ShieldAlert, Edit2,
  Calendar, ShoppingCart, User, AlertOctagon, Save, IndianRupee
} from "lucide-react"; 
import { format } from "date-fns";
import axios from "axios";
import { printerService } from "../services/api"; 

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  try {
    const token = JSON.parse(localStorage.getItem("pt_user"))?.token;
    return { headers: { Authorization: `Bearer ${token}` } };
  } catch {
    return {};
  }
};

export default function Damaged({ returns = [], isAdmin, isUser, onRefresh }) {
  
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState(null); // ✅ Track deleting state
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ condition: "Damaged", repairCost: "" });
  const [isSaving, setIsSaving] = useState(false);

  const canManage = isAdmin || isUser;

  const damagedItems = returns.filter((r) => {
    const search = searchTerm.toLowerCase();
    if (r.condition !== "Damaged") return false;
    return (
      (r.serialValue || "").toString().toLowerCase().includes(search) ||
      (r.serialNumberId?.modelId?.name || r.modelName || "").toString().toLowerCase().includes(search) ||
      (r.firmName || "").toString().toLowerCase().includes(search) ||
      (r.customerName || "").toString().toLowerCase().includes(search)
    );
  });

  // ✅ Fixed Delete Handler
  const handleDelete = async (item) => {
    // ✅ Use _id OR id (handle both cases)
    const itemId = item._id || item.id;
    

    if (!itemId) {
      alert("❌ Error: Could not find item ID. Check console for details.");
      console.error("Item has no _id or id:", item);
      return;
    }

    if (!isAdmin) {
      alert("🚫 Access Denied: Only Admins can delete records.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this damaged record?")) {
      try {
        setDeleting(itemId); // ✅ Show loading state
        
        console.log("🗑️ Deleting return with ID:", itemId);
        
        const response = await printerService.deleteReturn(itemId);
        
        console.log("✅ Delete response:", response);
        
        if (onRefresh) {
          await onRefresh(); // ✅ Await refresh
        }
      } catch (error) {
        console.error("❌ Delete failed:", error);
        console.error("❌ Error response:", error.response?.data);
        console.error("❌ Error status:", error.response?.status);
        
        alert(
          `Failed to delete record: ${
            error.response?.data?.message || error.message || "Unknown error"
          }`
        );
      } finally {
        setDeleting(null); // ✅ Reset loading state
      }
    }
  };

  // ✅ Save Edit Handler
  const handleSaveEdit = async () => {
    const itemId = editingItem._id || editingItem.id;
    setIsSaving(true);
    try {
      const payload = { condition: editForm.condition, repairCost: Number(editForm.repairCost) || 0 };
      
      await axios.put(`${API_BASE_URL}/api/returns/${itemId}`, payload, getAuthHeaders());

      if (onRefresh) await onRefresh();
      setEditingItem(null);
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      
      {/* Header Section */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg shadow-md shadow-red-500/25">
                <AlertOctagon size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Attention Required
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Damaged Inventory</h1>
            <p className="text-xs text-slate-500">Items returned as defective or damaged</p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80 group">
            <div className="absolute inset-0 bg-red-500 rounded-xl blur opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                className="w-full border border-slate-200 pl-10 pr-8 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm"
                placeholder="Search damaged items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex items-center gap-4 relative">
          <div className="p-3 bg-white rounded-xl shadow-sm border border-red-100">
            <ShieldAlert size={24} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Total Damaged Units</p>
            <h3 className="text-2xl font-extrabold text-red-700">{damagedItems.length}</h3>
          </div>
        </div>
        
        <div className="relative text-right hidden sm:block">
          <p className="text-[10px] text-red-400 font-medium">Action Needed</p>
          <p className="text-xs text-red-600 font-bold">Repair or Dispose</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Serial No</th>
                <th className="px-5 py-3">Model</th>
                <th className="px-5 py-3">Order Details</th>
                <th className="px-5 py-3 text-right">Return Date</th>
                <th className="px-5 py-3 text-right">Repair Cost</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {damagedItems.map((item) => {
                // ✅ Resolve ID safely
                const itemId = item._id || item.id;
                const isDeleting = deleting === itemId;

                return (
                  <tr 
                    key={itemId} 
                    className={`hover:bg-red-50/30 transition-colors group ${
                      isDeleting ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {/* Serial */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        <span className="font-mono font-bold text-slate-700 text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {item.serialValue || item.serialNumber}
                        </span>
                      </div>
                    </td>

                    {/* Model */}
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {item.serialNumberId?.modelId?.name || item.modelName || "Unknown"}
                      </span>
                    </td>

                    {/* Order Details */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <ShoppingCart size={10} />
                          <span className="font-medium text-slate-700">{item.firmName || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <User size={10} />
                          <span className="font-mono">{item.customerName || "N/A"}</span>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                        <Calendar size={12} />
                        {item.returnDate ? format(new Date(item.returnDate), "dd MMM yyyy") : "-"}
                      </div>
                    </td>

                    {/* Repair Cost */}
                    <td className="px-5 py-4 text-right font-bold text-slate-700">
                      {item.repairCost > 0 ? `₹${item.repairCost.toLocaleString()}` : "-"}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-red-100 shadow-sm">
                        <Wrench size={12} /> Needs Repair
                      </span>
                    </td>
                    
                    {/* ✅ Fixed Action - Pass entire item object */}
                    <td className="px-5 py-4 text-center">
                  {canManage ? (
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setEditForm({ condition: item.condition || "Damaged", repairCost: item.repairCost || "" });
                            }}
                            disabled={isDeleting}
                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all opacity-60 group-hover:opacity-100"
                            title="Edit Record"
                          >
                            <Edit2 size={16} />
                          </button>
                    {isAdmin && <button 
                          onClick={() => handleDelete(item)}
                          disabled={isDeleting}
                          className={`p-2 rounded-xl transition-all opacity-60 group-hover:opacity-100 ${
                            isDeleting 
                              ? "text-slate-300 cursor-not-allowed" 
                              : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                          }`}
                          title="Delete Record"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                    </button>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {damagedItems.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle size={32} className="text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-emerald-600">No Damaged Items Found</p>
                      <p className="text-xs text-slate-400">
                        {searchTerm ? "Try a different search term" : "Your inventory is in good health! ✅"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Repair Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" /> Repair Details
              </h3>
              <button onClick={() => setEditingItem(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={16}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Condition</label>
                <select 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  value={editForm.condition}
                  onChange={(e) => setEditForm({...editForm, condition: e.target.value})}
                >
                  <option value="Damaged">Damaged (Needs Repair)</option>
                  <option value="Repaired">Repaired (Move to Active Stock)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Repair Cost (₹)</label>
                <div className="relative">
                  <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="number" className="w-full border border-slate-200 pl-8 pr-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" value={editForm.repairCost} onChange={(e) => setEditForm({...editForm, repairCost: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingItem(null)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSaving} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}