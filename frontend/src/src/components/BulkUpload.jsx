// src/components/BulkUpload.jsx
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, FileSpreadsheet, CheckCircle,
  XCircle, AlertTriangle, X, Loader2, ChevronDown,
  ChevronUp, Info
} from "lucide-react";
import { printerService } from "../services/api";

// =============================================
// EXCEL TEMPLATE STRUCTURE
// =============================================
const TEMPLATE_HEADERS = [
  "company",
  "modelName", 
  "category",
  "colorType",
  "printerType",
  "mrp",
  "packagingCost",
  "serialNumber",
  "landingPrice"
];

const TEMPLATE_SAMPLE_DATA = [
  {
    company: "HP",
    modelName: "LaserJet Pro M404n",
    category: "Printer",
    colorType: "Monochrome",
    printerType: "Multi-Function",
    mrp: 15000,
    packagingCost: 500,
    serialNumber: "HP001234",
    landingPrice: 12000
  },
  {
    company: "Canon",
    modelName: "PIXMA G2010",
    category: "Printer",
    colorType: "Color",
    printerType: "Single-Function",
    mrp: 8000,
    packagingCost: 300,
    serialNumber: "CN005678",
    landingPrice: 6500
  },
  {
    company: "HP",
    modelName: "LaserJet Pro M404n",
    category: "Printer",
    colorType: "Monochrome",
    printerType: "Multi-Function",
    mrp: 15000,
    packagingCost: 500,
    serialNumber: "HP001235",
    landingPrice: 12000
  }
];

const COLOR_TYPES = ["Monochrome", "Color"];
const PRINTER_TYPES = ["Multi-Function", "Single-Function"];
const CATEGORIES = ["Printer", "Scanner", "Copier", "Fax", "All-in-One"];

