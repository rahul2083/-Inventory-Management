import React, { useState } from "react";
import {
  Printer, Package, Truck, CheckCircle2, AlertTriangle, TrendingUp, 
  RotateCcw, AlertOctagon, Search, X, Banknote, Coins,
  XCircle, TrendingDown, Sparkles, ArrowUpRight, ArrowDownRight,
  FileText 
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Dashboard({
  models = [],
  serials = [],
  dispatches = [],
  returns = [],
  onNavigate,
  isAdmin,
  isAccountant,
  isSupervisor
}) {
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [showModal, setShowModal] = useState(false);

  /* ================= CALCULATIONS ================= */
  const LOW_STOCK_THRESHOLD = 3;
  const availableStock = serials.filter((s) => s.status === "Available").length;
  const damagedStock = serials.filter((s) => s.status === "Damaged").length;
  const dispatchedStock = serials.filter((s) => s.status === "Dispatched").length;

  const activeDispatches = dispatches.filter(d => !d.isDeleted);
  const cancelledDispatches = dispatches.filter(d => d.isDeleted);

  const totalInventoryValue = serials
    .filter(s => s.status === "Available")
    .reduce((sum, item) => sum + (Number(item.landingPrice) || 0), 0);

  const totalRevenue = activeDispatches
    .reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0);

  const chartData = models.map((m) => {
    const stockCount = serials.filter((s) => s.modelId === m.id && s.status === "Available").length;
    return { name: m.name, stock: stockCount };
  });

  const lowStockModels = chartData.filter((m) => m.stock <= LOW_STOCK_THRESHOLD);

  const showReports = isAdmin || isAccountant || isSupervisor;
  const showFinancials = isAdmin || isAccountant;

  /* ================= SEARCH LOGIC (UPDATED) ================= */
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setGlobalSearch(query);

    if (!query.trim()) { 
        setSearchResult(null); 
        setShowModal(false);
        return; 
    }

    const lowerQuery = query.toLowerCase();

    // 1. First, try to find by Serial Number
    let foundSerial = serials.find(s => s.value.toLowerCase() === lowerQuery);
    
    // 2. If not found, try to find by Order ID (customerName in dispatches)
    if (!foundSerial) {
      const foundDispatch = dispatches.find(d => 
        d.customerName && d.customerName.toLowerCase() === lowerQuery
      );
      
      // If we found a dispatch with that Order ID, get the associated serial
      if (foundDispatch) {
        foundSerial = serials.find(s => s.id === foundDispatch.serialNumberId);
      }
    }

    // 3. If we identified a serial (directly or via Order ID), populate data
    if (foundSerial) {
      const model = models.find(m => m.id === foundSerial.modelId);
      
      const dispatchInfo = dispatches
        .filter(d => d.serialNumberId === foundSerial.id && !d.isDeleted)
        .sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate))[0];

      const cancelledDispatchInfo = dispatches
        .filter(d => d.serialNumberId === foundSerial.id && d.isDeleted)
        .sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt))[0];

      const returnInfo = returns
        .filter(r => r.serialNumberId === foundSerial.id)
        .sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate))[0];

      setSearchResult({
        serial: foundSerial.value,
        model: model?.name || "Unknown",
        status: foundSerial.status,
        company: model?.company || "Unknown",
        dispatch: dispatchInfo,
        cancelledDispatch: cancelledDispatchInfo,
        returnRecord: returnInfo,
        landingPrice: foundSerial.landingPrice 
      });
      setShowModal(true);
    } else {
      setSearchResult(null);
      setShowModal(false);
    }
  };

  /* ================= CUSTOM TOOLTIP ================= */
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-lg px-3 py-2 rounded-lg shadow-lg border border-slate-100">
          <p className="text-xs font-bold text-slate-800">{label}</p>
          <p className="text-sm font-bold text-indigo-600">{payload[0].value} units</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5 relative">

      {/* ✅ HEADER SECTION - Compact */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md shadow-indigo-500/25">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Live Dashboard
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
              Inventory Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Real-time overview of inventory, dispatches & returns
            </p>
          </div>

          {/* ✅ SEARCH BAR - Updated Placeholder */}
          <div className="relative w-full md:w-72 group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-white rounded-xl shadow-md border border-slate-200/50 overflow-hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
                placeholder="Search Serial or Order ID..." 
                value={globalSearch}
                onChange={handleSearchChange}
              />
              {globalSearch && (
                <button 
                  onClick={() => { setGlobalSearch(""); setShowModal(false); }} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ KPI CARDS - Row 1: Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* Models Card */}
        <div 
          onClick={() => onNavigate("models")}
          className="group relative bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-md shadow-indigo-500/30">
                <Printer size={16} className="text-white" />
              </div>
              <ArrowUpRight size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Models</p>
            <h3 className="text-xl font-extrabold text-slate-800">{models.length}</h3>
          </div>
        </div>

        {/* Available Stock Card */}
        <div 
          onClick={() => onNavigate("serials")}
          className="group relative bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md shadow-emerald-500/30">
                <Package size={16} className="text-white" />
              </div>
              <ArrowUpRight size={14} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Available Stock</p>
            <h3 className="text-xl font-extrabold text-slate-800">{availableStock}</h3>
            <span className="text-[9px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              {dispatchedStock} dispatched
            </span>
          </div>
        </div>

        {/* Dispatches Card */}
        <div 
          onClick={() => onNavigate("dispatch")}
          className="group relative bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          {cancelledDispatches.length > 0 && (
            <span className="absolute top-2 right-2 text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
              {cancelledDispatches.length} cancelled
            </span>
          )}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg shadow-md shadow-amber-500/30">
                <Truck size={16} className="text-white" />
              </div>
              <ArrowUpRight size={14} className="text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Dispatches</p>
            <h3 className="text-xl font-extrabold text-slate-800">{activeDispatches.length}</h3>
          </div>
        </div>

        {/* Returns Card */}
        <div 
          onClick={() => onNavigate("returns")}
          className="group relative bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-md shadow-orange-500/30">
                <RotateCcw size={16} className="text-white" />
              </div>
              <ArrowUpRight size={14} className="text-slate-300 group-hover:text-orange-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Returned</p>
            <h3 className="text-xl font-extrabold text-slate-800">{returns.length}</h3>
          </div>
        </div>
      </div>

      {/* ✅ KPI CARDS - Row 2: Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* Damaged Card */}
        <div 
          onClick={() => onNavigate("damaged")}
          className="group relative bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-3 border border-red-100 shadow-sm hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg shadow-md shadow-red-500/30">
                <AlertOctagon size={16} className="text-white" />
              </div>
              <ArrowUpRight size={14} className="text-red-200 group-hover:text-red-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Damaged</p>
            <h3 className="text-xl font-extrabold text-red-600">{damagedStock}</h3>
          </div>
        </div>

        {/* ✅ Reports Card - NEW ADDITION */}
        {showReports && (
          <div 
            onClick={() => onNavigate("reports")}
            className="group relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-3 border border-violet-100 shadow-sm hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-md shadow-violet-500/30">
                  <FileText size={16} className="text-white" />
                </div>
                <ArrowUpRight size={14} className="text-violet-200 group-hover:text-violet-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Reports & Analytics</p>
              <h3 className="text-base font-extrabold text-violet-700 mt-0.5">View Stats</h3>
            </div>
          </div>
        )}

        {/* Admin Only Cards */}
        {showFinancials ? (
          <>
            {/* Stock Value Card */}
            <div className="group relative bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-100 shadow-sm overflow-hidden">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg shadow-md shadow-emerald-500/30">
                    <Banknote size={16} className="text-white" />
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                    Inventory
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Stock Value</p>
                <h3 className="text-lg font-extrabold text-emerald-700">
                  ₹{totalInventoryValue.toLocaleString('en-IN')}
                </h3>
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100 shadow-sm overflow-hidden">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md shadow-blue-500/30">
                    <Coins size={16} className="text-white" />
                  </div>
                  <div className="flex items-center gap-0.5 text-emerald-500">
                    <TrendingUp size={12} />
                    <span className="text-[9px] font-bold">Active</span>
                  </div>
                </div>
                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Total Revenue</p>
                <h3 className="text-lg font-extrabold text-blue-700">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </h3>
              </div>
            </div>
          </>
        ) : (
          <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100 shadow-sm overflow-hidden col-span-2 md:col-span-3">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md shadow-blue-500/30">
                  <CheckCircle2 size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">System Health</p>
                  <h3 className="text-base font-extrabold text-blue-700">All Systems Operational</h3>
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-500">100%</span>
            </div>
          </div>
        )}
      </div>

      {/* ✅ MAIN SECTION - Compact Charts & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Stock Distribution Chart - Compact */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <TrendingUp size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Stock Distribution</h3>
                  <p className="text-[10px] text-slate-400">Available stock by model</p>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {models.length} Models
              </span>
            </div>
          </div>
          
          <div className="p-4">
            {chartData.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                <Package size={36} className="mb-2 text-slate-300" />
                <p className="text-sm font-medium">No inventory data</p>
                <p className="text-xs text-slate-400">Add models to see chart</p>
              </div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <defs>
                      {COLORS.map((color, index) => (
                        <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={1} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 9, fill: "#64748b", fontWeight: 500 }} 
                      tickLine={false} 
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fill: "#64748b" }} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="stock" 
                      radius={[6, 6, 0, 0]} 
                      barSize={35}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#gradient-${index % COLORS.length})`}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Stock Health Panel - Compact */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${lowStockModels.length > 0 ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-green-600'}`}>
                <AlertTriangle size={14} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Stock Health</h3>
                <p className="text-[10px] text-slate-400">Low stock alerts</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto max-h-52 custom-scrollbar">
            {lowStockModels.length > 0 ? (
              <div className="space-y-2">
                {/* Warning Banner */}
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 shadow-md shadow-red-500/25">
                  <AlertTriangle size={14} />
                  <div>
                    <p className="font-bold text-xs">{lowStockModels.length} Model(s) Low</p>
                    <p className="text-[10px] text-white/80">Stock ≤ {LOW_STOCK_THRESHOLD}</p>
                  </div>
                </div>

                {/* Low Stock Items */}
                {lowStockModels.map((model, index) => (
                  <div 
                    key={index} 
                    className="flex justify-between items-center p-2.5 bg-gradient-to-r from-slate-50 to-red-50 rounded-lg border border-red-100"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {model.name.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[80px]">{model.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowDownRight size={12} className="text-red-500" />
                      <span className="text-sm font-extrabold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">
                        {model.stock}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-4">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <h4 className="text-sm font-bold text-emerald-700">All Healthy!</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Sufficient stock levels
                </p>
                <div className="mt-2 px-2 py-1 bg-emerald-50 rounded-full">
                  <span className="text-[9px] font-semibold text-emerald-600">
                    Min: {LOW_STOCK_THRESHOLD} units
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ SEARCH RESULT MODAL - Compact */}
      {showModal && searchResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wider mb-0.5">Serial Number</p>
                  <h3 className="text-lg font-extrabold text-white tracking-wide">#{searchResult.serial}</h3>
                </div>
                <button 
                  onClick={() => { setShowModal(false); setGlobalSearch(""); }} 
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              
              {/* Status Badge */}
              <div className="flex justify-center">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 ${
                  searchResult.status === "Available" 
                    ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200" 
                    : searchResult.status === "Damaged" 
                    ? "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200" 
                    : "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200"
                }`}>
                  {searchResult.status === "Available" && <CheckCircle2 size={14} />}
                  {searchResult.status === "Damaged" && <AlertOctagon size={14} />}
                  {searchResult.status === "Dispatched" && <Truck size={14} />}
                  {searchResult.status}
                </span>
              </div>

              {/* Model & Company */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Model</p>
                  <p className="text-sm font-bold text-slate-700 truncate" title={searchResult.model}>{searchResult.model}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Company</p>
                  <p className="text-sm font-bold text-slate-700">{searchResult.company}</p>
                </div>
              </div>

              {/* Landing Price (Admin) */}
              {showFinancials && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider mb-0.5">Landing Price</p>
                  <p className="text-xl font-extrabold text-emerald-700">₹{searchResult.landingPrice?.toLocaleString('en-IN') || 0}</p>
                </div>
              )}

              {/* Dispatch Info */}
              {searchResult.status === "Dispatched" && searchResult.dispatch && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 relative">
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg">
                    DISPATCHED
                  </div>
                  <h4 className="text-[10px] font-bold text-blue-600 uppercase mb-3 flex items-center gap-1.5">
                    <Truck size={14} /> Shipment Details
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-blue-100">
                      <span className="text-slate-500">Platform</span>
                      <span className="font-semibold text-slate-700">{searchResult.dispatch.firmName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-blue-100">
                      <span className="text-slate-500">Order ID</span>
                      <span className="font-semibold text-slate-700">{searchResult.dispatch.customerName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-blue-100">
                      <span className="text-slate-500">Date</span>
                      <span className="font-semibold text-slate-700">{format(new Date(searchResult.dispatch.dispatchDate), "dd MMM yyyy")}</span>
                    </div>
                    {showFinancials && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">Selling Price</span>
                        <span className="text-base font-extrabold text-emerald-600">₹{searchResult.dispatch.sellingPrice?.toLocaleString('en-IN') || 0}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cancelled Dispatch Info */}
              {searchResult.cancelledDispatch && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 relative">
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg">
                    CANCELLED
                  </div>
                  <h4 className="text-[10px] font-bold text-red-600 uppercase mb-3 flex items-center gap-1.5">
                    <XCircle size={14} /> Cancelled Dispatch
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-red-100">
                      <span className="text-slate-500">Platform</span>
                      <span className="font-semibold text-slate-400 line-through">{searchResult.cancelledDispatch.firmName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-red-100">
                      <span className="text-slate-500">Order ID</span>
                      <span className="font-semibold text-slate-400 line-through">{searchResult.cancelledDispatch.customerName}</span>
                    </div>
                    <div className="py-1.5 border-b border-red-100">
                      <span className="text-slate-500 block mb-0.5">Reason</span>
                      <span className="font-semibold text-red-600">{searchResult.cancelledDispatch.cancellationReason || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Cancelled On</span>
                      <span className="font-semibold text-slate-600">
                        {searchResult.cancelledDispatch.cancelledAt 
                          ? format(new Date(searchResult.cancelledDispatch.cancelledAt), "dd MMM yyyy") 
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Return Info */}
              {(searchResult.status === "Available" || searchResult.status === "Damaged") && searchResult.returnRecord && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 relative">
                  <div className="absolute top-0 right-0 bg-orange-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg">
                    RETURNED
                  </div>
                  <h4 className="text-[10px] font-bold text-orange-600 uppercase mb-3 flex items-center gap-1.5">
                    <RotateCcw size={14} /> Return History
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-orange-100">
                      <span className="text-slate-500">From</span>
                      <span className="font-semibold text-slate-700">{searchResult.returnRecord.firmName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-orange-100">
                      <span className="text-slate-500">Date</span>
                      <span className="font-semibold text-slate-700">{format(new Date(searchResult.returnRecord.returnDate), "dd MMM yyyy")}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Condition</span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        searchResult.returnRecord.condition === "Damaged" 
                          ? "bg-red-100 text-red-600" 
                          : "bg-green-100 text-green-600"
                      }`}>
                        {searchResult.returnRecord.condition}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t">
              <button 
                onClick={() => { setShowModal(false); setGlobalSearch(""); }} 
                className="w-full py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm font-bold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg active:scale-[0.98]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #c7d2fe, #a5b4fc);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
