import React, { useState, useEffect, useRef } from "react";
import { printerService } from "../services/api";
import { 
  RotateCcw, History, Trash2, CheckCircle2, AlertTriangle, 
  Search, ScanLine, Box, Calendar, ShoppingCart, Zap, X,
  AlertCircle, Receipt, FileText, ExternalLink, MapPin, Truck, Phone
} from "lucide-react"; 
import { format } from "date-fns";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const UPLOADS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

const extractReturnsArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.returns)) return payload.data.returns;
  if (Array.isArray(payload?.returns)) return payload.returns;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.docs)) return payload.docs;
  if (Array.isArray(payload?.data?.docs)) return payload.data.docs;
  return [];
};

const getReturnSerial = (item) =>
  item?.serialValue ||
  item?.serialNumber ||
  item?.serial?.value ||
  item?.serial?.serialNumber ||
  item?.serialNumberId?.value ||
  item?.serialNumberId?.serialNumber ||
  item?.serialId?.value ||
  item?.serialId?.serialNumber ||
  "N/A";

const getReturnModelName = (item) =>
  item?.modelName ||
  item?.model?.name ||
  item?.modelId?.name ||
  item?.serialNumberId?.modelId?.name ||
  item?.serialId?.modelId?.name ||
  "N/A";

const getReturnFirmName = (item) =>
  item?.firmName ||
  item?.dispatchId?.firmName ||
  item?.dispatch?.firmName ||
  item?.orderId?.firmName ||
  item?.order?.firmName ||
  "N/A";

const getReturnCustomerName = (item) =>
  item?.customerName ||
  item?.dispatchId?.customerName ||
  item?.dispatch?.customerName ||
  item?.orderId?.customerName ||
  item?.order?.customerName ||
  "N/A";

const getReturnTimestamp = (item) => item?.returnDate || item?.createdAt || null;

const getReturnDispatchId = (item) => {
  const rawValue =
    item?.dispatchId?.id ||
    item?.dispatchId?._id ||
    item?.dispatch?.id ||
    item?.dispatch?._id ||
    item?.dispatchId ||
    item?.orderId?.id ||
    item?.orderId?._id ||
    item?.order?.id ||
    item?.order?._id ||
    null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getUploadFileUrl = (filename) => {
  const safeFilename = String(filename || "").trim();
  if (!safeFilename) return null;
  return `${UPLOADS_BASE_URL}/uploads/${encodeURIComponent(safeFilename)}`;
};

const sortReturns = (items) =>
  [...items].sort(
    (a, b) =>
      new Date(b.returnDate || b.createdAt || 0) -
      new Date(a.returnDate || a.createdAt || 0)
  );

const normalizeReturns = (payload) => {
  const grouped = {};

  extractReturnsArray(payload).forEach((item, index) => {
    if (!item) return;

    const extractedSerial = getReturnSerial(item);
    const extractedModelName = getReturnModelName(item);
    const extractedFirmName = getReturnFirmName(item);
    const extractedCustomerName = getReturnCustomerName(item);
    const timestamp = getReturnTimestamp(item);
    const groupKey = extractedSerial !== "N/A" ? extractedSerial : item.id || item._id || index;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        ...item,
        displaySerial: extractedSerial,
        modelName: extractedModelName,
        firmName: extractedFirmName,
        customerName: extractedCustomerName,
        returnCount: 1,
        allReturnDates: timestamp ? [timestamp] : []
      };
      return;
    }

    grouped[groupKey].returnCount += 1;
    if (timestamp) {
      grouped[groupKey].allReturnDates.push(timestamp);
    }

    const existingDate = new Date(getReturnTimestamp(grouped[groupKey]) || 0);
    const newDate = new Date(timestamp || 0);

    if (newDate >= existingDate) {
      grouped[groupKey] = {
        ...grouped[groupKey],
        ...item,
        displaySerial: extractedSerial !== "N/A" ? extractedSerial : grouped[groupKey].displaySerial,
        modelName: extractedModelName !== "N/A" ? extractedModelName : grouped[groupKey].modelName,
        firmName: extractedFirmName !== "N/A" ? extractedFirmName : grouped[groupKey].firmName,
        customerName: extractedCustomerName !== "N/A" ? extractedCustomerName : grouped[groupKey].customerName,
        reason: item.reason || grouped[groupKey].reason,
        refundStatus: item.refundStatus || grouped[groupKey].refundStatus,
        refundAmount: item.refundAmount !== undefined ? item.refundAmount : grouped[groupKey].refundAmount,
        returnDate: item.returnDate || grouped[groupKey].returnDate,
        createdAt: item.createdAt || grouped[groupKey].createdAt
      };
    }
  });

  Object.values(grouped).forEach((item) => {
    item.allReturnDates = [...(item.allReturnDates || [])].sort(
      (a, b) => new Date(b) - new Date(a)
    );
  });

  return sortReturns(Object.values(grouped));
};