export default function BulkUpload({ onSuccess, onClose }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=result
  const [showErrors, setShowErrors] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // =============================================
  // DOWNLOAD TEMPLATE
  // =============================================
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Main data sheet
    const wsData = [
      TEMPLATE_HEADERS,
      ...TEMPLATE_SAMPLE_DATA.map(row => TEMPLATE_HEADERS.map(h => row[h]))
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 15 }, // company
      { wch: 25 }, // modelName
      { wch: 15 }, // category
      { wch: 15 }, // colorType
      { wch: 18 }, // printerType
      { wch: 10 }, // mrp
      { wch: 15 }, // packagingCost
      { wch: 20 }, // serialNumber
      { wch: 15 }, // landingPrice
    ];

    XLSX.utils.book_append_sheet(wb, ws, "BulkData");

    // Instructions sheet
    const instructionsData = [
      ["📋 BULK UPLOAD INSTRUCTIONS"],
      [""],
      ["Column", "Required", "Valid Values", "Description"],
      ["company", "YES", "Any text", "Company name (e.g., HP, Canon, Epson)"],
      ["modelName", "YES", "Any text", "Model name (e.g., LaserJet Pro M404n)"],
      ["category", "YES", "Printer, Scanner, Copier, Fax, All-in-One", "Product category"],
      ["colorType", "YES", "Monochrome, Color", "Color type"],
      ["printerType", "YES", "Multi-Function, Single-Function", "Printer type"],
      ["mrp", "YES", "Number", "Maximum Retail Price"],
      ["packagingCost", "NO", "Number (default: 0)", "Packaging cost"],
      ["serialNumber", "YES", "Unique text", "Serial number (must be unique)"],
      ["landingPrice", "YES", "Number", "Landing/cost price"],
      [""],
      ["⚠️ IMPORTANT NOTES:"],
      ["1. Do NOT change column header names"],
      ["2. Serial numbers must be unique"],
      ["3. Same model can have multiple serial numbers (add multiple rows)"],
      ["4. mrp and landingPrice must be numbers only"],
      ["5. Delete sample rows before uploading your data"],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 45 },
      { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    XLSX.writeFile(wb, "bulk_upload_template.xlsx");
  };

  // =============================================
  // VALIDATE ROW
  // =============================================
  const validateRow = (row, index) => {
    const errors = [];
    const rowNum = index + 2; // +2 because row 1 is header

    if (!row.company?.toString().trim()) {
      errors.push(`Row ${rowNum}: Company is required`);
    }
    if (!row.modelName?.toString().trim()) {
      errors.push(`Row ${rowNum}: Model name is required`);
    }
    if (!row.category?.toString().trim()) {
      errors.push(`Row ${rowNum}: Category is required`);
    }
    if (!row.colorType?.toString().trim()) {
      errors.push(`Row ${rowNum}: Color type is required`);
    } else if (!COLOR_TYPES.includes(row.colorType?.toString().trim())) {
      errors.push(`Row ${rowNum}: colorType must be "Monochrome" or "Color"`);
    }
    if (!row.printerType?.toString().trim()) {
      errors.push(`Row ${rowNum}: Printer type is required`);
    } else if (!PRINTER_TYPES.includes(row.printerType?.toString().trim())) {
      errors.push(`Row ${rowNum}: printerType must be "Multi-Function" or "Single-Function"`);
    }
    if (!row.mrp && row.mrp !== 0) {
      errors.push(`Row ${rowNum}: MRP is required`);
    } else if (isNaN(Number(row.mrp))) {
      errors.push(`Row ${rowNum}: MRP must be a number`);
    }
    if (!row.serialNumber?.toString().trim()) {
      errors.push(`Row ${rowNum}: Serial number is required`);
    }
    if (!row.landingPrice && row.landingPrice !== 0) {
      errors.push(`Row ${rowNum}: Landing price is required`);
    } else if (isNaN(Number(row.landingPrice))) {
      errors.push(`Row ${rowNum}: Landing price must be a number`);
    }

    return errors;
  };

  // =============================================
  // PARSE EXCEL FILE
  // =============================================
  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: ""
        });

        if (jsonData.length === 0) {
          setValidationErrors(["Excel file is empty or has no data rows"]);
          return;
        }

        // Check headers
        const firstRow = jsonData[0];
        const missingHeaders = TEMPLATE_HEADERS.filter(h => !(h in firstRow));
        if (missingHeaders.length > 0) {
          setValidationErrors([
            `Missing columns: ${missingHeaders.join(", ")}`,
            "Please download the template and use correct column names"
          ]);
          return;
        }

        // Validate all rows
        const allErrors = [];
        const serialNumbers = new Set();
        const duplicatesInFile = [];

        jsonData.forEach((row, index) => {
          const rowErrors = validateRow(row, index);
          allErrors.push(...rowErrors);

          // Check duplicate serial numbers within the file
          const serial = row.serialNumber?.toString().trim().toUpperCase();
          if (serial) {
            if (serialNumbers.has(serial)) {
              duplicatesInFile.push(`Row ${index + 2}: Duplicate serial "${serial}" in file`);
            } else {
              serialNumbers.add(serial);
            }
          }
        });

        allErrors.push(...duplicatesInFile);

        setValidationErrors(allErrors);
        setParsedData(jsonData);
        setStep(2);
      } catch (err) {
        setValidationErrors([`Failed to parse Excel file: ${err.message}`]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // =============================================
  // FILE HANDLERS
  // =============================================
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];

    if (!validTypes.includes(selectedFile.type) &&
      !selectedFile.name.endsWith('.xlsx') &&
      !selectedFile.name.endsWith('.xls')) {
      setValidationErrors(["Only Excel files (.xlsx, .xls) are allowed"]);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setValidationErrors(["File size must be less than 10MB"]);
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);
    setUploadResult(null);
    parseExcel(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  // =============================================
  // UPLOAD TO SERVER
  // =============================================
  const handleUpload = async () => {
    if (parsedData.length === 0) return;
    if (validationErrors.length > 0) {
      alert("⚠️ Please fix all validation errors before uploading");
      return;
    }

    setIsUploading(true);

    try {
      const result = await printerService.bulkUploadExcel(parsedData);
      setUploadResult(result);
      setStep(3);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.message,
        results: { models: { success: 0, failed: 0 }, serials: { success: 0, failed: 0 } }
      });
      setStep(3);
    } finally {
      setIsUploading(false);
    }
  };

  // =============================================
  // RESET
  // =============================================
  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setUploadResult(null);
    setStep(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // =============================================
  // GROUP DATA FOR PREVIEW
  // =============================================
  const groupedPreview = parsedData.reduce((acc, row) => {
    const modelKey = `${row.company}_${row.modelName}`;
    if (!acc[modelKey]) {
      acc[modelKey] = {
        company: row.company,
        modelName: row.modelName,
        category: row.category,
        colorType: row.colorType,
        printerType: row.printerType,
        mrp: row.mrp,
        packagingCost: row.packagingCost || 0,
        serials: []
      };
    }
    acc[modelKey].serials.push({
      serialNumber: row.serialNumber,
      landingPrice: row.landingPrice
    });
    return acc;
  }, {});

  const uniqueModels = Object.values(groupedPreview);
  const totalSerials = parsedData.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">Bulk Excel Upload</h2>
              <p className="text-indigo-200 text-xs mt-0.5">
                Upload Models + Serials ek saath
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* STEPS INDICATOR */}
        <div className="flex items-center gap-0 px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          {[
            { num: 1, label: "File Upload" },
            { num: 2, label: "Preview & Validate" },
            { num: 3, label: "Result" }
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s.num
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-500"
                  }`}>
                  {step > s.num ? <CheckCircle size={14} /> : s.num}
                </div>
                <span className={`text-xs font-semibold ${step >= s.num ? "text-indigo-700" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.num ? "bg-indigo-400" : "bg-slate-200"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ===== STEP 1: FILE UPLOAD ===== */}
          {step === 1 && (
            <div className="space-y-5">

              {/* Download Template */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Download size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-800">
                      Pehle Template Download Karo
                    </p>
                    <p className="text-xs text-indigo-500 mt-0.5">
                      Correct format mein data fill karo
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md"
                >
                  <Download size={14} />
                  Download Template
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 mb-2">
                      Excel Format Rules:
                    </p>
                    <ul className="text-xs text-amber-700 space-y-1">
                      <li>✅ <strong>company, modelName, category</strong> — Required</li>
                      <li>✅ <strong>colorType</strong> — "Monochrome" ya "Color"</li>
                      <li>✅ <strong>printerType</strong> — "Multi-Function" ya "Single-Function"</li>
                      <li>✅ <strong>mrp, landingPrice</strong> — Numbers only</li>
                      <li>✅ <strong>serialNumber</strong> — Unique hona chahiye</li>
                      <li>✅ Ek model ke multiple serials = multiple rows</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragOver
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-indigo-100 rounded-2xl">
                    <Upload size={32} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-base">
                      Excel file drag karo ya click karo
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      .xlsx, .xls supported (Max 10MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                      <XCircle size={16} />
                      {validationErrors.length} Error(s) Found
                    </p>
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="text-red-500 hover:text-red-700"
                    >
                      {showErrors ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {showErrors && (
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {validationErrors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                          <span className="mt-0.5 shrink-0">•</span> {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 2: PREVIEW ===== */}
          {step === 2 && (
            <div className="space-y-4">

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-indigo-700">
                    {uniqueModels.length}
                  </p>
                  <p className="text-xs text-indigo-500 font-semibold mt-0.5">
                    Unique Models
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-emerald-700">
                    {totalSerials}
                  </p>
                  <p className="text-xs text-emerald-500 font-semibold mt-0.5">
                    Total Serials
                  </p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${validationErrors.length > 0
                  ? "bg-red-50 border-red-200"
                  : "bg-green-50 border-green-200"
                  }`}>
                  <p className={`text-2xl font-extrabold ${validationErrors.length > 0 ? "text-red-700" : "text-green-700"}`}>
                    {validationErrors.length}
                  </p>
                  <p className={`text-xs font-semibold mt-0.5 ${validationErrors.length > 0 ? "text-red-500" : "text-green-500"}`}>
                    {validationErrors.length > 0 ? "Errors Found" : "No Errors ✅"}
                  </p>
                </div>
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Fix these errors before uploading:
                    </p>
                    <button
                      onClick={() => setShowErrors(!showErrors)}
                      className="text-red-500"
                    >
                      {showErrors ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {showErrors && (
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {validationErrors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                          <span className="shrink-0 mt-0.5">•</span> {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Data Preview Table */}
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">
                  Data Preview:
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr className="text-slate-600 font-bold uppercase">
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Company</th>
                          <th className="px-3 py-2 text-left">Model</th>
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-left">Color</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-right">MRP</th>
                          <th className="px-3 py-2 text-right">Pkg Cost</th>
                          <th className="px-3 py-2 text-left">Serial No.</th>
                          <th className="px-3 py-2 text-right">Landing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{row.company}</td>
                            <td className="px-3 py-2">{row.modelName}</td>
                            <td className="px-3 py-2">{row.category}</td>
                            <td className="px-3 py-2">{row.colorType}</td>
                            <td className="px-3 py-2">{row.printerType}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              ₹{Number(row.mrp).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              ₹{Number(row.packagingCost || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 font-mono text-indigo-600 font-bold">
                              {row.serialNumber}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              ₹{Number(row.landingPrice).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Grouped Model Summary */}
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">
                  Model Summary:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {uniqueModels.map((model, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          {model.company} — {model.modelName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {model.category} • {model.colorType} • {model.printerType}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-indigo-600">
                          {model.serials.length} Serial{model.serials.length > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-slate-400">
                          MRP: ₹{Number(model.mrp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP 3: RESULT ===== */}
          {step === 3 && uploadResult && (
            <div className="space-y-4">
              {/* Success/Fail Banner */}
              <div className={`rounded-xl p-5 text-center ${uploadResult.success !== false
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-red-50 border border-red-200"
                }`}>
                {uploadResult.success !== false ? (
                  <>
                    <CheckCircle size={40} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-lg font-extrabold text-emerald-700">
                      Upload Successful!
                    </p>
                    <p className="text-sm text-emerald-600 mt-1">
                      {uploadResult.message}
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle size={40} className="text-red-500 mx-auto mb-2" />
                    <p className="text-lg font-extrabold text-red-700">
                      Upload Failed
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      {uploadResult.message}
                    </p>
                  </>
                )}
              </div>

              {/* Stats */}
              {uploadResult.results && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">
                      Models
                    </p>
                    <div className="flex justify-between">
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-emerald-600">
                          {uploadResult.results.models?.created || 0}
                        </p>
                        <p className="text-xs text-slate-400">Created</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-blue-600">
                          {uploadResult.results.models?.existing || 0}
                        </p>
                        <p className="text-xs text-slate-400">Already Existed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-red-600">
                          {uploadResult.results.models?.failed || 0}
                        </p>
                        <p className="text-xs text-slate-400">Failed</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">
                      Serials
                    </p>
                    <div className="flex justify-between">
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-emerald-600">
                          {uploadResult.results.serials?.created || 0}
                        </p>
                        <p className="text-xs text-slate-400">Created</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-amber-600">
                          {uploadResult.results.serials?.duplicate || 0}
                        </p>
                        <p className="text-xs text-slate-400">Duplicate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-red-600">
                          {uploadResult.results.serials?.failed || 0}
                        </p>
                        <p className="text-xs text-slate-400">Failed</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed Serials List */}
              {uploadResult.results?.serials?.failedList?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-red-700 mb-2">
                    Failed Serials:
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {uploadResult.results.serials.failedList.map((item, i) => (
                      <li key={i} className="text-xs text-red-600">
                        • {item.serialNumber}: {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duplicate Serials List */}
              {uploadResult.results?.serials?.duplicateList?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-700 mb-2">
                    Duplicate Serials (Skipped):
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {uploadResult.results.serials.duplicateList.map((item, i) => (
                      <li key={i} className="text-xs text-amber-600">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER BUTTONS */}
        <div className="border-t border-slate-200 p-4 flex justify-between items-center shrink-0 bg-slate-50">
          <button
            onClick={step === 1 ? onClose : handleReset}
            className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            {step === 1 ? "Cancel" : "← Start Over"}
          </button>

          <div className="flex gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                ← Back
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleUpload}
                disabled={isUploading || validationErrors.length > 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shadow-lg"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload {parsedData.length} Records
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-lg"
              >
                Done ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}