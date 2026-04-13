// ✅ OrderTracking Component (Comment updated to force Vite HMR cache clear)
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search, Eye, FileText, Truck, CheckCircle, AlertCircle,
  Clock, X, Box, Receipt, ExternalLink,
  Save, Package, RefreshCw, User, Building,
  Calendar, IndianRupee, Loader2, Check, AlertTriangle,
  Sparkles, Phone, Send, FileCheck, Ban, PauseCircle, CheckSquare,
  List, Archive, Layers, Edit3, Wrench, UploadCloud, RotateCcw,
  Hash, ChevronDown, ChevronUp, XCircle
} from "lucide-react";
import { format } from "date-fns";
import axios from "axios";
import NewDispatch from "./NewDispatch";
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

const STATUS_CONFIG = {
  Pending: { label: "Pending", bgClass: "bg-slate-100 border-slate-300 text-slate-700", dotClass: "bg-slate-400", icon: Clock, step: 0 },
  "Order Confirmed": { label: "Order Confirmed", bgClass: "bg-blue-50 border-blue-200 text-blue-700", dotClass: "bg-blue-400", icon: CheckCircle, step: 0.5 },
  "Order Not Confirmed": { label: "On Hold", bgClass: "bg-yellow-50 border-yellow-200 text-yellow-700", dotClass: "bg-yellow-500", icon: PauseCircle, step: 0 },
  "Send for Billing": { label: "Send for Billing", bgClass: "bg-indigo-100 border-indigo-300 text-indigo-700", dotClass: "bg-indigo-500", icon: Receipt, step: 1 },
  Billing: { label: "Billing", bgClass: "bg-indigo-100 border-indigo-300 text-indigo-700", dotClass: "bg-indigo-500", icon: Receipt, step: 1 },
  "Ready for Pickup": { label: "Ready for Pickup", bgClass: "bg-amber-100 border-amber-300 text-amber-700", dotClass: "bg-amber-500", icon: Box, step: 2 },
  Dispatched: { label: "Dispatched", bgClass: "bg-purple-100 border-purple-300 text-purple-700", dotClass: "bg-purple-500", icon: Truck, step: 3 },
  "Delivery in Process": { label: "Out for Delivery", bgClass: "bg-orange-100 border-orange-300 text-orange-700", dotClass: "bg-orange-500", icon: Truck, step: 4 },
  Delivered: { label: "Delivered", bgClass: "bg-emerald-100 border-emerald-300 text-emerald-700", dotClass: "bg-emerald-500", icon: CheckCircle, step: 5 },
  Completed: { label: "Completed", bgClass: "bg-slate-800 border-slate-900 text-white shadow-md shadow-slate-300", dotClass: "bg-white", icon: CheckSquare, step: 6 },
  RTO: { label: "RTO", bgClass: "bg-red-100 border-red-300 text-red-700", dotClass: "bg-red-500", icon: AlertCircle, step: -1 },
  Returned: { label: "Returned", bgClass: "bg-red-100 border-red-300 text-red-700", dotClass: "bg-red-500", icon: AlertCircle, step: -1 },
  "Partially Returned": { label: "Partially Returned", bgClass: "bg-orange-100 border-orange-300 text-orange-800", dotClass: "bg-orange-500", icon: RotateCcw, step: -1 },
  "Order Cancelled": { label: "Cancelled", bgClass: "bg-red-50 border-red-200 text-red-700", dotClass: "bg-red-500", icon: Ban, step: -1 },
  "Order On Hold": { label: "On Hold", bgClass: "bg-yellow-50 border-yellow-200 text-yellow-700", dotClass: "bg-yellow-500", icon: PauseCircle, step: 0 }
};

const UPDATE_STATUS_OPTIONS = [
  { value: "Order Confirmed", label: "Order Confirmed" },
  { value: "Order Not Confirmed", label: "Order Not Confirmed (On Hold)" },
  { value: "Send for Billing", label: "Send for Billing" },
  { value: "Order Cancelled", label: "Order Cancelled" },
  { value: "Order On Hold", label: "Order On Hold" }
];

const FILTER_OPTIONS = [
  { value: "All", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Order Confirmed", label: "Order Confirmed" },
  { value: "Order On Hold", label: "On Hold" },
  { value: "Send for Billing", label: "Billing Pending" },
  { value: "Ready for Pickup", label: "Ready for Pickup" },
  { value: "Delivery in Process", label: "Out for Delivery" },
  { value: "Delivered", label: "Delivered" },
  { value: "Returned", label: "Returned" },
  { value: "Order Cancelled", label: "Cancelled" },
];

function normalizeSerial(val) {
  if (!val) return "";
  return String(val).replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function getBatchKey(order) {
  const firm = (order.firmName || "").trim();
  const customer = (order.customerName || order.customer || "").trim();
  const bid = (order.bidNumber || "").trim();
  if (bid) return `${firm}__${bid}`;
  if (customer) return `${firm}__${customer}`;
  return `single__${order.id}`;
}

function getReturnSerial(returnRecord) {
  return returnRecord.serialValue
    || returnRecord.serialVal
    || returnRecord.serial_value
    || returnRecord.serialNumber
    || returnRecord.serial_number
    || returnRecord.serial_no
    || returnRecord.serialNo
    || returnRecord.serial
    || "";
}

function getItemSerial(item) {
  return item.serialValue
    || item.serialVal
    || item.serial_value
    || item.serialNumber
    || item.serial_number
    || item.serial_no
    || item.serialNo
    || item.serial
    || "";
}

function getReturnRecordForItem(item, returns = []) {
  if (!item || returns.length === 0) return null;

  const dispatchId = Number(item.id || item.dispatchId || item.orderId);
  if (Number.isFinite(dispatchId) && dispatchId > 0) {
    return returns.find((r) => Number(r.dispatchId) === dispatchId) || null;
  }

  return null;
}

function isItemReturned(item, returns = []) {
  const itemStatus = String(item.status || "").trim().toLowerCase();
  const logStatus = String(item.logisticsStatus || "").trim().toLowerCase();

  if (itemStatus === "returned" || itemStatus === "rto") return true;
  if (logStatus === "rto" || logStatus === "returned") return true;

  if (isItemReplaced(item)) return false;
  return !!getReturnRecordForItem(item, returns);
}

function getReplacedSerialHistory() {
  try {
    return JSON.parse(localStorage.getItem("replaced_serials") || "{}");
  } catch {
    return {};
  }
}

function isItemReplaced(item) {
  const history = getReplacedSerialHistory();
  if (history[item.id]) return true;

  const reason = item.reason || item.cancellationReason || item.cancelReason || item.remarks || item.holdReason || "";
  return reason.includes("Replaced returned serial:");
}

function getOldSerial(item) {
  if (item.replacements && item.replacements.length > 0) return item.replacements[item.replacements.length - 1].oldSerialValue;

  const reason = item.reason || item.cancellationReason || item.cancelReason || item.remarks || item.holdReason || "";
  if (reason.includes("Replaced returned serial:")) {
    return reason.split("Replaced returned serial: ")[1]?.trim();
  }
  return null;
}

function calculateBatchFinancials(items, returns = []) {
  let totalValue = 0;
  let returnedValue = 0;
  let returnedCount = 0;
  let activeCount = 0;
  let replacedCount = 0;

  items.forEach((item) => {
    const price = Number(item.sellingPrice || 0);
    totalValue += price;

    if (isItemReturned(item, returns)) {
      returnedValue += price;
      returnedCount++;
    } else {
      activeCount++;
      if (isItemReplaced(item)) replacedCount++;
    }
  });

  return {
    totalValue,
    returnedValue,
    netValue: totalValue - returnedValue,
    returnedCount,
    replacedCount,
    activeCount,
    totalCount: items.length
  };
}

function resolveDisplayStatus(status) {
  if (status === "Order Not Confirmed") return "Order On Hold";
  return status;
}

function safeFormatDate(dateValue, formatStr = "dd MMM yyyy") {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return format(date, formatStr);
  } catch {
    return null;
  }
}

function isInstallationRequired(value) {
  if (value === true || value === 1 || value === "1" || value === "true" || value === "Yes" || value === "yes") {
    return true;
  }
  return false;
}

// ✅ Helper function to check if status is "On Hold"
function isHoldStatus(status) {
  return status === "Order On Hold" || status === "Order Not Confirmed";
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const config = { success: { bg: "bg-emerald-500", icon: Check }, error: { bg: "bg-red-500", icon: AlertTriangle }, info: { bg: "bg-blue-500", icon: AlertCircle } };
  const { bg, icon: Icon } = config[type] || config.info;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] ${bg} text-white px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2`}>
      <Icon size={16} /><span className="font-medium text-xs">{message}</span>
      <button onClick={onClose} className="ml-1 hover:bg-white/20 rounded-full p-0.5"><X size={12} /></button>
    </div>
  );
}

function StatusBadge({ status, size = "default" }) {
  const displayStatus = resolveDisplayStatus(status);
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
  const Icon = config.icon;
  const sizeClasses = { small: "px-2 py-0.5 text-[10px] gap-1", default: "px-2.5 py-1 text-[11px] gap-1", large: "px-3 py-1.5 text-xs gap-1.5" };
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${config.bgClass} ${sizeClasses[size]}`}>
      <Icon size={size === "small" ? 9 : size === "large" ? 13 : 11} /><span>{config.label}</span>
    </span>
  );
}

function StatusTimeline({ currentStatus }) {
  const steps = [
    { key: "Send for Billing", label: "Billing", icon: Receipt },
    { key: "Dispatched", label: "Dispatched", icon: Truck },
    { key: "Delivered", label: "Delivered", icon: CheckCircle },
    { key: "Completed", label: "Completed", icon: CheckSquare },
  ];

  const resolvedStatus = resolveDisplayStatus(currentStatus);
  const currentConfig = STATUS_CONFIG[resolvedStatus] || STATUS_CONFIG[currentStatus] || STATUS_CONFIG.Pending;
  const currentStep = currentConfig.step;

  if (currentStep === -1) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-center gap-2">
        <AlertCircle size={16} className="text-red-500" />
        <span className="text-red-600 font-semibold text-sm">
          {resolvedStatus === "Order On Hold" 
            ? "Order On Hold" 
            : resolvedStatus === "Partially Returned" 
              ? "Order Partially Returned" 
              : resolvedStatus === "Order Cancelled"
                ? "Order Cancelled"
                : "Order Cancelled / Returned"}
        </span>
      </div>
    );
  }

  if (currentStep === 0 && (currentStatus === "Order Not Confirmed" || resolvedStatus === "Order On Hold")) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <PauseCircle size={16} className="text-yellow-600" />
          <span className="text-yellow-700 font-semibold text-sm">Order On Hold — Not Yet Confirmed</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                    <Icon size={14} />
                  </div>
                  <span className="text-[10px] mt-1.5 font-medium text-slate-400">{step.label}</span>
                </div>
                {index < steps.length - 1 && <div className="flex-1 h-0.5 mx-1.5 rounded bg-slate-200" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Hidden Timeline for normal steps, fully preserved via original logic
  return null;
}

