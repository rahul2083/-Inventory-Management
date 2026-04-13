import React, { useState, useMemo, useCallback } from "react";
import { printerService } from "../services/api";
import { 
  Layers, Plus, Box, Trash2, CheckSquare, X, Search, Info, 
  Package, Tag, Building2, TrendingUp, History, Hash, Sparkles,
  Edit, Palette, Settings2, Loader2, Check, AlertTriangle, RefreshCw
} from "lucide-react";
import { format } from "date-fns";

// ✅ Toast Component
function Toast({ message, type, onClose }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { bg: "bg-emerald-500", icon: Check },
    error: { bg: "bg-red-500", icon: AlertTriangle },
    info: { bg: "bg-blue-500", icon: Info }
  };

  const { bg, icon: Icon } = config[type] || config.info;

  return (
    <div className={`fixed bottom-6 right-6 z-[100] ${bg} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300`}>
      <Icon size={18} />
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded-full p-1 transition">
        <X size={14} />
      </button>
    </div>
  );
}

export default function Models({ models = [], serials = [], onRefresh, isAdmin, isUser }) {

  const canManage = isAdmin || isUser;

  const initialFormState = {
    name: "", 
    company: "HP", 
    category: "Laser", 
    colorType: "Monochrome",
    printerType: "Multi-Function",
    description: "", 
    mrp: ""
  };

  const [newModel, setNewModel] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingModel, setViewingModel] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  // ✅ Check if model name already exists
  const isDuplicateModel = useCallback((name, excludeId = null) => {
    if (!name || !name.trim()) return false;
    const trimmedName = name.trim().toLowerCase();
    return models.some(m => 
      m.name.trim().toLowerCase() === trimmedName && m.id !== excludeId
    );
  }, [models]);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds([]);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredModels = useMemo(() => {
    return models.filter(m => 
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [models, searchTerm]);

  const handleBulkDelete = async () => {
    if (!isAdmin) { 
      showToast("Access Denied: Admin Only", "error"); 
      return; 
    }
    if (window.confirm(`Delete ${selectedIds.length} models?`)) {
      try {
        for (const id of selectedIds) { 
          await printerService.deleteModel(id); 
        }
        showToast(`${selectedIds.length} models deleted successfully`, "success");
        onRefresh();
        setSelectedIds([]);
        setIsSelectionMode(false);
      } catch (error) { 
        showToast("Failed to delete some models", "error"); 
      }
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) { 
      showToast("Access Denied", "error"); 
      return; 
    }
    if (window.confirm("Are you sure you want to delete this model?")) {
      try { 
        await printerService.deleteModel(id); 
        showToast("Model deleted successfully", "success");
        onRefresh(); 
      } catch (error) { 
        showToast("Failed to delete model", "error"); 
      }
    }
  };

  const handleEdit = (model, e) => {
    if (e) e.stopPropagation();
    if (!canManage) { 
      showToast("Access Denied", "error"); 
      return; 
    }
    
    setNewModel({
      name: model.name || "",
      company: model.company || "HP",
      category: model.category || "Laser",
      colorType: model.colorType || "Monochrome",
      printerType: model.printerType || "Multi-Function",
      description: model.description || "",
      mrp: model.mrp || ""
    });
    
    setEditingId(model.id);
    setShowAddForm(true);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setNewModel(initialFormState);
  };

  // ✅ Submit with duplicate check
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newModel.name?.trim()) {
      showToast("Model name is required", "error");
      return;
    }
    if (!newModel.company?.trim()) {
      showToast("Company is required", "error");
      return;
    }

    // ✅ Duplicate check - exclude current model when editing
    if (isDuplicateModel(newModel.name, editingId)) {
      showToast(`Model "${newModel.name.trim()}" already exists!`, "error");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const modelData = {
        name: newModel.name.trim(),
        company: newModel.company,
        category: newModel.category,
        colorType: newModel.colorType,
        printerType: newModel.printerType,
        description: newModel.description?.trim() || "",
        mrp: newModel.mrp ? Number(newModel.mrp) : 0
      };

      if (editingId) {
        await printerService.updateModel(editingId, modelData);
        showToast("Model updated successfully!", "success");
      } else {
        await printerService.addModel(modelData);
        showToast("Model added successfully!", "success");
      }
      
      if (onRefresh) onRefresh();
      handleCloseForm();
      
    } catch (error) {
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || "Failed to save model";
      
      // ✅ Catch backend duplicate errors too
      if (errorMessage.toLowerCase().includes("exists") || errorMessage.toLowerCase().includes("duplicate")) {
        showToast(`Model "${newModel.name.trim()}" already exists!`, "error");
      } else {
        showToast(errorMessage, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getModelDetails = (model) => {
    if (!model) return { serials: [], stock: 0, priceHistory: [], latestPrice: 0, averagePrice: 0 };

    const modelSerials = serials.filter(s => s.modelId === model.id);
    
    const history = modelSerials
        .filter(s => s.landingPrice > 0)
        .map(s => ({
            price: s.landingPrice,
            date: s.createdAt || new Date().toISOString() 
        }))
        .sort((a,b) => new Date(b.date) - new Date(a.date));

    const inStockItems = modelSerials.filter(s => s.status === "Available");
    
    const totalValue = inStockItems.reduce((sum, item) => sum + (Number(item.landingPrice) || 0), 0);
    const avgPrice = inStockItems.length > 0 ? Math.round(totalValue / inStockItems.length) : 0;

    return {
      serials: modelSerials,
      stock: inStockItems.length,
      dispatched: modelSerials.filter(s => s.status === "Dispatched").length,
      damaged: modelSerials.filter(s => s.status === "Damaged").length,
      priceHistory: history,
      latestPrice: history[0]?.price || 0,
      averagePrice: avgPrice
    };
  };

  const viewDetails = viewingModel ? getModelDetails(viewingModel) : null;

  const getCompanyColor = (company) => {
    const colors = {
      'HP': { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 text-blue-600 border-blue-100' },
      'Canon': { bg: 'from-red-500 to-red-600', light: 'bg-red-50 text-red-600 border-red-100' },
      'Epson': { bg: 'from-indigo-500 to-indigo-600', light: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
      'Brother': { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    };
    return colors[company] || { bg: 'from-slate-500 to-slate-600', light: 'bg-slate-50 text-slate-600 border-slate-100' };
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Laser': '⚡',
      'Inkjet': '💧',
      'Ink Tank': '💧',
      'Thermal': '🔥',
      '3D Printer': '🎲'
    };
    return icons[category] || '🖨️';
  };

  // ✅ Live duplicate check for name input
  const nameIsDuplicate = useMemo(() => {
    return isDuplicateModel(newModel.name, editingId);
  }, [newModel.name, editingId, isDuplicateModel]);

  return (
    <div className="space-y-5 relative pb-20 min-h-screen">

      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md shadow-indigo-500/25">
                <Box size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {models.length} Models
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Printer Models</h1>
            <p className="text-xs text-slate-500">Manage your printer catalog</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 md:w-56 min-w-[150px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                className="w-full border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm" 
                placeholder="Search models..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            
            {onRefresh && (
              <button 
                onClick={onRefresh}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-all shadow-sm"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            )}
            
            <button 
              onClick={toggleSelectionMode} 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                isSelectionMode 
                  ? "bg-slate-800 text-white shadow-lg" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              }`}
            >
              {isSelectionMode ? <X size={14} /> : <CheckSquare size={14} />} 
              <span className="hidden sm:inline">{isSelectionMode ? "Cancel" : "Select"}</span>
            </button>
            
            {canManage && <button 
              onClick={() => showAddForm ? handleCloseForm() : setShowAddForm(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shadow-sm ${
                showAddForm 
                  ? "bg-slate-100 text-slate-600" 
                  : "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/25"
              }`}
            >
              {showAddForm ? <X size={14} /> : <Plus size={14} />}
              <span className="hidden sm:inline">{showAddForm ? "Close" : "Add Model"}</span>
            </button>}
          </div>
        </div>
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden animate-in slide-in-from-top duration-300">
          <div className={`bg-gradient-to-r ${editingId ? 'from-amber-500 to-orange-600' : 'from-indigo-500 to-purple-600'} px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                {editingId ? <Edit size={16} className="text-white" /> : <Plus size={16} className="text-white" />}
              </div>
              <h3 className="text-sm font-bold text-white">
                {editingId ? `Edit Model: ${newModel.name}` : 'Add New Model'}
              </h3>
            </div>
            {editingId && (
              <span className="text-xs bg-white/20 px-2 py-1 rounded-lg text-white font-medium">
                ID: {editingId}
              </span>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* ✅ Model Name with live duplicate warning */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag size={10} /> Model Name *
                </label>
                <div className="relative">
                  <input 
                    className={`w-full border p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 outline-none transition-all ${
                      nameIsDuplicate 
                        ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50/50' 
                        : 'border-slate-200 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                    placeholder="e.g. LaserJet Pro M1136"
                    value={newModel.name} 
                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} 
                    required 
                    disabled={isSubmitting}
                  />
                  {/* ✅ Duplicate indicator icon */}
                  {newModel.name.trim() && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {nameIsDuplicate ? (
                        <AlertTriangle size={16} className="text-red-500" />
                      ) : (
                        <Check size={16} className="text-emerald-500" />
                      )}
                    </div>
                  )}
                </div>
                {/* ✅ Duplicate warning message */}
                {nameIsDuplicate && (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle size={11} />
                    Model "{newModel.name.trim()}" already exists!
                  </p>
                )}
              </div>
              
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 size={10} /> Company *
                </label>
                <select 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer" 
                  value={newModel.company} 
                  onChange={(e) => setNewModel({ ...newModel, company: e.target.value })}
                  disabled={isSubmitting}
                >
                  <option value="HP">HP</option>
                  <option value="Canon">Canon</option>
                  <option value="Epson">Epson</option>
                  <option value="Brother">Brother</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers size={10} /> Category
                </label>
                <select 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer" 
                  value={newModel.category} 
                  onChange={(e) => setNewModel({ ...newModel, category: e.target.value })}
                  disabled={isSubmitting}
                >
                  <option value="Laser">Laser</option>
                  <option value="Inkjet">Inkjet</option>
                  <option value="Ink Tank">Ink Tank</option>
                  <option value="Thermal">Thermal</option>
                  <option value="3D Printer">3D Printer</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span>₹</span> MRP
                </label>
                <input 
                  type="number" 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  placeholder="15000"
                  value={newModel.mrp} 
                  onChange={(e) => setNewModel({ ...newModel, mrp: e.target.value })} 
                  disabled={isSubmitting}
                  min="0"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Palette size={10} /> Color Type
                </label>
                <select 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer" 
                  value={newModel.colorType} 
                  onChange={(e) => setNewModel({ ...newModel, colorType: e.target.value })}
                  disabled={isSubmitting}
                >
                  <option value="Monochrome">Monochrome (B&W)</option>
                  <option value="Color">Color</option>
                </select>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Settings2 size={10} /> Printer Type
                </label>
                <select 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer" 
                  value={newModel.printerType} 
                  onChange={(e) => setNewModel({ ...newModel, printerType: e.target.value })}
                  disabled={isSubmitting}
                >
                  <option value="Single-Function">Single-Function</option>
                  <option value="Multi-Function">Multi-Function (MFP)</option>
                  <option value="Ink Tank">Ink Tank</option>
                  <option value="Dot Matrix">Dot Matrix</option>
                </select>
              </div>
              
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Info size={10} /> Description
                </label>
                <input 
                  className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                  placeholder="Optional details..." 
                  value={newModel.description} 
                  onChange={(e) => setNewModel({ ...newModel, description: e.target.value })} 
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                {editingId ? `Editing model ID: ${editingId}` : "Fill in the required fields"}
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={handleCloseForm}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                {/* ✅ Disable submit when duplicate */}
                <button 
                  type="submit"
                  disabled={isSubmitting || nameIsDuplicate}
                  className={`text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
                    editingId 
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-orange-500/25" 
                      : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-500/25"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {editingId ? "Updating..." : "Adding..."}
                    </>
                  ) : (
                    <>
                      {editingId ? <Edit size={14} /> : <Sparkles size={14} />}
                      {editingId ? "Update Model" : "Add Model"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
          <span className="text-xs text-slate-500">Total:</span>
          <span className="text-sm font-bold text-slate-700">{models.length}</span>
        </div>
      </div>

      {/* Empty State */}
      {filteredModels.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={32} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Models Found</h3>
          <p className="text-sm text-slate-500 mb-4">
            {searchTerm ? `No results for "${searchTerm}"` : "Start by adding your first printer model"}
          </p>
          {!searchTerm && (
            <button 
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
            >
              <Plus size={16} /> Add First Model
            </button>
          )}
        </div>
      )}

      {/* Models Grid */}
      {filteredModels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredModels.map((m) => {
            const isSelected = selectedIds.includes(m.id);
            const details = getModelDetails(m);
            const companyColor = getCompanyColor(m.company);

            return (
              <div 
                key={m.id} 
                onClick={() => isSelectionMode ? handleSelectOne(m.id) : setViewingModel(m)} 
                className={`group relative bg-white rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                  isSelected 
                    ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-lg' 
                    : 'border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200'
                }`}
              >
                {isSelectionMode && (
                  <div className="absolute top-3 left-3 z-10">
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => handleSelectOne(m.id)} 
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                
                {!isSelectionMode && canManage && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                    <button 
                      onClick={(e) => handleEdit(m, e)} 
                      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all bg-white shadow-sm border border-slate-100" 
                      title="Edit Model"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} 
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all bg-white shadow-sm border border-slate-100" 
                      title="Delete Model"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                <div className={`h-1 bg-gradient-to-r ${companyColor.bg}`}></div>

                <div className="p-4">
                  <div className={`flex items-start gap-3 mb-3 ${isSelectionMode ? 'pl-6' : ''} pr-16`}>
                    <div className={`p-2 bg-gradient-to-br ${companyColor.bg} text-white rounded-lg shadow-md flex-shrink-0`}>
                      <Box size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight truncate" title={m.name}>
                        {m.name}
                      </h3>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">{m.company}</p>
                    </div>
                  </div>

                  <div className={`flex flex-wrap gap-1.5 mb-3 ${isSelectionMode ? 'pl-6' : ''}`}>
                    <span className={`px-2 py-0.5 text-[9px] rounded-md font-bold border ${companyColor.light}`}>
                      {getCategoryIcon(m.category)} {m.category}
                    </span>
                    
                    <span className="px-2 py-0.5 text-[9px] bg-slate-50 text-slate-600 border border-slate-200 rounded-md font-bold">
                      {m.printerType || 'Multi-Function'}
                    </span>
                    
                    {m.colorType === 'Color' ? (
                      <span className="px-2 py-0.5 text-[9px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-md font-bold shadow-sm">
                        Color
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] bg-slate-700 text-white rounded-md font-bold shadow-sm">
                        B&W
                      </span>
                    )}

                    {m.mrp > 0 && (
                      <span className="px-2 py-0.5 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md font-bold">
                        ₹{Number(m.mrp).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  <p className={`text-[11px] text-slate-500 mb-3 h-7 line-clamp-2 leading-relaxed ${isSelectionMode ? 'pl-6' : ''}`}>
                    {m.description || <span className="text-slate-300 italic">No description</span>}
                  </p>

                  <div className={`flex justify-between items-center pt-3 border-t border-slate-100 ${isSelectionMode ? 'pl-6' : ''}`}>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Package size={10} className="text-emerald-500" />
                        {details.stock}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash size={10} />
                        {details.serials.length}
                      </span>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                      details.stock > 0 
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                        : "bg-slate-100 text-slate-400"
                    }`}>
                      {details.stock > 0 ? `${details.stock} In Stock` : 'Out of Stock'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Details Modal */}
      {viewingModel && viewDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setViewingModel(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className={`bg-gradient-to-r ${getCompanyColor(viewingModel.company).bg} p-4 relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl flex-shrink-0">
                    <Box size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-lg leading-tight truncate">{viewingModel.name}</h3>
                    <p className="text-white/80 text-xs mt-0.5">
                      {viewingModel.company} • {viewingModel.category} • {viewingModel.printerType || 'Multi-Function'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingModel(null)} 
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              
              <div className="flex flex-wrap gap-2">
                {viewingModel.colorType === 'Color' ? (
                  <span className="px-2 py-1 text-[10px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-md font-bold shadow-sm flex items-center gap-1">
                    <Palette size={10}/> Color Printer
                  </span>
                ) : (
                  <span className="px-2 py-1 text-[10px] bg-slate-700 text-white rounded-md font-bold shadow-sm flex items-center gap-1">
                    Monochrome (B&W)
                  </span>
                )}
                <span className="px-2 py-1 text-[10px] bg-slate-100 text-slate-600 rounded-md font-bold border border-slate-200 flex items-center gap-1">
                  <Settings2 size={10}/> {viewingModel.printerType || 'Multi-Function'}
                </span>
              </div>

              {viewingModel.description && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Description:</span> {viewingModel.description}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">MRP</p>
                  <p className="text-sm font-bold text-slate-700">₹{Number(viewingModel.mrp || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl text-center border border-emerald-100">
                  <p className="text-[9px] text-emerald-500 uppercase font-bold">In Stock</p>
                  <p className="text-sm font-bold text-emerald-700">{viewDetails.stock}</p>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-xl text-center border border-blue-100">
                  <p className="text-[9px] text-blue-500 uppercase font-bold">Latest</p>
                  <p className="text-sm font-bold text-blue-700">₹{viewDetails.latestPrice?.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-purple-50 p-2.5 rounded-xl text-center border border-purple-100">
                  <p className="text-[9px] text-purple-500 uppercase font-bold">Avg</p>
                  <p className="text-sm font-bold text-purple-700">₹{viewDetails.averagePrice?.toLocaleString('en-IN')}</p>
                </div>
              </div>

              {viewDetails.serials.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                  <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                    <Hash size={12} /> Serial Numbers ({viewDetails.serials.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {viewDetails.serials.slice(0, 10).map((serial, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100">
                        {/* ✅ FIX: Added check for both serial.value and serial.serialNumber */}
                        <span className="font-mono text-slate-600 truncate">{serial.value || serial.serialNumber || "N/A"}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          serial.status === 'Available' ? 'bg-emerald-100 text-emerald-600' :
                          serial.status === 'Dispatched' ? 'bg-purple-100 text-purple-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {serial.status}
                        </span>
                      </div>
                    ))}
                    {viewDetails.serials.length > 10 && (
                      <p className="text-[10px] text-slate-400 text-center py-1">
                        + {viewDetails.serials.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {viewDetails.priceHistory.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                  <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                    <History size={12} /> Recent Purchases
                  </h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {viewDetails.priceHistory.slice(0, 5).map((entry, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-500">
                          {format(new Date(entry.date), "dd MMM yyyy")}
                        </span>
                        <span className="font-bold text-slate-700">
                          ₹{entry.price?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t flex justify-between items-center gap-2">
              {isAdmin && (
                <button 
                  onClick={() => {
                    setViewingModel(null);
                    handleEdit(viewingModel);
                  }} 
                  className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-600 hover:bg-amber-100 transition-all flex items-center gap-1"
                >
                  <Edit size={14} /> Edit
                </button>
              )}
              <button 
                onClick={() => setViewingModel(null)} 
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-4 z-50">
          <span className="font-bold text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {selectedIds.length} Selected
          </span>
          <div className="h-4 w-px bg-slate-700"></div>
          <button 
            onClick={handleBulkDelete} 
            className={`flex items-center gap-1.5 text-xs transition font-medium ${
              isAdmin ? "hover:text-red-400 cursor-pointer" : "text-slate-500 cursor-not-allowed"
            }`} 
            disabled={!isAdmin}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button 
            onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }} 
            className="text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}