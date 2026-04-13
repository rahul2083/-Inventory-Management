import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { printerService } from "../services/api";
import {
  QrCode, Trash2, Search, X, CheckSquare, Filter, Save,
  Package, Hash, ScanLine, AlertCircle, CheckCircle2,
  Box, TrendingUp, ChevronLeft, ChevronRight, Plus, Eye, Pencil,
  AlertTriangle, MessageSquare, Info, Upload, Download, File, XCircle,
  ChevronDown
} from "lucide-react";

const ITEMS_PER_PAGE = 50;

export default function Serials({
  models = [],
  serials = [],
  onRefresh,
  isAdmin,
  isUser
}) {
  const [newSerial, setNewSerial] = useState({
    modelId: "",
    value: "",
    landingPrice: "",
    mrp: ""
  });

  const [filter, setFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editPopup, setEditPopup] = useState(null);
  const [editData, setEditData] = useState({
    value: "",
    landingPrice: "",
    modelId: "",
    landingPriceReason: ""
  });
  const [editLoading, setEditLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [sessionCount, setSessionCount] = useState(0);

  // ✅ States for the new searchable model dropdown
  const [modelSearch, setModelSearch] = useState("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);


  // ✅ Reason popup state for register form
  const [reasonPopup, setReasonPopup] = useState({
    show: false,
    reason: "",
    pendingSerial: null
  });

  // ✅ View reason popup state
  const [viewReasonPopup, setViewReasonPopup] = useState(null);

  // ✅ Excel Upload States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  // 🔥 UPDATE: Added Model Filter state for Upload
  const [uploadModelId, setUploadModelId] = useState(""); 

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const canManage = isAdmin || isUser;

  // ✅ Instant duplicate check (made robust with trim, case sensitivity, and fallback property)
  const isDuplicateSerial = useCallback((value, excludeId = null) => {
    if (!value || !value.trim()) return false;
    const trimmed = value.trim().toLowerCase();
    return serials.some(s =>
      (s.value || s.serialNumber || "").trim().toLowerCase() === trimmed && s.id !== excludeId
    );
  }, [serials]);

  // ✅ Get MRP for a model
  const getModelMRP = useCallback((modelId) => {
    const model = models.find(m => m.id === Number(modelId));
    return Number(model?.mrp) || 0;
  }, [models]);

  // ✅ Check if landing price exceeds MRP
  const isLandingPriceExceedsMRP = useCallback((modelId, landingPrice) => {
    const mrp = getModelMRP(modelId);
    const lp = Number(landingPrice) || 0;
    return mrp > 0 && lp > mrp;
  }, [getModelMRP]);

  const handleModelChange = (modelId) => {
    const mId = Number(modelId);
    const selectedModel = models.find(m => m.id === mId);

    const latestSerial = serials
      .filter(s => s.modelId === mId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    setNewSerial(prev => ({
      ...prev,
      modelId: mId,
      mrp: selectedModel ? selectedModel.mrp : "",
      landingPrice: latestSerial ? latestSerial.landingPrice : ""
    }));

    if (inputRef.current) inputRef.current.focus();
  };

  // ✅ Save with reason support
  const saveSerialToApi = useCallback(async (serialValue, modelId, landingPrice, landingPriceReason = null) => {
    if (!modelId) {
      setStatusMsg({ type: "error", text: "Please select a Model!" });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      return;
    }
    if (!serialValue || serialValue.trim() === "") {
      setStatusMsg({ type: "error", text: "Please enter Serial Number!" });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      return;
    }

    const trimmedValue = serialValue.trim();

    // Instant duplicate check
    if (isDuplicateSerial(trimmedValue)) {
      setStatusMsg({ type: "error", text: `Serial "${trimmedValue}" already exists!` });
      setNewSerial(prev => ({ ...prev, value: "" }));
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    // Check if landing price > MRP and reason not provided
    const mrp = getModelMRP(modelId);
    const lp = Number(landingPrice) || 0;

    if (mrp > 0 && lp > mrp && !landingPriceReason) {
      setReasonPopup({
        show: true,
        reason: "",
        pendingSerial: {
          value: trimmedValue,
          modelId,
          landingPrice,
          mrp
        }
      });
      return;
    }

    setIsSaving(true);

    try {
      await printerService.addSerial({
        modelId,
        value: trimmedValue,
        landingPrice: Number(landingPrice) || 0,
        landingPriceReason: landingPriceReason || null
      });

      await onRefresh();
      setSessionCount(prev => prev + 1);
      setStatusMsg({ type: "success", text: `Saved: ${trimmedValue}` });
      setNewSerial(prev => ({ ...prev, value: "" }));
      
      // ✅ FIX: Page reset to 1 automatically after saving so new data is visible at top
      clearFilters();
      setCurrentPage(1);

    } catch (error) {
      const errorData = error.response?.data;
      const msg = errorData?.message || error.message || "Error adding serial";

      // If server says reason required
      if (errorData?.requiresReason) {
        setReasonPopup({
          show: true,
          reason: "",
          pendingSerial: {
            value: trimmedValue,
            modelId,
            landingPrice,
            mrp: errorData.mrp
          }
        });
        setIsSaving(false);
        return;
      }

      if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("duplicate")) {
        setStatusMsg({ type: "error", text: `Serial "${trimmedValue}" already exists!` });
      } else {
        setStatusMsg({ type: "error", text: msg });
      }
      setNewSerial(prev => ({ ...prev, value: "" }));
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      
      // Defer the focus call to run after the current execution stack clears.
      // This ensures the input is no longer disabled from 'isSaving' state before we try to focus it.
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  }, [isDuplicateSerial, onRefresh, getModelMRP]);

  // ✅ Handle reason popup submit
  const handleReasonSubmit = async () => {
    const reason = reasonPopup.reason.trim();
    if (!reason) return;

    const { value, modelId, landingPrice } = reasonPopup.pendingSerial;

    setReasonPopup({ show: false, reason: "", pendingSerial: null });
    await saveSerialToApi(value, modelId, landingPrice, reason);
  };

  // ✅ Handle reason popup cancel
  const handleReasonCancel = () => {
    setReasonPopup({ show: false, reason: "", pendingSerial: null });
    setNewSerial(prev => ({ ...prev, value: "" }));
    setStatusMsg({ type: "", text: "" });
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSaving || reasonPopup.show) return;
    saveSerialToApi(newSerial.value, newSerial.modelId, newSerial.landingPrice);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewSerial(prev => ({ ...prev, value: val }));

    if (val.trim().length === 10 && !isSaving && !reasonPopup.show) {
      if (isDuplicateSerial(val.trim())) {
        setStatusMsg({ type: "error", text: `Serial "${val.trim()}" already exists!` });
        setNewSerial(prev => ({ ...prev, value: "" }));
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
        if (inputRef.current) inputRef.current.focus();
        return;
      }
      saveSerialToApi(val, newSerial.modelId, newSerial.landingPrice);
    }
  };

  const handleDelete = async (ids) => {
    if (!isAdmin) { alert("🚫 Access Denied: Admin Only."); return; }
    if (window.confirm(`Delete ${ids.length} serial(s)?`)) {
      try {
        for (const id of ids) { await printerService.deleteSerial(id); }
        onRefresh();
        setSelectedIds([]);
        setIsSelectionMode(false);
        setEditPopup(null);
      } catch (error) { alert("Failed to delete"); }
    }
  };

  const handleToggleForm = () => {
    if (showForm) {
      setSessionCount(0);
      // Reset model search when closing form
      setModelSearch("");
      setNewSerial({ modelId: "", value: "", landingPrice: "", mrp: "" });
    }
    setShowForm(!showForm);
  };

  const clearFilters = () => {
    setFilter("");
    setModelFilter("");
  };

  const openEditPopup = (serial) => {
    setEditPopup(serial);
    setEditData({
      value: serial.value || serial.serialNumber || "", 
      landingPrice: serial.landingPrice || "",
      modelId: serial.modelId,
      landingPriceReason: serial.landingPriceReason || ""
    });
  };

  // ✅ Excel Upload Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setStatusMsg({ type: 'error', text: 'Please select an Excel file (.xlsx or .xls)' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'File size exceeds 10MB limit' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      return;
    }

    setUploadFile(file);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setStatusMsg({ type: 'error', text: 'Please select a file first' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
      return;
    }

    setUploading(true);

    try {
      // 🔥 UPDATE: Passing uploadModelId to backend
      const result = await printerService.uploadSerialsExcel(uploadFile, uploadModelId);
      setUploadResult(result.results);
      setShowUploadModal(false);
      setShowResultModal(true);
      setUploadFile(null);
      setUploadModelId(""); // Reset the filter after upload

      if (result.results.success.length > 0) {
        setStatusMsg({ type: 'success', text: `${result.results.success.length} serials uploaded successfully!` });
        setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
        
        clearFilters();
        setCurrentPage(1);
        await onRefresh();
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: error.message || 'Upload failed' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await printerService.downloadSerialTemplate();
      setStatusMsg({ type: 'success', text: 'Template downloaded!' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
    } catch (error) {
      setStatusMsg({ type: 'error', text: 'Failed to download template' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
    }
  };

  const handleExportSerials = async () => {
    try {
      await printerService.exportSerialsExcel();
      setStatusMsg({ type: 'success', text: 'Serials exported!' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
    } catch (error) {
      setStatusMsg({ type: 'error', text: 'Failed to export serials' });
      setTimeout(() => setStatusMsg({ type: "", text: "" }), 3000);
    }
  };

  // Live duplicate for register input
  const registerIsDuplicate = useMemo(() => {
    return isDuplicateSerial(newSerial.value);
  }, [newSerial.value, isDuplicateSerial]);

  // Live duplicate for edit popup
  const editIsDuplicate = useMemo(() => {
    if (!editPopup) return false;
    return isDuplicateSerial(editData.value, editPopup.id);
  }, [editData.value, editPopup, isDuplicateSerial]);

  // Check if edit landing price exceeds MRP
  const editExceedsMRP = useMemo(() => {
    if (!editPopup) return false;
    return isLandingPriceExceedsMRP(editData.modelId, editData.landingPrice);
  }, [editData.modelId, editData.landingPrice, editPopup, isLandingPriceExceedsMRP]);

  // Check if register landing price exceeds MRP
  const registerExceedsMRP = useMemo(() => {
    if (!newSerial.modelId || !newSerial.landingPrice) return false;
    return isLandingPriceExceedsMRP(newSerial.modelId, newSerial.landingPrice);
  }, [newSerial.modelId, newSerial.landingPrice, isLandingPriceExceedsMRP]);

  // Edit save with reason validation
  const handleEditSave = async () => {
    if (!editData.value.trim()) return;

    if (editIsDuplicate) {
      alert(`Serial "${editData.value.trim()}" already exists!`);
      return;
    }

    if (editExceedsMRP && !editData.landingPriceReason.trim()) {
      alert(`Landing Price (₹${Number(editData.landingPrice).toLocaleString('en-IN')}) exceeds MRP (₹${getModelMRP(editData.modelId).toLocaleString('en-IN')}). Please provide a reason.`);
      return;
    }

    setEditLoading(true);
    try {
      await printerService.updateSerial(editPopup.id, {
        value: editData.value.trim(),
        landingPrice: Number(editData.landingPrice) || 0,
        modelId: Number(editData.modelId),
        landingPriceReason: editExceedsMRP ? editData.landingPriceReason.trim() : null
      });
      await onRefresh();
      setEditPopup(null);
    } catch (error) {
      const errorData = error.response?.data;
      const msg = errorData?.message || error.message || "Failed to update";

      if (errorData?.requiresReason) {
        alert(msg);
        return;
      }

      if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("duplicate")) {
        alert(`Serial "${editData.value.trim()}" already exists!`);
      } else {
        alert(msg);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const hasActiveFilters = filter || modelFilter;

  // ✅ FIX: Removed .reverse() so that newest items (which backend sends first) stay at the top.
  const filteredSerials = useMemo(() => {
    return serials.filter((s) => {
      const currentStatus = (s.status || "").trim().toLowerCase();
      if (currentStatus !== "available") return false;
      
      const serialValue = (s.value || s.serialNumber || "").toLowerCase(); 
      const matchesSearch = serialValue.includes(filter.toLowerCase());
      const matchesModel = modelFilter ? s.modelId === Number(modelFilter) : true;
      return matchesSearch && matchesModel;
    }); 
  }, [serials, filter, modelFilter]);

  const totalPages = Math.ceil(filteredSerials.length / ITEMS_PER_PAGE);
  const currentSerials = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSerials.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSerials, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, modelFilter]);

  // ✅ Effect to handle clicks outside the model dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ✅ Filtered models for the new searchable dropdown
  const filteredModelsForDropdown = useMemo(() => {
      if (!modelSearch) return models;
      return models.filter(m => 
          m.name.toLowerCase().includes(modelSearch.toLowerCase())
      );
  }, [models, modelSearch]);

  // ✅ Handle model selection from the new dropdown
  const handleModelSelect = (modelId) => {
      const selectedModel = models.find(m => m.id === Number(modelId));
      if (selectedModel) {
          handleModelChange(modelId);
          setModelSearch(selectedModel.name);
          setIsModelDropdownOpen(false);
      }
  }

  // ✅ Handle change in the model search input
  const handleModelSearchChange = (e) => {
      const { value } = e.target;
      setModelSearch(value);
      if (value === "") {
          // If input is cleared, deselect the model
          setNewSerial(prev => ({ ...prev, modelId: "", mrp: "", landingPrice: "" }));
      }
      if (!isModelDropdownOpen) {
          setIsModelDropdownOpen(true);
      }
  }

  const availableSerials = serials.filter(s => (s.status || "").trim().toLowerCase() === "available").length;
  const totalValue = serials.filter(s => (s.status || "").trim().toLowerCase() === "available")
                            .reduce((sum, s) => sum + (Number(s.landingPrice) || 0), 0);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = currentSerials.map(s => s.id);
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    } else {
      const pageIds = new Set(currentSerials.map(s => s.id));
      setSelectedIds(prev => prev.filter(id => !pageIds.has(id)));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedIds([]);
    } else {
      setIsSelectionMode(true);
    }
  };

  const getModelName = (modelId) => {
    const model = models.find(m => m.id === modelId);
    return model?.name || "Unknown";
  };

  const getModelColor = (modelId) => {
    const colors = [
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-cyan-100 text-cyan-700 border-cyan-200',
    ];
    return colors[modelId % colors.length];
  };

  const areAllVisibleSelected = currentSerials.length > 0 && currentSerials.every(s => selectedIds.includes(s.id));

  const getRowNumber = (index) => {
    return (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
  };

  return (
    <div className="relative pb-20 space-y-5">

      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-lg shadow-md shadow-emerald-500/25">
                <QrCode size={14} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {availableSerials} Available
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Serial Numbers</h1>
            {/* <p className="text-xs text-slate-500">Manage registered printer serials</p> */}
          </div>

          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {/* ✅ Excel Options for Admins */}
            {isAdmin && (
              <>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                  title="Download Template"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Template</span>
                </button>
                <button
                  onClick={handleExportSerials}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                  title="Export Excel"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 shadow-sm"
                  title="Upload Excel"
                >
                  <Upload size={14} />
                  <span className="hidden sm:inline">Upload</span>
                </button>
              </>
            )}

            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shadow-sm ${showFilter || hasActiveFilters
                ? "bg-amber-500 text-white shadow-amber-500/25"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">Filter</span>
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {(filter ? 1 : 0) + (modelFilter ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              onClick={toggleSelectionMode}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${isSelectionMode
                ? "bg-slate-800 text-white shadow-lg"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                }`}
            >
              {isSelectionMode ? <X size={14} /> : <CheckSquare size={14} />}
              <span className="hidden sm:inline">{isSelectionMode ? "Cancel" : "Select"}</span>
            </button>

            {canManage && <button
              onClick={handleToggleForm}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shadow-lg ${showForm
                ? "bg-slate-800 text-white"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25"
                }`}
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              <span className="hidden sm:inline">{showForm ? "Close" : "Add"}</span>
            </button>}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top duration-200">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[150px] max-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full border border-slate-200 pl-9 pr-8 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Search serial..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              {filter && <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
            </div>
            <div className="relative min-w-[140px]">
              <select className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none cursor-pointer bg-white" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
                <option value="">All Models</option>
                {models.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1 px-2">
              <span className="font-bold text-slate-700">{filteredSerials.length}</span> results
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 hover:bg-red-50 rounded-lg transition-all">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Badge */}
      {!showFilter && hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Filtered:</span>
          {filter && (
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium flex items-center gap-1">
              "{filter}" <button onClick={() => setFilter('')}><X size={12} /></button>
            </span>
          )}
          {modelFilter && (
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium flex items-center gap-1">
              {getModelName(Number(modelFilter))} <button onClick={() => setModelFilter('')}><X size={12} /></button>
            </span>
          )}
          <span className="text-slate-400">({filteredSerials.length} results)</span>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 shadow-sm">
          <div className="p-1.5 bg-emerald-100 rounded-lg"><Package size={12} className="text-emerald-600" /></div>
          <div><p className="text-[9px] text-emerald-500 uppercase font-bold">Available</p><p className="text-sm font-bold text-emerald-700">{availableSerials}</p></div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 shadow-sm">
            <div className="p-1.5 bg-blue-100 rounded-lg"><TrendingUp size={12} className="text-blue-600" /></div>
            <div><p className="text-[9px] text-blue-500 uppercase font-bold">Stock Value</p><p className="text-sm font-bold text-blue-700">₹{totalValue.toLocaleString('en-IN')}</p></div>
          </div>
        )}
      </div>

      {/* Register Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="bg-gradient-to-r from-emerald-500 to-cyan-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg"><ScanLine size={14} className="text-white" /></div>
              <div><h3 className="text-sm font-bold text-white">Add Serial</h3><p className="text-[10px] text-white/70">Scan barcode or type manually</p></div>
            </div>
            <div className="flex items-center gap-3">
              {sessionCount > 0 && (
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full">
                  <Hash size={12} className="text-white" />
                  <span className="text-sm font-bold text-white">{sessionCount}</span>
                  <span className="text-[10px] text-white/80">registered</span>
                </div>
              )}
              {newSerial.modelId && <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-1 rounded-full">{getModelName(newSerial.modelId)}</span>}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              
              {/* === START: NEW SEARCHABLE MODEL DROPDOWN === */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Box size={10} /> Model
                </label>
                <div ref={modelDropdownRef} className="relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={modelSearch}
                            onChange={handleModelSearchChange}
                            onFocus={() => setIsModelDropdownOpen(true)}
                            placeholder="Search & select model..."
                            className="w-full border border-slate-200 p-2.5 pl-3 pr-10 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            required={!newSerial.modelId}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          {newSerial.modelId && modelSearch ? (
                             <button type="button" onClick={() => handleModelSearchChange({target: {value: ""}})} className="hover:text-slate-700">
                               <X size={16} />
                             </button>
                          ) : (
                            <ChevronDown size={16} className={`transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                    </div>
                    
                    {isModelDropdownOpen && (
                        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
                            {filteredModelsForDropdown.length > 0 ? (
                                filteredModelsForDropdown.map(model => (
                                    <div
                                        key={model.id}
                                        onClick={() => handleModelSelect(model.id)}
                                        className="px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                                    >
                                        {model.name}
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">No models found</div>
                            )}
                        </div>
                    )}
                </div>
              </div>
              {/* === END: NEW SEARCHABLE MODEL DROPDOWN === */}

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MRP</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span><input className="w-full border border-slate-200 p-2.5 pl-7 rounded-xl text-sm bg-slate-100 text-slate-500 cursor-not-allowed" value={newSerial.mrp || '-'} readOnly /></div>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Landing Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    className={`w-full border p-2.5 pl-7 rounded-xl text-sm bg-white outline-none transition-all ${registerExceedsMRP
                      ? 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/30'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                      }`}
                    value={newSerial.landingPrice}
                    onChange={(e) => setNewSerial(prev => ({ ...prev, landingPrice: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>
                {registerExceedsMRP && (
                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={10} />
                    LP exceeds MRP — reason will be required
                  </p>
                )}
              </div>
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><QrCode size={10} /> Serial Number</label>
                <div className="relative">
                  <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  <input
                    ref={inputRef}
                    className={`w-full border p-2.5 pl-10 pr-10 rounded-xl text-sm font-mono tracking-wider outline-none transition-all ${registerIsDuplicate
                      ? 'border-red-400 bg-red-50/50 focus:ring-2 focus:ring-red-500'
                      : isSaving
                        ? 'border-amber-300 bg-amber-50/30 focus:ring-2 focus:ring-amber-400'
                        : 'border-emerald-200 bg-emerald-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500'
                      }`}
                    placeholder={isSaving ? "Saving..." : "Scan or type..."}
                    value={newSerial.value}
                    onChange={handleInputChange}
                    disabled={isSaving || reasonPopup.show}
                    required
                  />
                  {newSerial.value.trim() && !isSaving && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {registerIsDuplicate ? (
                        <AlertCircle size={16} className="text-red-500" />
                      ) : (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                    </div>
                  )}
                  {isSaving && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin block"></span>
                    </div>
                  )}
                </div>
                {registerIsDuplicate && (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle size={11} />
                    Serial "{newSerial.value.trim()}" already exists!
                  </p>
                )}
              </div>
              <div className="md:col-span-1">
                <button
                  type="submit"
                  disabled={registerIsDuplicate || isSaving || reasonPopup.show}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-2.5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="Save"
                >
                  {isSaving ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block"></span>
                  ) : (
                    <Save size={18} />
                  )}
                </button>
              </div>
            </div>
            {statusMsg.text && (
              <div className={`mt-3 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 ${statusMsg.type === 'error' ? 'text-red-700 bg-red-50 border border-red-100' : 'text-emerald-700 bg-emerald-50 border border-emerald-100'}`}>
                {statusMsg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{statusMsg.text}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
              <tr>
                {isSelectionMode && (
                  <th className="p-3 w-10 text-center bg-slate-100 border-r border-slate-200">
                    <input type="checkbox" onChange={handleSelectAll} checked={areAllVisibleSelected} className="w-4 h-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  </th>
                )}
                <th className="p-3 w-12 font-bold text-center">#</th>
                <th className="p-3 font-bold">Serial Number</th>
                <th className="p-3 font-bold">Model</th>
                {canManage && <th className="p-3 font-bold">Landing Price</th>}
                <th className="p-3 font-bold">Status</th>
                {!isSelectionMode && <th className="p-3 font-bold text-center w-24">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentSerials.map((s, index) => {
                const serialModel = models.find(m => m.id === s.modelId);
                const serialMRP = Number(serialModel?.mrp) || 0;
                const serialLP = Number(s.landingPrice) || 0;
                const hasExceededMRP = serialMRP > 0 && serialLP > serialMRP;

                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(s.id) ? 'bg-emerald-50/60' : ''}`}
                    onClick={() => isSelectionMode && handleSelectOne(s.id)}
                  >
                    {isSelectionMode && (
                      <td className="p-3 text-center border-r border-slate-100">
                        <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => handleSelectOne(s.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      </td>
                    )}
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                        {getRowNumber(index)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-lg">
                          <QrCode size={12} className="text-emerald-600" />
                        </div>
                        {/* 🔥 Fallback to show serial if value is undefined */}
                        <span className="font-mono text-sm font-bold text-slate-800 tracking-wide">{s.value || s.serialNumber || "N/A"}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getModelColor(s.modelId)}`}>
                        {getModelName(s.modelId)}
                      </span>
                    </td>
                  {canManage && (
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${hasExceededMRP ? 'text-amber-700' : 'text-slate-700'}`}>
                            ₹{(s.landingPrice || 0).toLocaleString('en-IN')}
                          </span>
                          {hasExceededMRP && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewReasonPopup(s);
                              }}
                              className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-all"
                              title={s.landingPriceReason || "LP > MRP — Click to view reason"}
                            >
                              <AlertTriangle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {s.status}
                      </span>
                    </td>
                    {!isSelectionMode && (
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                      {canManage && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditPopup(s); }}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete([s.id]); }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {currentSerials.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-100 rounded-full">
                        <QrCode size={32} className="text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">No serials found</p>
                      <p className="text-slate-400 text-xs">Try adjusting your filters or add new serials</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredSerials.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-700">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to <strong className="text-slate-700">{Math.min(currentPage * ITEMS_PER_PAGE, filteredSerials.length)}</strong> of <strong className="text-slate-700">{filteredSerials.length}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Upload Excel Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Upload size={18} className="text-white" />
                </div>
                <h3 className="text-base font-bold text-white">Upload Excel</h3>
              </div>
              <button onClick={() => !uploading && setShowUploadModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all text-white/70 hover:text-white" disabled={uploading}>
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              {/* 🔥 NEW: Model Filter Dropdown */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Filter size={10} /> Filter by Model (Optional)
                </label>
                <select 
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
                  value={uploadModelId}
                  onChange={(e) => setUploadModelId(e.target.value)}
                >
                  <option value="">Upload All Models from Excel</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">If selected, only serials of this model will be saved.</p>
              </div>

              <div
                className={`border-2 dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${dragActive ? 'border-indigo-500 bg-indigo-50' : uploadFile ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileInputChange} accept=".xlsx,.xls" className="hidden" />
                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2 text-emerald-600">
                    <File size={32} />
                    <span className="font-bold text-slate-800">{uploadFile.name}</span>
                    <span className="text-xs text-slate-500">{(uploadFile.size / 1024).toFixed(1)} KB</span>
                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }} className="mt-2 px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-all">Remove</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Upload size={32} className="text-slate-400" />
                    <p className="text-sm font-bold text-slate-700">Drag & drop Excel file here</p>
                    <span className="text-xs text-slate-400">or click to browse (.xlsx, .xls max 10MB)</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Instructions</h4>
                <p className="text-xs text-slate-500 mb-2">1. Download the template to get the correct Model IDs.</p>
                <p className="text-xs text-slate-500 mb-2">2. Fill the data without changing column headers.</p>
                <button onClick={handleDownloadTemplate} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-3">
                  <Download size={14} /> Download Template
                </button>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowUploadModal(false)} disabled={uploading} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
              <button onClick={handleUpload} disabled={!uploadFile || uploading} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-all">
                {uploading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" /> : <Upload size={14} />}
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Upload Results Modal */}
      {showResultModal && uploadResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowResultModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Upload Results</h3>
              <button onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-white transition-all"><X size={18} /></button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
              {/* 🔥 UPDATE: Added Skipped Box */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center">
                  <span className="block text-2xl font-bold text-emerald-700">{uploadResult.success?.length || 0}</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Success</span>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center">
                  <span className="block text-2xl font-bold text-red-700">{uploadResult.failed?.length || 0}</span>
                  <span className="text-[10px] text-red-600 font-bold uppercase mt-1">Failed</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col items-center justify-center">
                  <span className="block text-2xl font-bold text-amber-700">{uploadResult.skipped?.length || 0}</span>
                  <span className="text-[10px] text-amber-600 font-bold uppercase mt-1">Skipped</span>
                </div>
              </div>

              {uploadResult.failed?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-red-600 uppercase mb-2 border-b border-red-100 pb-1">Failed Rows</h4>
                  <div className="space-y-2">
                    {uploadResult.failed.map((item, idx) => (
                      <div key={idx} className="bg-red-50/50 p-2 rounded-lg border border-red-100 flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          {/* 🔥 Fallback to show serial if value is undefined */}
                          <span className="text-xs font-bold text-slate-700">Row {item.row} <span className="font-mono text-red-600 bg-red-100 px-1 rounded ml-1">{item.serialNumber || item.value}</span></span>
                        </div>
                        <span className="text-[10px] text-red-600">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowResultModal(false)} className="px-5 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Reason Required Popup */}
      {reasonPopup.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleReasonCancel} />

          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reason Required</h3>
                <p className="text-[11px] text-white/80">Landing Price exceeds MRP</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Price Mismatch Detected</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-amber-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">MRP</p>
                    <p className="text-lg font-bold text-slate-700">
                      ₹{(reasonPopup.pendingSerial?.mrp || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-red-200">
                    <p className="text-[10px] text-red-400 uppercase font-bold">Landing Price</p>
                    <p className="text-lg font-bold text-red-600">
                      ₹{Number(reasonPopup.pendingSerial?.landingPrice || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                    +₹{(Number(reasonPopup.pendingSerial?.landingPrice || 0) - Number(reasonPopup.pendingSerial?.mrp || 0)).toLocaleString('en-IN')} above MRP
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <QrCode size={12} />
                <span>Serial: <strong className="text-slate-700 font-mono">{reasonPopup.pendingSerial?.value}</strong></span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare size={10} /> Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm bg-white focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-all"
                  rows={3}
                  placeholder="Why is the landing price higher than MRP? (e.g., Import duties, special configuration, accessories included...)"
                  value={reasonPopup.reason}
                  onChange={(e) => setReasonPopup(prev => ({ ...prev, reason: e.target.value }))}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && reasonPopup.reason.trim()) {
                      e.preventDefault();
                      handleReasonSubmit();
                    }
                  }}
                />
                <p className="text-[10px] text-slate-400">
                  {reasonPopup.reason.trim().length}/500 characters • Press Enter to submit
                </p>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={handleReasonCancel}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReasonSubmit}
                disabled={!reasonPopup.reason.trim() || isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Save size={14} />
                )}
                {isSaving ? "Saving..." : "Save with Reason"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ View Reason Popup */}
      {viewReasonPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setViewReasonPopup(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-white" />
                <span className="text-sm font-bold text-white">LP {'>'} MRP Reason</span>
              </div>
              <button
                onClick={() => setViewReasonPopup(null)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <QrCode size={14} className="text-slate-400" />
                {/* 🔥 Fallback to show serial if value is undefined */}
                <span className="font-mono text-sm font-bold text-slate-700">{viewReasonPopup.value || viewReasonPopup.serialNumber}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                  <p className="text-[9px] text-slate-400 uppercase font-bold">MRP</p>
                  <p className="text-sm font-bold text-slate-700">
                    ₹{(getModelMRP(viewReasonPopup.modelId) || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-2.5 border border-red-100">
                  <p className="text-[9px] text-red-400 uppercase font-bold">Landing Price</p>
                  <p className="text-sm font-bold text-red-600">
                    ₹{(viewReasonPopup.landingPrice || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  +₹{((Number(viewReasonPopup.landingPrice) || 0) - (getModelMRP(viewReasonPopup.modelId) || 0)).toLocaleString('en-IN')} above MRP
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare size={10} /> Reason
                </label>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  {viewReasonPopup.landingPriceReason || (
                    <span className="text-slate-400 italic">No reason provided</span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewReasonPopup(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Popup */}
      {editPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setEditPopup(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Pencil size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Serial</h3>
                  <p className="text-[11px] text-white/70">#{editPopup.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditPopup(null)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all text-white/70 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <QrCode size={10} /> Serial Number
                </label>
                {isAdmin ? (
                  <div className="relative">
                    <input
                      className={`w-full border p-3 pr-10 rounded-xl text-sm font-mono tracking-wider bg-white outline-none transition-all ${editIsDuplicate
                        ? 'border-red-400 focus:ring-2 focus:ring-red-500 bg-red-50/50'
                        : 'border-slate-200 focus:ring-2 focus:ring-blue-500'
                        }`}
                      value={editData.value}
                      onChange={(e) => setEditData(prev => ({ ...prev, value: e.target.value }))}
                    />
                    {editData.value.trim() && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {editIsDuplicate ? (
                          <AlertCircle size={16} className="text-red-500" />
                        ) : (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full border border-slate-100 p-3 rounded-xl text-sm font-mono tracking-wider bg-slate-50 text-slate-700 font-bold">
                    {editData.value}
                  </div>
                )}
                {editIsDuplicate && (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle size={11} />
                    Serial "{editData.value.trim()}" already exists!
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Box size={10} /> Model
                </label>
                {isAdmin ? (
                  <select
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    value={editData.modelId}
                    onChange={(e) => {
                      const newModelId = e.target.value;
                      setEditData(prev => ({
                        ...prev,
                        modelId: newModelId,
                        landingPriceReason: ""
                      }));
                    }}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full border border-slate-100 p-3 rounded-xl text-sm bg-slate-50">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getModelColor(editPopup.modelId)}`}>
                      {getModelName(editPopup.modelId)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MRP (Reference)</label>
                <div className="w-full border border-slate-100 p-3 rounded-xl text-sm bg-slate-50 text-slate-500">
                  ₹{getModelMRP(editData.modelId).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Landing Price</label>
                {isAdmin ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                    <input
                      type="number"
                      className={`w-full border p-3 pl-7 rounded-xl text-sm bg-white outline-none transition-all ${editExceedsMRP
                        ? 'border-amber-400 focus:ring-2 focus:ring-amber-500 bg-amber-50/30'
                        : 'border-slate-200 focus:ring-2 focus:ring-blue-500'
                        }`}
                      value={editData.landingPrice}
                      onChange={(e) => setEditData(prev => ({ ...prev, landingPrice: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="w-full border border-slate-100 p-3 rounded-xl text-sm bg-slate-50 text-slate-700 font-semibold">
                    ₹{(editPopup.landingPrice || 0).toLocaleString('en-IN')}
                  </div>
                )}
                {editExceedsMRP && (
                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                    <AlertTriangle size={10} />
                    LP (₹{Number(editData.landingPrice).toLocaleString('en-IN')}) exceeds MRP (₹{getModelMRP(editData.modelId).toLocaleString('en-IN')}) — reason required below
                  </p>
                )}
              </div>

              {editExceedsMRP && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare size={10} /> Reason for LP {'>'} MRP <span className="text-red-500">*</span>
                  </label>
                  {isAdmin ? (
                    <textarea
                      className={`w-full border p-3 rounded-xl text-sm outline-none resize-none transition-all ${editData.landingPriceReason.trim()
                        ? 'border-amber-300 bg-amber-50/30 focus:ring-2 focus:ring-amber-500'
                        : 'border-red-300 bg-red-50/30 focus:ring-2 focus:ring-red-500'
                        }`}
                      rows={2}
                      placeholder="Why is the landing price higher than MRP?"
                      value={editData.landingPriceReason}
                      onChange={(e) => setEditData(prev => ({ ...prev, landingPriceReason: e.target.value }))}
                    />
                  ) : (
                    <div className="w-full border border-amber-200 p-3 rounded-xl text-sm bg-amber-50 text-amber-800">
                      {editPopup.landingPriceReason || <span className="text-slate-400 italic">No reason</span>}
                    </div>
                  )}
                  {!editData.landingPriceReason.trim() && (
                    <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                      <AlertCircle size={10} /> Reason is mandatory when LP exceeds MRP
                    </p>
                  )}
                </div>
              )}

              {!editExceedsMRP && editPopup.landingPriceReason && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare size={10} /> Previous LP Reason (Archived)
                  </label>
                  <div className="w-full border border-slate-100 p-3 rounded-xl text-sm bg-slate-50 text-slate-500 italic">
                    {editPopup.landingPriceReason}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                <div className="w-full border border-slate-100 p-3 rounded-xl text-sm bg-slate-50">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {editPopup.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0">
              {isAdmin && (
                <button
                  onClick={() => handleDelete([editPopup.id])}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all border border-red-200"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setEditPopup(null)}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                {isAdmin && (
                  <button
                    onClick={handleEditSave}
                    disabled={editLoading || editIsDuplicate || (editExceedsMRP && !editData.landingPriceReason.trim())}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <Save size={14} />
                    )}
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom duration-300">
          <span className="font-bold text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">{selectedIds.length} Selected</span>
          <div className="h-4 w-px bg-slate-700"></div>
          {isAdmin ? (
            <button onClick={() => handleDelete(selectedIds)} className="flex items-center gap-1.5 text-xs hover:text-red-400 transition font-medium">
              <Trash2 size={14} /> Delete
            </button>
          ) : (
            <span className="text-xs text-slate-400 italic">Delete Restricted</span>
          )}
          <button onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }} className="text-slate-400 hover:text-white transition">
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}