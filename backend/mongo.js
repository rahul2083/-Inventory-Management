/* Paste this into NODE MONGO/index.js */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect("mongodb://127.0.0.1:27017/PrinterTracker")
  .then(() => console.log("✅ Connected to PrinterTracker DB"))
  .catch(err => console.log("❌ Mongo Error:", err));

// --- SCHEMAS ---

// 1. USER SCHEMA
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "User" }
});

// 2. MODEL SCHEMA (With MRP)
const modelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: String,
  category: String,
  description: String,
  mrp: { type: Number, default: 0 }
}, { timestamps: true });

// 3. SERIAL SCHEMA (With Landing Price)
const serialSchema = new mongoose.Schema({
  modelId: { type: mongoose.Schema.Types.ObjectId, ref: "Model", required: true },
  value: { type: String, unique: true, required: true },
  status: { type: String, default: "Available" },
  landingPrice: { type: Number, default: 0 }, // ✅ Landing Price
  returnCount: { type: Number, default: 0 }
}, { timestamps: true });

// 4. DISPATCH SCHEMA
const dispatchSchema = new mongoose.Schema({
  serialNumberId: { type: mongoose.Schema.Types.ObjectId, ref: "Serial" },
  firmName: String,         
  customerName: String,     
  shippingAddress: String,
  dispatchedBy: String,
  dispatchDate: { type: Date, default: Date.now }
});

// 4b. SERIAL MOVEMENT SCHEMA (Transaction History)
const serialMovementSchema = new mongoose.Schema({
  serialNumberId: { type: mongoose.Schema.Types.ObjectId, ref: "Serial", required: true },
  serialValue: { type: String, required: true },
  dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispatch", default: null },
  actionType: { type: String, required: true }, // 'Dispatched', 'Returned', 'InStock', 'Damaged'
  status: { type: String, required: true },
  condition: String,
  reason: String,
  firmName: String,
  customerName: String,
  createdBy: { type: String, default: "System" },
  notes: String
}, { timestamps: true });

