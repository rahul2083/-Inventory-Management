import React, { useEffect, useMemo, useRef, useState } from "react";
import { printerService } from "../services/api";
import {
  ArrowLeft, Package, Truck, ScanLine, Hash,
  Trash2, CheckCircle, AlertCircle, Sparkles,
  IndianRupee, ShoppingCart, Layers, Calculator,
  Calendar, FileText, MapPin, Phone, Mail, UploadCloud,
  Wrench, Activity, CheckSquare, X, Eye, EyeOff,
  TrendingUp, TrendingDown, Clock, CreditCard,
  Plus, Minus, Database, Building2, ListChecks,
  Zap, Shield, Box, CircleDot
} from "lucide-react";

export default function NewDispatch({
  models = [],
  serials = [],
  currentUser,
  onRefresh,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState("single");
  const [batchList, setBatchList] = useState([]);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const [autoSubmitDelay] = useState(300);
  const [modelPrices, setModelPrices] = useState({});
  const [showIndividualEdit, setShowIndividualEdit] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedPanelSerials, setSelectedPanelSerials] = useState([]);
  const [serialReturnWarning, setSerialReturnWarning] = useState("");

  const [lastDateManuallySet, setLastDateManuallySet] = useState(false);

  const [form, setForm] = useState({
    serialInput: "",
    serialId: "",
    modelName: "",
    companyName: "",
    platform: "",
    orderId: "",
    sellingPrice: "",
    landingPrice: 0,
    mrp: 0,
    modelId: null,
    quantity: 1,
    status: "Order Confirmed",
    installationRequired: "No",
    gemOrderType: "Direct Order",
    gemOrderDate: "",
    gemLastDate: "",
    gemBidNo: "",
    gemContractFile: null,
    gemAddress: "",
    gemGst: "",
    gemContact: "",
    gemAltContact: "",
    gemBuyerEmail: "",
    gemConsigneeEmail: ""
  });

  // Helper function to add days to a date string
  const addDaysToDate = (dateString, days) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle Order Date change with auto-fill logic
  const handleOrderDateChange = (newOrderDate) => {
    const autoLastDate = addDaysToDate(newOrderDate, 15);
    if (!lastDateManuallySet) {
      setForm(prev => ({
        ...prev,
        gemOrderDate: newOrderDate,
        gemLastDate: autoLastDate
      }));
    } else {
      setForm(prev => ({
        ...prev,
        gemOrderDate: newOrderDate
      }));
    }
  };

  // Handle Last Date manual change
  const handleLastDateChange = (newLastDate) => {
    setLastDateManuallySet(true);
    setForm(prev => ({
      ...prev,
      gemLastDate: newLastDate
    }));
  };

  // Reset manual flag when platform changes
  useEffect(() => {
    setLastDateManuallySet(false);
    // ✅ Reset status to "Order Confirmed" when switching to Amazon/Flipkart
    // so it always sends a valid default for platforms that don't show the picker
    if (form.platform === "Amazon" || form.platform === "Flipkart") {
      setForm(prev => ({ ...prev, status: "Order Confirmed" }));
    }
  }, [form.platform]);

  const platforms = [
    { value: "Amazon", icon: "🛒", color: "from-amber-400 to-orange-500", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
    { value: "Flipkart", icon: "📦", color: "from-blue-400 to-blue-600", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
    { value: "GeM", icon: "🏛️", color: "from-emerald-400 to-emerald-600", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
    { value: "Other", icon: "🔗", color: "from-violet-400 to-purple-600", bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-700" }
  ];

  const getCompanyName = (model) => {
    if (!model) return "Unknown";
    return model.company || model.companyName || model.firm || "Unknown";
  };

  const getSerialValue = (serial) => {
    if (!serial) return "";
    return serial.value || serial.serialNumber || serial.serial_no || serial.serial || "";
  };

  const normalize = (val) => {
    return String(val || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9-]/g, "");
  };

  const companyOptions = useMemo(() => {
    const unique = [...new Set(models.map((m) => getCompanyName(m)).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [models]);

  const filteredModelsByCompany = useMemo(() => {
    if (!selectedCompany) return [];
    return models.filter((m) => getCompanyName(m) === selectedCompany);
  }, [models, selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) {
      setSelectedModelId("");
      setSelectedPanelSerials([]);
      return;
    }
    if (selectedModelId) {
      const exists = filteredModelsByCompany.some((m) => String(m.id) === String(selectedModelId));
      if (!exists) {
        setSelectedModelId("");
        setSelectedPanelSerials([]);
      }
    }
  }, [selectedCompany, selectedModelId, filteredModelsByCompany]);

  useEffect(() => {
    if (!selectedCompany || !selectedModelId) {
      setSelectedPanelSerials([]);
      return;
    }

    const selectedSerialIdsInBatch = batchList.map((item) => String(item.serialId));
    const singleSelectedSerialId = form.serialId ? String(form.serialId) : null;

    const availableSerials = serials.filter((s) => {
      const serialStatus = String(s.status || "").trim().toLowerCase();
      const modelMatch = String(s.modelId) === String(selectedModelId);
      const isAvailable = serialStatus === "available";
      const alreadyUsedInMultiple = selectedSerialIdsInBatch.includes(String(s.id));
      const alreadyUsedInSingle = singleSelectedSerialId === String(s.id);
      return modelMatch && isAvailable && !alreadyUsedInMultiple && !alreadyUsedInSingle;
    });

    setSelectedPanelSerials(availableSerials);
  }, [selectedCompany, selectedModelId, serials, batchList, form.serialId]);

  const processSerial = (serialValue) => {
    if (!serialValue || String(serialValue).trim() === "") return;

    const trimmedValue = String(serialValue).trim();
    setIsProcessing(true);
    setSerialReturnWarning("");

    if (activeTab === "multiple") {
      const targetQty = parseInt(form.quantity, 10) || 1;
      if (batchList.length >= targetQty) {
        setError(`Target limit reached! You have already scanned ${targetQty} items.`);
        setIsProcessing(false);
        return;
      }
    }

    const foundSerial = serials.find((s) => {
      const serialVal = getSerialValue(s);
      return normalize(serialVal) === normalize(trimmedValue);
    });

    if (!foundSerial) {
      setError(`Serial "${trimmedValue}" not found in inventory.`);
      setIsProcessing(false);
      return;
    }

    const dbStatus = String(foundSerial.status || "").trim().toLowerCase();
    if (dbStatus !== "available") {
      setError(`Serial "${trimmedValue}" is "${foundSerial.status}" (must be Available).`);
      setIsProcessing(false);
      return;
    }

    const serialId = foundSerial.id;
    const serialDisplayValue = getSerialValue(foundSerial);

    if (
      activeTab === "multiple" &&
      batchList.find((b) => String(b.serialId) === String(serialId))
    ) {
      setError("This serial is already added.");
      setIsProcessing(false);
      return;
    }

    const model = models.find((m) => String(m.id) === String(foundSerial.modelId));

    if (!model) {
      setError(`Model not found for serial ${serialDisplayValue}`);
      setIsProcessing(false);
      return;
    }

    const companyName = getCompanyName(model);
    const warningMessage = Number(foundSerial.returnCount || 0) > 0
      ? `This serial was previously returned${foundSerial.latestReturnReason ? ` (Reason: ${foundSerial.latestReturnReason})` : ""}.`
      : "";
    setSerialReturnWarning(warningMessage);

    if (activeTab === "multiple") {
      if (modelPrices[foundSerial.modelId] === undefined) {
        setModelPrices((prev) => ({
          ...prev,
          [foundSerial.modelId]: model?.mrp || ""
        }));
      }

      setBatchList((prev) => [
        ...prev,
        {
          serialId,
          serialValue: serialDisplayValue,
          modelId: foundSerial.modelId,
          modelName: model.name,
          companyName,
          landingPrice: foundSerial.landingPrice || 0,
          mrp: model?.mrp || 0,
          individualPrice: null,
          returnCount: Number(foundSerial.returnCount || 0),
          latestReturnReason: foundSerial.latestReturnReason || ""
        }
      ]);

      setSuccessMsg(`✓ Added: ${serialDisplayValue}`);
      setForm((prev) => ({ ...prev, serialInput: "" }));
      setTimeout(() => setSuccessMsg(""), 2000);

      if (inputRef.current) inputRef.current.focus();
    } else {
      setForm((prev) => ({
        ...prev,
        serialId,
        modelId: foundSerial.modelId,
        modelName: model.name,
        companyName,
        landingPrice: foundSerial.landingPrice || 0,
        mrp: model?.mrp || 0,
        serialInput: serialDisplayValue,
        sellingPrice: prev.sellingPrice || (model?.mrp ? String(model.mrp) : ""),
        quantity: 1
      }));

      setSuccessMsg(`✓ Serial found: ${serialDisplayValue}`);
      setTimeout(() => setSuccessMsg(""), 2000);
    }

    setIsProcessing(false);
    setError("");
  };

  const handleSerialChange = (value) => {
    setForm((prev) => ({ ...prev, serialInput: value }));
    setError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || String(value).trim() === "") {
      if (activeTab === "single") {
        setForm((prev) => ({
          ...prev,
          serialId: "",
          modelName: "",
          companyName: "",
          landingPrice: 0,
          mrp: 0,
          modelId: null,
          quantity: 1
        }));
        setSerialReturnWarning("");
      }
      return;
    }

    if (autoSubmitDelay > 0) {
      debounceRef.current = setTimeout(() => {
        processSerial(value);
      }, autoSubmitDelay);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      processSerial(form.serialInput);
    }
  };

  const removeFromBatch = (serialId) => {
    setBatchList((prev) => prev.filter((item) => item.serialId !== serialId));
  };

  const updateModelPrice = (modelId, price) => {
    setModelPrices((prev) => ({ ...prev, [modelId]: price }));
  };

  const updateIndividualPrice = (serialId, price) => {
    setBatchList((prev) =>
      prev.map((item) =>
        item.serialId === serialId ? { ...item, individualPrice: price } : item
      )
    );
  };

  const handleFileChange = (e) => {
    setForm((prev) => ({ ...prev, gemContractFile: e.target.files[0] }));
  };

  const effectiveSingleQuantity = 1;
  const multipleQuantity = Number(form.quantity) || 0;

  const incrementQuantity = () => {
    if (activeTab !== "multiple") return;
    setForm((prev) => ({
      ...prev,
      quantity: String((Number(prev.quantity) || 0) + 1)
    }));
  };

  const decrementQuantity = () => {
    if (activeTab !== "multiple") return;
    setForm((prev) => {
      const nextQty = Math.max(Number(prev.quantity || 0) - 1, batchList.length, 1);
      return {
        ...prev,
        quantity: String(nextQty)
      };
    });
  };

  const batchSummary = useMemo(() => {
    const summary = {};
    batchList.forEach((item) => {
      if (!summary[item.modelId]) {
        summary[item.modelId] = {
          modelId: item.modelId,
          modelName: item.modelName,
          companyName: item.companyName,
          mrp: item.mrp,
          count: 0,
        };
      }
      summary[item.modelId].count++;
    });
    return Object.values(summary);
  }, [batchList]);

  const batchTotalValue = useMemo(() => {
    return batchList.reduce((sum, item) => {
      const price =
        item.individualPrice !== null
          ? Number(item.individualPrice)
          : Number(modelPrices[item.modelId] || 0);
      return sum + (price || 0);
    }, 0);
  }, [batchList, modelPrices]);

  // Derive the live status from the dispatch status
  const deriveLiveStatus = (dispatchStatus) => {
    if (dispatchStatus === "Order Not Confirmed") {
      return "Order On Hold";
    }
    return dispatchStatus;
  };

  // ✅ Check if current platform should show Order Status picker
  const showOrderStatus = form.platform === "GeM" || form.platform === "Other";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (!form.platform || !form.orderId) {
        setError("Please select Platform and enter Order ID.");
        return;
      }

      let contractFilename = null;

      if (form.gemContractFile) {
        try {
          const uploadResponse = await printerService.uploadOrderDocument(
            0,
            form.gemContractFile,
            "gemContract"
          );
          contractFilename = uploadResponse.filename;
        } catch {
          setError("Failed to upload contract file.");
          return;
        }
      }

      let additionalDetails = {};

      // ✅ For Amazon/Flipkart, always send "Order Confirmed"
      // For GeM/Other, use the selected status (derived)
      const actualStatus = showOrderStatus
        ? deriveLiveStatus(form.status)
        : "Order Confirmed";

      if (form.platform === "GeM") {
        if (!form.gemOrderDate || !form.gemLastDate || !form.gemContact) {
          setError("Please fill in all required GeM fields.");
          return;
        }

        additionalDetails = {
          status: actualStatus,
          installationRequired: form.installationRequired === "Yes",
          orderType: form.gemOrderType,
          bidNo:
            form.gemOrderType === "Bid" || form.gemOrderType === "PBP"
              ? form.gemBidNo
              : null,
          orderDate: form.gemOrderDate,
          lastDeliveryDate: form.gemLastDate,
          contractFile: contractFilename,
          shippingAddress: form.gemAddress,
          gstNumber: form.gemGst,
          contactNumber: form.gemContact,
          altContactNumber: form.gemAltContact,
          buyerEmail: form.gemBuyerEmail,
          consigneeEmail: form.gemConsigneeEmail
        };
      } else if (form.platform === "Other") {
        if (!form.gemOrderDate || !form.gemAddress || !form.gemContact) {
          setError("Please fill Order Date, Address and Contact No.");
          return;
        }

        additionalDetails = {
          status: actualStatus,
          installationRequired: form.installationRequired === "Yes",
          orderDate: form.gemOrderDate,
          lastDeliveryDate: form.gemLastDate || null,
          shippingAddress: form.gemAddress,
          gstNumber: form.gemGst,
          contactNumber: form.gemContact,
          altContactNumber: form.gemAltContact
        };
      } else {
        // Amazon / Flipkart — always "Order Confirmed"
        additionalDetails = {
          status: actualStatus,
          installationRequired: form.installationRequired === "Yes",
          orderDate: form.gemOrderDate || null,
          lastDeliveryDate: form.gemLastDate || null,
        };
      }

      const buildPayload = (serialId, price) => ({
        serialId,
        firmName: form.platform,
        customer: form.orderId,
        address:
          form.platform === "GeM" || form.platform === "Other"
            ? form.gemAddress || "N/A"
            : "N/A",
        user: currentUser?.username || "Unknown",
        sellingPrice: price,
        ...additionalDetails
      });

      if (activeTab === "single") {
        if (!form.serialId) {
          setError("Please scan or enter a valid serial number.");
          return;
        }

        if (!form.sellingPrice || Number(form.sellingPrice) <= 0) {
          setError("Please enter a valid selling price.");
          return;
        }

        setIsSubmitting(true);
        await printerService.addDispatch(
          buildPayload(form.serialId, Number(form.sellingPrice))
        );
      } else {
        if (batchList.length === 0) {
          setError("Please add at least one item to the batch.");
          return;
        }

        if (batchList.length !== parseInt(form.quantity, 10)) {
          setError(
            `Please scan all ${form.quantity} items before submitting (Currently scanned: ${batchList.length}).`
          );
          return;
        }

        const invalidItems = batchList.filter((item) => {
          const finalPrice =
            item.individualPrice !== null
              ? Number(item.individualPrice)
              : Number(modelPrices[item.modelId]);
          return !finalPrice || finalPrice <= 0;
        });

        if (invalidItems.length > 0) {
          setError("Please set a valid unit price for all items.");
          return;
        }

        setIsSubmitting(true);

        const promises = batchList.map((item) => {
          const finalPrice =
            item.individualPrice !== null
              ? Number(item.individualPrice)
              : Number(modelPrices[item.modelId]);
          return printerService.addDispatch(buildPayload(item.serialId, finalPrice));
        });

        await Promise.all(promises);
      }

      await onRefresh();
      onBack();
    } catch (err) {
      console.error("Dispatch save failed:", err);
      setError(err.message || "Failed to save shipment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const profit =
    form.sellingPrice && form.landingPrice
      ? Number(form.sellingPrice) - form.landingPrice
      : null;

  const progressPercentage =
    activeTab === "multiple" && form.quantity > 0
      ? Math.min((batchList.length / parseInt(form.quantity, 10)) * 100, 100)
      : 0;

  const getSelectedPlatformConfig = () => {
    return platforms.find(p => p.value === form.platform);
  };

  // Calculate days difference for display
  const daysDifference = useMemo(() => {
    if (!form.gemOrderDate || !form.gemLastDate) return null;
    const orderDate = new Date(form.gemOrderDate);
    const lastDate = new Date(form.gemLastDate);
    if (isNaN(orderDate.getTime()) || isNaN(lastDate.getTime())) return null;
    const diffTime = lastDate.getTime() - orderDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [form.gemOrderDate, form.gemLastDate]);

  // Status indicator text for "Order Not Confirmed"
  const getStatusHint = () => {
    if (form.status === "Order Not Confirmed") {
      return {
        text: "This order will appear as 'On Hold' in Order Tracking",
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: "⚠️"
      };
    }
    if (form.status === "Order Confirmed") {
      return {
        text: "This order will appear as 'Order Confirmed' in Order Tracking",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        icon: "✅"
      };
    }
    return null;
  };

  const statusHint = getStatusHint();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-[1520px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">

          {/* LEFT CONTENT */}
          <div className="space-y-5">
            {/* Header Card */}
            <div className="bg-white/90 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-lg shadow-slate-200/60 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={onBack}
                    className="group p-2.5 bg-slate-100/80 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-md hover:shadow-indigo-500/10"
                  >
                    <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform duration-300" />
                  </button>

                  <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl blur-lg opacity-40"></div>
                      <div className="relative p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
                        <Truck size={22} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-xl font-extrabold bg-gradient-to-r from-slate-800 via-indigo-800 to-slate-700 bg-clip-text text-transparent">
                        New Order
                      </h1>
                      <p className="text-[11px] text-slate-500 font-medium tracking-wide">Create outgoing shipment</p>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-3">
                  {activeTab === "multiple" && batchList.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full">
                      <Box size={12} className="text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-700">{batchList.length} items</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl shadow-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50"></div>
                    <span className="text-xs font-bold text-emerald-700">{currentUser?.username}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Form Card */}
            <div className="bg-white/95 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
              {/* Tab Switcher */}
              <div className="relative bg-gradient-to-r from-slate-100/80 to-slate-50/80 p-2.5 border-b border-slate-200/80">
                <div className="flex gap-2">
                  {[
                    { id: "single", label: "Single Item", icon: Package, desc: "One product", accent: "indigo" },
                    { id: "multiple", label: "Bulk Shipment", icon: Layers, desc: "Multiple items", accent: "purple" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setError("");
                        setBatchList([]);
                        setLastDateManuallySet(false);
                        setForm((prev) => ({
                          ...prev,
                          serialInput: "",
                          serialId: "",
                          modelName: "",
                          companyName: "",
                          landingPrice: 0,
                          mrp: 0,
                          modelId: null,
                          quantity: tab.id === "single" ? 1 : "",
                          sellingPrice: ""
                        }));
                      }}
                      className={`flex-1 relative py-3.5 px-5 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-300 ${
                        activeTab === tab.id
                          ? "bg-white text-indigo-700 shadow-lg shadow-indigo-500/10 border border-indigo-100/80 scale-[1.01]"
                          : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                      }`}
                    >
                      <tab.icon size={18} className={activeTab === tab.id ? "text-indigo-600" : "text-slate-400"} />
                      <span>{tab.label}</span>
                      {activeTab === tab.id && (
                        <span className="hidden sm:inline text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2.5 py-0.5 rounded-full ml-1 border border-indigo-100">
                          {tab.desc}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-8">
                {/* ═══ Section 1: Platform & Order Details ═══ */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl">
                        <ShoppingCart size={16} className="text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-700 tracking-tight">Order Details</h3>
                        <p className="text-[11px] text-slate-400 font-medium">Select platform and enter order information</p>
                      </div>
                    </div>
                  </div>

                  {/* Platform Selection */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                      <ShoppingCart size={12} className="text-slate-400" />
                      Platform <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {platforms.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, platform: p.value }))}
                          className={`relative group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-300 ${
                            form.platform === p.value
                              ? `${p.bg} ${p.border} shadow-lg scale-[1.02]`
                              : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:scale-[1.01]"
                          }`}
                        >
                          {form.platform === p.value && (
                            <div className="absolute -top-1.5 -right-1.5">
                              <div className={`w-5 h-5 bg-gradient-to-br ${p.color} rounded-full flex items-center justify-center shadow-lg`}>
                                <CheckCircle size={12} className="text-white" />
                              </div>
                            </div>
                          )}
                          <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{p.icon}</span>
                          <span className={`text-xs font-extrabold tracking-wide ${
                            form.platform === p.value ? p.text : "text-slate-600"
                          }`}>
                            {p.value}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Order ID */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Hash size={12} className="text-slate-400" />
                      Order ID <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        {form.platform && getSelectedPlatformConfig() ? (
                          <span className="text-lg">{getSelectedPlatformConfig().icon}</span>
                        ) : (
                          <Hash size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        )}
                      </div>
                      <input
                        type="text"
                        className="w-full border-2 border-slate-200/80 bg-white p-3.5 pl-12 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-300 focus:ring-4 focus:ring-indigo-400/15 focus:border-indigo-400 outline-none transition-all shadow-sm hover:shadow-md hover:border-slate-300 group-focus-within:shadow-md"
                        placeholder={
                          form.platform === "Amazon"
                            ? "e.g. 402-1234567-8901234"
                            : form.platform === "Flipkart"
                            ? "e.g. OD123456789012345"
                            : form.platform === "GeM"
                            ? "e.g. GEMC-511687-12345678"
                            : "Enter order ID..."
                        }
                        value={form.orderId}
                        onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                        required
                      />
                      {form.orderId && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="p-1 bg-emerald-100 rounded-lg">
                            <CheckCircle size={14} className="text-emerald-600" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ✅ ORDER STATUS — Only shown for GeM and Other platforms */}
                  {showOrderStatus && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity size={12} className="text-slate-400" />
                        Order Status <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Order Confirmed */}
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, status: "Order Confirmed" }))}
                          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 ${
                            form.status === "Order Confirmed"
                              ? "bg-emerald-50 border-emerald-400 shadow-lg shadow-emerald-100"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                          }`}
                        >
                          {form.status === "Order Confirmed" && (
                            <div className="absolute -top-1.5 -right-1.5">
                              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle size={12} className="text-white" />
                              </div>
                            </div>
                          )}
                          <div className={`p-2 rounded-lg ${
                            form.status === "Order Confirmed" ? "bg-emerald-100" : "bg-slate-100"
                          }`}>
                            <CheckCircle size={18} className={
                              form.status === "Order Confirmed" ? "text-emerald-600" : "text-slate-400"
                            } />
                          </div>
                          <div className="text-left">
                            <span className={`text-sm font-bold block ${
                              form.status === "Order Confirmed" ? "text-emerald-700" : "text-slate-600"
                            }`}>
                              Order Confirmed
                            </span>
                            <span className="text-[10px] text-slate-400">Ready for processing</span>
                          </div>
                        </button>

                        {/* Order Not Confirmed */}
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, status: "Order Not Confirmed" }))}
                          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 ${
                            form.status === "Order Not Confirmed"
                              ? "bg-amber-50 border-amber-400 shadow-lg shadow-amber-100"
                              : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                          }`}
                        >
                          {form.status === "Order Not Confirmed" && (
                            <div className="absolute -top-1.5 -right-1.5">
                              <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                                <CheckCircle size={12} className="text-white" />
                              </div>
                            </div>
                          )}
                          <div className={`p-2 rounded-lg ${
                            form.status === "Order Not Confirmed" ? "bg-amber-100" : "bg-slate-100"
                          }`}>
                            <Clock size={18} className={
                              form.status === "Order Not Confirmed" ? "text-amber-600" : "text-slate-400"
                            } />
                          </div>
                          <div className="text-left">
                            <span className={`text-sm font-bold block ${
                              form.status === "Order Not Confirmed" ? "text-amber-700" : "text-slate-600"
                            }`}>
                              Order Not Confirmed
                            </span>
                            <span className="text-[10px] text-slate-400">Will show as "On Hold"</span>
                          </div>
                        </button>
                      </div>

                      {/* Status Hint */}
                      {/*statusHint && (
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${statusHint.bg} ${statusHint.border}`}>
                          <span>{statusHint.icon}</span>
                          <span className={`text-xs font-medium ${statusHint.color}`}>
                            {statusHint.text}
                          </span>
                        </div>
                      )*/}
                    </div>
                  )}

                  {/* GeM-specific fields */}
                  {form.platform === "GeM" && (
                    <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-200/60 rounded-2xl p-5 space-y-5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🏛️</span>
                        <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest">GeM Order Details</span>
                      </div>

                     

                      {/* Order Type & Bid No */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <FileText size={10} className="text-slate-400" /> Order Type
                          </label>
                          <select
                            value={form.gemOrderType}
                            onChange={(e) => setForm({ ...form, gemOrderType: e.target.value })}
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                          >
                            <option value="Direct Order">Direct Order</option>
                            <option value="Bid">Bid</option>
                            <option value="PBP">PBP</option>
                          </select>
                        </div>

                        {(form.gemOrderType === "Bid" || form.gemOrderType === "PBP") && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Bid No.</label>
                            <input
                              type="text"
                              className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                              placeholder="Enter bid number"
                              value={form.gemBidNo}
                              onChange={(e) => setForm({ ...form, gemBidNo: e.target.value })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Dates with auto-fill */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" /> Order Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                            value={form.gemOrderDate}
                            onChange={(e) => handleOrderDateChange(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} className="text-slate-400" /> Last Delivery Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            className={`w-full border p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all ${
                              !lastDateManuallySet && form.gemLastDate
                                ? 'border-emerald-300 bg-emerald-50/30'
                                : 'border-slate-300/80'
                            }`}
                            value={form.gemLastDate}
                            onChange={(e) => handleLastDateChange(e.target.value)}
                            min={form.gemOrderDate || undefined}
                            required
                          />
                          {/* Days indicator */}
                          {daysDifference !== null && form.gemOrderDate && form.gemLastDate && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                daysDifference < 0
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : daysDifference <= 7
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}>
                                <Clock size={9} />
                                {daysDifference} day{daysDifference !== 1 ? 's' : ''} 
                                {daysDifference < 0 ? ' overdue' : ' window'}
                              </span>
                              {!lastDateManuallySet && (
                                <span className="text-[9px] text-slate-400 italic">auto-filled +15 days</span>
                              )}
                              {lastDateManuallySet && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLastDateManuallySet(false);
                                    const autoDate = addDaysToDate(form.gemOrderDate, 15);
                                    setForm(prev => ({ ...prev, gemLastDate: autoDate }));
                                  }}
                                  className="text-[9px] text-indigo-500 hover:text-indigo-700 font-bold underline underline-offset-2 transition-colors"
                                >
                                  Reset to +15 days
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Contract Upload */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <UploadCloud size={10} className="text-slate-400" /> Contract File
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            onChange={handleFileChange}
                            className="w-full border border-dashed border-slate-300 p-3 rounded-xl text-sm bg-white hover:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                          />
                        </div>
                      </div>

                      {/* Address & GST */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <MapPin size={10} className="text-slate-400" /> Shipping Address
                          </label>
                          <textarea
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all resize-none"
                            rows={2}
                            placeholder="Enter shipping address"
                            value={form.gemAddress}
                            onChange={(e) => setForm({ ...form, gemAddress: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <CreditCard size={10} className="text-slate-400" /> GST Number
                          </label>
                          <input
                            type="text"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                            placeholder="e.g. 22AAAAA0000A1Z5"
                            value={form.gemGst}
                            onChange={(e) => setForm({ ...form, gemGst: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Phone size={10} className="text-slate-400" /> Contact No. <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                            placeholder="Primary contact"
                            value={form.gemContact}
                            onChange={(e) => setForm({ ...form, gemContact: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Phone size={10} className="text-slate-400" /> Alt Contact
                          </label>
                          <input
                            type="text"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                            placeholder="Alternate contact"
                            value={form.gemAltContact}
                            onChange={(e) => setForm({ ...form, gemAltContact: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Email Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Mail size={10} className="text-slate-400" /> Buyer Email
                          </label>
                          <input
                            type="email"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                            placeholder="buyer@example.com"
                            value={form.gemBuyerEmail}
                            onChange={(e) => setForm({ ...form, gemBuyerEmail: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Mail size={10} className="text-slate-400" /> Consignee Email
                          </label>
                          <input
                            type="email"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                            placeholder="consignee@example.com"
                            value={form.gemConsigneeEmail}
                            onChange={(e) => setForm({ ...form, gemConsigneeEmail: e.target.value })}
                          />
                        </div>
                      </div>

                       {/* Installation field */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Wrench size={10} className="text-slate-400" /> Installation Required
                          </label>
                          <select
                            value={form.installationRequired}
                            onChange={(e) => setForm({ ...form, installationRequired: e.target.value })}
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 outline-none transition-all"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Other platform fields */}
                  {form.platform === "Other" && (
                    <div className="bg-gradient-to-br from-violet-50/60 to-purple-50/40 border border-violet-200/60 rounded-2xl p-5 space-y-5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🔗</span>
                        <span className="text-xs font-extrabold text-violet-800 uppercase tracking-widest">Other Platform Details</span>
                      </div>

                      {/* Installation field for Other platform */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Wrench size={10} className="text-slate-400" /> Installation Required
                          </label>
                          <select
                            value={form.installationRequired}
                            onChange={(e) => setForm({ ...form, installationRequired: e.target.value })}
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>

                      {/* Other platform Order Date with auto-fill */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" /> Order Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all"
                            value={form.gemOrderDate}
                            onChange={(e) => handleOrderDateChange(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} className="text-slate-400" /> Last Delivery Date
                          </label>
                          <input
                            type="date"
                            className={`w-full border p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all ${
                              !lastDateManuallySet && form.gemLastDate
                                ? 'border-violet-300 bg-violet-50/30'
                                : 'border-slate-300/80'
                            }`}
                            value={form.gemLastDate}
                            onChange={(e) => handleLastDateChange(e.target.value)}
                            min={form.gemOrderDate || undefined}
                          />
                          {daysDifference !== null && form.gemOrderDate && form.gemLastDate && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                daysDifference < 0
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : daysDifference <= 7
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}>
                                <Clock size={9} />
                                {daysDifference} day{daysDifference !== 1 ? 's' : ''} 
                                {daysDifference < 0 ? ' overdue' : ' window'}
                              </span>
                              {!lastDateManuallySet && (
                                <span className="text-[9px] text-slate-400 italic">auto-filled +15 days</span>
                              )}
                              {lastDateManuallySet && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLastDateManuallySet(false);
                                    const autoDate = addDaysToDate(form.gemOrderDate, 15);
                                    setForm(prev => ({ ...prev, gemLastDate: autoDate }));
                                  }}
                                  className="text-[9px] text-indigo-500 hover:text-indigo-700 font-bold underline underline-offset-2 transition-colors"
                                >
                                  Reset to +15 days
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <MapPin size={10} className="text-slate-400" /> Shipping Address <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all resize-none"
                          rows={2}
                          placeholder="Enter shipping address"
                          value={form.gemAddress}
                          onChange={(e) => setForm({ ...form, gemAddress: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <CreditCard size={10} className="text-slate-400" /> GST Number
                          </label>
                          <input
                            type="text"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all"
                            placeholder="e.g. 22AAAAA0000A1Z5"
                            value={form.gemGst}
                            onChange={(e) => setForm({ ...form, gemGst: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Phone size={10} className="text-slate-400" /> Contact No. <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all"
                            placeholder="Primary contact"
                            value={form.gemContact}
                            onChange={(e) => setForm({ ...form, gemContact: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Phone size={10} className="text-slate-400" /> Alt Contact
                        </label>
                        <input
                          type="text"
                          className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/20 focus:border-violet-400 outline-none transition-all"
                          placeholder="Alternate contact"
                          value={form.gemAltContact}
                          onChange={(e) => setForm({ ...form, gemAltContact: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Amazon/Flipkart — Date fields (NO Order Status here) */}
                  {(form.platform === "Amazon" || form.platform === "Flipkart") && (
                    <div className={`bg-gradient-to-br ${
                      form.platform === "Amazon" 
                        ? "from-amber-50/60 to-orange-50/40 border-amber-200/60" 
                        : "from-blue-50/60 to-sky-50/40 border-blue-200/60"
                    } border rounded-2xl p-5 space-y-5`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{form.platform === "Amazon" ? "🛒" : "📦"}</span>
                        <span className={`text-xs font-extrabold uppercase tracking-widest ${
                          form.platform === "Amazon" ? "text-amber-800" : "text-blue-800"
                        }`}>{form.platform} Order Details</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" /> Order Date
                          </label>
                          <input
                            type="date"
                            className="w-full border border-slate-300/80 p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 outline-none transition-all"
                            value={form.gemOrderDate}
                            onChange={(e) => handleOrderDateChange(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} className="text-slate-400" /> Last Delivery Date
                          </label>
                          <input
                            type="date"
                            className={`w-full border p-2.5 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 outline-none transition-all ${
                              !lastDateManuallySet && form.gemLastDate
                                ? 'border-emerald-300 bg-emerald-50/30'
                                : 'border-slate-300/80'
                            }`}
                            value={form.gemLastDate}
                            onChange={(e) => handleLastDateChange(e.target.value)}
                            min={form.gemOrderDate || undefined}
                          />
                          {daysDifference !== null && form.gemOrderDate && form.gemLastDate && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                daysDifference < 0
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : daysDifference <= 7
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}>
                                <Clock size={9} />
                                {daysDifference} day{daysDifference !== 1 ? 's' : ''} 
                                {daysDifference < 0 ? ' overdue' : ' window'}
                              </span>
                              {!lastDateManuallySet && (
                                <span className="text-[9px] text-slate-400 italic">auto-filled +15 days</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══ PRICING & QUANTITY SECTION ═══ */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                        <IndianRupee size={16} className="text-white" />
                      </div>
                      <h3 className="text-sm font-extrabold text-emerald-900 tracking-wide">Pricing & Quantity</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Unit Selling Price */}
                      {activeTab === "single" && (
                        <div className="space-y-3">
                          <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-1">
                            Unit Selling Price <span className="text-red-500">*</span>
                          </label>
                          <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-extrabold text-xl">₹</span>
                            <input 
                              type="number"
                              className="w-full h-14 pl-10 pr-4 bg-white border border-emerald-200 rounded-xl text-2xl font-extrabold text-slate-700 placeholder-slate-300 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                              placeholder="0.00"
                              value={form.sellingPrice}
                              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                              required
                            />
                            {form.mrp > 0 && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <button
                                  type="button"
                                  onClick={() => setForm({ ...form, sellingPrice: String(form.mrp) })}
                                  className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-200 transition-colors"
                                >
                                  MRP ₹{form.mrp.toLocaleString("en-IN")}
                                </button>
                              </div>
                            )}
                          </div>
                          {profit !== null && form.landingPrice > 0 && (
                            <div className="flex items-center justify-between p-2 bg-white/50 border border-emerald-100 rounded-lg">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Landing: ₹{form.landingPrice}</span>
                              <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {profit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {profit >= 0 ? "Profit" : "Loss"}: ₹{Math.abs(profit)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quantity */}
                      <div className={activeTab === "multiple" ? "md:col-span-2 space-y-3" : "space-y-3"}>
                        <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                          <Layers size={12} className={activeTab === "single" ? "text-slate-400" : "text-indigo-500"} />
                          Quantity
                        </label>
                        {activeTab === "single" ? (
                          <div className="space-y-2">
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl w-fit p-1">
                              <div className="w-12 h-10 flex items-center justify-center text-slate-300">
                                <Minus size={20} />
                              </div>
                              <div className="w-16 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm">
                                <span className="text-xl font-extrabold text-slate-400">1</span>
                              </div>
                              <div className="w-12 h-10 flex items-center justify-center text-slate-300">
                                <Plus size={20} />
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                              <CircleDot size={12} /> Fixed at 1 for single item
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center bg-white border border-indigo-200 rounded-xl w-fit p-1 shadow-sm">
                              <button 
                                type="button"
                                onClick={decrementQuantity} 
                                className="w-12 h-10 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Minus size={20} />
                              </button>
                              <input 
                                type="number"
                                min="1"
                                value={form.quantity}
                                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                className="w-16 h-10 text-center text-xl font-extrabold text-indigo-700 outline-none border-x border-slate-100"
                              />
                              <button 
                                type="button"
                                onClick={incrementQuantity} 
                                className="w-12 h-10 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Plus size={20} />
                              </button>
                            </div>
                            <p className="text-[11px] text-indigo-600 font-medium flex items-center gap-1.5">
                              <Zap size={12} className="fill-current" /> Editable for bulk shipments
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══ Section 2: Scan Inventory ═══ */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl">
                        <ScanLine size={16} className="text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-700 tracking-tight">Scan Inventory</h3>
                        <p className="text-[11px] text-slate-400 font-medium">Scan barcode or enter serial manually</p>
                      </div>
                    </div>

                    {activeTab === "multiple" && multipleQuantity > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="w-36 h-2.5 bg-slate-200/80 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              progressPercentage === 100
                                ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm shadow-emerald-500/30"
                                : "bg-gradient-to-r from-indigo-400 to-purple-500 shadow-sm shadow-indigo-500/30"
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-extrabold px-3 py-1.5 rounded-full shadow-sm ${
                          progressPercentage === 100
                            ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200"
                            : "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200"
                        }`}>
                          {batchList.length} / {form.quantity}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Scanner Input */}
                  <div className="relative">
                    <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
                      isProcessing ? "bg-indigo-400/20 blur-xl scale-105" : "bg-transparent blur-none scale-100"
                    }`}></div>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10">
                        <div className={`p-2.5 rounded-xl text-white shadow-lg transition-all duration-300 ${
                          isProcessing
                            ? "bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/30 animate-pulse"
                            : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30 group-focus-within:shadow-xl group-focus-within:shadow-indigo-500/40 group-focus-within:scale-110"
                        }`}>
                          <ScanLine size={20} />
                        </div>
                      </div>
                      <input
                        ref={inputRef}
                        className={`w-full border-2 bg-white p-5 pl-20 pr-14 rounded-2xl text-lg focus:ring-4 outline-none transition-all duration-300 font-mono tracking-wider shadow-lg hover:shadow-xl ${
                          activeTab === "multiple" && batchList.length >= (Number(form.quantity) || 1)
                            ? "border-emerald-300 bg-emerald-50/80 text-emerald-700 cursor-not-allowed"
                            : "border-slate-200 focus:ring-indigo-400/20 focus:border-indigo-400 text-slate-700 hover:border-slate-300"
                        }`}
                        placeholder={
                          activeTab === "multiple" && batchList.length >= (Number(form.quantity) || 1)
                            ? "✓ Target reached! Ready to submit"
                            : "Click here & scan barcode..."
                        }
                        value={form.serialInput}
                        onChange={(e) => handleSerialChange(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        disabled={activeTab === "multiple" && batchList.length >= (Number(form.quantity) || 1)}
                        autoFocus
                      />
                      {isProcessing && (
                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                          <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  {error && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/80 text-red-700 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
                      <div className="p-1 bg-red-100 rounded-lg flex-shrink-0 mt-0.5">
                        <AlertCircle size={16} className="text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-extrabold text-xs uppercase tracking-wider text-red-800">Error</p>
                        <p className="text-sm mt-0.5 text-red-600">{error}</p>
                      </div>
                      <button type="button" onClick={() => setError("")} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {successMsg && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 text-emerald-700 p-4 rounded-2xl flex items-center gap-3 shadow-sm animate-in slide-in-from-top-2">
                      <div className="p-1 bg-emerald-100 rounded-lg flex-shrink-0">
                        <CheckCircle size={16} className="text-emerald-600" />
                      </div>
                      <p className="font-bold text-sm">{successMsg}</p>
                    </div>
                  )}

                  {serialReturnWarning && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 text-amber-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                      <div className="p-1 bg-amber-100 rounded-lg flex-shrink-0 mt-0.5">
                        <AlertCircle size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-extrabold text-[10px] uppercase tracking-widest text-amber-700 mb-1">Previous Return Warning</p>
                        <p className="font-semibold text-sm">{serialReturnWarning}</p>
                      </div>
                    </div>
                  )}

                  {/* Scanned Item Preview (Single) */}
                  {activeTab === "single" && form.serialId && (
                    <div className="bg-gradient-to-r from-slate-50/80 to-indigo-50/50 border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-emerald-400 rounded-2xl blur-md opacity-20"></div>
                            <div className="relative p-3 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl border border-emerald-200/50">
                              <CheckCircle size={24} className="text-emerald-600" />
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">Scanned Item</p>
                            <p className="font-mono text-xl font-extrabold text-slate-800 tracking-wider">{form.serialInput}</p>
                            <div className="flex items-center gap-2 mt-2.5">
                              <span className="text-[10px] font-bold bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 shadow-sm">
                                {form.companyName}
                              </span>
                              <span className="text-[10px] font-bold bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg text-indigo-700">
                                {form.modelName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              serialId: "",
                              serialInput: "",
                              modelName: "",
                              companyName: "",
                              landingPrice: 0,
                              mrp: 0,
                              modelId: null
                            }));
                            setSerialReturnWarning("");
                          }}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Batch Items List (Multiple) */}
                  {activeTab === "multiple" && batchList.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                          Scanned Items
                        </span>
                        <button
                          type="button"
                          onClick={() => setBatchList([])}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={10} /> Clear All
                        </button>
                      </div>
                      <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 max-h-60 overflow-y-auto shadow-inner">
                        <div className="divide-y divide-slate-200/60">
                          {batchList.map((item, index) => (
                            <div key={item.serialId} className="flex items-center justify-between p-3 hover:bg-white transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 flex items-center justify-center bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg">
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="font-mono text-xs font-bold text-slate-800">{item.serialValue}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {item.companyName}
                                    </span>
                                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                      {item.modelName}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromBatch(item.serialId)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ═══ Section 3: Batch Pricing ═══ */}
                {activeTab === "multiple" && batchList.length > 0 && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="p-2 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl">
                        <Calculator size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-700 tracking-tight">Pricing Summary</h3>
                        <p className="text-[11px] text-slate-400 font-medium">Set unit prices for each model</p>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/80">
                          <tr className="text-[10px] text-slate-500 uppercase font-extrabold tracking-widest">
                            <th className="px-6 py-4 text-left">Model</th>
                            <th className="px-3 py-4 text-center w-16">Qty</th>
                            <th className="px-4 py-4 text-left">Unit Price <span className="text-red-500">*</span></th>
                            <th className="px-6 py-4 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80">
                          {batchSummary.map((group) => {
                            const price = modelPrices[group.modelId] || "";
                            const rowTotal = Number(price) * group.count;
                            return (
                              <tr key={group.modelId} className="hover:bg-slate-50/50 transition-colors duration-150">
                                <td className="px-6 py-5">
                                  <p className="font-extrabold text-slate-800 text-sm">{group.modelName}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                      {group.companyName}
                                    </span>
                                    {group.mrp > 0 && (
                                      <span className="text-[9px] text-slate-400">
                                        MRP: ₹{group.mrp.toLocaleString("en-IN")}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-5 text-center w-16">
                                  <span className="inline-flex items-center justify-center w-9 h-9 bg-indigo-100 text-indigo-700 font-extrabold rounded-xl text-base">
                                    {group.count}
                                  </span>
                                </td>
                                <td className="px-4 py-5">
                                  <div className="relative max-w-[140px]">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                    <input
                                      type="number"
                                      className={`w-full border-2 p-2.5 pl-7 rounded-xl text-sm font-bold focus:ring-2 outline-none transition-all ${
                                        price
                                          ? "border-emerald-200 bg-emerald-50/80 focus:ring-emerald-400/20 focus:border-emerald-400 text-emerald-800"
                                          : "border-red-200 bg-red-50/80 focus:ring-red-400/20 focus:border-red-400 text-red-800"
                                      }`}
                                      placeholder="0"
                                      value={price}
                                      onChange={(e) => updateModelPrice(group.modelId, e.target.value)}
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <span className="font-extrabold text-slate-800 text-lg">
                                    ₹{rowTotal.toLocaleString("en-IN")}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                            <td colSpan="3" className="px-6 py-5 text-right">
                              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                Total Amount
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <span className="text-2xl font-extrabold text-emerald-400">
                                ₹{batchTotalValue.toLocaleString("en-IN")}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* ═══ Submit Button ═══ */}
                <div className="pt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (activeTab === "single" && !form.serialId) ||
                      (activeTab === "multiple" && batchList.length === 0)
                    }
                    className={`w-full py-4.5 rounded-2xl text-base font-extrabold flex items-center justify-center gap-3 transition-all duration-300 ${
                      isSubmitting ||
                      (activeTab === "single" && !form.serialId) ||
                      (activeTab === "multiple" && batchList.length === 0)
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        : "bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:via-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Processing Order...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} className="animate-pulse" />
                        <span>
                          {activeTab === "single"
                            ? `Confirm Shipment ${form.sellingPrice ? `• ₹${Number(form.sellingPrice).toLocaleString("en-IN")}` : ""}`
                            : `Confirm Bulk Order • ₹${batchTotalValue.toLocaleString("en-IN")}`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ═══ RIGHT STATIC PANEL ═══ */}
          <aside className="xl:sticky xl:top-6 self-start">
            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
              {/* Panel Header */}
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/80 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400"></div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-400 rounded-xl blur-md opacity-20"></div>
                    <div className="relative p-2 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl border border-indigo-200/50">
                      <Database size={18} className="text-indigo-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Serial Selection Panel</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Browse & select serial numbers</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Company Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={11} className="text-slate-400" />
                    Company Name
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => {
                      setSelectedCompany(e.target.value);
                      setSelectedModelId("");
                    }}
                    className="w-full border border-slate-300/80 p-3 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 outline-none transition-all shadow-sm hover:shadow-md hover:border-slate-400"
                  >
                    <option value="">Select company</option>
                    {companyOptions.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Package size={11} className="text-slate-400" />
                    Model
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={!selectedCompany}
                    className="w-full border border-slate-300/80 p-3 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 outline-none transition-all shadow-sm hover:shadow-md hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:border-slate-300/80"
                  >
                    <option value="">Select model</option>
                    {filteredModelsByCompany.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Serial Numbers List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ListChecks size={11} className="text-slate-400" />
                      Available Serials
                    </label>
                    <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                      {selectedPanelSerials.length} found
                    </span>
                  </div>

                  {!selectedCompany || !selectedModelId ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/50">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Database size={20} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">
                        Select company & model
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">to view serial numbers</p>
                    </div>
                  ) : selectedPanelSerials.length === 0 ? (
                    <div className="border-2 border-dashed border-amber-200 rounded-2xl p-6 text-center bg-amber-50/50">
                      <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <AlertCircle size={20} className="text-amber-400" />
                      </div>
                      <p className="text-sm font-bold text-amber-700">
                        No serials available
                      </p>
                      <p className="text-[11px] text-amber-600 mt-1">for this model</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200/80 rounded-2xl bg-slate-50/80 max-h-[480px] overflow-y-auto shadow-inner">
                      <div className="divide-y divide-slate-200/80">
                        {selectedPanelSerials.map((serial) => {
                          const model = models.find((m) => String(m.id) === String(serial.modelId));
                          const serialDisplay = getSerialValue(serial);
                          const isAlreadyAdded = batchList.some((b) => String(b.serialId) === String(serial.id));

                          return (
                            <div
                              key={serial.id}
                              className={`p-3.5 transition-all duration-200 ${
                                isAlreadyAdded
                                  ? "bg-emerald-50/60 opacity-60"
                                  : "hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-mono text-xs font-extrabold text-slate-800 break-all leading-relaxed">
                                    {serialDisplay}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className="text-[9px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600 shadow-sm">
                                      {getCompanyName(model)}
                                    </span>
                                    <span className="text-[9px] font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-700">
                                      {model?.name || "Unknown"}
                                    </span>
                                    {Number(serial.returnCount || 0) > 0 && (
                                      <span className="text-[9px] font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-amber-700">
                                        Returned Earlier
                                      </span>
                                    )}
                                  </div>
                                  {serial.latestReturnReason && (
                                    <p className="text-[10px] text-amber-700 mt-1.5 break-words">
                                      Last reason: {serial.latestReturnReason}
                                    </p>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  disabled={isAlreadyAdded}
                                  onClick={() => {
                                    if (activeTab === "single") {
                                      processSerial(serialDisplay);
                                    } else {
                                      setForm((prev) => ({ ...prev, serialInput: serialDisplay }));
                                      processSerial(serialDisplay);
                                    }
                                  }}
                                  className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-extrabold rounded-lg transition-all duration-200 ${
                                    isAlreadyAdded
                                      ? "bg-emerald-100 text-emerald-600 cursor-not-allowed border border-emerald-200"
                                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-sm hover:shadow-md active:scale-95"
                                  }`}
                                >
                                  {isAlreadyAdded ? "✓ Added" : "Add"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-200/80 rounded-2xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                    <Shield size={11} className="text-emerald-600" />
                    Rules Applied
                  </h4>
                  <ul className="space-y-1.5 text-[11px] text-emerald-700 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0"></span>
                      Single item quantity is fixed at 1
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0"></span>
                      Multiple item quantity is editable
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0"></span>
                      Selected serial is removed instantly
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0"></span>
                      Last delivery date auto-fills +15 days
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0"></span>
                      Order status available for GeM & Other only
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
