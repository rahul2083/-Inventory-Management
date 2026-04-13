import React, { useState, useEffect, useRef } from "react";
import { printerService } from "../services/api";
import { 
  RotateCcw, History, Trash2, CheckCircle2, AlertTriangle, 
  Search, ScanLine, Box, Calendar, User, ShoppingCart, Zap, X,
  AlertCircle
} from "lucide-react"; 
import { format } from "date-fns";
import axios from "axios";

export default function Returns({ onRefresh, isAdmin, isSupervisor, currentUser }) {
  const [serialInput, setSerialInput] = useState("");
  const [returnsList, setReturnsList] = useState([]);
  const [allSerials, setAllSerials] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [pendingSerial, setPendingSerial] = useState("");
  const [condition, setCondition] = useState("InStock");

  const inputRef = useRef(null);

  useEffect(() => {
    loadData();
    if(inputRef.current) inputRef.current.focus();
  }, []);

  const loadData = async () => {
    const [rData, sData] = await Promise.all([
      printerService.getReturns(),
      printerService.getSerials() 
    ]);
    
    const inStockItems = rData.filter(item => item.condition !== "Damaged");
    setReturnsList(inStockItems);
    setAllSerials(sData);
  };

  const filteredReturns = returnsList.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
        item.serialValue.toLowerCase().includes(search) ||
        (item.serialNumberId?.modelId?.name || "").toLowerCase().includes(search) ||
        (item.firmName || "").toLowerCase().includes(search) ||
        (item.customerName || "").toLowerCase().includes(search)
    );
  });

  const initiateReturn = (value) => {
    const serialVal = value.trim().toUpperCase();

    // 1. Find the serial in our master list
    const serialRecord = allSerials.find(s => s.value.toUpperCase() === serialVal);

    if (!serialRecord) {
      setMessage({ type: "error", text: `❌ Serial ${serialVal} not found in system!` });
      setSerialInput("");
      return;
    }

    // Check if status is explicitly Available or Damaged
    if (serialRecord.status === "Available" || serialRecord.status === "Damaged") {
      let errorMsg = serialRecord.status === "Available" 
        ? `⚠️ Item is already In Stock (Available).` 
        : `⚠️ Item is already marked Damaged.`;

      setMessage({ type: "error", text: errorMsg });
      setSerialInput("");
      return;
    }

    // Valid -> Open Modal
    setPendingSerial(serialVal);
    setCondition("InStock");
    setShowConditionModal(true);
    setMessage({ type: "", text: "" }); 
  };

  const confirmReturn = async () => {
    setShowConditionModal(false);
    if(loading) return; 
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Direct axios call ensures 'returnedBy' is sent securely to the backend
      const response = await axios.post("http://localhost:5000/api/returns", {
        serialValue: pendingSerial,
        condition: condition,
        returnedBy: currentUser?.username || "Admin"
      });
      const result = response.data;
      const statusText = result.condition === "Damaged" ? "moved to Damaged Tab" : "restocked";
      
      setMessage({ 
        type: "success", 
        text: `✅ Success! ${result.serialValue} marked as ${result.condition}. ${statusText}.` 
      });
      
      setSerialInput("");
      loadData(); 
      if(onRefresh) onRefresh(); 
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: error.response?.data?.message || "❌ Failed to return item." 
      });
    } finally {
      setLoading(false);
      setTimeout(() => { if(inputRef.current) inputRef.current.focus(); }, 100);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) { alert("🚫 Access Denied: Admin Only."); return; }
    if (window.confirm("Delete record?")) {
      try { await printerService.deleteReturn(id); loadData(); } 
      catch (error) { alert("Failed to delete"); }
    }
  };

  const handleChange = (e) => {
    const val = e.target.value.toUpperCase();
    setSerialInput(val);
    
    if (val.length >= 10) { 
        setTimeout(() => initiateReturn(val), 300);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      initiateReturn(serialInput);
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      
      {/* Header Section */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-md shadow-orange-500/25">
                <RotateCcw size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                Returns Processing
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Returns Management</h1>
            <p className="text-xs text-slate-500">Scan serials to process customer returns</p>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${!isSupervisor ? 'lg:grid-cols-3' : ''} gap-6`}>
        
        {/* Scan Section */}
        {!isSupervisor && <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <ScanLine size={18} />
              <h3 className="font-bold text-sm">Process Return</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1 rounded-lg text-[10px] font-medium">
              <Zap size={10} /> Auto-Scan Ready
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col justify-center">
            <div className="relative mb-4">
              <ScanLine size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                ref={inputRef} 
                className="w-full border-2 border-slate-200 p-4 pl-12 pr-16 rounded-xl text-lg bg-slate-50 focus:bg-white focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-mono tracking-widest transition-all shadow-sm" 
                placeholder="Scan Serial Number..." 
                value={serialInput} 
                onChange={handleChange} 
                onKeyDown={handleKeyDown}
                disabled={loading} 
                autoFocus
              />
              {serialInput && (
                 <button onClick={() => { setSerialInput(""); setMessage({ type:"", text:"" }); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={16} /></button>
              )}
            </div>

            {/* Status Messages */}
            {message.text && (
              <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 animate-in slide-in-from-top duration-200 ${
                message.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {message.text}
              </div>
            )}
            
            {!message.text && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse"></span>
                Waiting for scan...
              </div>
            )}
          </div>
        </div>}

        {/* Search History */}
        <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full ${isSupervisor ? 'lg:col-span-3' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
              <Search size={14} />
            </div>
            <h3 className="font-bold text-sm text-slate-700">Search History</h3>
          </div>
          
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
            <input 
              className="w-full h-full border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
              placeholder="Search by serial, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-[10px] text-slate-400">
            <span>Total Returns: <strong>{returnsList.length}</strong></span>
            <span>Filtered: <strong>{filteredReturns.length}</strong></span>
          </div>
        </div>
      </div>

      {/* CONDITION MODAL */}
      {showConditionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <h3 className="text-lg font-bold text-white mb-1">Check Condition</h3>
              <p className="text-xs text-slate-400">Select the condition of the returned item</p>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Serial Number</p>
                <p className="font-mono text-xl font-bold text-indigo-600 tracking-wide">{pendingSerial}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => setCondition("InStock")}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    condition === "InStock" 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-200" 
                      : "border-slate-100 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <div className={`p-2 rounded-full ${condition === "InStock" ? "bg-emerald-200" : "bg-slate-100"}`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="text-sm font-bold">Good</span>
                  <span className="text-[10px] opacity-80 font-medium">Return to Stock</span>
                </button>
                
                <button 
                  onClick={() => setCondition("Damaged")}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    condition === "Damaged" 
                      ? "border-red-500 bg-red-50 text-red-700 shadow-md ring-2 ring-red-200" 
                      : "border-slate-100 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50/50"
                  }`}
                >
                  <div className={`p-2 rounded-full ${condition === "Damaged" ? "bg-red-200" : "bg-slate-100"}`}>
                    <AlertTriangle size={24} />
                  </div>
                  <span className="text-sm font-bold">Damaged</span>
                  <span className="text-[10px] opacity-80 font-medium">Move to Damaged</span>
                </button>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowConditionModal(false); setSerialInput(""); setMessage({ type:"", text:"" }); }} 
                  className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmReturn} 
                  className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 ${
                    condition === "InStock" 
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30" 
                      : "bg-red-600 hover:bg-red-700 shadow-red-500/30"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <h3 className="text-sm font-bold text-slate-700">Recent Returns</h3>
          </div>
          <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-500">
            In Stock Items Only
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Serial Number</th>
                <th className="px-5 py-3">Condition</th> 
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3 text-center">History</th>
                <th className="px-5 py-3 text-right">Date</th>
                <th className="px-5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Box size={32} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">No returns found</p>
                      <p className="text-xs text-slate-400">Try searching for a different serial</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-md">
                          <ScanLine size={12} className="text-indigo-600" />
                        </div>
                        <span className="font-mono font-bold text-slate-700 text-xs">{item.serialValue}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        In Stock
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <ShoppingCart size={12} className="text-slate-400" />
                        {item.firmName || "N/A"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {item.customerName || "N/A"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {item.returnCount > 1 ? (
                        <div className="group relative inline-flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full cursor-help flex items-center gap-1">
                            <History size={10} /> {item.returnCount} Times
                          </span>
                          <div className="hidden group-hover:block absolute bottom-full mb-2 w-max bg-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-50 text-left">
                            <p className="font-bold mb-1.5 text-slate-300 border-b border-slate-600 pb-1">Previous Returns:</p>
                            <ul className="space-y-1">
                              {(item.allReturnDates || []).map((d, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                  {format(new Date(d), "dd MMM yyyy, hh:mm a")}
                                </li>
                              ))}
                            </ul>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">1 Time</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                        <Calendar size={12} />
                        {item.returnDate ? format(new Date(item.returnDate), "dd MMM") : "-"}
                        <span className="text-[10px] text-slate-400 ml-1">
                          {item.returnDate ? format(new Date(item.returnDate), "HH:mm") : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isAdmin ? (
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">Locked</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}