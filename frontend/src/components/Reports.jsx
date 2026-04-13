import React, { useState, useEffect, useMemo } from "react";
import { printerService } from "../services/api"; 
import { 
  Calendar, Download, TrendingUp, 
  FileText, Printer, Layers, AlertTriangle, CheckCircle, Edit2, Save, X,
  ChevronLeft, ChevronRight, Truck, RefreshCw
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";

// ✅ MOVED OUTSIDE COMPONENT - Helper to format numbers for CSV
function formatCsvNumber(val) {
  if (val === null || val === undefined) return "0";
  const num = Number(val);
  if (isNaN(num)) return "0";
  return num.toString(); // No commas, so Excel treats it as a raw number
}

export default function Reports({ isAdmin, isAccountant, isSupervisor, returns = [] }) {
  const [dateRange, setDateRange] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const canEditCommission = isAdmin || isAccountant;

  const [editingId, setEditingId] = useState(null);
  const [tempCommission, setTempCommission] = useState("");

  useEffect(() => {
    if (dateRange !== "custom") fetchReport(dateRange);
  }, [dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportData]);

  // ✅ Auto-refresh every 30 seconds to keep reports up to date
  useEffect(() => {
    const interval = setInterval(() => {
      if (dateRange !== "custom") {
        fetchReport(dateRange);
      } else if (customStart && customEnd) {
        fetchReport("custom");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [dateRange, customStart, customEnd]);

  const fetchReport = async (range) => {
    setLoading(true);
    let start, end;
    const now = new Date();

    if (range === "today") {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (range === "week") {
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (range === "year") {
      start = startOfYear(now);
      end = endOfYear(now);
    } else if (range === "all") {
      start = new Date("2000-01-01");
      end = new Date("2100-12-31");
    } else if (range === "custom") {
      start = new Date(customStart);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }

    if (start && end) {
      try {
        const data = await printerService.getReports(start.toISOString(), end.toISOString());
        const transactionsArray = Array.isArray(data) ? data : (data?.transactions || []);
        setReportData({ transactions: transactionsArray });
      } catch (error) {
        console.error("Failed to fetch reports", error);
        setReportData({ transactions: [] });
      }
    }
    setLoading(false);
  };

  const handleCustomSearch = (e) => {
    e.preventDefault();
    if (customStart && customEnd) fetchReport("custom");
  };

  const startEditing = (transaction) => {
    setEditingId(transaction._id);
    setTempCommission(transaction.commission || 0);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTempCommission("");
  };

  const saveCommission = async (transaction) => {
    const commissionValue = Number(tempCommission);
    if (isNaN(commissionValue) || commissionValue < 0) {
      alert("Commission must be a valid positive number");
      return;
    }
    try {
      const perItemCommission = commissionValue / transaction.itemCount;
      
      await Promise.all(transaction.batchIds.map(id => 
        printerService.updateDispatch(id, { commission: perItemCommission })
      ));
      
      fetchReport(dateRange === "custom" ? "custom" : dateRange);
      setEditingId(null);
      setTempCommission("");
    } catch (error) {
      alert("Failed to update commission: " + error.message);
      console.error("Commission update error:", error);
    }
  };

  const processedData = useMemo(() => {
    if (!reportData || !reportData.transactions) return { 
      tableTransactions: [], 
      summary: { stockValue: 0, bookingValue: 0, revenue: 0, damageLoss: 0, netProfit: 0, deliveredCount: 0 } 
    };

    let stockValue = 0, bookingValue = 0, revenue = 0, damageLoss = 0, netProfitTotal = 0, deliveredCount = 0;

    const deliveredStatuses = ["delivered", "completed", "payment pending"];
    const activeBookingStatuses = ["ready for pickup", "delivery in process"];
    const damageStatuses = ["damage", "damaged"];
    const cancelledStatuses = ["order cancelled", "cancelled", "returned", "partially returned", "rto"];

    const groupedTransactions = [];
    const groups = {};

    reportData.transactions.forEach(t => {
      const status = (t.status || "").toLowerCase().trim();
      const logStatus = (t.logisticsStatus || "").toLowerCase().trim();
      const landing = Number(t.landingPrice) || 0;
      const selling = Number(t.sellingPrice) || 0;
      const commission = Number(t.commission) || 0;
      const freight = Number(t.freightCharges) || 0;
      const packing = Number(t.packingCharges) || 0;

      // ✅ Gather ALL return records for this dispatch (handles replacements & multiple returns)
      const orderReturns = returns.filter(r => String(r.dispatchId) === String(t._id));
      let refundAmount = 0;
      let repairCost = 0;
      let damagedReturnCount = 0;

      orderReturns.forEach(r => {
        refundAmount += (Number(r.refundAmount) || 0);
        repairCost += (Number(r.repairCost) || 0);
        if (r.condition === "Damaged") damagedReturnCount += 1;
      });

      if (status === "available") {
        stockValue += landing;
        return; // skip inventory stock
      }

      // ✅ Match Dispatch.jsx filter: Only show orders that have reached the Dispatch stage
      const hiddenStatuses = [
        "order confirmed", "pending", "send for billing", 
        "order on hold", "order not confirmed"
      ];
      const isCancelled = status === "order cancelled" || status === "cancelled" || logStatus === "cancelled";
      const isReturned = status === "returned" || status === "partially returned" || status === "rto" || logStatus === "rto" || logStatus === "returned";
      const hasLogistics = t.logisticsStatus && t.logisticsStatus.trim() !== "";

      if (!isCancelled && !isReturned && hiddenStatuses.includes(status) && !hasLogistics) {
        return; // Skip pre-dispatch orders
      }

      // ✅ Robust grouping key combining Firm + Customer ID + Date
      const customerIdentifier = t.customerName || t.customer;
      const dateStr = t.dispatchDate ? String(t.dispatchDate).split('T')[0] : 'nodate';
      const key = customerIdentifier ? `${t.firmName || 'Unknown'}_${customerIdentifier}_${dateStr}` : t._id;
      
      if (!groups[key]) {
        groups[key] = {
          ...t,
          isBulk: false,
          itemCount: 1,
          batchIds: [t._id],
          selling,
          landing,
          commission,
          freight,
          packing,
          refundAmount,
          damagedLanding: damagedReturnCount * landing,
          repairCost,
          hasReturn: orderReturns.length > 0,
          status,
          logisticsStatus: logStatus
        };
      } else {
        groups[key].isBulk = true;
        groups[key].itemCount += 1;
        groups[key].batchIds.push(t._id);
        groups[key].landing += landing;
        groups[key].selling += selling;
        groups[key].commission += commission;
        groups[key].refundAmount = (groups[key].refundAmount || 0) + refundAmount;
        groups[key].damagedLanding = (groups[key].damagedLanding || 0) + (damagedReturnCount * landing);
        groups[key].repairCost = (groups[key].repairCost || 0) + repairCost;
        if (orderReturns.length > 0) groups[key].hasReturn = true;
        // ❌ DO NOT multiply freight and packing here! They apply strictly once per batch.
      }
    });

    // Calculate final batch profits and summary metrics
    Object.values(groups).forEach(batch => {
      const isRto = batch.status === "rto" || batch.logisticsStatus === "rto";

      if (isRto) {
        // For RTO, selling and landing are 0 since item is back and no revenue realized.
        batch.selling = 0;
        batch.landing = 0;
        batch.netProfit = -(batch.commission + batch.freight + batch.packing);
        
        damageLoss += Math.abs(batch.netProfit);
        netProfitTotal += batch.netProfit;
      } else {
        // Calculate actuals factoring in refunds & recovered inventory cost
        const actualSelling = batch.selling - (batch.refundAmount || 0);
        const effectiveLanding = batch.landing - (batch.recoveredLanding || 0); 
        batch.netProfit = actualSelling - effectiveLanding - batch.commission - batch.freight - batch.packing - (batch.repairCost || 0);

        if (damageStatuses.includes(batch.status) || damageStatuses.includes(batch.logisticsStatus) || batch.damagedLanding > 0 || (batch.repairCost || 0) > 0) {
          damageLoss += (batch.damagedLanding > 0 ? batch.damagedLanding : batch.landing) + (batch.repairCost || 0);
        } 
        if (deliveredStatuses.includes(batch.status) || deliveredStatuses.includes(batch.logisticsStatus) || batch.hasReturn) {
          revenue += actualSelling;
          netProfitTotal += batch.netProfit;
          deliveredCount += batch.itemCount;
        } else if (activeBookingStatuses.includes(batch.status) || activeBookingStatuses.includes(batch.logisticsStatus)) {
          bookingValue += actualSelling;
        }
      }

      groupedTransactions.push(batch);
    });

    // Sort transactions by date descending for the table
    groupedTransactions.sort((a, b) => new Date(b.dispatchDate || 0) - new Date(a.dispatchDate || 0));

    return { 
      tableTransactions: groupedTransactions,
      summary: { stockValue, bookingValue, revenue, damageLoss, netProfit: netProfitTotal, deliveredCount }
    };
  }, [reportData, returns]);

  const { tableTransactions, summary } = processedData;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = tableTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(tableTransactions.length / itemsPerPage);

  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const prevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  // ✅ FIXED CSV DOWNLOAD - No ternary inside JSX-parsed area
  const downloadCSV = () => {
    if (!reportData) {
      alert("No data available to download");
      return;
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rangeLabel = dateRange === "custom" 
      ? customStart + " to " + customEnd 
      : dateRange === "all" ? "ALL TIME" : dateRange.toUpperCase();

    const summaryRows = [
      ["FINANCIAL REPORT SUMMARY"],
      ["Generated Date", new Date().toLocaleString()],
      ["Report Range", rangeLabel],
      [],
      ["METRIC", "AMOUNT (INR)"],
      ["Available Stock", summary.stockValue.toLocaleString("en-IN")],
      ["Order Booking (Active)", summary.bookingValue.toLocaleString("en-IN")],
      ["Total Revenue (Delivered)", summary.revenue.toLocaleString("en-IN")],
      ["Net Profit (After RTO)", summary.netProfit.toLocaleString("en-IN")],
      ["Total Loss (Damage & RTO)", summary.damageLoss.toLocaleString("en-IN")],
      [],
      ["DETAILED ORDER BREAKDOWN"],
    ];

    const tableHeaders = [
      "#", "Date", "Order ID", "Status", "Model", 
      "Landing Price", "Selling Price", "Refund",
      "Commission", "Packing", "Freight", "Repair Cost",
      "Net Profit"
    ];

    const tableData = tableTransactions.map((t, index) => {
      let dateStr = "N/A";
      if (t.dispatchDate) {
        try {
          dateStr = format(new Date(t.dispatchDate), "yyyy-MM-dd");
        } catch (e) {
          dateStr = "N/A";
        }
      }
      
      const orderIdStr = t.customerName || t.customer || t.orderId || "N/A";
      const modelStr = t.isBulk 
        ? `Multiple (${t.itemCount} items)` 
        : (t.modelName || "N/A") + " (" + (t.serialValue || "N/A") + ")";

      return [
        index + 1,
        dateStr,
        orderIdStr,
        (t.logisticsStatus || t.status || "").toUpperCase(),
        modelStr,
        formatCsvNumber(t.landing),
        formatCsvNumber(t.selling),
        formatCsvNumber(t.refundAmount),
        formatCsvNumber(t.commission),
        formatCsvNumber(t.packing),
        formatCsvNumber(t.freight),
        formatCsvNumber(t.repairCost),
        formatCsvNumber(t.netProfit)
      ];
    });

    const allRows = [...summaryRows, tableHeaders, ...tableData];

    const csvString = allRows
      .map(function(row) { return row.map(escapeCsv).join(","); })
      .join("\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "profit_report_" + dateRange + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20 print:p-0 print:m-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-indigo-600" /> Financial Report
          </h2>
          <p className="text-sm text-slate-500">Manage Commissions & View Profit Analysis</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchReport(dateRange === "custom" ? "custom" : dateRange)} disabled={loading} className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={downloadCSV} disabled={!reportData} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm disabled:opacity-50">
            <Download size={16} /> CSV
          </button>
          <button onClick={() => window.print()} disabled={!reportData} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Date Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", "today", "week", "year", "custom"].map((r) => (
            <button key={r} onClick={() => setDateRange(r)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${dateRange === r ? "bg-indigo-100 text-indigo-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
              {r === "all" ? "All Time" : r === "year" ? "This Year" : r === "week" ? "This Week" : r}
            </button>
          ))}
        </div>
        {dateRange === "custom" && (
          <form onSubmit={handleCustomSearch} className="flex flex-wrap items-end gap-3 bg-slate-50 p-3 rounded-xl">
            <div><label className="text-xs font-bold text-slate-500 block mb-1">Start</label><input type="date" className="border p-2 rounded-lg text-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} required /></div>
            <div><label className="text-xs font-bold text-slate-500 block mb-1">End</label><input type="date" className="border p-2 rounded-lg text-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} required /></div>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 h-10">Generate</button>
          </form>
        )}
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Processing Data...</div>
      ) : reportData ? (
        <div className="space-y-6 print:space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Layers size={40} className="text-blue-600"/></div>
              <p className="text-[10px] font-bold text-blue-500 uppercase">Available Stock</p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-1">₹{summary.stockValue.toLocaleString('en-IN')}</h3>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Truck size={40} className="text-amber-600"/></div>
              <p className="text-[10px] font-bold text-amber-500 uppercase">Order Booking (Active)</p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-1">₹{summary.bookingValue.toLocaleString('en-IN')}</h3>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><CheckCircle size={40} className="text-emerald-600"/></div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Total Revenue (Delivered)</p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-1">₹{summary.revenue.toLocaleString('en-IN')}</h3>
            </div>

            <div className={`bg-white p-4 rounded-2xl border shadow-sm relative overflow-hidden ${summary.netProfit >= 0 ? 'border-indigo-100' : 'border-red-100'}`}>
              <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={40} className="text-indigo-600"/></div>
              <p className={`text-[10px] font-bold uppercase ${summary.netProfit >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>Net Profit (After RTO)</p>
              <h3 className={`text-xl font-extrabold mt-1 ${summary.netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>₹{summary.netProfit.toLocaleString('en-IN')}</h3>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden bg-red-50/20">
              <div className="absolute top-0 right-0 p-3 opacity-10"><AlertTriangle size={40} className="text-red-600"/></div>
              <p className="text-[10px] font-bold text-red-500 uppercase">Total Loss (Damage & RTO)</p>
              <h3 className="text-xl font-extrabold text-red-700 mt-1">₹{summary.damageLoss.toLocaleString('en-IN')}</h3>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-slate-800">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 print:bg-white flex justify-between items-center">
              <h3 className="font-bold text-slate-700 text-sm">Order Breakdown</h3>
              <span className="text-xs text-slate-500 font-medium">
                Showing {tableTransactions.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, tableTransactions.length)} of {tableTransactions.length}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider print:bg-white border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">#</th>
                    <th className="px-4 py-3 w-24">Date</th>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3 text-right text-slate-600 bg-slate-50/50">Landing</th>
                    <th className="px-4 py-3 text-right text-indigo-600 bg-indigo-50/30">Selling</th>
                    <th className="px-4 py-3 text-right text-orange-600 bg-orange-50/30">Refund</th>
                    <th className="px-4 py-3 text-center w-32 bg-amber-50/30 text-amber-700">Commission</th>
                    <th className="px-4 py-3 text-right">Packing</th>
                    <th className="px-4 py-3 text-right">Freight</th>
                    <th className="px-4 py-3 text-right text-red-600 bg-red-50/30">Repair</th>
                    <th className="px-4 py-3 text-right bg-emerald-50/30">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTransactions.map((t, index) => (
                    <tr key={t._id || index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono">{indexOfFirstItem + index + 1}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {(() => {
                          try {
                            return t.dispatchDate ? format(new Date(t.dispatchDate), "dd MMM yy") : "-";
                          } catch {
                            return "-";
                          }
                        })()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        {t.customerName || t.customer || t.orderId || "-"}
                        {t.isBulk && (
                          <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                            Batch ({t.itemCount})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${
                          t.status === 'delivered' || t.status === 'completed' || t.status === 'payment pending' ? 'bg-emerald-100 text-emerald-700' :
                          t.status === 'order cancelled' || t.status === 'cancelled' || t.status === 'returned' || t.status === 'rto' ? 'bg-red-100 text-red-700' :
                          t.status === 'damage' || t.status === 'damaged' ? 'bg-orange-100 text-orange-700' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          {t.logisticsStatus || t.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-700">
                          {t.isBulk ? "Multiple Models" : t.modelName || "-"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {t.isBulk ? `${t.itemCount} Serials` : t.serialValue || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 bg-slate-50/50">
                        ₹{(t.landing || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-700 bg-indigo-50/30">
                        {t.selling > 0 ? "₹" + t.selling.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700 bg-orange-50/30">
                        {t.refundAmount > 0 ? "-₹" + t.refundAmount.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-center bg-amber-50/30">
                    {canEditCommission && editingId === t._id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input 
                              type="number" 
                              className="w-16 p-1 border rounded text-xs text-center" 
                              value={tempCommission} 
                              onChange={(e) => setTempCommission(e.target.value)} 
                              autoFocus 
                            />
                            <button 
                              onClick={() => saveCommission(t)} 
                              className="text-emerald-600 hover:bg-emerald-100 p-1 rounded"
                            >
                              <Save size={14}/>
                            </button>
                            <button 
                              onClick={cancelEditing} 
                              className="text-red-500 hover:bg-red-100 p-1 rounded"
                            >
                              <X size={14}/>
                            </button>
                          </div>
                    ) : canEditCommission ? (
                          <div 
                            className="flex items-center justify-center gap-2 group cursor-pointer hover:bg-amber-100/50 py-1 rounded transition" 
                            onClick={() => startEditing(t)} 
                            title="Click to Edit Commission"
                          >
                            <span className={`text-xs font-bold ${t.commission > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                              ₹{(t.commission || 0).toLocaleString()}
                            </span>
                            <Edit2 
                              size={12} 
                              className="text-slate-300 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-all"
                            />
                          </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-1 rounded">
                        <span className={`text-xs font-bold ${t.commission > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                          ₹{(t.commission || 0).toLocaleString()}
                        </span>
                      </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        ₹{(t.packing || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        ₹{(t.freight || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 bg-red-50/30 font-semibold">
                        {t.repairCost > 0 ? "₹" + t.repairCost.toLocaleString() : "-"}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold bg-emerald-50/30 ${t.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        ₹{(t.netProfit || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {tableTransactions.length === 0 && (
                    <tr>
                      <td colSpan="11" className="p-8 text-center text-slate-400">
                        No Orders found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {tableTransactions.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 print:hidden">
                <button 
                  onClick={prevPage} 
                  disabled={currentPage === 1} 
                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span className="text-sm text-slate-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={nextPage} 
                  disabled={currentPage === totalPages} 
                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Calendar size={48} className="mb-4 opacity-20" />
          <p>Select a date range.</p>
        </div>
      )}
    </div>
  );
}