const mergeReturnIntoList = (currentList, newItem) => {
  if (!newItem) return currentList;

  const serialKey = (newItem.displaySerial || newItem.serialValue || newItem.serialNumber || "")
    .toString()
    .trim()
    .toUpperCase();

  if (!serialKey) {
    return sortReturns([newItem, ...currentList]);
  }

  const existingIndex = currentList.findIndex((item) => {
    const itemSerial = (item.displaySerial || item.serialValue || item.serialNumber || "")
      .toString()
      .trim()
      .toUpperCase();
    return itemSerial === serialKey;
  });

  if (existingIndex === -1) {
    return sortReturns([
      {
        ...newItem,
        returnCount: Number(newItem.returnCount) || 1,
        allReturnDates: getReturnTimestamp(newItem) ? [getReturnTimestamp(newItem)] : []
      },
      ...currentList
    ]);
  }

  const existingItem = currentList[existingIndex];
  const nextTimestamp = getReturnTimestamp(newItem);
  const nextList = [...currentList];
  nextList.splice(existingIndex, 1);

  return sortReturns([
    {
      ...existingItem,
      ...newItem,
      displaySerial: newItem.displaySerial || existingItem.displaySerial,
      modelName: newItem.modelName || existingItem.modelName,
      firmName: newItem.firmName || existingItem.firmName,
      customerName: newItem.customerName || existingItem.customerName,
      reason: newItem.reason || existingItem.reason,
      condition: newItem.condition || existingItem.condition,
      refundStatus: newItem.refundStatus || existingItem.refundStatus,
      refundAmount: newItem.refundAmount !== undefined ? newItem.refundAmount : existingItem.refundAmount,
      returnDate: newItem.returnDate || existingItem.returnDate,
      createdAt: newItem.createdAt || existingItem.createdAt,
      returnCount: Number(existingItem.returnCount || 1) + 1,
      allReturnDates: [
        ...(nextTimestamp ? [nextTimestamp] : []),
        ...(existingItem.allReturnDates || [])
      ].sort((a, b) => new Date(b) - new Date(a))
    },
    ...nextList
  ]);
};

const createOptimisticReturn = ({
  result,
  serialValue,
  serialDetails,
  selectedCondition,
  returnReason,
  refundStatus,
  refundAmount,
  currentUser
}) => {
  const timestamp = new Date().toISOString();

  return {
    id: result?.id || `temp-${Date.now()}`,
    serialNumberId: serialDetails?.id || serialDetails?.serialNumberId || null,
    dispatchId: result?.dispatchId || serialDetails?.linkedOrder?.id || null,
    serialValue: result?.serialValue || serialValue,
    displaySerial: result?.serialValue || serialValue,
    condition: result?.condition || selectedCondition,
    reason: returnReason.trim(),
    refundStatus: result?.refundStatus || refundStatus,
    refundAmount: result?.refundAmount !== undefined ? result.refundAmount : refundAmount,
    returnDate: timestamp,
    createdAt: timestamp,
    returnedBy: currentUser?.username || "Admin",
    modelName: serialDetails?.modelName || "N/A",
    firmName: serialDetails?.linkedOrder?.firmName || "N/A",
    customerName: serialDetails?.linkedOrder?.customerName || "N/A",
    invoiceNumber: result?.invoiceNumber || serialDetails?.linkedOrder?.invoiceNumber || null,
    returnCount: 1,
    allReturnDates: [timestamp]
  };
};