// 5. RETURN SCHEMA
const returnSchema = new mongoose.Schema({
  serialNumberId: { type: mongoose.Schema.Types.ObjectId, ref: "Serial" },
  dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispatch" },
  serialValue: String,
  firmName: String,         
  customerName: String,     
  condition: { type: String, default: "Good" }, 
  reason: { type: String, required: true },
  returnDate: { type: Date, default: Date.now },
  returnCount: { type: Number, default: 1 },
  returnedBy: { type: String, default: "System" },
  repairCost: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);
const Model = mongoose.model("Model", modelSchema);
const Serial = mongoose.model("Serial", serialSchema);
const Dispatch = mongoose.model("Dispatch", dispatchSchema);
const Return = mongoose.model("Return", returnSchema);
const SerialMovement = mongoose.model("SerialMovement", serialMovementSchema);

// --- ROUTES ---

// === AUTH ROUTES ===
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.create({ username, password });
    res.json(user);
  } catch (error) { res.status(400).json({ message: "Username already exists or invalid data" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) { res.json(user); } 
    else { res.status(401).json({ message: "Invalid credentials" }); }
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// === MODEL ROUTES ===
app.get("/api/models", async (req, res) => {
  try {
    const models = await Model.find();
    const modelsWithStock = await Promise.all(
      models.map(async (m) => {
        const stockCount = await Serial.countDocuments({ modelId: m._id, status: "Available" });
        return { ...m.toObject(), stockCount };
      })
    );
    res.json(modelsWithStock);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post("/api/models", async (req, res) => {
  try {
    const model = await Model.create(req.body);
    res.json(model);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete("/api/models/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const linkedSerialsCount = await Serial.countDocuments({ modelId: id });
    if (linkedSerialsCount > 0) return res.status(400).json({ message: `Cannot delete: Model has ${linkedSerialsCount} linked serials.` });
    const deletedModel = await Model.findByIdAndDelete(id);
    if (!deletedModel) return res.status(404).json({ message: "Model not found" });
    res.json({ message: "Model deleted successfully" });
  } catch (error) { res.status(500).json({ message: "Server error: " + error.message }); }
});

// === SERIAL ROUTES ===
app.get("/api/serials", async (req, res) => {
  try {
    // Sort by createdAt descending to get latest first (important for price fetch)
    const serials = await Serial.find().sort({ createdAt: -1 }); 
    res.json(serials);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// ✅ ADD SERIAL (Fixed logic)
app.post("/api/serials", async (req, res) => {
  try {
    const { modelId, value, landingPrice } = req.body;
    
    // Check if Serial already exists
    const existingSerial = await Serial.findOne({ value });
    if (existingSerial) {
        return res.status(400).json({ message: "Serial number already exists!" });
    }

    const serial = await Serial.create({ 
        modelId, 
        value: value.trim(), 
        landingPrice: landingPrice || 0 // Save price
    });
    res.json(serial);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Serial exists!" });
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/serials/:id", async (req, res) => {
  try {
    await Serial.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// === DISPATCH ROUTES ===
app.get("/api/dispatches", async (req, res) => {
  try {
    const dispatches = await Dispatch.find();
    res.json(dispatches);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post("/api/dispatches", async (req, res) => {
  try {
    const { serialId, firmName, customer, address, user } = req.body;
    await Serial.findByIdAndUpdate(serialId, { status: "Dispatched" });
    const dispatch = await Dispatch.create({
      serialNumberId: serialId,
      firmName, customerName: customer, shippingAddress: address, dispatchedBy: user
    });
    
    // Record Serial Movement
    await SerialMovement.create({
      serialNumberId: serialId,
      serialValue: (await Serial.findById(serialId)).value,
      dispatchId: dispatch._id,
      actionType: "Dispatched",
      status: "Dispatched",
      firmName,
      customerName: customer,
      createdBy: user || "System",
      notes: `Assigned to order ${dispatch._id}`
    });

    res.json(dispatch);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.put("/api/dispatches", async (req, res) => {
  try {
    const { updates } = req.body; 
    const itemsToUpdate = Array.isArray(updates) ? updates : (req.body.ids ? [{ ids: req.body.ids, ...req.body.updates }] : []);
    if (itemsToUpdate.length === 0 && updates && !Array.isArray(updates)) { itemsToUpdate.push(updates); }

    for (const item of itemsToUpdate) {
        const updateFields = { firmName: item.firmName, customerName: item.customerName };
        const targetIds = Array.isArray(item.ids) ? item.ids : [item.id];
        for (const dispatchId of targetIds) {
            if (item.serialId && targetIds.length === 1) {
                const currentDispatch = await Dispatch.findById(dispatchId);
                if (currentDispatch && currentDispatch.serialNumberId.toString() !== item.serialId) {
                    await Serial.findByIdAndUpdate(currentDispatch.serialNumberId, { status: "Available" });
                    await Serial.findByIdAndUpdate(item.serialId, { status: "Dispatched" });
                    updateFields.serialNumberId = item.serialId;
                }
            }
            await Dispatch.findByIdAndUpdate(dispatchId, updateFields);
        }
    }
    res.json({ message: "Updated successfully" });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete("/api/dispatches", async (req, res) => {
  try {
    const { ids } = req.body; 
    const dispatchesToDelete = await Dispatch.find({ _id: { $in: ids } });
    for (const d of dispatchesToDelete) {
      await Serial.findByIdAndUpdate(d.serialNumberId, { status: "Available" });
    }
    await Dispatch.deleteMany({ _id: { $in: ids } });
    res.json({ message: "Dispatch deleted and items returned to stock." });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// === LOOKUP AND HISTORY ROUTES ===
app.get("/api/returns/lookup", async (req, res) => {
  try {
    const rawSerial = req.query.serialValue || req.query.serialNumber || req.query.serial;
    if (!rawSerial) return res.status(400).json({ message: "Serial number is required" });
    const serial = await Serial.findOne({ value: new RegExp(`^${rawSerial.trim()}$`, "i") }).populate("modelId");
    if (!serial) return res.status(404).json({ message: "Serial not found" });
    const linkedOrder = await Dispatch.findOne({ serialNumberId: serial._id }).sort({ dispatchDate: -1 });
    const existingReturn = linkedOrder ? await Return.findOne({ serialNumberId: serial._id, dispatchId: linkedOrder._id }) : null;
    res.json({
      ...serial.toObject(),
      modelName: serial.modelId?.name,
      companyName: serial.modelId?.company,
      currentStatus: serial.status,
      canReturn: serial.status === "Dispatched" && !!linkedOrder && !existingReturn,
      linkedOrder,
      existingReturnForLinkedOrder: existingReturn
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get("/api/serials/:id/history", async (req, res) => {
  try {
    const serial = await Serial.findById(req.params.id).populate("modelId");
    if (!serial) return res.status(404).json({ message: "Serial not found" });
    const history = await SerialMovement.find({ serialNumberId: serial._id }).populate("dispatchId").sort({ createdAt: -1 });
    res.json({ serial, history });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// === RETURN ROUTES ===
app.get("/api/returns", async (req, res) => {
  try {
    const returns = await Return.find().populate({ path: 'serialNumberId', populate: { path: 'modelId' }}).sort({ returnDate: -1 });
    res.json(returns);
    
    const grouped = {};
    returns.forEach(r => {
      const sId = r.serialNumberId?._id?.toString() || r.serialNumberId;
      if (!grouped[sId]) {
        grouped[sId] = {
          ...r.toObject(),
          returnCount: 0,
          allReturnDates: []
        };
      }
      grouped[sId].returnCount += 1;
      grouped[sId].allReturnDates.push(r.returnDate);
    });
    
    res.json(Object.values(grouped));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post("/api/returns", async (req, res) => {
  try {
    const { serialValue, condition, reason, dispatchId, returnedBy } = req.body; 
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "Return reason is required" });
    }
    const serial = await Serial.findOne({ value: serialValue });
    if (!serial) return res.status(404).json({ message: "Serial Number not found." });

    const lastDispatch = dispatchId ? await Dispatch.findById(dispatchId) : await Dispatch.findOne({ serialNumberId: serial._id }).sort({ dispatchDate: -1 });
    const finalCondition = condition || "InStock"; 
    
    const existingReturnsCount = await Return.countDocuments({ serialNumberId: serial._id });
    const newReturnCount = existingReturnsCount + 1;

    const newReturn = await Return.create({
      serialNumberId: serial._id, serialValue: serial.value,
      dispatchId: lastDispatch ? lastDispatch._id : null,
      firmName: lastDispatch ? lastDispatch.firmName : "Unknown Platform",
      customerName: lastDispatch ? lastDispatch.customerName : "Unknown Order ID",
      condition: finalCondition,
      reason: String(reason).trim(),
      returnCount: newReturnCount,
      returnedBy: returnedBy || "System"
    });

    serial.status = finalCondition === "Damaged" ? "Damaged" : "Available";
    serial.returnCount = newReturnCount;
    await serial.save();

    // Record Return Movement
    await SerialMovement.create({
      serialNumberId: serial._id, serialValue: serial.value,
      dispatchId: lastDispatch ? lastDispatch._id : null,
      actionType: "Returned", status: "Returned",
      condition: finalCondition, reason: String(reason).trim(),
      firmName: lastDispatch?.firmName, customerName: lastDispatch?.customerName,
      createdBy: returnedBy || "System", notes: "Returned from order"
    });
    // Record Inventory Restock Movement
    await SerialMovement.create({
      serialNumberId: serial._id, serialValue: serial.value,
      dispatchId: null,
      actionType: finalCondition === "Damaged" ? "Damaged" : "InStock",
      status: serial.status,
      condition: finalCondition, reason: String(reason).trim(),
      firmName: lastDispatch?.firmName, customerName: lastDispatch?.customerName,
      createdBy: returnedBy || "System", notes: "Inventory Restocked"
    });

    res.json(newReturn);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.put("/api/returns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, repairCost, reason } = req.body;
    const updateData = { condition, repairCost: Number(repairCost) || 0 };
    if (reason !== undefined) updateData.reason = reason;
    const returnRecord = await Return.findByIdAndUpdate(id, updateData, { new: true });
    if (!returnRecord) return res.status(404).json({ message: "Record not found" });

    if (condition === 'Repaired' || condition === 'Good' || condition === 'InStock') {
      await Serial.findByIdAndUpdate(returnRecord.serialNumberId, { status: "Available" });
      await SerialMovement.create({
        serialNumberId: returnRecord.serialNumberId, serialValue: returnRecord.serialValue,
        actionType: "InStock", status: "Available",
        condition, reason: returnRecord.reason,
        createdBy: "System", notes: "Status updated from return record"
      });
    }

    res.json({ message: "Return updated successfully" });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete("/api/returns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const returnRecord = await Return.findById(id);
    if (!returnRecord) return res.status(404).json({ message: "Record not found" });
    await Serial.findByIdAndUpdate(returnRecord.serialNumberId, { status: "Available" });
    await Return.findByIdAndDelete(id);
    res.json({ message: "Return record deleted and Serial marked as Available." });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));