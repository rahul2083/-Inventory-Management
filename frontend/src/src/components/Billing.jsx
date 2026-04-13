import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import {
    Receipt, Search, X, Edit2, ChevronLeft, ChevronRight, Activity,
    IndianRupee, FileText, UploadCloud, Link, Building, MapPin,
    Phone, Mail, Calendar, Box, User, Info, Download, Hash, Clock,
    ShoppingCart, CreditCard, CheckCircle, AlertTriangle, ExternalLink, Package
} from "lucide-react";
import { printerService } from "../services/api";

const ITEMS_PER_PAGE = 20;

export default function Billing({
    models = [],
    serials = [],
    dispatches = [],
    onUpdate,
    isAdmin
}) {
    const [activeTab, setActiveTab] = useState("billing");
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");

    // State for Editing Billing Status
    const [editingBatch, setEditingBatch] = useState(null);
    const [batchItems, setBatchItems] = useState([]);

    // State for Payment Collection
    const [paymentBatch, setPaymentBatch] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: "",
        utrId: ""
    });

    // State for Viewing Order Details
    const [viewingOrder, setViewingOrder] = useState(null);

    const [editForm, setEditForm] = useState({
        // ✅ UPDATED: Default status changed
        status: "Send for Billing",
        invoiceNo: "",
        ewayBill: "",
        gemUploaded: "No",
        invoiceFile: null,
        existingInvoice: "",
        // ✅ NEW: E-Way Bill file upload fields
        ewayBillFile: null,
        existingEwayBillName: ""
    });

    // Helper to get Serial/Model names
    const getDetails = (serialId) => {
        const s = serials.find((x) => x.id === serialId);
        const m = s ? models.find((x) => x.id === s.modelId) : null;
        return { serial: s?.value || "N/A", model: m?.name || "-", company: m?.company || "-" };
    };

    // Filter logic based on Active Tab
    const billingDispatches = useMemo(() => {
        if (!dispatches || !Array.isArray(dispatches)) return [];

        return dispatches.filter(d => {
            if (!d || d.isDeleted) return false;

            if (activeTab === "billing") {
                return d.status === "Send for Billing";
            } else {
                return d.status === "Payment Pending" || (d.logisticsStatus === "Delivered" && d.status !== "Completed");
            }
        });
    }, [dispatches, activeTab]);

    const groupedBilling = useMemo(() => {
        const groups = {};
        const term = String(searchTerm || "").toLowerCase();

        const filtered = billingDispatches.filter(d => {
            if (!d) return false;
            const s = serials.find((x) => x.id === d.serialNumberId);
            const serialVal = s ? s.value : "N/A";

            const firm = String(d.firmName || "").toLowerCase();
            const customer = String(d.customerName || "").toLowerCase();
            const serialStr = String(serialVal || "").toLowerCase();
            const contact = String(d.contactNumber || "").toLowerCase();

            return firm.includes(term) || customer.includes(term) || serialStr.includes(term) || contact.includes(term);
        });

        filtered.forEach((d) => {
            const simpleDate = d.dispatchDate ? String(d.dispatchDate).split('T')[0] : 'no-date';
            const firm = d.firmName || 'unknown';
            const customer = d.customerName || 'unknown';
            const key = d.dispatchGroupId || `${simpleDate}_${firm}_${customer}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
        });

        return Object.values(groups).sort((a, b) => {
            const dateA = a[0]?.dispatchDate ? new Date(a[0].dispatchDate).getTime() : 0;
            const dateB = b[0]?.dispatchDate ? new Date(b[0].dispatchDate).getTime() : 0;
            return dateB - dateA;
        });
    }, [billingDispatches, searchTerm, serials]);

    const totalPages = Math.max(1, Math.ceil(groupedBilling.length / ITEMS_PER_PAGE));
    const currentDispatches = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return groupedBilling.slice(start, start + ITEMS_PER_PAGE);
    }, [groupedBilling, currentPage]);

    const totalBillingRevenue = billingDispatches.reduce((sum, d) => sum + (Number(d.sellingPrice) || 0), 0);

    // ✅ NEW: Calculate batch order value for E-Way Bill validation
    const editingBatchOrderValue = useMemo(() => {
        if (!editingBatch || !Array.isArray(editingBatch)) return 0;
        return editingBatch.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0);
    }, [editingBatch]);

    // ✅ NEW: E-Way Bill required if order value > 50,000
    const isEwayBillRequired = editingBatchOrderValue > 50000;

    // Handle Edit Invoice Click
    const handleEditClick = (group) => {
        setEditingBatch(group);
        setBatchItems(group.map(item => ({ id: item.id, serialNumberId: item.serialNumberId })));
        const firstItem = group[0] || {};

        setEditForm({
            status: firstItem.status || "Send for Billing",
            invoiceNo: firstItem.invoiceNumber || "",
            ewayBill: firstItem.ewayBillNumber || "",
            gemUploaded: firstItem.gemBillUploaded || "No",
            invoiceFile: null,
            existingInvoice: firstItem.invoiceFilename || "",
            // ✅ NEW: Load existing E-Way Bill
            ewayBillFile: null,
            existingEwayBillName: firstItem.ewayBillFilename || ""
        });
    };

    // Handle Payment Click
    const handlePaymentClick = (group) => {
        setPaymentBatch(group);
        const totalAmount = group.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0);

        setPaymentForm({
            paymentDate: new Date().toISOString().split('T')[0],
            amount: totalAmount,
            utrId: ""
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setEditForm({ ...editForm, invoiceFile: e.target.files[0] });
        }
    };

    // ✅ NEW: E-Way Bill file change handler with validation
    const handleEwayBillFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = [
                "application/pdf",
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp"
            ];
            if (!allowedTypes.includes(file.type)) {
                alert("⚠️ Only PDF, JPG, PNG, and WEBP files are allowed for E-Way Bill.");
                e.target.value = "";
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert("⚠️ File size must be less than 10MB.");
                e.target.value = "";
                return;
            }
        }
        setEditForm(prev => ({ ...prev, ewayBillFile: file || null }));
    };

    // ✅ UPDATED: Save Invoice Logic — with E-Way Bill upload + "Send for Packing"
    const handleSaveEdit = async (e) => {
        e.preventDefault();

        // ✅ UPDATED: Validate for "Send for Packing" instead of "Billed"
        if (editForm.status === "Send for Packing" && !editForm.invoiceNo.trim()) {
            alert("⚠️ Invoice Number is required to Send for Packing.");
            return;
        }

        // ✅ NEW: E-Way Bill validation — mandatory if order > ₹50,000
        if (editForm.status === "Send for Packing" && isEwayBillRequired) {
            if (!editForm.ewayBillFile && !editForm.existingEwayBillName) {
                alert(
                    `⚠️ E-Way Bill is mandatory for orders above ₹50,000.\n\n` +
                    `Order Value: ₹${editingBatchOrderValue.toLocaleString("en-IN")}\n\n` +
                    `Please upload an E-Way Bill document to proceed.`
                );
                return;
            }
        }

        // Upload Invoice file
        let filename = editForm.existingInvoice;
        if (editForm.invoiceFile) {
            try {
                const uploadResponse = await printerService.uploadOrderDocument(
                    editingBatch[0].id,
                    editForm.invoiceFile,
                    'invoice'
                );
                filename = uploadResponse.filename;
            } catch (uploadError) {
                console.error("File upload failed", uploadError);
                alert("Failed to upload invoice file.");
                return;
            }
        }

        // ✅ NEW: Upload E-Way Bill file
        let ewayBillFilename = editForm.existingEwayBillName;
        if (editForm.ewayBillFile) {
            try {
                const uploadResponse = await printerService.uploadOrderDocument(
                    editingBatch[0].id,
                    editForm.ewayBillFile,
                    'ewayBill'
                );
                ewayBillFilename = uploadResponse.filename;
            } catch (uploadError) {
                console.error("E-Way Bill upload failed:", uploadError);
                alert("⚠️ E-Way Bill upload failed. Please try again.");
                return;
            }
        }

        // ✅ UPDATED: Map "Send for Packing" to "Packing in Process" for backend
        let finalStatus = editForm.status;
        let finalLogisticsStatus = null;

        if (editForm.status === "Send for Packing") {
            finalStatus = "Billed";
            finalLogisticsStatus = "Packing in Process";
        }

        const updateData = {
            status: finalStatus,
            invoiceNumber: editForm.invoiceNo,
            ewayBillNumber: editForm.ewayBill,
            gemBillUploaded: editForm.gemUploaded,
            invoiceFilename: filename,
            // ✅ NEW: Include E-Way Bill filename
            ewayBillFilename: ewayBillFilename || null,
            // ✅ NEW: Set logistics status when sending for packing
            ...(finalLogisticsStatus ? { logisticsStatus: finalLogisticsStatus } : {})
        };

        let payload;
        if (editingBatch.length === 1) {
            payload = { id: editingBatch[0].id, ...updateData };
        } else {
            payload = batchItems.map(item => ({ id: item.id, ...updateData }));
        }

        try {
            if (Array.isArray(payload)) {
                if (onUpdate) await onUpdate(null, payload);
            } else {
                if (onUpdate) await onUpdate(payload.id, payload);
            }
            setEditingBatch(null);
        } catch (error) {
            console.error("Update failed", error);
            alert("Failed to update status.");
        }
    };

    // Save Payment Logic
    const handleSavePayment = async (e) => {
        e.preventDefault();

        if (!paymentForm.utrId || !paymentForm.amount) {
            alert("⚠️ UTR ID and Amount are required.");
            return;
        }

        const count = paymentBatch.length;
        const amountPerItem = (Number(paymentForm.amount) / count).toFixed(2);

        try {
            await Promise.all(paymentBatch.map(item =>
                printerService.updatePayment(item.id, {
                    paymentDate: paymentForm.paymentDate,
                    amount: amountPerItem,
                    utrId: paymentForm.utrId,
                    status: "Completed"
                })
            ));

            alert("Payment recorded successfully! Orders moved to Completed.");
            setPaymentBatch(null);
            window.location.reload();

        } catch (error) {
            console.error("Payment save failed", error);
            alert("Failed to save payment details. Check console.");
        }
    };

    const handleDownloadContract = (filename) => {
        if (!filename) return;
        window.open(`http://localhost:5000/uploads/${filename}`, "_blank");
    };

    return (
        <div className="space-y-5 relative pb-20">
            {/* Header */}
            <div className="relative">
                <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl -z-10" />
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg shadow-md shadow-indigo-500/25">
                                <Receipt size={14} className="text-white" />
                            </div>
                            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Billing & Accounts</h1>
                        </div>
                        <p className="text-xs text-slate-500">Manage Invoices and Payment Collection</p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                        <button
                            onClick={() => { setActiveTab("billing"); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === "billing" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            <FileText size={14} /> Pending Invoice
                        </button>
                        <button
                            onClick={() => { setActiveTab("payment"); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === "payment" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            <CreditCard size={14} /> Pending Payment
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 shadow-sm">
                        <IndianRupee size={16} className="text-indigo-600" />
                        <div>
                            <p className="text-[10px] text-indigo-500 uppercase font-bold">Total {activeTab === "billing" ? "Unbilled" : "Receivable"}</p>
                            <p className="text-base font-bold text-indigo-800">₹{totalBillingRevenue.toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex w-full md:w-72 relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm bg-white" placeholder={`Search ${activeTab === 'billing' ? 'billing' : 'payment'} orders...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`border-b border-slate-200 px-4 py-3 flex items-center gap-2 ${activeTab === 'payment' ? 'bg-emerald-50/50' : 'bg-indigo-50/50'}`}>
                    <span className="flex h-2 w-2 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTab === 'payment' ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${activeTab === 'payment' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                        {activeTab === 'billing' ? 'Orders Awaiting Invoice' : 'Orders Awaiting Payment'} ({groupedBilling.length})
                    </span>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-sm">
                        <thead className="text-[10px] uppercase font-bold tracking-wider border-b bg-slate-50 text-slate-500">
                            <tr>
                                <th className="w-10 p-4 text-center">#</th>
                                <th className="p-4 text-left">Order ID</th>
                                <th className="p-4 text-left">Platform</th>
                                <th className="p-4 text-left">Model</th>
                                <th className="p-4 text-center">Amount</th>
                                <th className="p-4 text-center">{activeTab === 'billing' ? 'Order Date' : 'Delivery Date'}</th>
                                <th className="p-4 text-left">Contact No.</th>
                                <th className="w-32 p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentDispatches.length === 0 ? (
                                <tr><td colSpan="100" className="p-12 text-center text-sm font-medium text-slate-400">
                                    {activeTab === 'billing'
                                        ? 'No pending bills. Check Dispatch to send orders here.'
                                        : 'No pending payments. Ensure orders are marked "Delivered" in Dispatch.'}
                                </td></tr>
                            ) : (
                                currentDispatches.map((group, index) => {
                                    const item = group[0];
                                    const isMultiple = group.length > 1;
                                    const { model } = getDetails(item.serialNumberId);
                                    const totalAmount = group.reduce((sum, i) => sum + (Number(i.sellingPrice) || 0), 0);

                                    // ✅ NEW: Show E-Way Bill indicator for high-value orders
                                    const needsEway = totalAmount > 50000;

                                    return (
                                        <tr key={index} className={`transition-colors ${activeTab === 'payment' ? 'hover:bg-emerald-50/30' : 'hover:bg-indigo-50/30'}`}>
                                            <td className="p-4 text-center text-xs font-medium text-slate-400">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>

                                            <td className="p-4">
                                                <button
                                                    onClick={() => setViewingOrder(group)}
                                                    className={`text-xs font-bold hover:underline font-mono px-2 py-1 rounded transition-colors text-left ${activeTab === 'payment' ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                                                    title="Click to view full order details"
                                                >
                                                    {item.customerName || "N/A"}
                                                </button>
                                            </td>

                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase
                                                    ${item.firmName === 'GeM' ? 'bg-orange-100 text-orange-700' :
                                                        item.firmName === 'Amazon' ? 'bg-yellow-100 text-yellow-700' :
                                                            item.firmName === 'Flipkart' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-slate-100 text-slate-600'}
                                                `}>
                                                    {item.firmName === 'GeM' && <Building size={10} />}
                                                    {item.firmName || 'Other'}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]" title={model}>
                                                        {isMultiple ? `${model} (+${group.length - 1} more)` : model}
                                                    </span>
                                                    {isMultiple && <span className="text-[9px] text-slate-500 font-medium">Batch Order</span>}
                                                </div>
                                            </td>

                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-xs font-bold text-slate-800">
                                                        ₹{totalAmount.toLocaleString('en-IN')}
                                                    </span>
                                                    {/* ✅ NEW: E-Way Bill indicator badge */}
                                                    {activeTab === 'billing' && needsEway && (
                                                        <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                                                            <AlertTriangle size={8} /> E-Way Req.
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4 text-center">
                                                <span className="text-xs text-slate-600 font-medium">
                                                    {activeTab === 'billing'
                                                        ? (item.orderDate ? format(new Date(item.orderDate), "dd MMM, yyyy") : "-")
                                                        : (item.logisticsDispatchDate ? format(new Date(item.logisticsDispatchDate), "dd MMM, yyyy") : "-")
                                                    }
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <span className="text-xs text-slate-600 font-mono">
                                                    {item.contactNumber || "-"}
                                                </span>
                                            </td>

                                            <td className="p-4 text-center">
                                                {activeTab === 'billing' ? (
                                                    <button onClick={() => handleEditClick(group)} title="Generate Bill" className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm text-xs font-bold w-full justify-center">
                                                        <Edit2 size={12} />
                                                        Process
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handlePaymentClick(group)} title="Receive Payment" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm text-xs font-bold w-full justify-center">
                                                        <CreditCard size={12} />
                                                        Payment
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                        <span className="text-xs text-slate-500">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-50 border border-transparent hover:border-slate-200"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-50 border border-transparent hover:border-slate-200"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* PAYMENT MODAL */}
            {paymentBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                                <IndianRupee size={22} className="text-emerald-600" /> Payment Details
                            </h3>
                            <button type="button" onClick={() => setPaymentBatch(null)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20} className="text-slate-400" /></button>
                        </div>

                        <form onSubmit={handleSavePayment} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">Payment Received Date <span className="text-red-500">*</span></label>
                                <input type="date" required className="w-full border p-2.5 rounded-lg mt-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">Amount Received (₹) <span className="text-red-500">*</span></label>
                                <input type="number" required className="w-full border p-2.5 rounded-lg mt-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">UTR / Transaction ID <span className="text-red-500">*</span></label>
                                <input type="text" required placeholder="Enter UTR / Ref No." className="w-full border p-2.5 rounded-lg mt-1 text-sm focus:ring-2 focus:ring-emerald-500 outline-none uppercase font-mono" value={paymentForm.utrId} onChange={(e) => setPaymentForm({ ...paymentForm, utrId: e.target.value })} />
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex gap-3">
                                <CheckCircle className="text-emerald-600 flex-shrink-0" size={18} />
                                <p className="text-xs text-emerald-800 font-medium">
                                    Submitting this will mark the order as <strong>Completed</strong> and move it to the Completed Orders tab.
                                </p>
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setPaymentBatch(null)} className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition">Save & Complete Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW ORDER DETAILS MODAL */}
            {viewingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 my-auto">

                        <div className="flex justify-between items-center p-5 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                    <Info size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Order Details</h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                        ID: <span className="font-mono text-slate-700 bg-white border border-slate-200 px-1.5 rounded">{viewingOrder[0].customerName}</span>
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setViewingOrder(null)} className="p-2 hover:bg-slate-200/60 rounded-full transition">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[75vh] overflow-y-auto">
                            {(() => {
                                const details = viewingOrder[0];
                                const isGeM = details.firmName === "GeM";
                                const isBidOrPBP = isGeM && (details.orderType === "Bid" || details.orderType === "PBP");
                                const isRestrictedView = ["Amazon", "Flipkart"].includes(details.firmName);

                                if (isRestrictedView) {
                                    return (
                                        <div className="mb-8">
                                            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl mb-4 flex items-center gap-3">
                                                <div className="p-2 bg-yellow-100 rounded-full text-yellow-700">
                                                    <ShoppingCart size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-yellow-800 uppercase tracking-wide">E-Commerce Order</p>
                                                    <p className="text-[11px] text-yellow-700">Limited details available for this platform.</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Order ID</p>
                                                    <p className="text-sm font-bold font-mono text-slate-800 break-all">{details.customerName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Platform</p>
                                                    <span className="inline-block px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700">
                                                        {details.firmName}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Qty</p>
                                                    <p className="text-sm font-bold text-indigo-600">{viewingOrder.length} Items</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Value</p>
                                                    <p className="text-sm font-bold text-emerald-600">
                                                        ₹{viewingOrder.reduce((sum, i) => sum + Number(i.sellingPrice || 0), 0).toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <Building size={12} /> Basic Information
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Order ID</p>
                                                    <p className="text-sm font-bold font-mono text-slate-800">{details.customerName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Platform</p>
                                                    <p className="text-sm font-semibold text-slate-700">{details.firmName || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Order Date</p>
                                                    <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {details.orderDate ? format(new Date(details.orderDate), "dd MMM yyyy") : "-"}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Last Delivery Date</p>
                                                    <p className="text-sm font-medium text-red-600 flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {details.lastDeliveryDate ? format(new Date(details.lastDeliveryDate), "dd MMM yyyy") : "-"}
                                                    </p>
                                                </div>
                                            </div>
                                            {isGeM && (
                                                <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg mt-3">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[10px] text-orange-400 font-bold uppercase">Order Type</p>
                                                            <p className="text-sm font-bold text-orange-800">{details.orderType || "Direct Order"}</p>
                                                        </div>
                                                        {isBidOrPBP && details.bidNo && (
                                                            <div>
                                                                <p className="text-[10px] text-orange-400 font-bold uppercase">Bid No.</p>
                                                                <p className="text-sm font-mono text-orange-800">{details.bidNo}</p>
                                                            </div>
                                                        )}
                                                        {details.contractFile && (
                                                            <div className="col-span-2 pt-2 border-t border-orange-100/50">
                                                                <p className="text-[10px] text-orange-400 font-bold uppercase mb-1">Bid Contract</p>
                                                                <button
                                                                    onClick={() => handleDownloadContract(details.contractFile)}
                                                                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline"
                                                                >
                                                                    <FileText size={14} />
                                                                    {details.contractFile} <Download size={10} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <User size={12} /> Customer & Contact
                                            </h4>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Shipping Address</p>
                                                <div className="flex gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <MapPin size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                                                    <p className="text-sm text-slate-600 leading-relaxed">
                                                        {details.shippingAddress || "No address provided"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">GST Number</p>
                                                    <p className="text-sm font-mono text-slate-700">{details.gstNumber || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Contact No.</p>
                                                    <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                                        <Phone size={12} /> {details.contactNumber || "-"}
                                                    </p>
                                                </div>
                                                {isGeM && (
                                                    <>
                                                        <div>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Alt. Contact No.</p>
                                                            <p className="text-sm font-medium text-slate-700">{details.altContactNumber || "-"}</p>
                                                        </div>
                                                        <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                                            <div>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Buyer Email</p>
                                                                <p className="text-xs font-medium text-indigo-600 break-all flex items-center gap-1">
                                                                    <Mail size={10} /> {details.buyerEmail || "-"}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Consignee Email</p>
                                                                <p className="text-xs font-medium text-indigo-600 break-all flex items-center gap-1">
                                                                    <Mail size={10} /> {details.consigneeEmail || "-"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div>
                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-1">
                                    <Box size={12} /> Items in this Order ({viewingOrder.length})
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3">#</th>
                                                <th className="px-4 py-3">Model</th>
                                                <th className="px-4 py-3">Serial Number</th>
                                                <th className="px-4 py-3 text-right">Selling Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewingOrder.map((item, idx) => {
                                                const { model, serial } = getDetails(item.serialNumberId);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-700">{model}</td>
                                                        <td className="px-4 py-3 font-mono text-slate-600">{serial}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                                            ₹{Number(item.sellingPrice || 0).toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-200">
                                            <tr>
                                                <td colSpan="3" className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Total Amount</td>
                                                <td className="px-4 py-3 text-right font-bold text-indigo-700 text-base">
                                                    ₹{viewingOrder.reduce((sum, i) => sum + Number(i.sellingPrice || 0), 0).toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button onClick={() => setViewingOrder(null)} className="px-6 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-sm transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* ✅ UPDATED: EDIT INVOICE MODAL — WITH E-WAY BILL + SEND FOR PACKING */}
            {/* ================================================================ */}
            {editingBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                                <Receipt size={22} className="text-indigo-600" /> Process Billing
                            </h3>
                            <button type="button" onClick={() => setEditingBatch(null)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20} className="text-slate-400" /></button>
                        </div>

                        {/* ✅ NEW: Order Value Info Bar with E-Way Bill indicator */}
                        <div className={`mb-5 px-4 py-2.5 rounded-xl flex items-center justify-between text-sm font-semibold ${isEwayBillRequired
                            ? "bg-amber-50 border border-amber-200 text-amber-800"
                            : "bg-slate-50 border border-slate-200 text-slate-600"
                            }`}>
                            <span className="flex items-center gap-2">
                                <Receipt size={14} />
                                Order Value: <strong className="text-base">₹{editingBatchOrderValue.toLocaleString("en-IN")}</strong>
                                <span className="text-xs font-normal">({editingBatch.length} item{editingBatch.length > 1 ? "s" : ""})</span>
                            </span>
                            {isEwayBillRequired && (
                                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-bold">
                                    <AlertTriangle size={12} /> E-Way Bill Required
                                </span>
                            )}
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><FileText size={12} /> Invoice / Bill No. <span className="text-red-500">*</span></label>
                                        <input
                                            className="w-full border p-2.5 rounded-lg mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase"
                                            placeholder="INV-XXXXX"
                                            value={editForm.invoiceNo}
                                            onChange={(e) => setEditForm({ ...editForm, invoiceNo: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Link size={12} /> E-Way Bill No. <span className="text-slate-400 font-normal">(Optional)</span></label>
                                        <input
                                            className="w-full border p-2.5 rounded-lg mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase"
                                            placeholder="EWAY-XXXXX"
                                            value={editForm.ewayBill}
                                            onChange={(e) => setEditForm({ ...editForm, ewayBill: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UploadCloud size={12} /> Upload Invoice</label>
                                        <input
                                            type="file"
                                            className="w-full border p-1.5 rounded-lg mt-1 text-xs bg-white text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                            onChange={handleFileChange}
                                        />
                                        {editForm.existingInvoice && <p className="text-[10px] text-indigo-600 mt-1 font-medium">Existing: {editForm.existingInvoice}</p>}
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Activity size={12} /> Uploaded on GeM?</label>
                                        <select
                                            className="w-full border p-2.5 rounded-lg mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                            value={editForm.gemUploaded}
                                            onChange={(e) => setEditForm({ ...editForm, gemUploaded: e.target.value })}
                                        >
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* ================================================================ */}
                            {/* ✅ NEW: E-WAY BILL UPLOAD SECTION                                */}
                            {/* ================================================================ */}
                            <div className={`p-4 rounded-xl border transition-all ${isEwayBillRequired
                                ? "bg-amber-50/80 border-amber-200 ring-1 ring-amber-200"
                                : "bg-slate-50 border-slate-100"
                                }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <label className={`text-xs font-bold uppercase flex items-center gap-1.5 ${isEwayBillRequired ? "text-red-600" : "text-slate-500"}`}>
                                        <FileText size={14} />
                                        E-Way Bill Upload
                                        {isEwayBillRequired ? (
                                            <span className="text-red-500 text-sm">*</span>
                                        ) : (
                                            <span className="text-slate-400 normal-case font-normal ml-1">(Optional)</span>
                                        )}
                                    </label>

                                    {/* Show existing file indicator */}
                                    {editForm.existingEwayBillName && !editForm.ewayBillFile && (
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                            <CheckCircle size={10} /> Uploaded
                                        </span>
                                    )}
                                </div>

                                {/* Mandatory warning message */}
                                {isEwayBillRequired && (
                                    <div className="flex items-start gap-2 mb-3 bg-red-50 border border-red-200 rounded-lg p-2.5">
                                        <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs text-red-700 font-bold">
                                                E-Way Bill is mandatory for orders above ₹50,000
                                            </p>
                                            <p className="text-[10px] text-red-500 mt-0.5">
                                                Current Order Value: ₹{editingBatchOrderValue.toLocaleString("en-IN")}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* File input */}
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                        className={`w-full border p-2 rounded-lg text-xs bg-white text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:cursor-pointer transition-all ${isEwayBillRequired && !editForm.ewayBillFile && !editForm.existingEwayBillName
                                            ? "border-red-300 bg-red-50/50 ring-1 ring-red-200 file:bg-red-100 file:text-red-700"
                                            : "border-slate-200 file:bg-indigo-50 file:text-indigo-700 hover:border-indigo-300"
                                            }`}
                                        onChange={handleEwayBillFileChange}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                        Accepted: PDF, JPG, PNG, WEBP (Max 10MB)
                                    </p>
                                </div>

                                {/* Show existing E-Way Bill with view/remove */}
                                {editForm.existingEwayBillName && !editForm.ewayBillFile && (
                                    <div className="mt-3 flex items-center justify-between bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-200">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-emerald-600" />
                                            <div>
                                                <p className="text-xs text-emerald-800 font-bold">Current E-Way Bill</p>
                                                <p className="text-[10px] text-emerald-600 font-mono truncate max-w-[200px]">
                                                    {editForm.existingEwayBillName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`http://localhost:5000/uploads/${editForm.existingEwayBillName}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink size={10} /> View
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setEditForm(prev => ({ ...prev, existingEwayBillName: "" }))}
                                                className="flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition"
                                                title="Remove & replace"
                                            >
                                                <X size={10} /> Remove
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Show newly selected file */}
                                {editForm.ewayBillFile && (
                                    <div className="mt-3 flex items-center justify-between bg-indigo-50 px-3 py-2.5 rounded-lg border border-indigo-200">
                                        <div className="flex items-center gap-2">
                                            <UploadCloud size={14} className="text-indigo-600" />
                                            <div>
                                                <p className="text-xs text-indigo-800 font-bold">New File Selected</p>
                                                <p className="text-[10px] text-indigo-600 font-mono truncate max-w-[250px]">
                                                    {editForm.ewayBillFile.name}
                                                </p>
                                                <p className="text-[9px] text-indigo-400">
                                                    {(editForm.ewayBillFile.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditForm(prev => ({ ...prev, ewayBillFile: null }))}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Remove selected file"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* ========= END E-WAY BILL SECTION ========= */}

                            {/* ✅ UPDATED: Final Action — "Send for Packing" replaces old options */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1 mb-2">Final Action</label>
                                <select
                                    className="w-full border p-3 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold"
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                >
                                    <option value="Send for Billing">Keep Pending</option>
                                    {/* ✅ UPDATED: Replaced "Billed" with "Send for Packing" */}
                                    <option value="Send for Packing">Send for Packing</option>
                                </select>

                                {/* ✅ UPDATED: Status hints */}
                                {editForm.status === "Send for Packing" && (
                                    <div className="mt-2 p-2.5 bg-cyan-50 border border-cyan-200 rounded-lg flex items-start gap-2">
                                        <Package size={14} className="text-cyan-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-cyan-800 font-bold">
                                                ✅ Order will be sent to Packing stage
                                            </p>
                                            <p className="text-[10px] text-cyan-600 mt-0.5">
                                                Status will show as "Packing in Process" in Dispatch & Order Tracking
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {editForm.status === "Send for Billing" && (
                                    <p className="text-[10px] text-slate-500 mt-2 font-medium bg-white p-2 rounded border border-slate-100">
                                        📋 Order will remain in billing queue for later processing.
                                    </p>
                                )}

                                {/* ✅ NEW: E-Way Bill validation warning in final action */}
                                {editForm.status === "Send for Packing" && isEwayBillRequired && !editForm.ewayBillFile && !editForm.existingEwayBillName && (
                                    <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-[11px] text-red-700 font-bold">
                                            ⚠️ Cannot proceed without E-Way Bill (Order &gt; ₹50,000)
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setEditingBatch(null)} className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-2">
                                    {editForm.status === "Send for Packing" ? (
                                        <>
                                            <Package size={14} /> Save & Send for Packing
                                        </>
                                    ) : (
                                        "Save Billing Details"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}