export default function Returns({ returns = [], isLoaded = false, onRefresh, isAdmin, isSupervisor, currentUser }) {
  const [serialInput, setSerialInput] = useState("");
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [pendingSerial, setPendingSerial] = useState("");
  const [pendingSerialDetails, setPendingSerialDetails] = useState(null);
  const [condition, setCondition] = useState("InStock");
  const [reason, setReason] = useState("");
  const [refundStatus, setRefundStatus] = useState("Full");
  const [refundAmount, setRefundAmount] = useState("");
  const [selectedReturnOrder, setSelectedReturnOrder] = useState(null);
  const [selectedDispatchDetails, setSelectedDispatchDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (isLoaded) {
      setReturnsList(normalizeReturns(returns));
    } else {
      loadData();
    }
    if(inputRef.current) inputRef.current.focus();
  }, [isLoaded, returns]);

  const getConditionMeta = (value) => {
    const normalized = (value || "").toString().trim().toLowerCase();

    if (normalized === "damaged") {
      return {
        label: "Damaged",
        className: "bg-red-50 text-red-700 border-red-100",
        dotClassName: "bg-red-500"
      };
    }

    return {
      label: "In Stock",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100",
      dotClassName: "bg-emerald-500"
    };
  };

  const _loadDataLegacy = async () => {
    try {
      setLoading(true);
      
      // ✅ Ensure we hit the correct endpoint directly via axios 
      // just like the POST request to avoid printerService misconfiguration/caching
      let token = "";
      try {
        const userStr = localStorage.getItem("pt_user");
        if (userStr) token = JSON.parse(userStr).token;
      } catch {
        // Legacy fallback for older cached sessions.
      }

      let rData;
      try {
        const response = await axios.get(`${API_BASE_URL}/api/returns`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        rData = response.data;
      } catch (apiErr) {
        console.warn("Direct API fetch failed, falling back to printerService:", apiErr);
        rData = await printerService.getReturns();
      }

      console.log("Raw Returns Data API Response:", rData);
      
      let rArray = [];
      if (Array.isArray(rData)) rArray = rData;
      else if (rData?.data && Array.isArray(rData.data)) rArray = rData.data;
      else if (rData?.data?.data && Array.isArray(rData.data.data)) rArray = rData.data.data;
      else if (rData?.data?.returns && Array.isArray(rData.data.returns)) rArray = rData.data.returns;
      else if (rData?.returns && Array.isArray(rData.returns)) rArray = rData.returns;
      else if (rData?.results && Array.isArray(rData.results)) rArray = rData.results;
      else if (rData?.docs && Array.isArray(rData.docs)) rArray = rData.docs;
      else if (rData?.data?.docs && Array.isArray(rData.data.docs)) rArray = rData.data.docs;

      // Group returns by serial to handle duplicate rows and compute returnCount
      const grouped = {};
      rArray.forEach((item, index) => {
        if (!item) return;
        
        // Robust extraction covering all possible API population structures
        const extractedSerial = item.serialValue || item.serialNumber || item.serial?.value || item.serial?.serialNumber || item.serialNumberId?.value || item.serialNumberId?.serialNumber || item.serialId?.value || item.serialId?.serialNumber || "N/A";
        
        // Safely extract nested properties in case they are populated inside relations like serialNumberId or dispatchId
        const extractedModelName = item.modelName || item.model?.name || item.modelId?.name || item.serialNumberId?.modelId?.name || item.serialId?.modelId?.name || "N/A";
        const extractedFirmName = item.firmName || item.dispatchId?.firmName || item.dispatch?.firmName || item.orderId?.firmName || item.order?.firmName || "N/A";
        const extractedCustomerName = item.customerName || item.dispatchId?.customerName || item.dispatch?.customerName || item.orderId?.customerName || item.order?.customerName || "N/A";

        const groupKey = extractedSerial !== "N/A" ? extractedSerial : (item.id || item._id || index);

        if (!grouped[groupKey]) {
          grouped[groupKey] = { 
            ...item, 
            displaySerial: extractedSerial,
            modelName: extractedModelName,
            firmName: extractedFirmName,
            customerName: extractedCustomerName,
            returnCount: 1, 
            allReturnDates: item.returnDate ? [item.returnDate] : item.createdAt ? [item.createdAt] : [] 
          };
        } else {
          grouped[groupKey].returnCount += 1;
          if (item.returnDate || item.createdAt) {
            grouped[groupKey].allReturnDates.push(item.returnDate || item.createdAt);
          }
          
          // Keep the latest status and details
          const existingDate = new Date(grouped[groupKey].returnDate || grouped[groupKey].createdAt || 0);
          const newDate = new Date(item.returnDate || item.createdAt || 0);
          if (newDate >= existingDate) {
            grouped[groupKey].condition = item.condition || grouped[groupKey].condition;
            grouped[groupKey].returnDate = item.returnDate || grouped[groupKey].returnDate;
            grouped[groupKey].firmName = extractedFirmName !== "N/A" ? extractedFirmName : grouped[groupKey].firmName;
            grouped[groupKey].customerName = extractedCustomerName !== "N/A" ? extractedCustomerName : grouped[groupKey].customerName;
            grouped[groupKey].reason = item.reason || grouped[groupKey].reason;
            grouped[groupKey].refundStatus = item.refundStatus || grouped[groupKey].refundStatus;
            grouped[groupKey].refundAmount = item.refundAmount !== undefined ? item.refundAmount : grouped[groupKey].refundAmount;
            grouped[groupKey].id = item.id || item._id || grouped[groupKey].id;
            grouped[groupKey].serialNumberId = item.serialNumberId || grouped[groupKey].serialNumberId;
            grouped[groupKey].modelName = extractedModelName !== "N/A" ? extractedModelName : grouped[groupKey].modelName;
            grouped[groupKey].displaySerial = extractedSerial !== "N/A" ? extractedSerial : grouped[groupKey].displaySerial;
            grouped[groupKey].createdAt = item.createdAt || grouped[groupKey].createdAt;
          }
        }
      });

      // Sort the return dates inside each group for the tooltip (latest first)
      Object.values(grouped).forEach(g => {
        if (g.allReturnDates) {
          g.allReturnDates.sort((a, b) => new Date(b) - new Date(a));
        }
      });

      const uniqueReturns = Object.values(grouped);
      
      // Sort uniqueReturns by returnDate descending so table is ordered latest first
      uniqueReturns.sort((a, b) => new Date(b.returnDate || b.createdAt || 0) - new Date(a.returnDate || a.createdAt || 0));
      
      console.log("Processed Unique Returns:", uniqueReturns);
      setReturnsList(uniqueReturns);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const rData = await printerService.getReturns();
      setReturnsList(normalizeReturns(rData));
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReturns = returnsList.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
        (item.displaySerial || item.serialValue || "").toString().toLowerCase().includes(search) ||
        (item.modelName || "").toString().toLowerCase().includes(search) ||
        (item.firmName || "").toString().toLowerCase().includes(search) ||
        (item.customerName || "").toString().toLowerCase().includes(search) ||
        (item.dispatchId || "").toString().toLowerCase().includes(search) ||
        (item.invoiceNumber || "").toString().toLowerCase().includes(search) ||
        (item.reason || "").toString().toLowerCase().includes(search)
    );
  });

  const initiateReturn = async (value) => {
    const serialVal = value.trim().toUpperCase();
    if (!serialVal) return;

    setLoading(true);
    try {
      const data = await printerService.getReturnLookup(serialVal);

      if (!data.canReturn) {
         if (data.currentStatus === "Available" || data.currentStatus === "Damaged") {
           setMessage({ type: "error", text: `⚠️ Item is already ${data.currentStatus}.` });
         } else if (data.existingReturnForLinkedOrder) {
           setMessage({ type: "error", text: "⚠️ This order is already marked as returned." });
         } else if (!data.linkedOrder) {
           setMessage({ type: "error", text: "⚠️ No dispatch record found for this serial to return." });
         } else {
           setMessage({ type: "error", text: `⚠️ Cannot return. Status is ${data.currentStatus}.` });
         }
         setSerialInput("");
         setLoading(false);
         return;
      }

      // ✅ NEW CHECK: Enforce that the item is Delivered before allowing a return
      const orderStatus = String(data.linkedOrder?.status || "").trim();
      const logStatus = String(data.linkedOrder?.logisticsStatus || "").trim();
      
      const isDelivered = 
        logStatus === "Delivered" || 
        orderStatus === "Delivered" || 
        orderStatus === "Completed" || 
        orderStatus === "Payment Pending";

      if (!isDelivered) {
         setMessage({ 
           type: "error", 
           text: `⚠️ Cannot return. Item must be 'Delivered' first. (Current Status: ${logStatus || orderStatus || data.currentStatus})` 
         });
         setSerialInput("");
         setLoading(false);
         return;
      }

      setPendingSerial(serialVal);
      setPendingSerialDetails(data);
      setCondition("InStock");
      setReason("");
      setRefundStatus("Full");
      setRefundAmount(data?.linkedOrder?.sellingPrice || "");
      setShowConditionModal(true);
      setMessage({ type: "", text: "" }); 
    } catch (err) {
      if (err.response?.status === 404) {
        setMessage({ type: "error", text: `❌ Serial ${serialVal} not found in system!` });
      } else {
        setMessage({ type: "error", text: "❌ Failed to fetch serial details." });
      }
      setSerialInput("");
    } finally {
      setLoading(false);
    }
  };

  const confirmReturn = async () => {
    if (!reason.trim()) {
      setMessage({ type: "error", text: "⚠️ Return reason is mandatory." });
      return;
    }
    if (refundStatus !== "None" && (!refundAmount || Number(refundAmount) <= 0)) {
      setMessage({ type: "error", text: "⚠️ Refund amount is required for Full/Partial refunds." });
      return;
    }
    setShowConditionModal(false);
    if(loading) return; 
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const dispatchId = pendingSerialDetails?.linkedOrder?.id || pendingSerialDetails?.linkedOrder?._id;
      const result = await printerService.addReturn({
        serialValue: pendingSerial,
        condition,
        reason,
        refundStatus,
        refundAmount: refundStatus === "None" ? 0 : Number(refundAmount),
        dispatchId,
        returnedBy: currentUser?.username || "Admin"
      });
      const statusText = result.condition === "Damaged" ? "moved to Damaged Tab" : "restocked";
      
      setMessage({ 
        type: "success", 
        text: `✅ Success! ${result.serialValue} marked as ${result.condition}. ${statusText}.` 
      });
      
      setSerialInput("");
      setPendingSerial("");
      setPendingSerialDetails(null);
      setReason("");
      setRefundStatus("Full");
      setRefundAmount("");
      setReturnsList((currentList) =>
        mergeReturnIntoList(
          currentList,
          createOptimisticReturn({
            result,
            serialValue: pendingSerial,
            serialDetails: pendingSerialDetails,
            selectedCondition: condition,
            returnReason: reason,
            refundStatus,
            refundAmount: refundStatus === "None" ? 0 : Number(refundAmount),
            currentUser
          })
        )
      );
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
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
      try {
        await printerService.deleteReturn(id);
        await loadData();
        if (onRefresh) {
          await onRefresh();
        }
      } 
      catch { alert("Failed to delete"); }
    }
  };

  const handleChange = (e) => {
    const val = e.target.value.toUpperCase();
    setSerialInput(val);
    
    if (val.length >= 10) { 
        if (!loading) {
           // Wait for enter key
        }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      initiateReturn(serialInput);
    }
  };

  const closeOrderDetails = () => {
    setSelectedReturnOrder(null);
    setSelectedDispatchDetails(null);
    setLoadingOrderDetails(false);
    setOrderDetailsError("");
  };

  const handleOpenUploadFile = async (filename, label = "File") => {
    const fileUrl = getUploadFileUrl(filename);

    if (!fileUrl) {
      setOrderDetailsError(`${label} file not uploaded.`);
      return;
    }

    try {
      setOrderDetailsError("");
      const response = await fetch(fileUrl, { method: "HEAD" });

      if (!response.ok) {
        throw new Error(`${label} file not found`);
      }

      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(`Failed to open ${label.toLowerCase()} file:`, error);
      setOrderDetailsError(`${label} file server par nahi mili. Please upload it again.`);
    }
  };

  const handleOpenOrderDetails = async (item) => {
    const dispatchId = getReturnDispatchId(item);

    if (!dispatchId) {
      alert("Linked order not found for this return.");
      return;
    }

    setSelectedReturnOrder(item);
    setSelectedDispatchDetails(null);
    setOrderDetailsError("");
    setLoadingOrderDetails(true);

    try {
      const dispatchDetails = await printerService.getDispatchById(dispatchId);
      if (!dispatchDetails) {
        setOrderDetailsError("Order details fetch nahi ho payi.");
        return;
      }
      setSelectedDispatchDetails(dispatchDetails);
    } catch (error) {
      console.error("Failed to load order details:", error);
      setOrderDetailsError("Order details load nahi ho payi.");
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const orderDetails = selectedDispatchDetails || selectedReturnOrder;
  const orderDetailsDispatchId = getReturnDispatchId(selectedDispatchDetails) || getReturnDispatchId(selectedReturnOrder);
  const orderInvoiceUrl = getUploadFileUrl(orderDetails?.invoiceFilename);

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
                disabled={loading || showConditionModal} 
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Serial Number</p>
                <p className="font-mono text-xl font-bold text-indigo-600 tracking-wide">{pendingSerial}</p>
                
                {pendingSerialDetails && pendingSerialDetails.linkedOrder && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-left text-xs bg-white p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Model</span>
                      <span className="font-semibold text-slate-700">{pendingSerialDetails.modelName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Platform</span>
                      <span className="font-semibold text-slate-700">{pendingSerialDetails.linkedOrder.firmName || "N/A"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Order ID</span>
                      {/*<span className="font-semibold text-slate-700">{pendingSerialDetails.linkedOrder.customerName || "N/A"}</span> */}
                    </div>
                  </div>
                )}
                {pendingSerialDetails?.smartWarning && (
                  <div className="mt-3 bg-amber-50 text-amber-700 text-xs p-2.5 rounded-lg text-left flex gap-2 items-start border border-amber-100">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span className="font-medium">{pendingSerialDetails.smartWarning}</span>
                  </div>
                )}
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

          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Refund Status <span className="text-red-500">*</span></label>
              <select 
                className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={refundStatus}
                onChange={(e) => {
                  setRefundStatus(e.target.value);
                  if(e.target.value === "None") setRefundAmount("0");
                }}
              >
                <option value="Full">Full Refund</option>
                <option value="Partial">Partial Refund</option>
                <option value="None">No Refund</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Refund (₹) {refundStatus !== "None" && <span className="text-red-500">*</span>}</label>
              <input 
                type="number"
                className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Amount"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                disabled={refundStatus === "None"}
              />
            </div>
          </div>

              <div className="mb-6 text-left">
                <label className="block text-xs font-bold text-slate-600 mb-1">Return Reason <span className="text-red-500">*</span></label>
                <textarea 
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                  rows={2} 
                  placeholder="Why is this item being returned?" 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                />
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

      {selectedReturnOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 flex items-start justify-between text-white">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2">
                  <Receipt size={20} /> Order Details
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="bg-white/10 px-2 py-1 rounded-lg font-semibold">
                    {orderDetails?.customerName || selectedReturnOrder.customerName || "N/A"}
                  </span>
                  {orderDetailsDispatchId && (
                    <span className="bg-white/10 px-2 py-1 rounded-lg font-mono">
                      Ref #{orderDetailsDispatchId}
                    </span>
                  )}
                  <span className="bg-white/10 px-2 py-1 rounded-lg">
                    Return Serial: {selectedReturnOrder.displaySerial || selectedReturnOrder.serialValue || "N/A"}
                  </span>
                </div>
              </div>
              <button
                onClick={closeOrderDetails}
                className="p-2 hover:bg-white/10 rounded-full transition"
              >
                <X size={20} className="text-slate-200" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingOrderDetails && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
                  Order details load ho rahi hai...
                </div>
              )}

              {orderDetailsError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {orderDetailsError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Truck size={15} /> Order Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Platform</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.firmName || selectedReturnOrder.firmName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Order Status</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.status || orderDetails?.orderStatus || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Logistics Status</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.logisticsStatus || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Dispatch Date</p>
                      <p className="font-semibold text-slate-700 mt-1">
                        {orderDetails?.dispatchDate ? format(new Date(orderDetails.dispatchDate), "dd MMM yyyy") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Invoice No.</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.invoiceNumber || selectedReturnOrder.invoiceNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Tracking ID</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.trackingId || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Box size={15} /> Product & Return
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Serial</p>
                      <p className="font-mono font-semibold text-slate-700 mt-1">{selectedReturnOrder.displaySerial || selectedReturnOrder.serialValue || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Model</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.modelName || selectedReturnOrder.modelName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Return Condition</p>
                      <p className="font-semibold text-slate-700 mt-1">{selectedReturnOrder.condition || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Return Date</p>
                      <p className="font-semibold text-slate-700 mt-1">
                        {selectedReturnOrder.returnDate || selectedReturnOrder.createdAt
                          ? format(new Date(selectedReturnOrder.returnDate || selectedReturnOrder.createdAt), "dd MMM yyyy, hh:mm a")
                          : "N/A"}
                      </p>
                    </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Refund Details</p>
                  <p className="font-semibold text-slate-700 mt-1">
                    {selectedReturnOrder.refundStatus || "N/A"} 
                    {selectedReturnOrder.refundAmount > 0 && ` - ₹${selectedReturnOrder.refundAmount}`}
                  </p>
                </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Reason</p>
                      <p className="font-semibold text-slate-700 mt-1 break-words">{selectedReturnOrder.reason || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <MapPin size={15} /> Customer Details
                  </h4>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Customer / Order ID</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.customerName || orderDetails?.customer || selectedReturnOrder.customerName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                        <Phone size={11} /> Contact
                      </p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.contactNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Shipping Address</p>
                      <p className="font-semibold text-slate-700 mt-1 break-words">
                        {orderDetails?.shippingAddress || orderDetails?.address || selectedReturnOrder.shippingAddress || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <FileText size={15} /> Invoice
                  </h4>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Invoice Number</p>
                      <p className="font-semibold text-slate-700 mt-1">{orderDetails?.invoiceNumber || selectedReturnOrder.invoiceNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Invoice File</p>
                      {orderInvoiceUrl ? (
                        <button
                          type="button"
                          onClick={() => handleOpenUploadFile(orderDetails?.invoiceFilename, "Invoice")}
                          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          <FileText size={14} /> View Invoice
                          <ExternalLink size={12} />
                        </button>
                      ) : (
                        <p className="font-semibold text-slate-400 mt-1">Invoice file not uploaded</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end">
              <button
                onClick={closeOrderDetails}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition"
              >
                Close
              </button>
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
            All Return Items
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Serial Number</th>
                <th className="px-5 py-3">Model</th>
                <th className="px-5 py-3">Condition</th> 
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3">Order ID</th>
            <th className="px-5 py-3">Refund</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3 text-center">History</th>
                <th className="px-5 py-3 text-right">Date</th>
                <th className="px-5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReturns.length === 0 ? (
                <tr>
                <td colSpan="10" className="p-12 text-center">
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
                filteredReturns.map((item, index) => {
                  const conditionMeta = getConditionMeta(item.condition);

                  return (
                  <tr key={item.id || item._id || index} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-md">
                          <ScanLine size={12} className="text-indigo-600" />
                        </div>
                        <span className="font-mono font-bold text-slate-700 text-xs">{item.displaySerial || item.serialValue || item.serialNumber || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-slate-700 font-medium">{item.modelName || "N/A"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${conditionMeta.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${conditionMeta.dotClassName}`}></span>
                        {conditionMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <ShoppingCart size={12} className="text-slate-400" />
                        {item.firmName || "N/A"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {getReturnDispatchId(item) ? (
                        <button
                          onClick={() => handleOpenOrderDetails(item)}
                          className="text-left group"
                          title="View order details"
                        >
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg group-hover:bg-indigo-100 transition">
                            {item.customerName || "N/A"}
                            <ExternalLink size={11} />
                          </span>
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {item.customerName || "N/A"}
                        </span>
                      )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${item.refundStatus === 'Full' ? 'text-emerald-600' : item.refundStatus === 'Partial' ? 'text-amber-600' : 'text-slate-500'}`}>
                      {item.refundStatus || "N/A"}
                    </span>
                    {item.refundAmount > 0 && (
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">₹{item.refundAmount}</span>
                    )}
                  </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[150px] truncate" title={item.reason}>
                      <span className="text-xs text-slate-600">
                        {item.reason || "N/A"}
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
                                  {d ? format(new Date(d), "dd MMM yyyy, hh:mm a") : "Unknown Date"}
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
                        {item.returnDate || item.createdAt ? format(new Date(item.returnDate || item.createdAt), "dd MMM yyyy") : "-"}
                        <span className="text-[10px] text-slate-400 ml-1">
                          {item.returnDate || item.createdAt ? format(new Date(item.returnDate || item.createdAt), "HH:mm") : ""}
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
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
