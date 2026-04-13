import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format, isToday, parseISO, differenceInDays } from "date-fns";
import {
  Trash2, X, CheckSquare, Search, AlertCircle,
  RotateCcw, CheckCircle, XCircle, Truck,
  ChevronLeft, ChevronRight,
  Box, Clock, Phone, UploadCloud, FileText,
  Receipt, MapPin, Info, Banknote, Package,
  Edit2, Save, AlertTriangle, ExternalLink, User
} from "lucide-react";
import { printerService } from "../services/api";

const ITEMS_PER_PAGE = 20;

// ============================================
// 🚨 URGENCY HELPER
// ============================================
function getDeadlineUrgency(lastDeliveryDate, status) {
  if (!lastDeliveryDate) return { level: "none", label: "", daysLeft: null };

  const cancelledStatuses = ["Order Cancelled", "Delivered", "Completed"];
  if (cancelledStatuses.includes(status)) return { level: "none", label: "", daysLeft: null };

  try {
    const deadline = new Date(lastDeliveryDate);
    if (isNaN(deadline.getTime())) return { level: "none", label: "", daysLeft: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const daysLeft = differenceInDays(deadline, today);

    if (daysLeft < 0) return { level: "overdue", label: `${Math.abs(daysLeft)}d OVERDUE`, daysLeft };
    if (daysLeft === 0) return { level: "today", label: "DUE TODAY", daysLeft: 0 };
    if (daysLeft === 1) return { level: "critical", label: "DUE TOMORROW", daysLeft: 1 };
    if (daysLeft <= 3) return { level: "warning", label: `${daysLeft}d LEFT`, daysLeft };
    return { level: "safe", label: "", daysLeft };
  } catch {
    return { level: "none", label: "", daysLeft: null };
  }
}

// ============================================
// 🚨 URGENCY BADGE COMPONENT
// ============================================
const DeadlineBadge = ({ lastDeliveryDate, status }) => {
  const urgency = getDeadlineUrgency(lastDeliveryDate, status);
  if (urgency.level === "none" || urgency.level === "safe") return null;

  const styles = {
    overdue: "bg-red-500 text-white animate-pulse",
    today: "bg-red-500 text-white",
    critical: "bg-orange-500 text-white",
    warning: "bg-amber-100 text-amber-700 border border-amber-300"
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${styles[urgency.level]}`}>
      <AlertTriangle size={9} />
      {urgency.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color, subText, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 min-w-[160px] flex-1 hover:shadow-md transition-shadow ${onClick ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
  >
    <div className={`p-2 rounded-lg ${color}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
      <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{value}</h3>
      {subText && <p className="text-[9px] text-slate-400 mt-0.5">{subText}</p>}
    </div>
  </div>
);

export default function Dispatch({
  models = [],
  serials = [],
  dispatches = [],
  currentUser = null,
  onUpdate,
  onDelete,
  onRestore,
  onUpdateModel,
  isAdmin,
  isSupervisor
}) {
  const [activeTabView, setActiveTabView] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [viewOrder, setViewOrder] = useState(null);

  /* ================= PACKAGING CONFIG STATE ================= */
  const [showPackagingModal, setShowPackagingModal] = useState(false);
  const [editingModelId, setEditingModelId] = useState(null);
  const [tempCost, setTempCost] = useState("");

  const [localModels, setLocalModels] = useState(models);

  useEffect(() => {
    setLocalModels(models);
  }, [models]);

  /* ================= LOGISTICS STATE ================= */
  const [logisticsBatch, setLogisticsBatch] = useState(null);
  const [logisticsForm, setLogisticsForm] = useState({
    courierPartner: "",
    logisticsDispatchDate: "",
    trackingId: "",
    freightCharges: "",
    logisticsStatus: "Packing in Process",
    podFile: null,
    existingPodName: "",
    includePackaging: "no",
    packagingCost: ""
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [itemsToRestore, setItemsToRestore] = useState([]);
  const [isRestoring, setIsRestoring] = useState(false);

  const getDetails = useCallback((id) => {
    if (!id) return { serial: "N/A", model: "-", company: "-", modelId: null };
    const lookupId = String(id);
    const s = serials.find((x) => String(x.id) === lookupId);
    const m = s ? localModels.find((x) => String(x.id) === String(s.modelId)) : null;
    return {
      serial: s?.value || s?.serialNumber || s?.serial || "N/A",
      model: m?.name || "-",
      company: m?.company || m?.companyName || "-",
      modelId: m?.id
    };
  }, [serials, localModels]);

  // ✅ UPDATED: Added Returned Logic
  const processedData = useMemo(() => {
    if (!dispatches || !Array.isArray(dispatches)) return { active: [], cancelled: [], returned: [] };
    
    const active = [];
    const cancelled = [];
    const returned = [];

    dispatches.forEach((d) => {
      const isCancelled = d.isDeleted || d.status === "Order Cancelled";
      
      const lookupId = String(d.serialNumberId || d.serialId);
      const s = serials.find((x) => String(x.id) === lookupId);
      
      // Agar serial ka status 'Dispatched' nahi hai aur order cancel bhi nahi hai, matlab item wapas aa gaya hai.
      const isReturned = !isCancelled && s && s.status !== "Dispatched";

      const hiddenStatuses = [
        "Order Confirmed",
        "Pending",
        "Send for Billing",
        "Order On Hold",
        "Order Not Confirmed"
      ];

      if (isCancelled) {
        cancelled.push(d);
      } else if (isReturned) {
        returned.push(d);
      } else {
      const hasLogistics = d.logisticsStatus && d.logisticsStatus.trim() !== "";
      if (!hiddenStatuses.includes(d.status) || hasLogistics) {
          active.push(d);
        }
      }
    });

    return { active, cancelled, returned };
  }, [dispatches, serials]);

  const activeDispatches = processedData.active;
  const cancelledDispatches = processedData.cancelled;
  const returnedDispatches = processedData.returned;

  const dashboardStats = useMemo(() => {
    let totalDispatchToday = 0;
    let readyToday = 0;
    let deliveredToday = 0;
    let rtoCount = 0;
    let totalRevenue = 0;
    let totalFreight = 0;
    const processedTrackingIds = new Set();

    activeDispatches.forEach((d) => {
      const dispatchDate = d.dispatchDate ? parseISO(d.dispatchDate) : null;
      if (dispatchDate && isToday(dispatchDate)) totalDispatchToday++;

      const logisticsDate = d.logisticsDispatchDate ? parseISO(d.logisticsDispatchDate) : null;
      const isLogisticsToday = logisticsDate && isToday(logisticsDate);

      if (d.logisticsStatus === "Ready for Pickup" && isLogisticsToday) readyToday++;
      if (d.logisticsStatus === "Delivered" && isLogisticsToday) deliveredToday++;
      if (d.logisticsStatus === "RTO") rtoCount++;

      totalRevenue += (Number(d.sellingPrice) || 0);

      const freight = Number(d.freightCharges) || 0;
      if (freight > 0) {
        if (d.trackingId && d.trackingId.trim() !== "") {
          if (!processedTrackingIds.has(d.trackingId)) {
            totalFreight += freight;
            processedTrackingIds.add(d.trackingId);
          }
        } else {
          totalFreight += freight;
        }
      }
    });

    return { totalDispatchToday, readyToday, deliveredToday, rtoCount, totalRevenue, totalFreight };
  }, [activeDispatches]);

  const allGroupedDispatches = useMemo(() => {
    const groups = {};
    const sourceDispatches = 
      activeTabView === "active" ? activeDispatches : 
      activeTabView === "cancelled" ? cancelledDispatches : returnedDispatches;

    const filtered = sourceDispatches.filter((d) => {
      const { serial } = getDetails(d.serialNumberId || d.serialId);
      const term = searchTerm.toLowerCase();
      return (
        (d.firmName || "").toLowerCase().includes(term) ||
        (d.customerName || d.customer || "").toLowerCase().includes(term) ||
        (serial || "").toLowerCase().includes(term) ||
        (d.trackingId || "").toLowerCase().includes(term) ||
        (d.modelName || "").toLowerCase().includes(term)
      );
    });

    filtered.forEach((d) => {
      const key = d.customerName || d.customer || d.dispatchGroupId || d.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b[0].dispatchDate || b[0].createdAt || 0) - new Date(a[0].dispatchDate || a[0].createdAt || 0)
    );
  }, [activeDispatches, cancelledDispatches, returnedDispatches, activeTabView, searchTerm, getDetails]);

  const totalPages = Math.max(1, Math.ceil(allGroupedDispatches.length / ITEMS_PER_PAGE));

  const currentDispatches = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allGroupedDispatches.slice(start, start + ITEMS_PER_PAGE);
  }, [allGroupedDispatches, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIndices([]);
  }, [activeTabView, searchTerm]);

  const handleTabChange = (tab) => {
    setActiveTabView(tab);
    setIsSelectionMode(false);
    setSearchTerm("");
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIndices([]);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIndices(currentDispatches.map((_, index) => index));
    else setSelectedIndices([]);
  };

  const handleSelectOne = (index) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const getSelectedItems = () => {
    return selectedIndices.flatMap((index) => currentDispatches[index]?.map((item) => item.id) || []);
  };

  const handleViewOrder = (e, group) => {
    e.stopPropagation();
    setViewOrder(group);
  };

  const handleBulkDeleteClick = () => {
    if (!isAdmin) { alert("🚫 Access Denied: Admin Only."); return; }
    const allIds = getSelectedItems();
    if (allIds.length === 0) return;
    setItemsToDelete(allIds);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const handleSingleDeleteClick = (group) => {
    if (!isAdmin) { alert("🚫 Access Denied: Admin Only."); return; }
    const ids = group.map((item) => item.id).filter(Boolean);
    if (ids.length === 0) return;
    setItemsToDelete(ids);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteReason.trim()) { alert("⚠️ Please enter a reason for cancellation!"); return; }
    if (!onDelete) return;
    if (!itemsToDelete.length) return;
    setIsDeleting(true);
    try {
      await onDelete(itemsToDelete, deleteReason, currentUser?.username || "Admin");
      setShowDeleteModal(false);
      setSelectedIndices([]);
      setIsSelectionMode(false);
      setItemsToDelete([]);
      setDeleteReason("");
    } catch (error) {
      alert("Failed to delete: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkRestoreClick = () => {
    if (!isAdmin) { alert("🚫 Access Denied: Admin Only."); return; }
    const allIds = getSelectedItems();
    if (allIds.length === 0) return;
    setItemsToRestore(allIds);
    setShowRestoreModal(true);
  };

  const handleSingleRestoreClick = (group) => {
    if (!isAdmin) { alert("🚫 Access Denied: Admin Only."); return; }
    const ids = group.map((item) => item.id).filter(Boolean);
    setItemsToRestore(ids);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    setIsRestoring(true);
    try {
      if (onRestore) await onRestore(itemsToRestore);
      setShowRestoreModal(false);
      setSelectedIndices([]);
      setIsSelectionMode(false);
    } catch (error) {
      alert("Failed to restore: " + error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const startEditingModel = (model) => {
    setEditingModelId(model.id);
    setTempCost(model.packagingCost || "");
  };

  const saveModelCost = async (modelId) => {
    const apiFunction = onUpdateModel || printerService.onUpdateModel || printerService.updateModel;
    const existingModel = localModels.find(m => m.id === modelId);
    if (apiFunction && existingModel) {
      try {
        const newCost = Number(tempCost);
        await apiFunction(modelId, { ...existingModel, packagingCost: newCost });
        setLocalModels(prev => prev.map(m => m.id === modelId ? { ...m, packagingCost: newCost } : m));
        setEditingModelId(null);
      } catch (error) {
        alert("Failed to update model cost: " + error.message);
      }
    }
  };

  const handleLogisticsClick = (group) => {
    setLogisticsBatch(group);

    const firstItem = group[0] || {};
    let formattedDate = "";
    if (firstItem.logisticsDispatchDate) {
      try {
        formattedDate = new Date(firstItem.logisticsDispatchDate).toISOString().split("T")[0];
      } catch {
        formattedDate = "";
      }
    }

    const savedCost = firstItem.packagingCost ? Number(firstItem.packagingCost) : 0;

    setLogisticsForm({
      courierPartner: firstItem.courierPartner ?? "",
      logisticsDispatchDate: formattedDate,
      trackingId: firstItem.trackingId ?? "",
      freightCharges: firstItem.freightCharges ?? "",
      logisticsStatus: firstItem.logisticsStatus ?? "Packing in Process",
      podFile: null,
      existingPodName: firstItem.podFilename ?? "",
      includePackaging: savedCost > 0 ? "yes" : "no",
      packagingCost: savedCost > 0 ? savedCost : ""
    });
  };

  const handlePackagingToggle = (e) => {
    const value = e.target.value;
    if (value === "yes") {
      if (logisticsBatch && logisticsBatch.length > 0) {
        const totalBatchCost = logisticsBatch.reduce((sum, item) => {
          const lookupId = String(item.serialNumberId || item.serialId);
          const s = serials.find((x) => String(x.id) === lookupId);
          if (!s) return sum;
          const matchedModel = localModels.find(m => String(m.id) === String(s.modelId));
          return sum + (matchedModel ? Number(matchedModel.packagingCost || 0) : 0);
        }, 0);
        setLogisticsForm(prev => ({
          ...prev,
          includePackaging: "yes",
          packagingCost: totalBatchCost > 0 ? totalBatchCost : ""
        }));
      } else {
        setLogisticsForm(prev => ({ ...prev, includePackaging: "yes", packagingCost: "" }));
      }
    } else {
      setLogisticsForm(prev => ({ ...prev, includePackaging: "no", packagingCost: "" }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setLogisticsForm({ ...logisticsForm, podFile: file });
  };

  const handleSaveLogistics = async (e) => {
    e.preventDefault();
    const finalLogisticsStatus = logisticsForm.logisticsStatus;

    if (finalLogisticsStatus === "Delivered" && !logisticsForm.podFile && !logisticsForm.existingPodName) {
      alert("⚠️ Proof of Delivery (POD) is required to mark status as 'Delivered'.");
      return;
    }

    let podName = logisticsForm.existingPodName;
    if (logisticsForm.podFile) {
      try {
        const uploadResponse = await printerService.uploadOrderDocument(
          logisticsBatch[0].id,
          logisticsForm.podFile,
          "pod"
        );
        podName = uploadResponse.filename;
      } catch (uploadError) {
        console.error("POD upload failed:", uploadError);
        podName = "uploaded_pod_" + Date.now();
      }
    }

    const commonUpdateData = {
      courierPartner: logisticsForm.courierPartner || null,
      logisticsDispatchDate: logisticsForm.logisticsDispatchDate || null,
      trackingId: logisticsForm.trackingId || null,
      freightCharges: logisticsForm.freightCharges ? Number(logisticsForm.freightCharges) : 0,
      logisticsStatus: finalLogisticsStatus,
      podFilename: podName || null,
      packagingCost: logisticsForm.includePackaging === "yes" ? Number(logisticsForm.packagingCost) : 0
    };

    try {
      if (!logisticsBatch || logisticsBatch.length === 0) return;

      const bulkPayload = logisticsBatch.map((item) => {
        let nextStatus = item.status;

        if (
          finalLogisticsStatus === "Delivered" &&
          item.status !== "Completed" &&
          item.status !== "Order Cancelled"
        ) {
          nextStatus = "Payment Pending";
        }

        return {
          id: item.id,
          status: nextStatus,
          ...commonUpdateData
        };
      });

      if (bulkPayload.length > 1) {
        if (onUpdate) await onUpdate(null, bulkPayload);
      } else {
        if (onUpdate) await onUpdate(bulkPayload[0].id, bulkPayload[0]);
      }
      setLogisticsBatch(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update logistics.");
    }
  };

  const checkIsReturned = (item) => {
    if (item.isDeleted && item.cancelReason) return true;
    const lookupId = String(item.serialNumberId || item.serialId);
    const s = serials.find((x) => String(x.id) === lookupId);
    if (s && s.status !== 'Dispatched') return true;
    return false;
  };

  const getRowUrgencyClasses = (group) => {
    const item = group[0];
    if (!item) return "";

    const isCancelled = item.isDeleted || item.status === "Order Cancelled";
    if (isCancelled) return "";

    const deliveredStatuses = ["Delivered", "Completed"];
    const currentStatus = item.logisticsStatus || item.status || "";
    if (deliveredStatuses.includes(currentStatus)) return "";

    const deadlineDate = item.lastDeliveryDate || item.logisticsDispatchDate;
    if (!deadlineDate) return "";

    const urgency = getDeadlineUrgency(deadlineDate, item.status);

    switch (urgency.level) {
      case "overdue": return "bg-red-50 border-l-4 border-l-red-500";
      case "today": return "bg-red-50/70 border-l-4 border-l-red-400";
      case "critical": return "bg-orange-50/70 border-l-4 border-l-orange-400";
      case "warning": return "bg-amber-50/50 border-l-4 border-l-amber-400";
      default: return "";
    }
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg shadow-md shadow-amber-500/25 text-white">
              <Truck size={18} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Dispatch Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium">Manage shipments & track order status</p>
        </div>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 ${isAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3`}>
        <StatCard icon={Box} label="Total Dispatch (Today)" value={dashboardStats.totalDispatchToday} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={Clock} label="Ready for Pickup" value={dashboardStats.readyToday} color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle} label="Delivered (Today)" value={dashboardStats.deliveredToday} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={RotateCcw} label="RTO (Total)" value={dashboardStats.rtoCount} color="bg-red-50 text-red-600" />

        {isAdmin && (
          <>
            <StatCard
              icon={Banknote}
              label="Freight Charges"
              value={`₹${dashboardStats.totalFreight.toLocaleString("en-IN")}`}
              color="bg-purple-50 text-purple-600"
              subText="Total Logistics Cost"
            />
            <div className="md:col-span-3 lg:col-span-5 flex justify-end">
              <button
                onClick={() => setShowPackagingModal(true)}
                className="flex items-center gap-2 bg-pink-50 text-pink-700 px-4 py-2 rounded-xl text-xs font-bold border border-pink-100 hover:bg-pink-100 transition shadow-sm"
              >
                <Package size={14} />Packaging Cost
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-4 border-t border-slate-100">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => handleTabChange("active")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTabView === "active" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <CheckCircle size={14} /> Active
          </button>
          {/* ✅ RETURNED TAB ADDED HERE */}
          <button onClick={() => handleTabChange("returned")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTabView === "returned" ? "bg-white text-orange-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <RotateCcw size={14} /> Returned
          </button>
          <button onClick={() => handleTabChange("cancelled")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTabView === "cancelled" ? "bg-white text-red-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <XCircle size={14} /> Cancelled
          </button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all shadow-sm"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isSelectionMode ? "bg-slate-800 text-white shadow-lg" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"}`}
          >
            {isSelectionMode ? <X size={14} /> : <CheckSquare size={14} />}
            {isSelectionMode ? "Cancel" : "Select"}
          </button>
        </div>
      </div>

      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${activeTabView === "active" ? "border-slate-200" : activeTabView === "returned" ? "border-orange-100" : "border-red-100"}`}>
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm">
            <thead className={`text-[10px] uppercase font-bold tracking-wider border-b ${activeTabView === "active" ? "bg-slate-50 text-slate-500" : activeTabView === "returned" ? "bg-orange-50/50 text-slate-500 border-orange-100" : "bg-red-50/50 text-slate-500 border-red-100"}`}>
              <tr>
                {isSelectionMode && (
                  <th className="w-10 p-3 text-center">
                    <input type="checkbox" onChange={handleSelectAll} checked={currentDispatches.length > 0 && selectedIndices.length === currentDispatches.length} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                  </th>
                )}
                <th className="w-10 p-3 text-center">#</th>
                <th className="p-3 text-left">Order ID</th>
                <th className="p-3 text-left">Platform</th>
                <th className="p-3 text-left">Model</th>
                <th className="p-3 text-center">Order Value</th>
                <th className="p-3 text-center">Order Date</th>
                <th className="p-3 text-center">Last Delivery</th>
                <th className="p-3 text-left">Contact No.</th>
                <th className="p-3 text-left">Status</th>
                {!isSelectionMode && <th className="w-24 p-3 text-center">Action</th>}
              </tr>
            </thead>

            <tbody className={`divide-y ${activeTabView === "active" ? "divide-slate-100" : activeTabView === "returned" ? "divide-orange-50" : "divide-red-50"}`}>
              {currentDispatches.length === 0 ? (
                <tr>
                  <td colSpan="100" className="p-12 text-center text-sm font-medium text-slate-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                currentDispatches.map((group, index) => {
                  const item = group[0];
                  const isMultiple = group.length > 1;

                  const dbModelName = item.modelName;
                  const lookupId = item.serialNumberId || item.serialId;
                  const { model: calculatedModel } = getDetails(lookupId);
                  const displayModel = dbModelName || calculatedModel || "-";

                  const isSelected = selectedIndices.includes(index);

                  // Returned check for styles
                  const isReturnedItem = activeTabView === "returned" || checkIsReturned(item);
                  const isCancelled = item.isDeleted || item.status === "Order Cancelled";

                  const totalSellPrice = group.reduce((sum, i) => {
                    const returned = checkIsReturned(i);
                    if (returned) return sum;
                    return sum + (Number(i.sellingPrice) || 0);
                  }, 0);

                  const statusColors = {
                    Delivered: "bg-green-100 text-green-700 border-green-200",
                    RTO: "bg-red-100 text-red-700 border-red-200",
                    "Delivery in Process": "bg-blue-100 text-blue-700 border-blue-200",
                    "Ready for Pickup": "bg-amber-100 text-amber-700 border-amber-200",
                    "Packing in Process": "bg-cyan-100 text-cyan-700 border-cyan-200",
                    "Send for Billing": "bg-indigo-100 text-indigo-700 border-indigo-200",
                    Billed: "bg-emerald-100 text-emerald-700 border-emerald-200",
                    "Order On Hold": "bg-yellow-100 text-yellow-700 border-yellow-200",
                    "Order Cancelled": "bg-red-100 text-red-700 border-red-200"
                  };

                  let displayStatus = item.logisticsStatus || item.status || "Packing in Process";
                  if (item.status === "Order Cancelled") displayStatus = "Cancelled";
                  if (item.status === "Order On Hold") displayStatus = "On Hold";
                  if (displayStatus === "Ready for Dispatch") displayStatus = "Packing in Process";

                  const statusStyle = statusColors[displayStatus] || statusColors[item.status] || "bg-slate-100 text-slate-600";

                  const rowUrgencyClass = getRowUrgencyClasses(group);
                  const deadlineDate = item.lastDeliveryDate || item.logisticsDispatchDate;
                  const urgencyInfo = getDeadlineUrgency(deadlineDate, item.status);

                  return (
                    <tr
                      key={index}
                      className={`transition-colors cursor-pointer ${rowUrgencyClass} ${isSelected
                        ? (isCancelled ? "bg-red-50" : isReturnedItem ? "bg-orange-50" : "bg-amber-50")
                        : !rowUrgencyClass
                          ? (isCancelled ? "hover:bg-red-50/50" : isReturnedItem ? "hover:bg-orange-50/50" : "hover:bg-amber-50/30")
                          : (urgencyInfo.level === "overdue" || urgencyInfo.level === "today"
                            ? "hover:bg-red-100/70"
                            : urgencyInfo.level === "critical"
                              ? "hover:bg-orange-100/50"
                              : "hover:bg-amber-100/50")
                        }`}
                      onClick={() => isSelectionMode && handleSelectOne(index)}
                    >
                      {isSelectionMode && (
                        <td className="p-3 text-center">
                          <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(index)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                        </td>
                      )}
                      <td className="p-3 text-center text-xs font-medium text-slate-400">
                        {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </td>
                      <td className="p-3">
                        <button onClick={(e) => handleViewOrder(e, group)} className={`text-xs font-mono font-bold text-left hover:underline ${isCancelled || isReturnedItem ? "text-slate-400 line-through" : "text-indigo-600"}`}>
                          {item.customerName || item.customer || "-"}
                        </button>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md ${isCancelled || isReturnedItem ? "line-through text-slate-400 bg-slate-100" : ""}`}>
                          {item.firmName}
                        </span>
                        {isReturnedItem && !isCancelled && (
                          <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-orange-100 text-orange-700 font-bold rounded uppercase">Returned</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-slate-600 font-medium">
                          {isMultiple ? `Multiple (${group.length})` : displayModel}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-bold ${isCancelled || isReturnedItem ? "text-slate-400 line-through" : "text-emerald-600"}`}>
                          ₹{totalSellPrice.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {item.dispatchDate ? format(new Date(item.dispatchDate), "dd MMM yyyy") : "-"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[11px] font-mono ${urgencyInfo.level === "overdue" ? "text-red-600 font-bold" :
                            urgencyInfo.level === "today" ? "text-red-600 font-bold" :
                              urgencyInfo.level === "critical" ? "text-orange-600 font-bold" :
                                urgencyInfo.level === "warning" ? "text-amber-600 font-semibold" :
                                  "text-slate-500"
                            }`}>
                            {deadlineDate ? format(new Date(deadlineDate), "dd MMM yyyy") : "-"}
                          </span>
                          <DeadlineBadge lastDeliveryDate={deadlineDate} status={item.status} />
                        </div>
                      </td>
                      <td className="p-3">
                        {item.contactNumber ? (
                          <div className="flex items-center gap-1 text-slate-600 text-xs">
                            <Phone size={10} className="text-slate-400" /> {item.contactNumber}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit whitespace-nowrap ${statusStyle}`}>
                          {displayStatus}
                        </span>
                      </td>
                      {!isSelectionMode && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isCancelled ? (
                              isAdmin ? (
                                <button onClick={(e) => { e.stopPropagation(); handleSingleRestoreClick(group); }} className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition text-[10px] font-bold mx-auto">
                                  <RotateCcw size={12} /> Restore
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400">Admin</span>
                              )
                            ) : (
                              <>
                                {!isSupervisor && <button onClick={(e) => { e.stopPropagation(); handleLogisticsClick(group); }} title="Update Logistics" className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition">
                                  <Truck size={14} />
                                </button>}
                                <button onClick={(e) => { e.stopPropagation(); handleSingleDeleteClick(group); }} title="Soft Delete" className={`p-1.5 rounded-lg transition ${isAdmin ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-200 cursor-not-allowed"}`} disabled={!isAdmin}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-50 border border-transparent hover:border-slate-200">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-50 border border-transparent hover:border-slate-200">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedIndices.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-4 z-50">
          <span className="font-bold text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {selectedIndices.length} Selected
          </span>
          {activeTabView === "active" || activeTabView === "returned" ? (
            <button onClick={handleBulkDeleteClick} className="flex items-center gap-1.5 text-xs hover:text-red-400 transition font-medium">
              <Trash2 size={14} /> Cancel
            </button>
          ) : (
            <button onClick={handleBulkRestoreClick} className="flex items-center gap-1.5 text-xs hover:text-emerald-400 transition font-medium">
              <RotateCcw size={14} /> Restore
            </button>
          )}
          <button onClick={() => { setSelectedIndices([]); setIsSelectionMode(false); }} className="text-slate-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-slate-800 mb-2 text-center flex items-center justify-center gap-2">
              <AlertCircle className="text-red-500" /> Confirm Cancel
            </h3>
            <textarea className="w-full border p-3 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-red-500 outline-none" rows="2" placeholder="Reason is required..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">Keep</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition flex items-center justify-center gap-2">
                {isDeleting ? "Cancelling..." : "Cancel Items"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Confirm Restore</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowRestoreModal(false)} className="flex-1 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">Cancel</button>
              <button onClick={confirmRestore} disabled={isRestoring} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {isRestoring ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPackagingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Package className="text-pink-500" size={20} /> Packaging Cost</h3>
              <button onClick={() => setShowPackagingModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Model Name</th>
                    <th className="px-4 py-3 text-right">Standard Cost</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localModels.map((model) => (
                    <tr key={model.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{model.name}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {editingModelId === model.id ? (
                          <input type="number" className="w-20 border border-indigo-300 rounded px-2 py-1 text-right text-xs focus:ring-2 focus:ring-indigo-500 outline-none" value={tempCost} onChange={(e) => setTempCost(e.target.value)} autoFocus />
                        ) : (
                          <span className={model.packagingCost > 0 ? "text-pink-600 font-bold" : "text-slate-400"}>
                            ₹{Number(model.packagingCost || 0).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingModelId === model.id ? (
                          <button onClick={() => saveModelCost(model.id)} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Save size={14} /></button>
                        ) : (
                          <button onClick={() => startEditingModel(model)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end shrink-0">
              <button onClick={() => setShowPackagingModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md">Done</button>
            </div>
          </div>
        </div>
      )}

      {logisticsBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Truck size={20} className="text-indigo-600" /> Update Logistics
              </h3>
              <button onClick={() => setLogisticsBatch(null)} className="p-2 hover:bg-slate-100 rounded-full transition">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Courier Partner</label>
                    <select className="w-full border p-2.5 rounded-lg mt-1 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" value={logisticsForm.courierPartner} onChange={(e) => setLogisticsForm({ ...logisticsForm, courierPartner: e.target.value })}>
                      <option value="">Select...</option>
                      <option value="Delhivery">Delhivery</option>
                      <option value="Shiprocket">Shiprocket</option>
                      <option value="Annex">Annex</option>
                      <option value="Amazon">Amazon</option>
                      <option value="Flipkart">Flipkart</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Dispatch Date</label>
                    <input type="date" className="w-full border p-2.5 rounded-lg mt-1 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" value={logisticsForm.logisticsDispatchDate} onChange={(e) => setLogisticsForm({ ...logisticsForm, logisticsDispatchDate: e.target.value })} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Tracking ID</label>
                    <input className="w-full border p-2.5 rounded-lg mt-1 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tracking No" value={logisticsForm.trackingId} onChange={(e) => setLogisticsForm({ ...logisticsForm, trackingId: e.target.value })} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Freight Charges (₹)</label>
                    <input type="number" className="w-full border p-2.5 rounded-lg mt-1 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" value={logisticsForm.freightCharges} onChange={(e) => setLogisticsForm({ ...logisticsForm, freightCharges: e.target.value })} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Packaging Cost?</label>
                    <div className="flex gap-4 mt-2.5">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium text-slate-700">
                        <input type="radio" name="pkg" value="yes" checked={logisticsForm.includePackaging === "yes"} onChange={handlePackagingToggle} className="text-pink-600 focus:ring-pink-500" /> Yes
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer font-medium text-slate-700">
                        <input type="radio" name="pkg" value="no" checked={logisticsForm.includePackaging === "no"} onChange={handlePackagingToggle} className="text-pink-600 focus:ring-pink-500" /> No
                      </label>
                    </div>
                  </div>

                  {logisticsForm.includePackaging === "yes" && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <label className="text-xs font-bold text-pink-500 uppercase flex items-center gap-1"><Package size={12} /> Pkg Cost (Total)</label>
                      <input type="number" className="w-full border p-2.5 rounded-lg mt-1 text-sm bg-pink-50 border-pink-200 text-pink-700 font-bold focus:ring-pink-500 outline-none" value={logisticsForm.packagingCost} onChange={(e) => setLogisticsForm({ ...logisticsForm, packagingCost: e.target.value })} />
                      <p className="text-[10px] text-pink-500 mt-1">Sum of packaging costs for all selected items.</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select className="w-full border p-2.5 rounded-lg mt-1 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={logisticsForm.logisticsStatus} onChange={(e) => setLogisticsForm({ ...logisticsForm, logisticsStatus: e.target.value })}>
                      <option value="Packing in Process">Packing in Process</option>
                      <option value="Ready for Pickup">Ready for Pickup</option>
                      <option value="Delivery in Process">Delivery in Process</option>
                      <option value="Delivered">Delivered</option>
                      <option value="RTO">RTO</option>
                    </select>
                  </div>

                  {logisticsForm.logisticsStatus === "Delivered" && (
                    <div>
                      <label className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-1">
                        <UploadCloud size={12} /> Upload POD <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input type="file" className="w-full border p-1.5 rounded-lg text-xs bg-white text-slate-500" onChange={handleFileChange} />
                      </div>
                      {logisticsForm.existingPodName && (
                        <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                          <FileText size={10} /> Existing: {logisticsForm.existingPodName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setLogisticsBatch(null)} className="px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveLogistics} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 shadow-lg transition flex items-center gap-2">
                  <CheckSquare size={16} /> Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[75vh]">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold">Batch Details ({selectedBatch.length})</h3>
              <button onClick={() => setSelectedBatch(null)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[10px] uppercase text-slate-500 font-bold">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Serial</th>
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedBatch.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs font-bold text-amber-600">{getDetails(d.serialId).serial}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{getDetails(d.serialId).model}</td>
                      <td className="px-4 py-2 text-right text-xs font-bold text-slate-700">₹{Number(d.sellingPrice).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

            <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <Receipt className="text-indigo-600" size={20} />
                  Order Details
                </h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                  <span className="font-mono bg-white border px-1.5 rounded">{viewOrder[0].customerName || viewOrder[0].customer}</span>
                  <span>•</span>
                  <span>{format(new Date(viewOrder[0].dispatchDate), "dd MMM yyyy")}</span>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${viewOrder[0].firmName.toLowerCase().includes("gem") ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                    {viewOrder[0].firmName}
                  </span>
                  {isAdmin && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <User size={12}/> {viewOrder[0].dispatchedBy || "Unknown"}
                      </span>
                      {(viewOrder[0].status === "Order Cancelled" || viewOrder[0].isDeleted) && (
                        <span className="flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-200 ml-1">
                          <XCircle size={12}/> Cancelled by: {viewOrder[0].cancelledBy || "Unknown"}
                        </span>
                      )}
                    </>
                  )}
                  {(() => {
                    const deadlineDate = viewOrder[0].lastDeliveryDate || viewOrder[0].logisticsDispatchDate;
                    return <DeadlineBadge lastDeliveryDate={deadlineDate} status={viewOrder[0].status} />;
                  })()}
                </div>
              </div>
              <button onClick={() => setViewOrder(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} className="text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Box size={16} /> Product List ({viewOrder.length})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Serial Number</th>
                        <th className="px-4 py-3">Model</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewOrder.map((item, i) => {
                        const dbModel = item.modelName;
                        const lookup = item.serialNumberId || item.serialId;
                        const { serial, model: calcModel } = getDetails(lookup);
                        const isReturned = checkIsReturned(item);
                        return (
                          <tr key={i} className={`hover:bg-slate-50/50 ${isReturned ? "bg-red-50/30" : ""}`}>
                            <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-3 font-mono font-bold text-indigo-600">
                              {serial}
                              {isReturned && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase font-bold">Returned</span>}
                            </td>
                            <td className={`px-4 py-3 text-slate-600 ${isReturned ? "line-through opacity-60" : ""}`}>{dbModel || calcModel}</td>
                            <td className={`px-4 py-3 text-right font-bold text-slate-700 ${isReturned ? "line-through text-red-400" : ""}`}>
                              ₹{Number(item.sellingPrice).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan="3" className="px-4 py-3 text-right text-slate-600">Total Order Value:</td>
                        <td className="px-4 py-3 text-right text-emerald-600 text-lg">
                          ₹{viewOrder.reduce((acc, curr) => {
                            if (checkIsReturned(curr)) return acc;
                            return acc + (Number(curr.sellingPrice) || 0);
                          }, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {!["amazon", "flipkart"].includes(viewOrder[0].firmName.toLowerCase()) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><MapPin size={16} /> Shipping Details</h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-slate-500 text-xs uppercase font-bold">Consignee Name</p>
                      <p className="font-medium">{viewOrder[0].consigneeEmail || "N/A"}</p>
                      <p className="text-slate-500 text-xs uppercase font-bold mt-2">Address</p>
                      <p className="font-medium text-slate-600">{viewOrder[0].shippingAddress || viewOrder[0].address || "N/A"}</p>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <p className="text-slate-500 text-xs uppercase font-bold">Contact</p>
                          <p className="font-medium">{viewOrder[0].contactNumber || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs uppercase font-bold">GST Number</p>
                          <p className="font-medium font-mono">{viewOrder[0].gstNumber || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Truck size={16} /> Logistics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs uppercase font-bold">Courier</p>
                          <p className="font-medium">{viewOrder[0].courierPartner || "Not Assigned"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs uppercase font-bold">Tracking ID</p>
                          <p className="font-medium font-mono text-indigo-600">{viewOrder[0].trackingId || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs uppercase font-bold">Status</p>
                          <span className="px-2 py-0.5 bg-white border rounded text-xs font-bold">
                            {(viewOrder[0].logisticsStatus === "Ready for Dispatch" ? "Packing in Process" : viewOrder[0].logisticsStatus) || "Pending"}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs uppercase font-bold">Date</p>
                          <p className="font-medium">{viewOrder[0].logisticsDispatchDate ? format(new Date(viewOrder[0].logisticsDispatchDate), "dd MMM yyyy") : "-"}</p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-slate-500 text-xs uppercase font-bold">E-Way Bill</p>
                          {viewOrder[0].ewayBillFilename ? (
                            <div className="mt-1 flex items-center gap-2">
                              <a
                                href={`http://localhost:5000/uploads/${viewOrder[0].ewayBillFilename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition border border-indigo-100"
                              >
                                <FileText size={12} /> View E-Way Bill
                                <ExternalLink size={10} />
                              </a>
                              <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                                <CheckCircle size={10} /> Uploaded
                              </span>
                            </div>
                          ) : (
                            <p className="font-medium text-slate-400 text-xs mt-1">Not uploaded</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {(viewOrder[0].installationRequired === 1 || viewOrder[0].installationRequired === true) && (
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-2"><Info size={16} /> Installation Info</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-indigo-400 text-xs uppercase font-bold">Technician</p>
                            <p className="font-medium text-indigo-900">{viewOrder[0].technicianName || "Pending"}</p>
                          </div>
                          <div>
                            <p className="text-indigo-400 text-xs uppercase font-bold">Status</p>
                            <p className="font-medium text-indigo-900">{viewOrder[0].installationStatus || "Pending"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => setViewOrder(null)} className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition shadow-lg">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}