function DocumentButton({ label, filename, onView }) {
  const isAvailable = !!filename;
  return (
    <button
      onClick={() => onView(filename)}
      disabled={!isAvailable}
      className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all ${isAvailable ? "bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer" : "bg-slate-50 border-slate-100 cursor-not-allowed opacity-60"}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={14} className={isAvailable ? "text-indigo-600 flex-shrink-0" : "text-slate-400 flex-shrink-0"} />
        <span className={`font-medium text-xs truncate ${isAvailable ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
      </div>
      <div className="flex-shrink-0 ml-2">
        {isAvailable ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">View <ExternalLink size={8} /></span>
        ) : (
          <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Missing</span>
        )}
      </div>
    </button>
  );
}

export default function OrderTracking({
  orders = [],
  onRefresh,
  models = [],
  serials = [],
  returns: propReturns = [],
  currentUser = null,
  isAdmin,
  isSupervisor,
  focusOrderId = null,
  onFocusHandled,
  catalogLoaded = false,
  returnsLoaded = false
}) {
  const [activeTab, setActiveTab] = useState("active"); // ✅ Updated: "active" | "hold" | "completed" | "cancelled"
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [billingLoadingId, setBillingLoadingId] = useState(null);
  const [restoringBatchKey, setRestoringBatchKey] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [toast, setToast] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editItems, setEditItems] = useState([]);
  const [replacingItemId, setReplacingItemId] = useState(null);
  const [replaceWithSerialId, setReplaceWithSerialId] = useState("");
  
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentEditForm, setPaymentEditForm] = useState({ paymentDate: "", amount: "", utrId: "" });
  const [contractFile, setContractFile] = useState(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [localOrders, setLocalOrders] = useState(orders);
  const canEditPayment = isAdmin || currentUser?.role === "Accountant";
  const [localModels, setLocalModels] = useState(Array.isArray(models) ? models : []);
  const [localSerials, setLocalSerials] = useState(Array.isArray(serials) ? serials : []);
  const [loadingDispatchData, setLoadingDispatchData] = useState(false);
  const [returns, setReturns] = useState([]);

  useEffect(() => { setLocalOrders(orders); }, [orders]);
  useEffect(() => {
    if (catalogLoaded) {
      setLocalModels(Array.isArray(models) ? models : []);
    } else if (Array.isArray(models) && models.length > 0) {
      setLocalModels(models);
    }
  }, [catalogLoaded, models]);

  useEffect(() => {
    if (catalogLoaded) {
      setLocalSerials(Array.isArray(serials) ? serials : []);
    } else if (Array.isArray(serials) && serials.length > 0) {
      setLocalSerials(serials);
    }
  }, [catalogLoaded, serials]);
  useEffect(() => { setStatusFilter("All"); setSearchTerm(""); }, [activeTab]);

  useEffect(() => {
    let mounted = true;
    const loadDispatchData = async () => {
      const hasLocalModels = Array.isArray(localModels) && localModels.length > 0;
      const hasLocalSerials = Array.isArray(localSerials) && localSerials.length > 0;
      if (catalogLoaded || (hasLocalModels && hasLocalSerials)) return;
      try {
        setLoadingDispatchData(true);
        const [modelsRes, serialsRes] = await Promise.all([printerService.getModels(), printerService.getSerials()]);
        if (!mounted) return;
        setLocalModels(Array.isArray(modelsRes) ? modelsRes : Array.isArray(modelsRes?.data) ? modelsRes.data : []);
        setLocalSerials(Array.isArray(serialsRes) ? serialsRes : Array.isArray(serialsRes?.data) ? serialsRes.data : []);
      } catch (error) {
        if (!mounted) return;
        console.error("Failed to load models/serials:", error);
      } finally {
        if (mounted) setLoadingDispatchData(false);
      }
    };
    loadDispatchData();
    return () => { mounted = false; };
  }, [catalogLoaded, localModels, localSerials]);

  useEffect(() => {
    const loadReturns = async () => {
      if (returnsLoaded) {
        setReturns(Array.isArray(propReturns) ? propReturns : []);
        return;
      }
      try {
        const data = await printerService.getReturns();
        
        let returnsArray = [];
        if (Array.isArray(data)) returnsArray = data;
        else if (data && Array.isArray(data.data)) returnsArray = data.data;
        else if (data && Array.isArray(data.returns)) returnsArray = data.returns;
        else if (data && Array.isArray(data.results)) returnsArray = data.results;
        
        setReturns(returnsArray);
      } catch (err) {
        console.warn("Failed to load returns:", err);
        setReturns([]);
      }
    };
    loadReturns();
  }, [propReturns, returnsLoaded]);

  const showToast = useCallback((message, type = "info") => { setToast({ message, type }); }, []);

  const getRestoredStatus = useCallback((item) => {
    const currentStatus = String(item?.status || "").trim();
    const logisticsStatus = String(item?.logisticsStatus || "").trim();

    if (currentStatus !== "Order Cancelled") {
      return currentStatus || "Pending";
    }

    if (logisticsStatus === "Delivered") return "Payment Pending";
    if (logisticsStatus) return "Billed";
    return "Pending";
  }, []);

  const groupedBatches = useMemo(() => {
    const groups = {};
    localOrders.forEach((order) => {
      const key = getBatchKey(order);
      if (!groups[key]) {
        groups[key] = {
          batchKey: key,
          id: order.id,
          firmName: order.firmName,
          customerName: order.customerName,
          bidNumber: order.bidNumber,
          shippingAddress: order.shippingAddress,
          dispatchDate: order.dispatchDate,
          status: order.status,
          logisticsStatus: order.logisticsStatus,
          trackingId: order.trackingId,
          contactNumber: order.contactNumber,
          altContactNumber: order.altContactNumber,
          buyerEmail: order.buyerEmail,
          consigneeEmail: order.consigneeEmail,
          gstNumber: order.gstNumber,
          orderDate: order.orderDate || order.dispatchDate,
          lastDeliveryDate: order.lastDeliveryDate,
          logisticsDispatchDate: order.logisticsDispatchDate,
          gemOrderType: order.gemOrderType,
          contractFilename: order.contractFilename,
          invoiceFilename: order.invoiceFilename,
          ewayBillFilename: order.ewayBillFilename,
          podFilename: order.podFilename,
          installationRequired: isInstallationRequired(order.installationRequired) || false,
          paymentReceivedDate: order.paymentReceivedDate,
          paymentReceivedAmount: order.paymentReceivedAmount,
          utrId: order.utrId,
          isDeleted: order.isDeleted,
          dispatchedBy: order.dispatchedBy,
          cancelledBy: order.cancelledBy,
          cancellationReason: order.cancellationReason || order.reason,
          holdReason: order.holdReason || order.reason, // ✅ Added hold reason
          documents: order.documents ? [...order.documents] : [],
          dispatches: order.dispatches || [],
          replacements: order.replacements || [],
          items: [],
        };
      } else {
        if (order.documents && order.documents.length > 0) {
          order.documents.forEach(doc => {
            if (!groups[key].documents.some(d => d.filename === doc.filename)) {
              groups[key].documents.push(doc);
            }
          });
        }
      }
      groups[key].items.push(order);
      if (!groups[key].orderDate && order.orderDate) groups[key].orderDate = order.orderDate;
      if (!groups[key].lastDeliveryDate && order.lastDeliveryDate) groups[key].lastDeliveryDate = order.lastDeliveryDate;
      if (isInstallationRequired(order.installationRequired)) groups[key].installationRequired = true;
      if (!groups[key].ewayBillFilename && order.ewayBillFilename) {
        groups[key].ewayBillFilename = order.ewayBillFilename;
      }
      if (!groups[key].cancellationReason && (order.cancellationReason || order.reason)) {
        groups[key].cancellationReason = order.cancellationReason || order.reason;
      }
      if (!groups[key].holdReason && (order.holdReason || order.reason)) {
        groups[key].holdReason = order.holdReason || order.reason;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.dispatchDate || 0) - new Date(a.dispatchDate || 0));
  }, [localOrders]);

  const filteredBatches = useMemo(() => {
    return groupedBatches.map(batch => {
      const financials = calculateBatchFinancials(batch.items, returns);
      
      // Determine aggregate batch state so mixed items (e.g. partial replacements) stay active
      const activeItems = batch.items.filter(i => !isItemReturned(i, returns) && String(i.status).trim() !== "Order Cancelled" && !i.isDeleted);
      const isCancelled = batch.items.every(i => String(i.status).trim() === "Order Cancelled" || i.isDeleted || isItemReturned(i, returns)) && batch.items.some(i => String(i.status).trim() === "Order Cancelled" || i.isDeleted);
      const isHold = activeItems.some(i => isHoldStatus(String(i.status).trim()));
      const isCompleted = activeItems.length > 0 && activeItems.every(i => String(i.status).trim() === "Completed");
      
      return { ...batch, financials, activeItems, isCancelled, isHold, isCompleted };
    }).filter((batch) => {
      const hasReturns = batch.financials.returnedCount > 0;
      const hasActive = batch.activeItems.length > 0;
      
      // Tab filtering
      if (activeTab === "active" && (!hasActive || batch.isCompleted || batch.isCancelled || batch.isHold)) return false;
      if (activeTab === "returned" && !hasReturns) return false;
      if (activeTab === "hold" && !batch.isHold) return false;
      if (activeTab === "completed" && !batch.isCompleted) return false;
      if (activeTab === "cancelled" && !batch.isCancelled) return false;

      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesSearch =
          (batch.customerName || "").toLowerCase().includes(term) ||
          (batch.firmName || "").toLowerCase().includes(term) ||
          (batch.bidNumber || "").toLowerCase().includes(term) ||
          String(batch.id).includes(term) ||
          batch.items.some((i) =>
            normalizeSerial(getItemSerial(i)).includes(term.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
          );
        if (!matchesSearch) return false;
      }

      // Status filtering (only for active tab)
      if (activeTab === "active" && statusFilter !== "All") {
        if (statusFilter === "Returned") {
          if (!batch.items.some((i) => isItemReturned(i, returns))) return false;
        } else if (statusFilter === "Order On Hold") {
          if (batch.status !== "Order On Hold" && batch.status !== "Order Not Confirmed") return false;
        } else {
          if (batch.status !== statusFilter && batch.logisticsStatus !== statusFilter) return false;
        }
      }
      return true;
    }).map(batch => {
      let displayItems = batch.items;
      if (activeTab === "active") displayItems = batch.items.filter(i => !isItemReturned(i, returns));
      if (activeTab === "returned") displayItems = batch.items.filter(i => isItemReturned(i, returns));
      return { ...batch, displayItems };
    });
  }, [groupedBatches, searchTerm, statusFilter, activeTab, returns]);

  // ✅ Updated stats to include hold & returned
  const stats = useMemo(() => {
    let active = 0, hold = 0, completed = 0, cancelled = 0, returned = 0;
    groupedBatches.forEach((b) => {
      const f = calculateBatchFinancials(b.items, returns);
      const activeItems = b.items.filter(i => !isItemReturned(i, returns) && String(i.status).trim() !== "Order Cancelled" && !i.isDeleted);
      const isCancelled = b.items.every(i => String(i.status).trim() === "Order Cancelled" || i.isDeleted || isItemReturned(i, returns)) && b.items.some(i => String(i.status).trim() === "Order Cancelled" || i.isDeleted);
      const isHold = activeItems.some(i => isHoldStatus(String(i.status).trim()));
      const isCompleted = activeItems.length > 0 && activeItems.every(i => String(i.status).trim() === "Completed");
      
      if (f.returnedCount > 0) returned++;
      if (activeItems.length > 0 && !isCompleted && !isCancelled && !isHold) active++;
      if (isHold) hold++;
      if (isCompleted) completed++;
      if (isCancelled) cancelled++;
    });
    return { total: groupedBatches.length, active, hold, completed, cancelled, returned };
  }, [groupedBatches, returns]);

  const handleViewDocument = useCallback((filename) => {
    if (!filename) {
      showToast("Document not uploaded yet", "error");
      return;
    }
    window.open(`${API_BASE_URL}/uploads/${filename}`, "_blank");
  }, [showToast]);

  const handleSendForBilling = async (batch) => {
    setBillingLoadingId(batch.batchKey);
    try {
      await Promise.all(batch.items.map((item) => axios.put(`${API_BASE_URL}/api/orders/${item.id}/status`, { status: "Send for Billing" }, getAuthHeaders())));
      setLocalOrders((prev) => prev.map((o) => batch.items.some((bi) => bi.id === o.id) ? { ...o, status: "Send for Billing" } : o));
      showToast("Batch sent for billing!", "success");
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Billing update failed", error);
      showToast("Failed to send for billing", "error");
    } finally {
      setBillingLoadingId(null);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedBatch || !newStatus) {
      showToast("Please select a status", "error");
      return;
    }
    if (newStatus === "Order Cancelled" && !cancellationReason.trim()) {
      showToast("Please enter a cancellation reason.", "error");
      return;
    }
    setIsUpdating(true);
    try {
      const payload = { 
        status: newStatus, 
        trackingId, 
        reason: newStatus === "Order Cancelled" ? cancellationReason : null,
        cancelledBy: newStatus === "Order Cancelled" ? (currentUser?.username || "Unknown") : null
      };
      await Promise.all(selectedBatch.items.map((item) => axios.put(`${API_BASE_URL}/api/orders/${item.id}/status`, payload, getAuthHeaders())));
      showToast(
        newStatus === "Order Cancelled" 
          ? "Order cancelled successfully!" 
          : newStatus === "Order On Hold" || newStatus === "Order Not Confirmed"
            ? "Order moved to hold!"
            : "Batch status updated!", 
        "success"
      );
      setLocalOrders((prev) =>
        prev.map((o) => {
          if (!selectedBatch.items.some((bi) => bi.id === o.id)) return o;
          return {
            ...o,
            status: newStatus,
            trackingId,
            logisticsStatus: newStatus === "Completed" ? "Delivered" : o.logisticsStatus,
            cancellationReason: newStatus === "Order Cancelled" ? cancellationReason : o.cancellationReason
          };
        })
      );
      if (onRefresh) onRefresh();
      closeModal();
    } catch (error) {
      console.error("Update failed", error);
      showToast("Failed to update status", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRestoreBatch = useCallback(async (batch, shouldCloseModal = false) => {
    if (!isAdmin) {
      showToast("Only admin can restore cancelled orders.", "error");
      return;
    }

    if (!batch?.items?.length) {
      showToast("No items found to restore.", "error");
      return;
    }

    const restoreIds = batch.items.map((item) => item.id).filter(Boolean);
    if (restoreIds.length === 0) {
      showToast("No valid order IDs found to restore.", "error");
      return;
    }

    setRestoringBatchKey(batch.batchKey || String(batch.id || restoreIds[0]));

    try {
      const result = await printerService.restoreDispatch(restoreIds);
      const restoredIdSet = new Set(restoreIds.map((id) => String(id)));

      setLocalOrders((prev) =>
        prev.map((order) => {
          if (!restoredIdSet.has(String(order.id))) return order;

          return {
            ...order,
            isDeleted: false,
            status: getRestoredStatus(order),
            cancellationReason: null,
            cancelReason: null,
            cancelledBy: null
          };
        })
      );

      if (shouldCloseModal) {
        setModalOpen(false);
        setSelectedBatch(null);
        setIsEditMode(false);
      }

      const successCount = result?.results?.success?.length || restoreIds.length;
      const failedCount = result?.results?.failed?.length || 0;

      if (failedCount > 0) {
        showToast(`Restored ${successCount} item(s). Some failed.`, "info");
      } else {
        showToast("Cancelled order restored successfully!", "success");
      }

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Restore failed", error);
      showToast("Failed to restore cancelled order.", "error");
    } finally {
      setRestoringBatchKey(null);
    }
  }, [getRestoredStatus, isAdmin, onRefresh, showToast]);

  const handleToggleInstallation = async (required) => {
    if (!selectedBatch) return;
    setIsUpdating(true);
    try {
      const normalizedRequired = !!required;

      await Promise.all(
        selectedBatch.items.map((item) =>
          printerService.updateDispatch(item.id, { installationRequired: normalizedRequired })
        )
      );

      setLocalOrders((prev) =>
        prev.map((o) =>
          selectedBatch.items.some((bi) => bi.id === o.id)
            ? { ...o, installationRequired: normalizedRequired }
            : o
        )
      );

      setSelectedBatch((prev) => ({
        ...prev,
        installationRequired: normalizedRequired,
        items: prev.items.map((i) => ({
          ...i,
          installationRequired: normalizedRequired,
        })),
      }));

      showToast(`Installation ${normalizedRequired ? "enabled" : "disabled"} for batch`, "success");
    } catch {
      showToast("Failed to update installation status", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEdits = async () => {
    // Validate serials and find their IDs before saving
    for (let item of editItems) {
      const matchedSerial = localSerials.find(s => normalizeSerial(s.value) === normalizeSerial(item.serialValue));
      if (!matchedSerial) {
        showToast(`Serial number ${item.serialValue} not found in inventory!`, "error");
        return;
      }
      if (matchedSerial.status !== "Available" && matchedSerial.id !== item.serialNumberId) {
        showToast(`Serial ${item.serialValue} is currently ${matchedSerial.status} and cannot be assigned!`, "error");
        return;
      }
      item.newSerialId = matchedSerial.id;
    }

    setIsUpdating(true);
    try {
      let uploadedContractFilename = selectedBatch.contractFilename;
      if (contractFile) {
        setUploadingContract(true);
        try {
          const formData = new FormData();
          formData.append("file", contractFile);
          formData.append("docType", "gemContract");
          const uploadRes = await axios.post(`${API_BASE_URL}/api/orders/${selectedBatch.items[0].id}/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data", ...getAuthHeaders().headers }
          });
          uploadedContractFilename = uploadRes.data.filename;
        } catch (uploadErr) {
          console.error("Contract upload failed:", uploadErr);
          showToast("Contract upload failed", "error");
        } finally {
          setUploadingContract(false);
        }
      }

      await Promise.all(
        editItems.map((item) => {
          const payload = {
            customerName: editFormData.customerName,
            shippingAddress: editFormData.shippingAddress,
            contactNumber: editFormData.contactNumber,
            buyerEmail: editFormData.buyerEmail,
            gstNumber: editFormData.gstNumber,
            sellingPrice: Number(item.sellingPrice) || 0,
            contractFilename: uploadedContractFilename,
            serialId: item.newSerialId
          };
          return printerService.updateDispatch(item.id, payload);
        })
      );

      showToast("Order updated successfully!", "success");
      setIsEditMode(false);
      setContractFile(null);
      if (onRefresh) onRefresh();
      closeModal();
    } catch (err) {
      console.error("Save failed:", err);
      showToast("Failed to save changes", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSavePaymentEdit = async () => {
    if (!canEditPayment) {
      showToast("Only Admin or Accountant can update payments", "error");
      return;
    }

    if (!paymentEditForm.amount || !paymentEditForm.utrId) {
      showToast("Please fill all payment details", "error");
      return;
    }
    setIsUpdating(true);
    try {
      const count = selectedBatch.items.length;
      const amountPerItem = (Number(paymentEditForm.amount) / count).toFixed(2);
      
      await Promise.all(selectedBatch.items.map(item => 
        axios.put(`${API_BASE_URL}/api/orders/${item.id}/payment`, {
          paymentDate: paymentEditForm.paymentDate,
          amount: amountPerItem,
          utrId: paymentEditForm.utrId,
          status: "Completed"
        }, getAuthHeaders())
      ));
      
      showToast("Payment details updated successfully!", "success");
      
      setLocalOrders(prev => prev.map(o => {
        if (selectedBatch.items.some(bi => bi.id === o.id)) {
          return { ...o, paymentReceivedDate: paymentEditForm.paymentDate, paymentReceivedAmount: amountPerItem, utrId: paymentEditForm.utrId };
        }
        return o;
      }));
      
      if (onRefresh) onRefresh();
      setIsEditingPayment(false);
      
      setSelectedBatch(prev => ({
        ...prev, paymentReceivedDate: paymentEditForm.paymentDate, paymentReceivedAmount: amountPerItem, utrId: paymentEditForm.utrId,
        items: prev.items.map(i => ({ ...i, paymentReceivedDate: paymentEditForm.paymentDate, paymentReceivedAmount: amountPerItem, utrId: paymentEditForm.utrId }))
      }));
    } catch (error) {
      console.error("Payment update failed", error);
      showToast("Failed to update payment details", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReplaceSerial = async (dispatchId, newSerialId, oldSerialValue) => {
    if (!newSerialId) {
      showToast("Please select a new serial number", "error");
      return;
    }
    setIsUpdating(true);
    try {
      const reasonText = `Replaced returned serial: ${oldSerialValue}`;
      
      const newSerialObj = localSerials.find(s => s.id === Number(newSerialId));
      const newSerialValue = newSerialObj ? newSerialObj.value : "";

      // 1. Call the new backend replacement endpoint to handle history insertion
      await axios.post(`${API_BASE_URL}/api/orders/${dispatchId}/replace`, {
        oldSerialValue,
        newSerialId: Number(newSerialId),
        newSerialValue,
        reason: reasonText
      }, getAuthHeaders());
      
      setLocalOrders(prev => prev.map(o => {
        if (o.id === dispatchId) {
          return { ...o, serialNumberId: newSerialId, serialId: newSerialId, serialValue: newSerialValue, serialNumber: newSerialValue, status: "Send for Billing", logisticsStatus: null, reason: reasonText, cancellationReason: reasonText, cancelReason: reasonText, remarks: reasonText, isDeleted: false };
        }
        return o;
      }));
      
      setSelectedBatch(prev => {
        if(!prev) return prev;
        const newItems = prev.items.map(i => i.id === dispatchId ? { ...i, serialNumberId: newSerialId, serialId: newSerialId, serialValue: newSerialValue, serialNumber: newSerialValue, status: "Send for Billing", logisticsStatus: null, reason: reasonText, cancellationReason: reasonText, cancelReason: reasonText, remarks: reasonText, isDeleted: false } : i);
        
        const f = calculateBatchFinancials(newItems, returns);
        let targetTab = activeTab;
        if (activeTab === "returned" && f.returnedCount === 0) {
          targetTab = "active";
        }

        let newDisplayItems = newItems;
        if (targetTab === "active") newDisplayItems = newItems.filter(i => !isItemReturned(i, returns));
        if (targetTab === "returned") newDisplayItems = newItems.filter(i => isItemReturned(i, returns));
        
        return { ...prev, items: newItems, displayItems: newDisplayItems, financials: f };
      });
      
      if (activeTab === "returned") {
         setActiveTab("active");
      }

      showToast("Serial replaced successfully!", "success");
      setReplacingItemId(null);
      setReplaceWithSerialId("");
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Replacement failed", err);
      showToast("Failed to replace serial", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const openModal = useCallback((batch) => {
    setSelectedBatch({
      ...batch,
      installationRequired: isInstallationRequired(batch.installationRequired) || false,
      items: (batch.items || []).map((item) => ({
        ...item,
        installationRequired: isInstallationRequired(item.installationRequired) || false,
      })),
    });
    setNewStatus(batch.status || "Pending");
    setTrackingId(batch.trackingId || "");
    setCancellationReason("");
    setIsEditMode(false);
    setContractFile(null);
    setEditFormData({
      customerName: batch.customerName || "",
      shippingAddress: batch.shippingAddress || "",
      contactNumber: batch.contactNumber || "",
      buyerEmail: batch.buyerEmail || "",
      gstNumber: batch.gstNumber || ""
    });
    setEditItems(JSON.parse(JSON.stringify(batch.items)));
    setIsEditingPayment(false);
    setModalOpen(true);
    setReplacingItemId(null);
    setReplaceWithSerialId("");
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedBatch(null);
    setIsEditMode(false);
  }, []);

  useEffect(() => {
    if (!focusOrderId) return;

    const targetBatch = groupedBatches.find((batch) =>
      Number(batch.id) === Number(focusOrderId) ||
      batch.items.some((item) => Number(item.id) === Number(focusOrderId))
    );

    if (!targetBatch) return;

    const financials = calculateBatchFinancials(targetBatch.items, returns);
    if (financials.returnedCount > 0) {
      setActiveTab("returned");
    } else if (isHoldStatus(targetBatch.status)) {
      setActiveTab("hold");
    } else if (targetBatch.status === "Completed") {
      setActiveTab("completed");
    } else if (targetBatch.status === "Order Cancelled") {
      setActiveTab("cancelled");
    } else {
      setActiveTab("active");
    }

    openModal({ ...targetBatch, financials });
    if (typeof onFocusHandled === "function") {
      onFocusHandled();
    }
  }, [focusOrderId, groupedBatches, returns, openModal, onFocusHandled]);

  if (isCreating) {
    if (loadingDispatchData) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex items-center gap-3">
            <Loader2 size={22} className="animate-spin text-indigo-600" />
            <span className="text-slate-700 font-semibold">Loading models and serials...</span>
          </div>
        </div>
      );
    }
    return (
      <NewDispatch
        models={localModels}
        serials={localSerials}
        currentUser={currentUser}
        onRefresh={() => {
          if (onRefresh) onRefresh();
          setIsCreating(false);
        }}
        onBack={() => setIsCreating(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Truck className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">Order Processing</h1>
              <p className="text-sm text-slate-500">Track, manage and dispatch orders</p>
            </div>
          </div>
          
          {/* ✅ Updated Tabs - Now with 5 tabs including Returned & Hold */}
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner flex-wrap">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                activeTab === "active" 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <List size={15} /> Active
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-xs">
                {stats.active}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab("returned")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                activeTab === "returned" 
                  ? "bg-white text-orange-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <RotateCcw size={15} /> Returned
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                stats.returned > 0 ? "bg-orange-100 text-orange-700 animate-pulse" : "bg-orange-100 text-orange-700"
              }`}>
                {stats.returned}
              </span>
            </button>

            {/* ✅ New Hold Tab */}
            <button
              onClick={() => setActiveTab("hold")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                activeTab === "hold" 
                  ? "bg-white text-yellow-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <PauseCircle size={15} /> On Hold
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                stats.hold > 0 
                  ? "bg-yellow-100 text-yellow-700 animate-pulse" 
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {stats.hold}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                activeTab === "completed" 
                  ? "bg-white text-emerald-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Archive size={15} /> Completed
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-xs">
                {stats.completed}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("cancelled")}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                activeTab === "cancelled" 
                  ? "bg-white text-red-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <XCircle size={15} /> Cancelled
              <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-xs">
                {stats.cancelled}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none"
              placeholder={`Search ${activeTab === "hold" ? "on hold" : activeTab} orders...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Only show status filter for active tab */}
          {activeTab === "active" && (
            <select
              className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium min-w-[150px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {FILTER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          )}

          {!isSupervisor && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 font-semibold text-sm flex-shrink-0 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles size={16} /><span>Create Order</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 font-semibold text-sm flex-shrink-0"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className={`border-b border-slate-200 px-4 py-3 flex items-center gap-2 ${
          activeTab === "completed" 
            ? "bg-emerald-50/50" 
            : activeTab === "cancelled" 
              ? "bg-red-50/50" 
              : activeTab === "returned"
                ? "bg-orange-50/50"
              : activeTab === "hold"
                ? "bg-yellow-50/50"
                : "bg-slate-50"
        }`}>
          <span className={`text-xs font-bold uppercase ${
            activeTab === "completed" 
              ? "text-emerald-700" 
              : activeTab === "cancelled" 
                ? "text-red-700" 
                : activeTab === "returned"
                  ? "text-orange-700"
                : activeTab === "hold"
                  ? "text-yellow-700"
                  : "text-slate-500"
          }`}>
            {activeTab === "active" 
              ? "Ongoing Orders" 
              : activeTab === "returned"
                ? "Returned Items"
              : activeTab === "hold"
                ? "Orders On Hold"
                : activeTab === "completed" 
                  ? "Completed Order History" 
                  : "Cancelled Orders"}
          </span>
          <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
            {filteredBatches.length}
          </span>
          {/* ✅ Show alert for hold tab */}
          {activeTab === "hold" && stats.hold > 0 && (
            <span className="text-[10px] font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full ml-2 flex items-center gap-1">
              <AlertCircle size={10} /> Requires Attention
            </span>
          )}
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center w-12">#</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap">Order ID</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap">Platform</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center">Items</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center">Order Date</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center">Last Delivery</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap">Contact No.</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center">Order Value</th>
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap">
                  {activeTab === "cancelled" ? "Reason" : activeTab === "hold" ? "Hold Status" : "Live Status"}
                </th>
                {activeTab === "active" && <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center">Billing</th>}
                <th className="p-4 text-xs uppercase tracking-wider text-slate-500 font-bold whitespace-nowrap text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredBatches.length > 0 ? (
                filteredBatches.map((batch, index) => {
                  const showBillingBtn = batch.status === "Order Confirmed";
                  const isBillingLoading = billingLoadingId === batch.batchKey;
                  const financials = batch.financials;

                  let representativeItem = batch.activeItems.find(i => String(i.status).trim() !== "Completed") || batch.activeItems[0] || batch.items[0];
                  let rawStatus = representativeItem.status;
                  let displayStatus = resolveDisplayStatus(rawStatus);
                  const processingPhases = ["Pending", "Order Confirmed", "Order Not Confirmed", "Send for Billing", "Billing", "Order Cancelled", "Order On Hold", "Returned", "Completed"];
                  if (!processingPhases.includes(rawStatus) && !processingPhases.includes(displayStatus) && representativeItem.logisticsStatus) {
                    displayStatus = representativeItem.logisticsStatus;
                  }

                  if (financials.returnedCount > 0 && batch.activeItems.length === 0) {
                    displayStatus = "Returned";
                  } else if (financials.returnedCount > 0 && activeTab === "returned") {
                    displayStatus = "Partially Returned";
                  }

                  const isBulk = batch.displayItems.length > 1;
                  const orderDateFormatted = safeFormatDate(batch.orderDate);
                  const lastDeliveryFormatted = safeFormatDate(batch.lastDeliveryDate);
                  const hasReturns = financials.returnedCount > 0;
                  const isCancelled = batch.isCancelled;
                  const isOnHold = batch.isHold;
                  const isRestoreEligible = activeTab === "cancelled" && isCancelled;
                  const isRestoringBatch = restoringBatchKey === (batch.batchKey || String(batch.id));

                  const hasActiveReturns = financials.returnedCount > 0;
                  const hasReplacements = financials.replacedCount > 0;

                  return (
                    <tr 
                      key={batch.batchKey} 
                      className={`hover:bg-slate-50 transition-colors ${
                        hasActiveReturns ? "bg-red-50/30" : 
                        hasReplacements ? "bg-indigo-50/20" :
                        isCancelled ? "bg-red-50/20" : 
                        isOnHold ? "bg-yellow-50/30" : ""
                      }`}
                    >
                      <td className="p-4 text-center text-xs text-slate-400 font-bold">{index + 1}</td>

                      <td className="p-4">
                        <div className="min-w-0">
                          {(batch.firmName === "GeM" || batch.firmName === "Other") && batch.contractFilename ? (
                            <button
                              onClick={() => handleViewDocument(batch.contractFilename)}
                              className={`font-semibold hover:underline text-sm truncate max-w-[180px] flex items-center gap-1 ${
                                isCancelled ? "text-red-600 hover:text-red-800" : 
                                isOnHold ? "text-yellow-700 hover:text-yellow-800" :
                                "text-indigo-600 hover:text-indigo-800"
                              }`}
                              title="View Contract"
                            >
                              {batch.customerName || `Order #${batch.id}`}
                              <ExternalLink size={10} className="mb-0.5 flex-shrink-0" />
                            </button>
                          ) : (
                            <div className={`font-semibold text-sm truncate max-w-[180px] ${
                              isCancelled ? "text-red-700" : 
                              isOnHold ? "text-yellow-700" :
                              "text-slate-800"
                            }`}>
                              {batch.customerName || `Order #${batch.id}`}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 truncate max-w-[180px] flex items-center gap-1">
                            {batch.firmName || "N/A"}
                            {batch.bidNumber && <span className="text-slate-400">• {batch.bidNumber}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          batch.firmName === "GeM" ? "bg-orange-100 text-orange-700" : 
                          batch.firmName === "Amazon" ? "bg-yellow-100 text-yellow-700" : 
                          batch.firmName === "Flipkart" ? "bg-blue-100 text-blue-700" : 
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {batch.firmName === "GeM" && <Building size={10} />}
                          {batch.firmName || "Other"}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isBulk 
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                            : "bg-slate-50 text-slate-600 border border-slate-100"
                        }`}>
                          <Layers size={11} />
                          {batch.displayItems.length} {batch.displayItems.length === 1 ? "Item" : "Items"}
                        </span>
                        {activeTab !== "returned" && financials.returnedCount > 0 && (
                          <div className="text-[10px] text-red-600 mt-1 font-bold flex items-center justify-center gap-0.5">
                            <RotateCcw size={8} />
                            {financials.returnedCount} returned
                          </div>
                        )}
                        {financials.replacedCount > 0 && (
                          <div className="text-[10px] text-indigo-600 mt-1 font-bold flex items-center justify-center gap-0.5">
                            <RefreshCw size={8} />
                            {financials.replacedCount} replaced
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-center text-xs text-slate-600 font-mono">
                        {orderDateFormatted || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="p-4 text-center text-xs text-slate-600 font-mono">
                        {lastDeliveryFormatted || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="p-4">
                        {batch.contactNumber ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Phone size={12} className="text-slate-400" />
                            <span>{batch.contactNumber}</span>
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>

                      <td className="p-4 text-center">
                        <div className={`text-xs font-bold ${
                          isCancelled ? "text-red-400 line-through" : 
                          hasReturns ? "text-amber-600" : 
                          isOnHold ? "text-yellow-600" :
                          "text-emerald-600"
                        }`}>
                          ₹{financials.netValue.toLocaleString()}
                        </div>
                        {financials.returnedValue > 0 && !isCancelled && (
                          <div className="text-[10px] text-red-500 line-through">₹{financials.totalValue.toLocaleString()}</div>
                        )}
                      </td>

                      {/* ✅ Show status/reason based on tab */}
                      <td className="p-4">
                        {activeTab === "cancelled" ? (
                          <div className="max-w-[150px]">
                            <span className="text-xs text-red-600 line-clamp-2">
                              {batch.cancellationReason || batch.items[0]?.cancellationReason || batch.items[0]?.reason || "No reason provided"}
                            </span>
                          </div>
                        ) : activeTab === "hold" ? (
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={displayStatus} size="small" />
                            {(batch.holdReason || batch.items[0]?.reason) && (
                              <span className="text-[10px] text-yellow-600 line-clamp-1 max-w-[120px]">
                                {batch.holdReason || batch.items[0]?.reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={displayStatus} size="small" />
                            {financials.replacedCount > 0 && (
                               <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                                 <RefreshCw size={8} /> Replaced
                               </span>
                            )}
                          </div>
                        )}
                      </td>

                      {activeTab === "active" && (
                        <td className="p-4 text-center">
                          {showBillingBtn ? (
                            <button
                              onClick={() => handleSendForBilling(batch)}
                              disabled={isBillingLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-xs shadow-sm transition-all hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {isBillingLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              {isBillingLoading ? "Sending..." : "Send for Billing"}
                            </button>
                          ) : batch.status === "Order Not Confirmed" || batch.status === "Order On Hold" ? (
                            <span className="text-xs text-yellow-600 font-medium flex items-center justify-center gap-1">
                              <PauseCircle size={14} className="text-yellow-500" />On Hold
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
                              <CheckCircle size={14} className="text-slate-300" />Sent
                            </span>
                          )}
                        </td>
                      )}

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isRestoreEligible && (
                            <button
                              onClick={() => handleRestoreBatch(batch)}
                              disabled={!isAdmin || isRestoringBatch}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold text-[11px] transition-colors ${
                                isAdmin
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                              title={isAdmin ? "Restore cancelled order" : "Admin only"}
                            >
                              {isRestoringBatch ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                              <span className="hidden sm:inline">{isRestoringBatch ? "Restoring" : "Restore"}</span>
                            </button>
                          )}

                          <button
                            onClick={() => openModal(batch)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold text-[11px] transition-colors ${
                              activeTab === "cancelled" 
                                ? "bg-red-50 text-red-600 hover:bg-red-100" 
                                : activeTab === "hold"
                                  ? "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                                  : activeTab === "completed" 
                                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                                    : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                            }`}
                          >
                            <Eye size={12} />
                            <span className="hidden sm:inline">View</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="p-12 text-center">
                    <Package size={48} className={`mx-auto mb-3 ${
                      activeTab === "completed" ? "text-emerald-200" : 
                      activeTab === "cancelled" ? "text-red-200" : 
                      activeTab === "returned" ? "text-orange-200" :
                      activeTab === "hold" ? "text-yellow-200" :
                      "text-slate-200"
                    }`} />
                    <p className="text-slate-500 font-medium">
                      {activeTab === "completed" 
                        ? "No completed orders found" 
                        : activeTab === "returned"
                          ? "No returned orders"
                        : activeTab === "cancelled" 
                          ? "No cancelled orders found" 
                          : activeTab === "hold"
                            ? "No orders on hold"
                            : "No active orders found"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {activeTab === "hold" 
                        ? "Great! All orders are progressing normally" 
                        : "Try different search criteria"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={`border-t border-slate-200 px-4 py-3 text-sm text-slate-500 ${
          activeTab === "cancelled" ? "bg-red-50/30" : 
          activeTab === "completed" ? "bg-emerald-50/30" : 
          activeTab === "returned" ? "bg-orange-50/30" : 
          activeTab === "hold" ? "bg-yellow-50/30" :
          "bg-slate-50"
        }`}>
          Showing {filteredBatches.length} {activeTab === "hold" ? "on hold" : activeTab} order batches
        </div>
      </div>

      {/* ==================== MODAL ==================== */}
      {modalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-3 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            {(() => {
              const f = selectedBatch.financials || calculateBatchFinancials(selectedBatch.items, returns);
              const selectedBatchOrderValue = selectedBatch.items.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0);
              const selectedBatchEwayBillFilename =
                selectedBatch.ewayBillFilename ||
                selectedBatch.items.find((item) => item.ewayBillFilename)?.ewayBillFilename ||
                null;
              const isEwayBillRequired = selectedBatchOrderValue > 50000;
              const shouldShowEwayBillDocument = isEwayBillRequired || !!selectedBatchEwayBillFilename;
              let representativeItemModal = selectedBatch.activeItems?.find(i => String(i.status).trim() !== "Completed") || selectedBatch.activeItems?.[0] || selectedBatch.items[0];
              let rawStatusModal = representativeItemModal.status;
              let modalDisplayStatus = resolveDisplayStatus(rawStatusModal);
              const processingPhasesModal = ["Pending", "Order Confirmed", "Order Not Confirmed", "Send for Billing", "Billing", "Order Cancelled", "Order On Hold", "Returned", "Completed"];
              if (!processingPhasesModal.includes(rawStatusModal) && !processingPhasesModal.includes(modalDisplayStatus) && representativeItemModal.logisticsStatus) {
                modalDisplayStatus = representativeItemModal.logisticsStatus;
              }
              if (f.returnedCount > 0 && (!selectedBatch.activeItems || selectedBatch.activeItems.length === 0)) {
                modalDisplayStatus = "Returned";
              } else if (f.returnedCount > 0 && activeTab === "returned") {
                modalDisplayStatus = "Partially Returned";
              }

              const isCancelledOrder = selectedBatch.isCancelled;
              const isOnHoldOrder = selectedBatch.isHold;
              const isRestoreEligibleInModal = activeTab === "cancelled" && isCancelledOrder;
              const isRestoringSelectedBatch = restoringBatchKey === (selectedBatch.batchKey || String(selectedBatch.id));
              const batchReturnHistory = returns
                .filter((record) => selectedBatch.items.some((item) => Number(item.id) === Number(record.dispatchId)))
                .sort((a, b) => new Date(b.returnDate || 0) - new Date(a.returnDate || 0));

              // 🆕 Extract ALL historical and merged documents directly from items + history
              const allDocsMap = new Map();
              if (selectedBatch.documents) {
                selectedBatch.documents.forEach(doc => {
                  allDocsMap.set(doc.filename, doc.docType);
                });
              }
              selectedBatch.items.forEach(item => {
                if (item.contractFilename && !allDocsMap.has(item.contractFilename)) allDocsMap.set(item.contractFilename, 'gemContract');
                if (item.invoiceFilename && !allDocsMap.has(item.invoiceFilename)) allDocsMap.set(item.invoiceFilename, 'invoice');
                if (item.ewayBillFilename && !allDocsMap.has(item.ewayBillFilename)) allDocsMap.set(item.ewayBillFilename, 'ewayBill');
                if (item.podFilename && !allDocsMap.has(item.podFilename)) allDocsMap.set(item.podFilename, 'pod');
              });

              const activeDocs = [
                selectedBatch.contractFilename,
                selectedBatch.invoiceFilename,
                selectedBatchEwayBillFilename,
                selectedBatch.podFilename
              ].filter(Boolean);

              const oldDocs = [];
              allDocsMap.forEach((docType, filename) => {
                if (!activeDocs.includes(filename)) {
                  oldDocs.push({ filename, docType });
                }
              });

              return (
                <>
                  <div className={`p-4 rounded-t-xl ${
                    isEditMode 
                      ? "bg-gradient-to-r from-amber-600 to-orange-700" 
                      : isCancelledOrder
                        ? "bg-gradient-to-r from-red-700 to-red-900"
                        : isOnHoldOrder
                          ? "bg-gradient-to-r from-yellow-600 to-amber-700"
                          : selectedBatch.status === "Completed" 
                            ? "bg-gradient-to-r from-emerald-800 to-teal-900" 
                            : "bg-gradient-to-r from-slate-800 to-indigo-900"
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          {isEditMode ? <Edit3 className="text-white" size={18} /> : 
                           isCancelledOrder ? <Ban className="text-white" size={18} /> :
                           isOnHoldOrder ? <PauseCircle className="text-white" size={18} /> :
                           <Package className="text-white" size={18} />}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-white flex items-center gap-2">
                            {isEditMode ? "Edit Order" : 
                             isCancelledOrder ? "Cancelled Order" : 
                             isOnHoldOrder ? "Order On Hold" :
                             "Order Details"}
                            {selectedBatch.items.length > 1 && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{selectedBatch.displayItems.length} of {selectedBatch.items.length} Items</span>}
                          </h2>
                          <p className="text-white/70 text-xs flex items-center gap-1.5 mt-0.5">
                            <Calendar size={10} />
                            {safeFormatDate(selectedBatch.dispatchDate) || "N/A"}
                            {selectedBatch.bidNumber && <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">BID: {selectedBatch.bidNumber}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!isEditMode && isRestoreEligibleInModal && (
                          <button
                            onClick={() => handleRestoreBatch(selectedBatch, true)}
                            disabled={!isAdmin || isRestoringSelectedBatch}
                            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs ${
                              isAdmin
                                ? "text-white/80 hover:text-white hover:bg-white/10"
                                : "text-white/40 cursor-not-allowed"
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                            title={isAdmin ? "Restore cancelled order" : "Admin only"}
                          >
                            {isRestoringSelectedBatch ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            <span className="hidden sm:inline">{isRestoringSelectedBatch ? "Restoring" : "Restore"}</span>
                          </button>
                        )}
                    {!isEditMode && selectedBatch.status !== "Completed" && !isCancelledOrder && !isSupervisor && (
                          <button onClick={() => setIsEditMode(true)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-1 text-xs">
                            <Edit3 size={13} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}
                        <button onClick={closeModal} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={modalDisplayStatus} size="default" />
                      {f.returnedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-200 border border-red-400/30">
                          <RotateCcw size={9} />
                          {f.returnedCount} Returned
                        </span>
                      ) : null}
                      {f.replacedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                          <RefreshCw size={9} />
                          {f.replacedCount} Replaced
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
                    {isEditMode ? (
                      <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <h3 className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-1.5">
                            <Edit3 size={13} /> Edit Order Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-1">Order ID</label>
                              <input className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                value={editFormData.customerName}
                                onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-1">Contact Number</label>
                              <input className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                value={editFormData.contactNumber}
                                onChange={(e) => setEditFormData({ ...editFormData, contactNumber: e.target.value })}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[10px] font-semibold text-slate-600 block mb-1">Shipping Address</label>
                              <textarea className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                                rows="2"
                                value={editFormData.shippingAddress}
                                onChange={(e) => setEditFormData({ ...editFormData, shippingAddress: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-1">Buyer Email</label>
                              <input type="email"
                                className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                value={editFormData.buyerEmail}
                                onChange={(e) => setEditFormData({ ...editFormData, buyerEmail: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-slate-600 block mb-1">GST Number</label>
                              <input
                                className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                                value={editFormData.gstNumber}
                                onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })}
                              />
                            </div>
                          </div>

                          {selectedBatch.firmName === "GeM" && (
                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <h4 className="text-[10px] font-bold text-orange-700 mb-2 flex items-center gap-1">
                                <Building size={12} /> GeM Order Details
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { label: "Bid Number", value: selectedBatch.bidNumber },
                                  { label: "Order Type", value: selectedBatch.gemOrderType },
                                  { label: "Order Date", value: safeFormatDate(selectedBatch.orderDate) || "N/A" },
                                  { label: "Last Delivery", value: safeFormatDate(selectedBatch.lastDeliveryDate) || "N/A" },
                                ].map((item, i) => (
                                  <div key={i} className="bg-white rounded p-2 border border-orange-100">
                                    <span className="text-[10px] text-orange-600 font-medium">{item.label}</span>
                                    <p className="text-xs font-semibold text-slate-800">{item.value || "N/A"}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2">
                                <label className="text-[10px] font-semibold text-orange-700 block mb-1 flex items-center gap-1">
                                  <UploadCloud size={10} /> Upload / Replace Contract
                                </label>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx"
                                  className="w-full text-xs border border-orange-200 bg-white p-1.5 rounded-lg file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:bg-orange-100 file:text-orange-700 file:font-semibold file:text-[10px]"
                                  onChange={(e) => setContractFile(e.target.files[0] || null)}
                                />
                                {selectedBatch.contractFilename && <p className="text-[10px] text-orange-600 mt-1">Current: {selectedBatch.contractFilename}</p>}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Hash size={13} /> Edit Items & Serials
                            </h3>
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{editItems.length} items</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">#</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">Model</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">Serial Number</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase text-right">Price (₹)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {editItems.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2 text-slate-400 font-bold">{idx + 1}</td>
                                    <td className="px-3 py-2 text-slate-700 font-medium">{item.modelName || "Unknown"}</td>
                                    <td className="px-3 py-2">
                                      <input
                                        className="w-full border border-slate-200 bg-slate-50 p-1.5 rounded text-xs font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                                        value={item.serialValue || ""}
                                        onChange={(e) => {
                                          const u = [...editItems];
                                          u[idx] = { ...u[idx], serialValue: e.target.value };
                                          setEditItems(u);
                                        }}
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        className="w-full border border-slate-200 bg-slate-50 p-1.5 rounded text-xs text-right font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                                        value={item.sellingPrice || 0}
                                        onChange={(e) => {
                                          const u = [...editItems];
                                          u[idx] = { ...u[idx], sellingPrice: e.target.value };
                                          setEditItems(u);
                                        }}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => { setIsEditMode(false); setContractFile(null); }}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-semibold text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdits}
                            disabled={isUpdating || uploadingContract}
                            className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isUpdating || uploadingContract ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Save size={13} /> Save Changes</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <StatusTimeline currentStatus={modalDisplayStatus} />

                        {/* ✅ Hold Reason Alert for On Hold Orders */}
                        {isOnHoldOrder && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-start gap-2.5">
                              <div className="p-1.5 bg-yellow-100 rounded-lg flex-shrink-0 mt-0.5">
                                <PauseCircle size={14} className="text-yellow-600" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-xs font-bold text-yellow-700 flex items-center gap-1.5">
                                  Order On Hold
                                </h4>
                                <p className="text-xs text-yellow-600 mt-1">
                                  This order requires attention before it can proceed. Update the status to confirm or cancel.
                                </p>
                                {(selectedBatch.holdReason || selectedBatch.items[0]?.reason) && (
                                  <p className="text-xs text-yellow-700 mt-1.5 bg-yellow-100 rounded px-2 py-1">
                                    <span className="font-medium">Note: </span>
                                    {selectedBatch.holdReason || selectedBatch.items[0]?.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Cancellation Reason Alert for Cancelled Orders */}
                        {isCancelledOrder && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-start gap-2.5">
                              <div className="p-1.5 bg-red-100 rounded-lg flex-shrink-0 mt-0.5">
                                <Ban size={14} className="text-red-600" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                                  Order Cancelled
                                </h4>
                                <p className="text-xs text-red-600 mt-1">
                                  <span className="font-medium">Reason: </span>
                                  {selectedBatch.cancellationReason || selectedBatch.items[0]?.cancellationReason || selectedBatch.items[0]?.reason || "No reason provided"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {(() => {
                          if (f.returnedCount === 0) return null;
                          return (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-start gap-2.5">
                                <div className="p-1.5 bg-red-100 rounded-lg flex-shrink-0 mt-0.5">
                                  <RotateCcw size={14} className="text-red-600" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                                    Return Alert — {f.returnedCount} of {f.totalCount} item{f.returnedCount > 1 ? "s" : ""} returned
                                  </h4>
                                  <div className="flex items-center gap-4 mt-1.5">
                                    <div className="text-[10px] text-red-600">
                                      <span className="font-medium">Returned Value:</span>{" "}
                                      <span className="font-bold">₹{f.returnedValue.toLocaleString()}</span>
                                    </div>
                                    <div className="text-[10px] text-emerald-700">
                                      <span className="font-medium">Net Billing:</span>{" "}
                                      <span className="font-bold">₹{f.netValue.toLocaleString()}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 line-through">
                                      Original: ₹{f.totalValue.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-3">
                            {selectedBatch.status !== "Completed" && !isCancelledOrder && (
                              <div className={`border rounded-lg p-3 ${isOnHoldOrder ? "bg-yellow-50 border-yellow-200" : "bg-indigo-50 border-indigo-200"}`}>
                                <h3 className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${isOnHoldOrder ? "text-yellow-700" : "text-indigo-700"}`}>
                                  <Truck size={13} /> Update Status
                                </h3>
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">New Status</label>
                                    <select
                                      className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                      value={newStatus}
                                      onChange={(e) => setNewStatus(e.target.value)}
                                    >
                                      {UPDATE_STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                  </div>

                                  {newStatus === "Order Cancelled" && (
                                    <div>
                                      <label className="text-[10px] font-semibold text-red-600 block mb-1 flex items-center gap-1">
                                        <AlertCircle size={10} /> Cancellation Reason <span className="text-red-500">*</span>
                                      </label>
                                      <textarea
                                        className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                        placeholder="Why is this order being cancelled?"
                                        rows="2"
                                        value={cancellationReason}
                                        onChange={(e) => setCancellationReason(e.target.value)}
                                      />
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">Tracking ID</label>
                                    <input
                                      className="w-full border border-slate-200 bg-white p-2 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                      placeholder="e.g. DTDC12345"
                                      value={trackingId}
                                      onChange={(e) => setTrackingId(e.target.value)}
                                    />
                                  </div>

                                  <button
                                    onClick={handleUpdateStatus}
                                    disabled={isUpdating}
                                    className={`w-full text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                      newStatus === "Order Cancelled" 
                                        ? "bg-red-600 hover:bg-red-700" 
                                        : newStatus === "Order Confirmed"
                                          ? "bg-emerald-600 hover:bg-emerald-700"
                                          : "bg-indigo-600 hover:bg-indigo-700"
                                    }`}
                                  >
                                    {isUpdating ? (
                                      <><Loader2 size={13} className="animate-spin" /> Updating...</>
                                    ) : (
                                      <>
                                        {newStatus === "Order Cancelled" ? <Ban size={13} /> : 
                                         newStatus === "Order Confirmed" ? <CheckCircle size={13} /> :
                                         <Save size={13} />}
                                        {newStatus === "Order Cancelled" ? "Confirm Cancellation" : 
                                         newStatus === "Order Confirmed" ? "Confirm Order" :
                                         "Update Status"}
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {selectedBatch.status === "Completed" && (() => {
                              const totalPaidAmount = selectedBatch.items.reduce((sum, item) => sum + Number(item.paymentReceivedAmount || 0), 0);
                              const fallbackAmount = selectedBatch.items.reduce((s, i) => s + Number(i.sellingPrice || 0), 0);
                              const displayAmount = totalPaidAmount > 0 ? totalPaidAmount : fallbackAmount;

                              return (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                      <CheckSquare size={13} /> Payment Information
                                    </h3>
                                    {!isEditingPayment && canEditPayment && (
                                      <button
                                        onClick={() => {
                                          const defaultDate = selectedBatch.paymentReceivedDate 
                                            ? new Date(selectedBatch.paymentReceivedDate).toISOString().split('T')[0]
                                            : new Date().toISOString().split('T')[0];
                                          setPaymentEditForm({
                                            paymentDate: defaultDate,
                                            amount: displayAmount,
                                            utrId: selectedBatch.utrId || ""
                                          });
                                          setIsEditingPayment(true);
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition"
                                      >
                                        Edit Payment
                                      </button>
                                    )}
                                  </div>
                                  
                                  {isEditingPayment ? (
                                    <div className="space-y-2 mt-2 border-t border-emerald-200 pt-2">
                                      <div>
                                        <label className="text-[10px] font-semibold text-emerald-700 block mb-1">Payment Date</label>
                                        <input type="date" className="w-full border border-emerald-200 p-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" value={paymentEditForm.paymentDate} onChange={e => setPaymentEditForm({...paymentEditForm, paymentDate: e.target.value})} />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-emerald-700 block mb-1">Total Amount (₹)</label>
                                        <input type="number" className="w-full border border-emerald-200 p-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500" value={paymentEditForm.amount} onChange={e => setPaymentEditForm({...paymentEditForm, amount: e.target.value})} />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-emerald-700 block mb-1">UTR ID</label>
                                        <input type="text" className="w-full border border-emerald-200 p-1.5 rounded text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-mono uppercase" value={paymentEditForm.utrId} onChange={e => setPaymentEditForm({...paymentEditForm, utrId: e.target.value})} />
                                      </div>
                                      <div className="flex justify-end gap-2 pt-2">
                                        <button onClick={() => setIsEditingPayment(false)} className="px-3 py-1.5 bg-white border border-emerald-200 rounded text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Cancel</button>
                                        <button onClick={handleSavePaymentEdit} disabled={isUpdating} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                                          {isUpdating ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {[
                                        { label: "Date Received", value: safeFormatDate(selectedBatch.paymentReceivedDate) || "—" },
                                        { label: "Total Amount", value: `₹${displayAmount.toLocaleString('en-IN')}` },
                                        { label: "UTR ID", value: selectedBatch.utrId || "N/A", mono: true },
                                      ].map((item, i) => (
                                        <div key={i} className={`flex justify-between ${i < 2 ? "border-b border-emerald-200 pb-1.5" : ""}`}>
                                          <span className="text-[10px] text-emerald-600 font-medium">{item.label}</span>
                                          <span className={`text-xs font-bold text-emerald-800 ${item.mono ? "font-mono uppercase" : ""}`}>{item.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            <div className="bg-white border border-slate-200 rounded-lg p-3">
                              <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                                <User size={13} /> Shipment Details
                              </h3>
                              <div className="space-y-2">
                                {[
                                  { label: "Platform", value: selectedBatch.firmName || "N/A" },
                                  { label: "Order ID", value: selectedBatch.customerName || "N/A" },
                                  { label: "Address", value: selectedBatch.shippingAddress || "N/A", break: true },
                                  { label: "Order Date", value: safeFormatDate(selectedBatch.orderDate) || "—" },
                                  { label: "Last Delivery", value: safeFormatDate(selectedBatch.lastDeliveryDate) || "—" },
                                  ...(currentUser?.role === "Admin" ? [
                                    { label: "Dispatched By", value: selectedBatch.dispatchedBy || "Unknown" },
                                    ...(isCancelledOrder ? [{ label: "Cancelled By", value: selectedBatch.cancelledBy || "Unknown" }] : [])
                                  ] : [])
                                ].map((item, i) => (
                                  <div key={i} className="bg-slate-50 rounded p-2">
                                    <span className="text-[10px] text-slate-500 font-medium">{item.label}</span>
                                    <p className={`text-xs font-semibold text-slate-800 ${item.break ? "break-words" : "truncate"} ${item.mono ? "font-mono" : ""}`}>{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="bg-white border border-slate-200 rounded-lg p-3">
                              <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                                <FileCheck size={13} /> Documents
                              </h3>
                              <div className="space-y-1.5">
                              <DocumentButton label="GeM Contract" filename={selectedBatch.contractFilename} onView={handleViewDocument} />
                              <DocumentButton label="Tax Invoice" filename={selectedBatch.invoiceFilename} onView={handleViewDocument} />
                              {shouldShowEwayBillDocument && (
                                <DocumentButton label={isEwayBillRequired ? "E-Way Bill (Required)" : "E-Way Bill"} filename={selectedBatchEwayBillFilename} onView={handleViewDocument} />
                              )}
                              <DocumentButton label="Proof of Delivery" filename={selectedBatch.podFilename} onView={handleViewDocument} />

                              {oldDocs.length > 0 && (
                                <>
                                  <div className="my-2 pt-1 border-t border-slate-100" />
                                  <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Older / Replaced Documents</h4>
                                  {oldDocs.map((doc, idx) => {
                                    let label = doc.docType;
                                    if (label === 'gemContract') label = "GeM Contract";
                                    if (label === 'invoice') label = "Tax Invoice";
                                    if (label === 'ewayBill') label = "E-Way Bill";
                                    if (label === 'pod') label = "Proof of Delivery";
                                    return <DocumentButton key={idx} label={`[Old] ${label}`} filename={doc.filename} onView={handleViewDocument} />
                                  })}
                                </>
                              )}
                              </div>
                             
                            </div>

                            {selectedBatch.firmName === "GeM" && (
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                <h3 className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                                  <Building size={13} /> GeM Details
                                </h3>
                                <div className="space-y-1.5">
                                  {[
                                    { label: "Bid No", value: selectedBatch.bidNumber },
                                    { label: "Order Type", value: selectedBatch.gemOrderType },
                                    { label: "GST", value: selectedBatch.gstNumber },
                                    { label: "Contact", value: selectedBatch.contactNumber },
                                    { label: "Buyer Email", value: selectedBatch.buyerEmail, small: true },
                                    { label: "Order Date", value: safeFormatDate(selectedBatch.orderDate) || "—" },
                                    { label: "Last Delivery", value: safeFormatDate(selectedBatch.lastDeliveryDate) || "—" },
                                  ].map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs">
                                      <span className="text-orange-600">{item.label}</span>
                                      <span className={`font-bold text-slate-800 ${item.small ? "text-[10px]" : ""}`}>{item.value || "N/A"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(selectedBatch.contactNumber || selectedBatch.buyerEmail) && (
                              <div className="bg-white border border-slate-200 rounded-lg p-3">
                                <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                                  <Phone size={13} /> Contact
                                </h3>
                                <div className="space-y-1.5">
                                  {selectedBatch.contactNumber && (
                                    <div className="flex items-center gap-1.5 bg-slate-50 rounded p-2">
                                      <Phone size={11} className="text-slate-400" />
                                      <span className="text-xs font-medium text-slate-700">{selectedBatch.contactNumber}</span>
                                    </div>
                                  )}
                                  {selectedBatch.buyerEmail && (
                                    <div className="flex items-center gap-1.5 bg-slate-50 rounded p-2">
                                      <span className="text-xs font-medium text-slate-700">{selectedBatch.buyerEmail}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Installation Toggle - Hide for cancelled orders */}
                        {!isCancelledOrder && (
                          <div className={`flex items-center justify-between p-3 rounded-lg border ${isInstallationRequired(selectedBatch.installationRequired) ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-200"}`}>
                            <div className="flex items-center gap-2.5">
                              <div className={`p-2 rounded-lg ${isInstallationRequired(selectedBatch.installationRequired) ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"}`}>
                                <Wrench size={16} />
                              </div>
                              <div>
                                <div className="font-bold text-slate-700 text-xs">Installation Required?</div>
                                <div className="text-[10px] text-slate-500">
                                  {isInstallationRequired(selectedBatch.installationRequired)
                                    ? "Yes — Will appear in Installation tab"
                                    : "No — Default. Toggle to enable"}
                                </div>
                              </div>
                            </div>
                            <div className="flex bg-white rounded-md border border-slate-300 p-0.5">
                              <button
                                onClick={() => handleToggleInstallation(false)}
                                disabled={isUpdating}
                                className={`px-3 py-1 rounded text-[10px] font-bold transition ${
                                  !isInstallationRequired(selectedBatch.installationRequired)
                                    ? "bg-slate-700 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                No
                              </button>
                              <button
                                onClick={() => handleToggleInstallation(true)}
                                disabled={isUpdating}
                                className={`px-3 py-1 rounded text-[10px] font-bold transition ${
                                  isInstallationRequired(selectedBatch.installationRequired)
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                Yes
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Box size={13} /> Order Items
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">Showing {selectedBatch.displayItems.length} of {f.totalCount} Items</span>
                              {f.activeCount > 0 && f.returnedCount > 0 && (
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">{f.activeCount} Active</span>
                              )}
                              {f.returnedCount > 0 && (
                                <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 flex items-center gap-0.5">
                                  <RotateCcw size={8} />{f.returnedCount} Returned
                                </span>
                              )}
                              {f.replacedCount > 0 && (
                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                                  <RefreshCw size={8} />{f.replacedCount} Replaced
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-white border-b border-slate-100">
                                <tr>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase w-8">#</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">Model</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase">Serial No.</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase text-center">Status</th>
                                  <th className="px-3 py-2 text-[10px] text-slate-500 font-bold uppercase text-right">Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {selectedBatch.displayItems.map((item, idx) => {
                                  const returned = isItemReturned(item, returns);
                                  const replaced = isItemReplaced(item);
                                  const oldSerial = getOldSerial(item);
                                  const itemSerial = getItemSerial(item);
                                  const isReplacing = replacingItemId === item.id;
                                  
                                  // Safely find the correct modelId for the current item
                                  const currentSerialId = item.serialNumberId || item.serialId;
                                  const currentSerialObj = localSerials.find(s => s.id === currentSerialId);
                                  const targetModelId = item.modelId || currentSerialObj?.modelId;

                                  const availableSerialsForModel = localSerials.filter(s => 
                                    s.modelId === targetModelId && 
                                    (s.status || "").trim().toLowerCase() === "available"
                                  );

                                  return (
                                    <tr key={idx} className={returned ? "bg-red-50" : replaced ? "bg-indigo-50/30" : isOnHoldOrder ? "bg-yellow-50/50" : "hover:bg-slate-50"}>
                                      <td className="px-3 py-2.5 text-slate-400 font-bold text-center">{idx + 1}</td>
                                      <td className="px-3 py-2.5">
                                        <span className={`font-medium ${returned ? "text-red-700" : "text-slate-700"}`}>
                                          {item.modelName || "Unknown"}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className={`font-mono ${returned ? "text-red-600" : replaced ? "text-indigo-600" : "text-slate-600"}`}>
                                          {itemSerial || "N/A"}
                                        </span>
                                        {replaced && (
                                          <div className="text-[9px] text-indigo-500 font-bold mt-0.5 bg-indigo-50 px-1 py-0.5 rounded w-fit border border-indigo-100">
                                            Replaced old: {oldSerial}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        {isReplacing ? (
                                          <div className="flex items-center justify-center gap-1.5">
                                            <select
                                              className="w-[130px] border border-slate-300 rounded-md p-1.5 text-[10px] outline-none focus:ring-2 focus:ring-indigo-500"
                                              value={replaceWithSerialId}
                                              onChange={e => setReplaceWithSerialId(e.target.value)}
                                            >
                                              <option value="">Select Serial...</option>
                                              {availableSerialsForModel.map(s => <option key={s.id} value={s.id}>{s.value || s.serialNumber}</option>)}
                                            </select>
                                            <button onClick={() => handleReplaceSerial(item.id, replaceWithSerialId, itemSerial)} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-md border border-emerald-200 transition-colors" title="Save"><Check size={12} /></button>
                                            <button onClick={() => { setReplacingItemId(null); setReplaceWithSerialId(""); }} className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-md border border-red-200 transition-colors" title="Cancel"><X size={12} /></button>
                                          </div>
                                        ) : returned ? (
                                          <div className="flex items-center justify-center gap-2">
                                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-red-200"><RotateCcw size={9} />RETURNED</span>
                                            {(isAdmin || isSupervisor) && (
                                              <button onClick={() => setReplacingItemId(item.id)} className="text-[10px] text-indigo-600 font-bold hover:bg-indigo-100 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 transition-colors" title="Replace Serial"><RefreshCw size={10} /> Replace</button>
                                            )}
                                          </div>
                                        ) : replaced ? (
                                          <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-indigo-200">
                                            <RefreshCw size={9} /> REPLACED
                                          </span>
                                        ) : isCancelledOrder ? (
                                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-[10px] font-bold border border-red-100">
                                            <Ban size={9} />CANCELLED
                                          </span>
                                        ) : isOnHoldOrder ? (
                                          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-yellow-200">
                                            <PauseCircle size={9} />ON HOLD
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-100">
                                            <Check size={9} />ACTIVE
                                          </span>
                                        )}
                                      </td>
                                      <td className={`px-3 py-2.5 text-right font-bold ${returned || isCancelledOrder ? "text-red-400 line-through" : "text-slate-700"}`}>
                                        ₹{Number(item.sellingPrice || 0).toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 border-t border-slate-200">
                                  <td colSpan="4" className="px-3 py-2 text-right text-slate-500 font-medium text-[10px] uppercase">
                                    Total Batch Value ({f.totalCount} items)
                                  </td>
                                  <td className={`px-3 py-2 text-right font-bold text-xs ${isCancelledOrder ? "text-red-400 line-through" : "text-slate-800"}`}>
                                    ₹{f.totalValue.toLocaleString()}
                                  </td>
                                </tr>

                                {f.returnedValue > 0 && !isCancelledOrder && (
                                  <tr className="bg-red-50 border-t border-red-100">
                                    <td colSpan="4" className="px-3 py-2 text-right text-red-600 font-medium text-[10px] uppercase flex items-center justify-end gap-1">
                                      <RotateCcw size={9} /> Less: Returns ({f.returnedCount} item{f.returnedCount > 1 ? "s" : ""})
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-red-600 text-xs">
                                      -₹{f.returnedValue.toLocaleString()}
                                    </td>
                                  </tr>
                                )}

                                {!isCancelledOrder && (
                                  <tr className={`border-t-2 ${
                                    f.returnedCount > 0 ? "bg-amber-50 border-amber-200" : 
                                    isOnHoldOrder ? "bg-yellow-50 border-yellow-200" :
                                    "bg-indigo-50 border-indigo-200"
                                  }`}>
                                    <td colSpan="4" className={`px-3 py-2.5 text-right font-bold uppercase text-[10px] ${
                                      f.returnedCount > 0 ? "text-amber-700" : 
                                      isOnHoldOrder ? "text-yellow-700" :
                                      "text-indigo-700"
                                    }`}>
                                      {f.returnedCount > 0 ? "Net Billing Value (After Returns)" : 
                                       isOnHoldOrder ? "Pending Value (On Hold)" :
                                       "Final Billing Value"}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right font-bold text-sm ${
                                      f.returnedCount > 0 ? "text-amber-700" : 
                                      isOnHoldOrder ? "text-yellow-700" :
                                      "text-indigo-700"
                                    }`}>
                                      ₹{f.netValue.toLocaleString()}
                                    </td>
                                  </tr>
                                )}

                                {isCancelledOrder && (
                                  <tr className="border-t-2 bg-red-50 border-red-200">
                                    <td colSpan="4" className="px-3 py-2.5 text-right font-bold uppercase text-[10px] text-red-700">
                                      Order Cancelled — No Billing
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-sm text-red-700">
                                      ₹0
                                    </td>
                                  </tr>
                                )}
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        {/* ✅ REPLACEMENT HISTORY CARD */}
                        {batchReturnHistory.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden mt-4">
                            <div className="bg-red-100/60 px-3 py-2 border-b border-red-200 flex items-center justify-between">
                              <h3 className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                                <RotateCcw size={13} /> Return History
                              </h3>
                              <span className="text-[10px] font-bold bg-white text-red-700 px-2 py-0.5 rounded border border-red-200">
                                {batchReturnHistory.length} record{batchReturnHistory.length > 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="p-3 space-y-2">
                              {batchReturnHistory.map((record) => (
                                <div key={record.id} className="bg-white border border-red-100 rounded-lg p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                                  <div>
                                    <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Serial</p>
                                    <p className="font-mono text-xs font-bold text-slate-700">{record.serialValue || getReturnSerial(record) || "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Condition</p>
                                    <p className="text-xs font-semibold text-red-700">{record.condition || "Returned"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Reason</p>
                                    <p className="text-xs font-medium text-slate-700 break-words">{record.reason || "No reason recorded"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Invoice</p>
                                    <p className="text-xs font-medium text-slate-700">{record.invoiceNumber || "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Returned On</p>
                                    <p className="text-xs font-medium text-slate-700">
                                      {record.returnDate ? format(new Date(record.returnDate), "dd MMM yyyy, hh:mm a") : "N/A"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedBatch.items.some(isItemReplaced) && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg overflow-hidden mt-4">
                            <div className="bg-indigo-100/50 px-3 py-2 border-b border-indigo-200 flex items-center justify-between">
                              <h3 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                                <RefreshCw size={13} /> Serial Replacements
                              </h3>
                            </div>
                            <div className="p-3 space-y-2">
                              {selectedBatch.items.filter(isItemReplaced).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white border border-indigo-100 p-2.5 rounded-lg shadow-sm">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Old Serial (Returned)</p>
                                      <p className="font-mono text-xs font-bold text-red-500 line-through bg-red-50 px-2 py-0.5 rounded border border-red-100">{getOldSerial(item)}</p>
                                    </div>
                                    <div className="text-indigo-300 font-bold text-lg">➔</div>
                                    <div className="text-center">
                                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">New Serial (Active)</p>
                                      <p className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{getItemSerial(item)}</p>
                                    </div>
                                  </div>
                                  <div className="hidden sm:block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200">
                                    Replaced Successfully
                                  </div>
                                </div>
                              ))}
                             </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 rounded-b-xl flex justify-end">
              <button onClick={closeModal} className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
