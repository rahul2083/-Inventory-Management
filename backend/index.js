﻿const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const sql = require("mssql/msnodesqlv8");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx"); // ✅ ADDED XLSX PACKAGE

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.type("html").send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Printer Tracker API</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f5f7fb;
            color: #1f2937;
          }
          .wrap {
            max-width: 720px;
            margin: 48px auto;
            padding: 32px;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }
          h1 {
            margin-top: 0;
            color: #0f172a;
          }
          p {
            line-height: 1.6;
          }
          code {
            background: #eef2ff;
            padding: 2px 6px;
            border-radius: 6px;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin: 8px 0;
          }
          a {
            color: #2563eb;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Printer Tracker API is running</h1>
          <p>This project currently starts an Express API server, not a full browser frontend.</p>
          <p>If you open <code>http://localhost:5000/</code>, you will now see this page instead of a blank screen.</p>
          <p>Useful API routes:</p>
          <ul>
            <li><a href="/api/auth/bootstrap-status">/api/auth/bootstrap-status</a></li>
            <li><a href="/api/models">/api/models</a></li>
            <li><a href="/api/serials">/api/serials</a></li>
            <li><a href="/api/dispatches">/api/dispatches</a></li>
          </ul>
          <p>If you want an actual dashboard page, we will need to add or connect the frontend files separately.</p>
        </div>
      </body>
    </html>
  `);
});

// ================================
// ✅ UPLOADS (STATIC + MULTER)
// ================================
const uploadDir = path.resolve(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeOriginal = file.originalname.replace(/[^\w.\- ()]/g, "_");
    cb(null, `${uniqueSuffix}-${safeOriginal}`);
  },
});
const upload = multer({ storage });

// ================================
// ✅ DATABASE CONFIG
// ================================
const SERVER_NAME = "(localdb)\\MSSQLLocalDB";
const DATABASE_NAME = "InventoryDB";

const connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${SERVER_NAME};Database=${DATABASE_NAME};Trusted_Connection=yes;`;

const config = {
  connectionString,
  pool: { max: 50, min: 0, idleTimeoutMillis: 30000 },
  options: {
    useUTC: false
  }
};

const VALID_ROLES = ["Admin", "Supervisor", "Accountant", "User", "Operator"];
const ALL_AUTHENTICATED_ROLES = [...VALID_ROLES];
const OPERATIONAL_ROLES = ["Admin", "User", "Operator"];

const safeDate = (dateStr) => (dateStr && dateStr !== "" ? dateStr : null);
const safeNum = (val, fallback = 0) => {
  const num = Number(val);
  return Number.isNaN(num) ? fallback : num;
};
const safeStr = (val, fallback = null) => {
  if (val === undefined || val === null) return fallback;
  const v = String(val).trim();
  return v === "" ? fallback : v;
};
const toBit = (val) =>
  val === true ||
  val === 1 ||
  val === "1" ||
  val === "true" ||
  val === "TRUE" ||
  val === "Yes" ||
  val === "yes";

const normalizeBusinessStatus = (status) => {
  const s = safeStr(status, "Pending");
  if (s === "Order Not Confirmed") return "Order On Hold";
  return s;
};

const normalizeLogisticsStatus = (status) => {
  const s = safeStr(status, null);
  if (!s) return null;
  if (s === "Ready for Dispatch") return "Packing in Process";
  return s;
};

function createDbRequest(db) {
  if (db && typeof db.request === "function") {
    return db.request();
  }
  return new sql.Request(db);
}

async function recordSerialMovement(db, movement = {}) {
  if (!db || !movement.serialNumberId || !movement.serialValue) return;

  await createDbRequest(db)
    .input("serialNumberId", sql.Int, Number(movement.serialNumberId))
    .input("serialValue", sql.NVarChar, String(movement.serialValue).trim())
    .input("dispatchId", sql.Int, movement.dispatchId ? Number(movement.dispatchId) : null)
    .input("actionType", sql.NVarChar, safeStr(movement.actionType, "StatusUpdated"))
    .input("status", sql.NVarChar, safeStr(movement.status, "Unknown"))
    .input("condition", sql.NVarChar, safeStr(movement.condition, null))
    .input("reason", sql.NVarChar, safeStr(movement.reason, null))
    .input("firmName", sql.NVarChar, safeStr(movement.firmName, null))
    .input("customerName", sql.NVarChar, safeStr(movement.customerName, null))
    .input("invoiceNumber", sql.NVarChar, safeStr(movement.invoiceNumber, null))
    .input("createdAt", sql.DateTime, movement.createdAt ? new Date(movement.createdAt) : new Date())
    .input("createdBy", sql.NVarChar, safeStr(movement.createdBy, "System"))
    .input("notes", sql.NVarChar, safeStr(movement.notes, null))
    .query(`
      INSERT INTO SerialMovements
        (
          serialNumberId, serialValue, dispatchId, actionType, status, condition,
          reason, firmName, customerName, invoiceNumber, createdAt, createdBy, notes
        )
      VALUES
        (
          @serialNumberId, @serialValue, @dispatchId, @actionType, @status, @condition,
          @reason, @firmName, @customerName, @invoiceNumber, @createdAt, @createdBy, @notes
        )
    `);
}

async function backfillSerialMovementsIfNeeded(pool) {
  const movementCount = await pool.request().query("SELECT COUNT(*) as total FROM SerialMovements");
  if ((movementCount.recordset[0]?.total || 0) > 0) return;

  await pool.request().query(`
    INSERT INTO SerialMovements
      (
        serialNumberId, serialValue, dispatchId, actionType, status, condition,
        reason, firmName, customerName, invoiceNumber, createdAt, createdBy, notes
      )
    SELECT
      d.serialNumberId,
      ISNULL(s.value, ''),
      d.id,
      'Dispatched',
      'Dispatched',
      NULL,
      NULL,
      d.firmName,
      COALESCE(d.customer, d.customerName),
      d.invoiceNumber,
      ISNULL(d.dispatchDate, GETDATE()),
      ISNULL(d.dispatchedBy, 'System'),
      CONCAT('Backfilled dispatch movement for order #', d.id)
    FROM Dispatches d
    LEFT JOIN Serials s ON s.id = d.serialNumberId
  `);

  await pool.request().query(`
    INSERT INTO SerialMovements
      (
        serialNumberId, serialValue, dispatchId, actionType, status, condition,
        reason, firmName, customerName, invoiceNumber, createdAt, createdBy, notes
      )
    SELECT
      r.serialNumberId,
      COALESCE(NULLIF(r.serialValue, ''), s.value, ''),
      r.dispatchId,
      'Returned',
      'Returned',
      r.condition,
      r.reason,
      COALESCE(r.firmName, d.firmName),
      COALESCE(r.customerName, d.customer, d.customerName),
      COALESCE(r.invoiceNumber, d.invoiceNumber),
      ISNULL(r.returnDate, GETDATE()),
      ISNULL(r.returnedBy, 'System'),
      CONCAT('Backfilled return movement from return record #', r.id)
    FROM Returns r
    LEFT JOIN Serials s ON s.id = r.serialNumberId
    LEFT JOIN Dispatches d ON d.id = r.dispatchId
    WHERE r.isDeleted = 0
  `);

  await pool.request().query(`
    INSERT INTO SerialMovements
      (
        serialNumberId, serialValue, dispatchId, actionType, status, condition,
        reason, firmName, customerName, invoiceNumber, createdAt, createdBy, notes
      )
    SELECT
      r.serialNumberId,
      COALESCE(NULLIF(r.serialValue, ''), s.value, ''),
      NULL,
      CASE WHEN r.condition = 'Damaged' THEN 'Damaged' ELSE 'InStock' END,
      CASE WHEN r.condition = 'Damaged' THEN 'Damaged' ELSE 'Available' END,
      r.condition,
      r.reason,
      COALESCE(r.firmName, d.firmName),
      COALESCE(r.customerName, d.customer, d.customerName),
      COALESCE(r.invoiceNumber, d.invoiceNumber),
      DATEADD(SECOND, 1, ISNULL(r.returnDate, GETDATE())),
      ISNULL(r.returnedBy, 'System'),
      CONCAT('Backfilled inventory movement from return record #', r.id)
    FROM Returns r
    LEFT JOIN Serials s ON s.id = r.serialNumberId
    LEFT JOIN Dispatches d ON d.id = r.dispatchId
    WHERE r.isDeleted = 0
  `);
}

async function columnExists(pool, tableName, columnName) {
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .input("columnName", sql.NVarChar, columnName)
    .query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @columnName
    `);
  return result.recordset[0].count > 0;
}

async function logUserActivity(pool, user, action, changes, ipAddress) {
  try {
    const details = JSON.stringify(changes);
    await pool.request()
      .input("userId", sql.Int, user.id)
      .input("username", sql.NVarChar, user.username)
      .input("role", sql.NVarChar, user.role)
      .input("action", sql.NVarChar, action)
      .input("details", sql.NVarChar, details)
      .input("ipAddress", sql.NVarChar, ipAddress)
      .query(`
        INSERT INTO UserActivityLogs (userId, username, role, action, details, ipAddress)
        VALUES (@userId, @username, @role, @action, @details, @ipAddress)
      `);
    console.log(`📝 Audit log created for user ${user.username}: ${action}`);
  } catch (logErr) {
    console.error("🔴 Failed to create audit log:", logErr.message);
    // We don't re-throw here to avoid failing the main operation if logging fails
  }
}

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(async (pool) => {
    console.log(`✅ Connected to SQL Server: ${DATABASE_NAME}`);

    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
        BEGIN
          CREATE TABLE Users (
            id INT IDENTITY(1,1) PRIMARY KEY,
            username NVARCHAR(255) NOT NULL UNIQUE,
            password NVARCHAR(255) NOT NULL,
            role NVARCHAR(50) NOT NULL DEFAULT 'User',
            authToken NVARCHAR(255) NULL,
            createdAt DATETIME DEFAULT GETDATE(),
            updatedAt DATETIME DEFAULT GETDATE()
          )
          PRINT '✅ Users Table Created Successfully'
        END
      `);

      const userColumns = [
        ["fullName", "NVARCHAR(255) NULL"],
        ["email", "NVARCHAR(255) NULL"],
        ["phone", "NVARCHAR(50) NULL"],
      ];

      for (const [col, type] of userColumns) {
        const exists = await columnExists(pool, 'Users', col);
        if (!exists) {
          await pool.request().query(`ALTER TABLE Users ADD ${col} ${type}`);
          console.log(`✅ Added ${col} column to Users`);
        }
      }

      const updatedAtExists = await columnExists(pool, 'Users', 'updatedAt');
      if (!updatedAtExists) {
          await pool.request().query(`ALTER TABLE Users ADD updatedAt DATETIME NOT NULL DEFAULT GETDATE()`);
          console.log(`✅ Added updatedAt column to Users`);
      }

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Payments' AND xtype='U')
        BEGIN
          CREATE TABLE Payments (
            id INT IDENTITY(1,1) PRIMARY KEY,
            dispatchId INT NOT NULL,
            paymentDate DATE,
            amount DECIMAL(18, 2),
            utrId NVARCHAR(255),
            createdAt DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (dispatchId) REFERENCES Dispatches(id) ON DELETE CASCADE
          )
          PRINT '✅ Payments Table Created Successfully'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Models' AND COLUMN_NAME = 'packagingCost')
        BEGIN
          ALTER TABLE Models ADD packagingCost DECIMAL(18, 2) DEFAULT 0 WITH VALUES
          PRINT '✅ Added packagingCost column to Models'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Dispatches' AND COLUMN_NAME = 'packagingCost')
        BEGIN
          ALTER TABLE Dispatches ADD packagingCost DECIMAL(18, 2) DEFAULT 0 WITH VALUES
          PRINT '✅ Added packagingCost column to Dispatches'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Dispatches' AND COLUMN_NAME = 'commission')
        BEGIN
          ALTER TABLE Dispatches ADD commission DECIMAL(18, 2) DEFAULT 0 WITH VALUES
          PRINT '✅ Added commission column to Dispatches'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'role')
        BEGIN
          ALTER TABLE Users ADD role NVARCHAR(50) NOT NULL DEFAULT 'User' WITH VALUES
          PRINT '✅ Added role column to Users'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'authToken')
        BEGIN
          ALTER TABLE Users ADD authToken NVARCHAR(255) NULL
          PRINT '✅ Added authToken column to Users'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'createdAt')
        BEGIN
          ALTER TABLE Users ADD createdAt DATETIME NOT NULL DEFAULT GETDATE() WITH VALUES
          PRINT '✅ Added createdAt column to Users'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'updatedAt')
        BEGIN
          ALTER TABLE Users ADD updatedAt DATETIME NOT NULL DEFAULT GETDATE() WITH VALUES
          PRINT '✅ Added updatedAt column to Users'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserActivityLogs' AND xtype='U')
        BEGIN
          CREATE TABLE UserActivityLogs (
            id INT IDENTITY(1,1) PRIMARY KEY,
            userId INT NOT NULL,
            username NVARCHAR(255) NOT NULL,
            role NVARCHAR(50) NOT NULL,
            action NVARCHAR(255) NOT NULL,
            details NVARCHAR(MAX) NULL, -- JSON string for changes
            changedAt DATETIME DEFAULT GETDATE(),
            ipAddress NVARCHAR(50) NULL,
            FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
          )
          PRINT '✅ UserActivityLogs Table Created Successfully'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Returns' AND xtype='U')
        BEGIN
          CREATE TABLE Returns (
            id INT IDENTITY(1,1) PRIMARY KEY,
            serialNumberId INT NOT NULL,
            condition NVARCHAR(50) DEFAULT 'Good',
            returnDate DATETIME DEFAULT GETDATE(),
            returnedBy NVARCHAR(255),
            firmName NVARCHAR(255),
            customerName NVARCHAR(255),
            isDeleted BIT DEFAULT 0,
            createdAt DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (serialNumberId) REFERENCES Serials(id) ON DELETE CASCADE
          )
          PRINT '✅ Returns Table Created Successfully'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'firmName')
        BEGIN
          ALTER TABLE Returns ADD firmName NVARCHAR(255) NULL
          PRINT '✅ Added firmName column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'customerName')
        BEGIN
          ALTER TABLE Returns ADD customerName NVARCHAR(255) NULL
          PRINT '✅ Added customerName column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'returnedBy')
        BEGIN
          ALTER TABLE Returns ADD returnedBy NVARCHAR(255) NULL
          PRINT '✅ Added returnedBy column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SavedReports' AND xtype='U')
        BEGIN
          CREATE TABLE SavedReports (
            id INT IDENTITY(1,1) PRIMARY KEY,
            reportType NVARCHAR(100) NOT NULL DEFAULT 'financial',
            reportLabel NVARCHAR(255) NULL,
            dateRange NVARCHAR(50) NOT NULL DEFAULT 'all',
            startDate DATETIME NULL,
            endDate DATETIME NULL,
            filtersJson NVARCHAR(MAX) NULL,
            summaryJson NVARCHAR(MAX) NULL,
            rowsJson NVARCHAR(MAX) NULL,
            reportRowCount INT NOT NULL DEFAULT 0,
            stockValue DECIMAL(18,2) NOT NULL DEFAULT 0,
            bookingValue DECIMAL(18,2) NOT NULL DEFAULT 0,
            revenue DECIMAL(18,2) NOT NULL DEFAULT 0,
            damageLoss DECIMAL(18,2) NOT NULL DEFAULT 0,
            netProfit DECIMAL(18,2) NOT NULL DEFAULT 0,
            deliveredCount INT NOT NULL DEFAULT 0,
            createdByUserId INT NULL,
            createdBy NVARCHAR(255) NULL,
            createdAt DATETIME NOT NULL DEFAULT GETDATE()
          )
          PRINT '✅ SavedReports Table Created Successfully'
        END
      `);

      const savedReportsRowCountExists = await columnExists(pool, "SavedReports", "reportRowCount");
      if (!savedReportsRowCountExists) {
        await pool.request().query(`
          ALTER TABLE SavedReports
          ADD reportRowCount INT NOT NULL DEFAULT 0 WITH VALUES
        `);
        console.log("✅ Added reportRowCount column to SavedReports");
      }

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavedReports_CreatedAt' AND object_id = OBJECT_ID('SavedReports'))
        BEGIN
          CREATE INDEX IX_SavedReports_CreatedAt
          ON SavedReports (createdAt DESC, id DESC)
          PRINT '✅ Added IX_SavedReports_CreatedAt index'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'createdAt')
        BEGIN
          ALTER TABLE Returns ADD createdAt DATETIME NOT NULL DEFAULT GETDATE() WITH VALUES
          PRINT '✅ Added createdAt column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'Dispatches' 
          AND COLUMN_NAME = 'ewayBillFilename'
        )
        BEGIN
          ALTER TABLE Dispatches ADD ewayBillFilename NVARCHAR(500) NULL
          PRINT '✅ Added ewayBillFilename column to Dispatches'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'repairCost')
        BEGIN
          ALTER TABLE Returns ADD repairCost DECIMAL(18, 2) DEFAULT 0 WITH VALUES
          PRINT '✅ Added repairCost column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'Serials' 
          AND COLUMN_NAME = 'landingPriceReason'
        )
        BEGIN
          ALTER TABLE Serials ADD landingPriceReason NVARCHAR(500) NULL
          PRINT '✅ Added landingPriceReason column to Serials'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Serials' AND COLUMN_NAME = 'returnCount')
        BEGIN
          ALTER TABLE Serials ADD returnCount INT DEFAULT 0 WITH VALUES
          PRINT '✅ Added returnCount column to Serials'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'returnCount')
        BEGIN
          ALTER TABLE Returns ADD returnCount INT DEFAULT 1 WITH VALUES
          PRINT '✅ Added returnCount column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'serialValue')
        BEGIN
          ALTER TABLE Returns ADD serialValue NVARCHAR(255) NULL
          PRINT '✅ Added serialValue column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'dispatchId')
        BEGIN
          ALTER TABLE Returns ADD dispatchId INT NULL
          PRINT '✅ Added dispatchId column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'invoiceNumber')
        BEGIN
          ALTER TABLE Returns ADD invoiceNumber NVARCHAR(255) NULL
          PRINT '✅ Added invoiceNumber column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Returns' AND COLUMN_NAME = 'reason')
        BEGIN
          ALTER TABLE Returns ADD reason NVARCHAR(MAX) NULL
          PRINT '✅ Added reason column to Returns'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SerialMovements' AND xtype='U')
        BEGIN
          CREATE TABLE SerialMovements (
            id INT IDENTITY(1,1) PRIMARY KEY,
            serialNumberId INT NOT NULL,
            serialValue NVARCHAR(255) NOT NULL,
            dispatchId INT NULL,
            actionType NVARCHAR(50) NOT NULL,
            status NVARCHAR(50) NOT NULL,
            condition NVARCHAR(50) NULL,
            reason NVARCHAR(MAX) NULL,
            firmName NVARCHAR(255) NULL,
            customerName NVARCHAR(255) NULL,
            invoiceNumber NVARCHAR(255) NULL,
            createdAt DATETIME DEFAULT GETDATE(),
            createdBy NVARCHAR(255) NULL,
            notes NVARCHAR(MAX) NULL,
            FOREIGN KEY (serialNumberId) REFERENCES Serials(id) ON DELETE CASCADE
          )
          PRINT '✅ SerialMovements Table Created Successfully'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SerialMovements_SerialCreatedAt' AND object_id = OBJECT_ID('SerialMovements'))
        BEGIN
          CREATE INDEX IX_SerialMovements_SerialCreatedAt
          ON SerialMovements (serialNumberId, createdAt DESC, id DESC)
          PRINT '✅ Added IX_SerialMovements_SerialCreatedAt index'
        END
      `);

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SerialMovements_DispatchCreatedAt' AND object_id = OBJECT_ID('SerialMovements'))
        BEGIN
          CREATE INDEX IX_SerialMovements_DispatchCreatedAt
          ON SerialMovements (dispatchId, createdAt DESC, id DESC)
          PRINT '✅ Added IX_SerialMovements_DispatchCreatedAt index'
        END
      `);

      // ✅ Additional columns needed by current frontend/service
      const extraColumns = [
        ["Dispatches", "courierPartner", "ALTER TABLE Dispatches ADD courierPartner NVARCHAR(255) NULL"],
        ["Dispatches", "logisticsDispatchDate", "ALTER TABLE Dispatches ADD logisticsDispatchDate DATETIME NULL"],
        ["Dispatches", "trackingId", "ALTER TABLE Dispatches ADD trackingId NVARCHAR(255) NULL"],
        ["Dispatches", "freightCharges", "ALTER TABLE Dispatches ADD freightCharges DECIMAL(18,2) DEFAULT 0 WITH VALUES"],
        ["Dispatches", "logisticsStatus", "ALTER TABLE Dispatches ADD logisticsStatus NVARCHAR(255) NULL"],
        ["Dispatches", "podFilename", "ALTER TABLE Dispatches ADD podFilename NVARCHAR(500) NULL"],
        ["Dispatches", "invoiceFilename", "ALTER TABLE Dispatches ADD invoiceFilename NVARCHAR(500) NULL"],
        ["Dispatches", "invoiceNumber", "ALTER TABLE Dispatches ADD invoiceNumber NVARCHAR(255) NULL"],
        ["Dispatches", "ewayBillNumber", "ALTER TABLE Dispatches ADD ewayBillNumber NVARCHAR(255) NULL"],
        ["Dispatches", "gemBillUploaded", "ALTER TABLE Dispatches ADD gemBillUploaded NVARCHAR(255) NULL"],
        ["Dispatches", "remarks", "ALTER TABLE Dispatches ADD remarks NVARCHAR(MAX) NULL"],
        ["Dispatches", "customer", "ALTER TABLE Dispatches ADD customer NVARCHAR(255) NULL"],
        ["Dispatches", "address", "ALTER TABLE Dispatches ADD address NVARCHAR(MAX) NULL"],
        ["Dispatches", "installationDate", "ALTER TABLE Dispatches ADD installationDate DATETIME NULL"],
        ["Dispatches", "cancelReason", "ALTER TABLE Dispatches ADD cancelReason NVARCHAR(MAX) NULL"],
        ["Dispatches", "cancelledBy", "ALTER TABLE Dispatches ADD cancelledBy NVARCHAR(255) NULL"],
        ["Dispatches", "cancelledAt", "ALTER TABLE Dispatches ADD cancelledAt DATETIME NULL"],
      ];

      for (const [table, col, query] of extraColumns) {
        const exists = await columnExists(pool, table, col);
        if (!exists) {
          await pool.request().query(query);
          console.log(`✅ Added ${col} column to ${table}`);
        }
      }

      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrderDocuments' AND xtype='U')
        BEGIN
          CREATE TABLE OrderDocuments (
            id INT IDENTITY(1,1) PRIMARY KEY,
            dispatchId INT NOT NULL,
            docType NVARCHAR(100) NOT NULL,
            filename NVARCHAR(500) NOT NULL,
            createdAt DATETIME DEFAULT GETDATE(),
            FOREIGN KEY (dispatchId) REFERENCES Dispatches(id) ON DELETE CASCADE
          )
          PRINT '✅ OrderDocuments Table Created Successfully'
        END
      `);

      await backfillSerialMovementsIfNeeded(pool);
    } catch (tblErr) {
      console.error("⚠️ Error checking/creating tables or columns:", tblErr.message);
    }

    return pool;
  })
  .catch((err) => {
    console.error("❌ Database Connection Failed!", err);
  });

async function getPool(res) {
  const pool = await poolPromise;
  if (!pool) {
    if (res) res.status(500).json({ message: "Database not connected" });
    return null;
  }
  return pool;
}

function normalizeRole(role) {
  const value = safeStr(role, "User");
  const matchedRole = VALID_ROLES.find(
    (item) => item.toLowerCase() === String(value).toLowerCase()
  );
  return matchedRole || "User";
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    fullName: user.fullName || null,
    email: user.email || null,
    phone: user.phone || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function generateAuthToken() {
  return crypto.randomBytes(48).toString("hex");
}

async function getUserCount(pool) {
  const result = await pool.request().query("SELECT COUNT(*) as total FROM Users");
  return Number(result.recordset[0]?.total || 0);
}

async function getUserByToken(pool, token) {
  const result = await pool
    .request()
    .input("authToken", sql.NVarChar, token)
    .query("SELECT TOP 1 * FROM Users WHERE authToken = @authToken");
  return result.recordset[0] || null;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

async function attachAuthenticatedUser(req, res, next) {
  if (!req.path.startsWith("/api")) {
    return next();
  }

  const token = getBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const pool = await getPool();
    if (!pool) {
      req.user = null;
      return next();
    }

    const user = await getUserByToken(pool, token);
    req.user = user ? sanitizeUser(user) : null;
    return next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

function requireRoles(roles, message = "You do not have permission to perform this action.") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const role = normalizeRole(req.user.role);
    if (!roles.includes(role)) {
      return res.status(403).json({ message });
    }

    return next();
  };
}

function authorizeReadWrite({
  readRoles = ALL_AUTHENTICATED_ROLES,
  writeRoles = [],
  deleteRoles = null,
  denyMessage = "You do not have permission to perform this action.",
}) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const role = normalizeRole(req.user.role);
    const method = req.method.toUpperCase();
    const safeDeleteRoles = deleteRoles || writeRoles;
    const allowedRoles =
      method === "GET" || method === "HEAD" || method === "OPTIONS"
        ? readRoles
        : method === "DELETE"
          ? safeDeleteRoles
          : writeRoles;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: denyMessage });
    }

    return next();
  };
}

const ACCOUNTANT_DISPATCH_FIELDS = new Set([
  "id",
  "ids",
  "status",
  "invoiceNumber",
  "ewayBillNumber",
  "gemBillUploaded",
  "invoiceFilename",
  "ewayBillFilename",
  "logisticsStatus",
  "commission",
]);

const ACCOUNTANT_ALLOWED_DISPATCH_STATUSES = new Set([
  "Send for Billing",
  "Billed",
  "Payment Pending",
  "Completed",
]);

const ACCOUNTANT_ALLOWED_LOGISTICS_STATUSES = new Set([
  null,
  "",
  "Packing in Process",
  "Delivered",
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getDispatchUpdatePayloads(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.updates)) return body.updates;
  if (isPlainObject(body?.updates)) return [body.updates];
  if (isPlainObject(body)) return [body];
  return [];
}

function isAccountantDispatchUpdateAllowed(update) {
  if (!isPlainObject(update)) return false;

  const keys = Object.keys(update).filter((key) => update[key] !== undefined);
  if (keys.length === 0) return false;
  if (!keys.every((key) => ACCOUNTANT_DISPATCH_FIELDS.has(key))) return false;

  if (
    update.status !== undefined &&
    !ACCOUNTANT_ALLOWED_DISPATCH_STATUSES.has(normalizeBusinessStatus(update.status))
  ) {
    return false;
  }

  if (
    update.logisticsStatus !== undefined &&
    !ACCOUNTANT_ALLOWED_LOGISTICS_STATUSES.has(normalizeLogisticsStatus(update.logisticsStatus))
  ) {
    return false;
  }

  return true;
}

function isAccountantDispatchRequest(req) {
  const updates = getDispatchUpdatePayloads(req.body);
  return updates.length > 0 && updates.every(isAccountantDispatchUpdateAllowed);
}

function isSameDateTimeValue(a, b) {
  const left = safeDate(a);
  const right = safeDate(b);
  return (left ? new Date(left).getTime() : null) === (right ? new Date(right).getTime() : null);
}

function isSameStringValue(a, b) {
  return safeStr(a, "") === safeStr(b, "");
}

function isSameNumericValue(a, b) {
  return Number(a ?? 0) === Number(b ?? 0);
}

function hasDeliveredLogisticsFieldChange(fields, current) {
  return (
    (fields.dispatchDate !== undefined && !isSameDateTimeValue(fields.dispatchDate, current.dispatchDate)) ||
    (fields.courierPartner !== undefined && !isSameStringValue(fields.courierPartner, current.courierPartner)) ||
    (fields.logisticsDispatchDate !== undefined && !isSameDateTimeValue(fields.logisticsDispatchDate, current.logisticsDispatchDate)) ||
    (fields.trackingId !== undefined && !isSameStringValue(fields.trackingId, current.trackingId)) ||
    (fields.freightCharges !== undefined && !isSameNumericValue(fields.freightCharges, current.freightCharges)) ||
    (fields.podFilename !== undefined && !isSameStringValue(fields.podFilename, current.podFilename)) ||
    (fields.packagingCost !== undefined && !isSameNumericValue(fields.packagingCost, current.packagingCost))
  );
}

function authorizeDispatchRequest(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const role = normalizeRole(req.user.role);
  const method = req.method.toUpperCase();

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  if (role === "Admin" || role === "User" || role === "Operator") {
    return next();
  }

  if (role === "Accountant" && method === "PUT" && isAccountantDispatchRequest(req)) {
    return next();
  }

  return res.status(403).json({
    message: "This dispatch action is not allowed for your role.",
  });
}

function canManageOrderDocuments(role, docType) {
  const normalizedDocType = safeStr(docType, "");

  if (role === "Admin") return true;
  if (role === "Accountant") {
    return ["invoice", "ewayBill", "pod"].includes(normalizedDocType);
  }
  if (role === "User" || role === "Operator") {
    return ["gemContract", "pod"].includes(normalizedDocType);
  }
  return false;
}

function authorizeOrdersRequest(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const role = normalizeRole(req.user.role);
  const method = req.method.toUpperCase();

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  if (req.path.endsWith("/payment") || req.path.endsWith("/batch-payment")) {
    if (role === "Admin" || role === "Accountant") {
      return next();
    }
    return res.status(403).json({ message: "Only Admin or Accountant can update payments." });
  }

  if (req.path.endsWith("/upload")) {
    if (role === "Admin" || role === "Accountant" || role === "User" || role === "Operator") {
      return next();
    }
    return res.status(403).json({ message: "You cannot upload order documents." });
  }

  if (req.path.endsWith("/status")) {
    if (role === "Admin" || role === "User" || role === "Operator") {
      return next();
    }
    return res.status(403).json({ message: "Only Admin or Operators can update order status." });
  }

  if (req.path.endsWith("/replace")) {
    if (role === "Admin" || role === "User" || role === "Operator") {
      return next();
    }
    return res.status(403).json({ message: "Only Admin or Operators can replace orders." });
  }

  return res.status(403).json({ message: "This order action is not allowed for your role." });
}

app.use(attachAuthenticatedUser);

// =============================================
// =============== PROFILE ROUTES ==============
// =============================================
app.get("/api/auth/profile", requireAuth, async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool
      .request()
      .input("id", sql.Int, req.user.id)
      .query("SELECT id, username, role, fullName, email, phone, createdAt FROM Users WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/auth/profile", requireAuth, async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    console.log(`🔄 User ${req.user.username} is updating profile. Changes:`, { fullName, email, phone, password: password ? "***" : undefined });
    const pool = await getPool(res);
    if (!pool) return;

    const userResult = await pool.request().input("id", sql.Int, req.user.id).query("SELECT * FROM Users WHERE id = @id");
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    const currentUser = userResult.recordset[0];

    const changes = [];
    const updatedFields = {};

    const nextFullName = safeStr(fullName);
    const nextEmail = safeStr(email);
    const nextPhone = safeStr(phone);

    if (fullName !== undefined && nextFullName !== currentUser.fullName) {
      changes.push({ field: 'fullName', oldValue: currentUser.fullName, newValue: nextFullName });
      updatedFields.fullName = nextFullName;
    }
    if (email !== undefined && nextEmail !== currentUser.email) {
      changes.push({ field: 'email', oldValue: currentUser.email, newValue: nextEmail });
      updatedFields.email = nextEmail;
    }
    if (phone !== undefined && nextPhone !== currentUser.phone) {
      changes.push({ field: 'phone', oldValue: currentUser.phone, newValue: nextPhone });
      updatedFields.phone = nextPhone;
    }
    if (password !== undefined && password !== "" && password !== currentUser.password) {
      changes.push({ field: 'password', oldValue: '***', newValue: '***' });
      updatedFields.password = password;
    }

    if (changes.length > 0) {
      const setClauses = Object.keys(updatedFields).map(key => `${key} = @${key}`);
      const request = pool.request().input("id", sql.Int, req.user.id);
      Object.entries(updatedFields).forEach(([key, value]) => {
        request.input(key, sql.NVarChar, value);
      });

      await request.query(`UPDATE Users SET ${setClauses.join(", ")}, updatedAt = GETDATE() WHERE id = @id`);
      
      await logUserActivity(pool, req.user, 'Profile Update', changes, req.ip);
    }

    // Fetch updated user to send back to the frontend
    const updatedUserResult = await pool.request().input("id", sql.Int, req.user.id).query("SELECT * FROM Users WHERE id = @id");

    res.json({ 
      message: "Profile updated successfully.", 
      user: sanitizeUser(updatedUserResult.recordset[0]) 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== PASSWORD ROUTE ==============
// =============================================
app.put(["/api/auth/password", "/api/auth/change-password"], requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new password are required." });
    }

    const userResult = await pool.request().input("id", sql.Int, req.user.id).query("SELECT * FROM Users WHERE id = @id");
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    const currentUser = userResult.recordset[0];

    if (currentUser.password !== oldPassword) {
      return res.status(400).json({ message: "Incorrect old password." });
    }

    await pool.request()
      .input("id", sql.Int, req.user.id)
      .input("password", sql.NVarChar, newPassword)
      .query("UPDATE Users SET password = @password, updatedAt = GETDATE() WHERE id = @id");

    await logUserActivity(pool, req.user, 'Password Change', [{ field: 'password', oldValue: '***', newValue: '***' }], req.ip);

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/activity-logs", requireRoles(["Admin"]), async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query("SELECT * FROM UserActivityLogs ORDER BY changedAt DESC");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.use("/api/users", requireRoles(["Admin"], "Admin access required."));
app.use(
  "/api/models",
  authorizeReadWrite({
    readRoles: ["Admin", "Supervisor", "Accountant", "User", "Operator"],
    writeRoles: ["Admin", "User", "Operator"],
    deleteRoles: ["Admin"],
    denyMessage: "Only Admin or Operators can manage models.",
  })
);
app.use(
  "/api/serials",
  authorizeReadWrite({
    readRoles: ["Admin", "Supervisor", "Accountant", "User", "Operator"],
    writeRoles: ["Admin", "User", "Operator"],
    deleteRoles: ["Admin"],
    denyMessage: "Only Admin or Operators can manage serials.",
  })
);
app.use("/api/dispatches", authorizeDispatchRequest);
app.use(
  "/api/installations",
  authorizeReadWrite({
    readRoles: ["Admin", "Supervisor", "User", "Operator"],
    writeRoles: ["Admin", "User", "Operator"],
    denyMessage: "Only Admin or Operators can manage installations.",
  })
);
app.use("/api/returns", (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const role = normalizeRole(req.user.role);
  const method = req.method.toUpperCase();

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    if (["Admin", "Supervisor", "User", "Operator"].includes(role)) {
      return next();
    }
    return res.status(403).json({ message: "You do not have access to returns." });
  }

  if (method === "DELETE") {
    if (role === "Admin") {
      return next();
    }
    return res.status(403).json({ message: "Only Admin can delete return records." });
  }

  if (role === "Admin" || role === "User" || role === "Operator") {
    return next();
  }

  return res.status(403).json({ message: "Only Admin or Operators can manage returns." });
});
app.use(
  "/api/reports",
  authorizeReadWrite({
    readRoles: ["Admin", "Supervisor", "Accountant"],
    writeRoles: ["Admin", "Accountant"],
    denyMessage: "You do not have access to reports.",
  })
);
app.use("/api/orders", authorizeOrdersRequest);
app.use(
  "/api/dashboard",
  authorizeReadWrite({
    readRoles: ALL_AUTHENTICATED_ROLES,
    writeRoles: [],
    denyMessage: "You do not have access to dashboard data.",
  })
);
app.use(
  "/api/search",
  authorizeReadWrite({
    readRoles: ALL_AUTHENTICATED_ROLES,
    writeRoles: [],
    denyMessage: "You do not have access to search.",
  })
);
app.use(
  "/api/export",
  authorizeReadWrite({
    readRoles: ["Admin", "Supervisor", "Accountant", "User", "Operator"],
    writeRoles: [],
    denyMessage: "You do not have access to exports.",
  })
);

// =============================================
// =============== AUTH ROUTES =================
// =============================================
app.get("/api/auth/bootstrap-status", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const totalUsers = await getUserCount(pool);
    res.json({ setupRequired: totalUsers === 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const safeUsername = safeStr(username, "");
    const safePassword = safeStr(password, "");

    if (!safeUsername || !safePassword) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const pool = await getPool(res);
    if (!pool) return;

    const totalUsers = await getUserCount(pool);
    if (totalUsers > 0 && normalizeRole(req.user?.role) !== "Admin") {
      return res.status(403).json({ message: "Only Admin can create users." });
    }

    const requestedRole = totalUsers === 0 ? "Admin" : normalizeRole(role);

    const check = await pool
      .request()
      .input("username", sql.NVarChar, safeUsername)
      .query("SELECT id FROM Users WHERE username = @username");

    if (check.recordset.length > 0) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const insertResult = await pool
      .request()
      .input("username", sql.NVarChar, safeUsername)
      .input("password", sql.NVarChar, safePassword)
      .input("role", sql.NVarChar, requestedRole)
      .query(`
        INSERT INTO Users (username, password, role, createdAt, updatedAt)
        OUTPUT INSERTED.*
        VALUES (@username, @password, @role, GETDATE(), GETDATE())
      `);

    res.json({
      message: totalUsers === 0 ? "Admin account created successfully." : "User created successfully.",
      user: sanitizeUser(insertResult.recordset[0]),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool
      .request()
      .input("username", sql.NVarChar, safeStr(username, ""))
      .input("password", sql.NVarChar, safeStr(password, ""))
      .query("SELECT TOP 1 * FROM Users WHERE username = @username AND password = @password");

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.recordset[0];
    const authToken = generateAuthToken();

    await pool
      .request()
      .input("id", sql.Int, user.id)
      .input("authToken", sql.NVarChar, authToken)
      .query(`
        UPDATE Users
        SET authToken = @authToken, updatedAt = GETDATE()
        WHERE id = @id
      `);

    await logUserActivity(pool, { id: user.id, username: user.username, role: user.role }, 'Login', [{ field: 'session', newValue: 'Started' }], req.ip);

    res.json({
      token: authToken,
      user: sanitizeUser({ ...user, authToken }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    await pool
      .request()
      .input("id", sql.Int, req.user.id)
      .query("UPDATE Users SET authToken = NULL, updatedAt = GETDATE() WHERE id = @id");

    await logUserActivity(pool, req.user, 'Logout', [{ field: 'session', newValue: 'Ended' }], req.ip);

    res.json({ message: "Logged out successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== USER ROUTES =================
// =============================================
app.get("/api/users", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT id, username, role, createdAt, updatedAt
      FROM Users
      ORDER BY createdAt DESC, id DESC
    `);

    res.json(result.recordset.map(sanitizeUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { username, password, role, fullName, email, phone } = req.body;
    const safeUsername = safeStr(username, "");
    const safePassword = safeStr(password, "");

    if (!safeUsername || !safePassword) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const pool = await getPool(res);
    if (!pool) return;

    const check = await pool
      .request()
      .input("username", sql.NVarChar, safeUsername)
      .query("SELECT id FROM Users WHERE username = @username");

    if (check.recordset.length > 0) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const result = await pool
      .request()
      .input("username", sql.NVarChar, safeUsername)
      .input("password", sql.NVarChar, safePassword)
      .input("role", sql.NVarChar, normalizeRole(role))
      .input("fullName", sql.NVarChar, safeStr(fullName, null))
      .input("email", sql.NVarChar, safeStr(email, null))
      .input("phone", sql.NVarChar, safeStr(phone, null))
      .query(`
        INSERT INTO Users (username, password, role, fullName, email, phone, createdAt, updatedAt)
        OUTPUT INSERTED.*
        VALUES (@username, @password, @role, @fullName, @email, @phone, GETDATE(), GETDATE())
      `);

    res.json({ message: "User created successfully.", user: sanitizeUser(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, fullName, email, phone } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const existingResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Users WHERE id = @id");

    if (existingResult.recordset.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const existingUser = existingResult.recordset[0];
    const nextUsername = safeStr(username, existingUser.username);
    const nextPassword = safeStr(password, existingUser.password);
    const nextRole = normalizeRole(role || existingUser.role);
    const nextFullName = safeStr(fullName, existingUser.fullName);
    const nextEmail = safeStr(email, existingUser.email);
    const nextPhone = safeStr(phone, existingUser.phone);

    const duplicateResult = await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.NVarChar, nextUsername)
      .query("SELECT id FROM Users WHERE username = @username AND id <> @id");

    if (duplicateResult.recordset.length > 0) {
      return res.status(400).json({ message: "Username already exists." });
    }

    if (Number(id) === Number(req.user.id) && nextRole !== "Admin") {
      return res.status(400).json({ message: "You cannot remove your own Admin access." });
    }

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.NVarChar, nextUsername)
      .input("password", sql.NVarChar, nextPassword)
      .input("role", sql.NVarChar, nextRole)
      .input("fullName", sql.NVarChar, nextFullName)
      .input("email", sql.NVarChar, nextEmail)
      .input("phone", sql.NVarChar, nextPhone)
      .query(`
        UPDATE Users
        SET username = @username,
            password = @password,
            role = @role,
            fullName = @fullName,
            email = @email,
            phone = @phone,
            updatedAt = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    res.json({ message: "User updated successfully.", user: sanitizeUser(result.recordset[0]) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(res);
    if (!pool) return;

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const remainingAdmins = await pool.request().query(`
      SELECT COUNT(*) as total
      FROM Users
      WHERE role = 'Admin'
    `);

    const targetResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Users WHERE id = @id");

    if (targetResult.recordset.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const targetUser = targetResult.recordset[0];
    if (normalizeRole(targetUser.role) === "Admin" && Number(remainingAdmins.recordset[0]?.total || 0) <= 1) {
      return res.status(400).json({ message: "At least one Admin account must remain." });
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Users WHERE id = @id");

    res.json({ message: "User deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== MODEL ROUTES ================
// =============================================
app.get("/api/models", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        m.*,
        ISNULL(stock.availableCount, 0) as stockCount
      FROM Models m 
      LEFT JOIN (
        SELECT
          modelId,
          COUNT(*) as availableCount
        FROM Serials
        WHERE status = 'Available' AND isDeleted = 0
        GROUP BY modelId
      ) stock ON stock.modelId = m.id
      WHERE m.isDeleted = 0
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/models", async (req, res) => {
  try {
    const { name, company, category, colorType, printerType, description, mrp, isSerialized, stockQuantity, packagingCost } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    await pool
      .request()
      .input("name", sql.NVarChar, name)
      .input("company", sql.NVarChar, company)
      .input("category", sql.NVarChar, category)
      .input("colorType", sql.NVarChar, colorType || "Monochrome")
      .input("printerType", sql.NVarChar, printerType || "Multi-Function")
      .input("description", sql.NVarChar, description)
      .input("mrp", sql.Int, mrp || 0)
      .input("isSerialized", sql.Bit, isSerialized !== false)
      .input("stockQuantity", sql.Int, stockQuantity || 0)
      .input("packagingCost", sql.Decimal(18, 2), packagingCost || 0)
      .query(`
        INSERT INTO Models (name, company, category, colorType, printerType, description, mrp, isSerialized, stockQuantity, packagingCost, isDeleted) 
        VALUES (@name, @company, @category, @colorType, @printerType, @description, @mrp, @isSerialized, @stockQuantity, @packagingCost, 0)
      `);

    res.json({ message: "Model added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/models/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, category, colorType, printerType, description, mrp, isSerialized, stockQuantity, packagingCost } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar, name)
      .input("company", sql.NVarChar, company)
      .input("category", sql.NVarChar, category)
      .input("colorType", sql.NVarChar, colorType || "Monochrome")
      .input("printerType", sql.NVarChar, printerType || "Multi-Function")
      .input("description", sql.NVarChar, description)
      .input("mrp", sql.Int, mrp || 0)
      .input("isSerialized", sql.Bit, isSerialized !== false)
      .input("stockQuantity", sql.Int, stockQuantity || 0)
      .input("packagingCost", sql.Decimal(18, 2), packagingCost || 0)
      .query(`
        UPDATE Models SET 
          name = @name, 
          company = @company, 
          category = @category,
          colorType = @colorType,
          printerType = @printerType,
          description = @description, 
          mrp = @mrp,
          isSerialized = @isSerialized,
          stockQuantity = @stockQuantity,
          packagingCost = @packagingCost
        WHERE id = @id AND isDeleted = 0
      `);

    res.json({ message: "Model updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/models/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(res);
    if (!pool) return;

    const check = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT COUNT(*) as count FROM Serials WHERE modelId = @id AND isDeleted = 0");

    if (check.recordset[0].count > 0)
      return res.status(400).json({ message: "Cannot delete: Model has active serials." });

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("UPDATE Models SET isDeleted = 1 WHERE id = @id");

    res.json({ message: "Model deleted (soft)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/models/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const idArray = Array.isArray(ids) ? ids : [ids];
    const results = { success: [], failed: [] };

    for (const id of idArray) {
      try {
        const check = await pool
          .request()
          .input("id", sql.Int, id)
          .query("SELECT COUNT(*) as count FROM Serials WHERE modelId = @id AND isDeleted = 0");

        if (check.recordset[0].count > 0) {
          results.failed.push({ id, reason: "Has active serials" });
          continue;
        }

        await pool
          .request()
          .input("id", sql.Int, id)
          .query("UPDATE Models SET isDeleted = 1 WHERE id = @id");

        results.success.push(id);
      } catch (err) {
        results.failed.push({ id, reason: err.message });
      }
    }

    res.json({ message: "Bulk delete completed", results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== SERIAL ROUTES ===============
// =============================================

// ✅ FIXED 1: Added JOIN to Models so frontend gets modelName and companyName
app.get("/api/serials", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        s.*, 
        m.name as modelName, 
        m.company as companyName,
        m.category as modelCategory,
        latestReturn.reason as latestReturnReason,
        latestReturn.returnDate as latestReturnDate,
        latestReturn.condition as latestReturnCondition
      FROM Serials s
      LEFT JOIN Models m ON s.modelId = m.id
      OUTER APPLY (
        SELECT TOP 1
          r.reason,
          r.returnDate,
          r.condition
        FROM Returns r
        WHERE r.serialNumberId = s.id AND r.isDeleted = 0
        ORDER BY r.returnDate DESC, r.id DESC
      ) latestReturn
      WHERE s.isDeleted = 0 
      ORDER BY s.createdAt DESC, s.id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/serials", async (req, res) => {
  try {
    const { modelId, value, landingPrice, landingPriceReason } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const check = await pool
      .request()
      .input("value", sql.NVarChar, value)
      .query("SELECT * FROM Serials WHERE value = @value");

    if (check.recordset.length > 0)
      return res.status(400).json({ message: "Serial exists!" });

    const modelCheck = await pool
      .request()
      .input("modelId", sql.Int, modelId)
      .query("SELECT mrp FROM Models WHERE id = @modelId AND isDeleted = 0");

    if (modelCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Model not found" });
    }

    const modelMRP = Number(modelCheck.recordset[0].mrp) || 0;
    const lp = Number(landingPrice) || 0;

    if (lp > modelMRP && modelMRP > 0) {
      if (!landingPriceReason || !landingPriceReason.trim()) {
        return res.status(400).json({
          message: `Landing Price (₹${lp.toLocaleString('en-IN')}) exceeds MRP (₹${modelMRP.toLocaleString('en-IN')}). Please provide a reason.`,
          requiresReason: true,
          landingPrice: lp,
          mrp: modelMRP
        });
      }
    }

    // ✅ FIXED 2: Explicitly adding GETDATE() for createdAt
    await pool
      .request()
      .input("modelId", sql.Int, modelId)
      .input("value", sql.NVarChar, value)
      .input("landingPrice", sql.Int, landingPrice || 0)
      .input("landingPriceReason", sql.NVarChar,
        (lp > modelMRP && modelMRP > 0) ? (landingPriceReason || '').trim() : null
      )
      .query(`
        INSERT INTO Serials (modelId, value, landingPrice, landingPriceReason, status, isDeleted, createdAt) 
        VALUES (@modelId, @value, @landingPrice, @landingPriceReason, 'Available', 0, GETDATE())
      `);

    res.json({ message: "Serial added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/serials/:id", async (req, res) => {
  try {
    const { value, landingPrice, modelId, landingPriceReason } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const modelCheck = await pool
      .request()
      .input("modelId", sql.Int, modelId)
      .query("SELECT mrp FROM Models WHERE id = @modelId AND isDeleted = 0");

    if (modelCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Model not found" });
    }

    const modelMRP = Number(modelCheck.recordset[0].mrp) || 0;
    const lp = Number(landingPrice) || 0;

    if (lp > modelMRP && modelMRP > 0) {
      if (!landingPriceReason || !landingPriceReason.trim()) {
        return res.status(400).json({
          message: `Landing Price (₹${lp.toLocaleString('en-IN')}) exceeds MRP (₹${modelMRP.toLocaleString('en-IN')}). Please provide a reason.`,
          requiresReason: true,
          landingPrice: lp,
          mrp: modelMRP
        });
      }
    }

    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .input("value", sql.NVarChar, value?.trim())
      .input("landingPrice", sql.Decimal(10, 2), landingPrice || 0)
      .input("modelId", sql.Int, modelId)
      .input("landingPriceReason", sql.NVarChar,
        (lp > modelMRP && modelMRP > 0) ? (landingPriceReason || '').trim() : null
      )
      .query(`
        UPDATE Serials SET 
          value = @value, 
          landingPrice = @landingPrice, 
          modelId = @modelId,
          landingPriceReason = @landingPriceReason
        WHERE id = @id
      `);

    res.json({ message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/serials/:id", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE Serials SET isDeleted = 1 WHERE id = @id");

    res.json({ message: "Deleted (soft)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/serials/bulk", async (req, res) => {
  try {
    const { serials } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const results = { success: [], failed: [] };

    for (const serial of serials) {
      try {
        const existing = await pool
          .request()
          .input("value", sql.NVarChar, serial.value?.trim())
          .query("SELECT id FROM Serials WHERE value = @value AND isDeleted = 0");

        if (existing.recordset.length > 0) {
          results.failed.push({ value: serial.value, reason: "Already exists" });
          continue;
        }

        const modelCheck = await pool
          .request()
          .input("modelId", sql.Int, serial.modelId)
          .query("SELECT mrp FROM Models WHERE id = @modelId AND isDeleted = 0");

        let reasonValue = null;
        if (modelCheck.recordset.length > 0) {
          const modelMRP = Number(modelCheck.recordset[0].mrp) || 0;
          const lp = Number(serial.landingPrice) || 0;

          if (lp > modelMRP && modelMRP > 0) {
            if (!serial.landingPriceReason || !serial.landingPriceReason.trim()) {
              results.failed.push({
                value: serial.value,
                reason: `Landing Price (₹${lp}) exceeds MRP (₹${modelMRP}). Reason required.`,
                requiresReason: true
              });
              continue;
            }
            reasonValue = serial.landingPriceReason.trim();
          }
        }

        // ✅ FIXED 3: Explicitly adding GETDATE() for createdAt in bulk add
        const result = await pool
          .request()
          .input("modelId", sql.Int, serial.modelId)
          .input("value", sql.NVarChar, serial.value?.trim())
          .input("landingPrice", sql.Decimal(10, 2), serial.landingPrice || 0)
          .input("landingPriceReason", sql.NVarChar, reasonValue)
          .query(`
            INSERT INTO Serials (modelId, value, landingPrice, landingPriceReason, status, isDeleted, createdAt) 
            OUTPUT INSERTED.id 
            VALUES (@modelId, @value, @landingPrice, @landingPriceReason, 'Available', 0, GETDATE())
          `);

        results.success.push({ id: result.recordset[0].id, value: serial.value });
      } catch (err) {
        results.failed.push({ value: serial.value, reason: err.message });
      }
    }

    res.json({ message: "Bulk add completed", results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/serials/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const idArray = Array.isArray(ids) ? ids : [ids];

    for (const id of idArray) {
      await pool
        .request()
        .input("id", sql.Int, id)
        .query("UPDATE Serials SET isDeleted = 1 WHERE id = @id");
    }

    res.json({ message: "Bulk deleted (soft)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ EXCEL UPLOAD FOR SERIALS (UPDATED WITH FIXES)
// =============================================
app.post("/api/serials/upload-excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Receive targetModelId from frontend (For Model Filter)
    const targetModelId = req.body.targetModelId ? Number(req.body.targetModelId) : null;

    const pool = await getPool(res);
    if (!pool) return;

    // Read the Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log('📊 Excel data received:', data.length, 'rows');
    if (targetModelId) console.log('🎯 Target Model Filter Applied:', targetModelId);

    if (data.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Excel file is empty" });
    }

    const results = { 
      success: [], 
      failed: [],
      skipped: [], // ✅ Added skipped array for Model Filter
      totalRows: data.length 
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const modelIdValue = row.modelId || row.modelid || row.ModelId || row['Model ID'] || row['model_id'];
        const serialValue = row.value || row.Value || row.serialNumber || row.SerialNumber || row['Serial Number'] || row['Serial No'] || row['serial_number'] || row['serial'];
        
        // ✅ SMART LANDING PRICE EXTRACTOR (Ignores spaces, case, and formatting)
        const lpKey = Object.keys(row).find(key => 
            key.toLowerCase().replace(/[^a-z]/g, '') === 'landingprice'
        );
        const rawLandingPrice = lpKey ? row[lpKey] : 0;
        
        const statusValue = row.status || row.Status || 'Available';
        const reasonValue = row.landingPriceReason || row.LandingPriceReason || row.reason || row.Reason || row['Reason'] || null;

        if (!modelIdValue || !serialValue) {
          results.failed.push({
            row: rowNumber,
            serialNumber: serialValue || 'N/A',
            reason: 'Missing required fields: modelId or value (Serial Number)'
          });
          continue;
        }

        const modelId = Number(modelIdValue);

        // ✅ APPLY MODEL FILTER (If user selected a specific model)
        if (targetModelId && modelId !== targetModelId) {
            results.skipped.push({
                row: rowNumber,
                serialNumber: serialValue || 'N/A',
                reason: `Skipped (Filter applied - Not matching selected model)`
            });
            continue; // Skip this row and go to next
        }

        const trimmedSerial = String(serialValue).trim();
        
        // ✅ CLEAN LANDING PRICE (Removes commas, ₹, spaces)
        let cleanLp = 0;
        if (rawLandingPrice !== undefined && rawLandingPrice !== null && rawLandingPrice !== '') {
            const strVal = String(rawLandingPrice).replace(/[^0-9.]/g, ''); // Extract only numbers
            cleanLp = Number(strVal);
        }
        const landingPrice = isNaN(cleanLp) ? 0 : cleanLp;

        const status = String(statusValue).trim() || 'Available';
        const landingPriceReason = reasonValue ? String(reasonValue).trim() : null;

        // Check if model exists
        const modelCheck = await pool
          .request()
          .input("modelId", sql.Int, modelId)
          .query("SELECT id, mrp, name FROM Models WHERE id = @modelId AND isDeleted = 0");

        if (modelCheck.recordset.length === 0) {
          results.failed.push({
            row: rowNumber,
            serialNumber: trimmedSerial,
            reason: `Model ID ${modelId} not found`
          });
          continue;
        }

        const model = modelCheck.recordset[0];
        const modelMRP = Number(model.mrp) || 0;

        // Check if serial already exists
        const serialCheck = await pool
          .request()
          .input("value", sql.NVarChar, trimmedSerial)
          .query("SELECT id FROM Serials WHERE value = @value");

        if (serialCheck.recordset.length > 0) {
          results.failed.push({
            row: rowNumber,
            serialNumber: trimmedSerial,
            reason: 'Serial number already exists'
          });
          continue;
        }

        // Validate landing price vs MRP
        let finalLandingPriceReason = null;
        if (landingPrice > modelMRP && modelMRP > 0) {
          if (!landingPriceReason) {
            results.failed.push({
              row: rowNumber,
              serialNumber: trimmedSerial,
              reason: `Landing Price (₹${landingPrice.toLocaleString('en-IN')}) exceeds MRP (₹${modelMRP.toLocaleString('en-IN')}). Reason required.`,
              requiresReason: true
            });
            continue;
          }
          finalLandingPriceReason = landingPriceReason;
        }

        // Insert serial with explicit GETDATE() for createdAt
        const insertResult = await pool
          .request()
          .input("modelId", sql.Int, modelId)
          .input("value", sql.NVarChar, trimmedSerial)
          .input("landingPrice", sql.Decimal(10, 2), landingPrice)
          .input("status", sql.NVarChar, status)
          .input("landingPriceReason", sql.NVarChar, finalLandingPriceReason)
          .query(`
            INSERT INTO Serials (modelId, value, landingPrice, status, landingPriceReason, isDeleted, createdAt) 
            OUTPUT INSERTED.id
            VALUES (@modelId, @value, @landingPrice, @status, @landingPriceReason, 0, GETDATE())
          `);

        results.success.push({
          row: rowNumber,
          id: insertResult.recordset[0].id,
          serialNumber: trimmedSerial,
          modelId: modelId,
          modelName: model.name
        });

      } catch (err) {
        console.error(`Error processing row ${rowNumber}:`, err.message);
        results.failed.push({
          row: rowNumber,
          serialNumber: row.value || 'N/A',
          reason: err.message
        });
      }
    }

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Upload completed. Success: ${results.success.length}, Failed: ${results.failed.length}, Skipped: ${results.skipped.length}`,
      results
    });

  } catch (err) {
    console.error('Excel upload error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: err.message });
  }
});

// ✅ Download Excel Template with Models List
app.get("/api/serials/download-template", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    // Get all models for reference
    const modelsResult = await pool.request().query(`
      SELECT id, name, company, mrp 
      FROM Models 
      WHERE isDeleted = 0 
      ORDER BY name
    `);

    // Create template sheet
    const templateData = [
      {
        modelId: 1,
        value: 'SAMPLE-SER-001',
        landingPrice: 25000,
        status: 'Available',
        landingPriceReason: ''
      }
    ];

    // Create models reference sheet
    const modelsData = modelsResult.recordset.map(m => ({
      'Model ID': m.id,
      'Model Name': m.name,
      'Company': m.company,
      'MRP': m.mrp
    }));

    const workbook = xlsx.utils.book_new();

    // Template sheet
    const templateSheet = xlsx.utils.json_to_sheet(templateData);
    templateSheet['!cols'] = [
      { wch: 10 },  // modelId
      { wch: 25 },  // value
      { wch: 15 },  // landingPrice
      { wch: 12 },  // status
      { wch: 30 }   // landingPriceReason
    ];
    xlsx.utils.book_append_sheet(workbook, templateSheet, 'Upload Data');

    // Models reference sheet
    const modelsSheet = xlsx.utils.json_to_sheet(modelsData);
    modelsSheet['!cols'] = [
      { wch: 10 },  // Model ID
      { wch: 30 },  // Model Name
      { wch: 20 },  // Company
      { wch: 12 }   // MRP
    ];
    xlsx.utils.book_append_sheet(workbook, modelsSheet, 'Models Reference');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=serial_upload_template.xlsx');
    res.send(buffer);

  } catch (err) {
    console.error('Template download error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Export Serials to Excel
app.get("/api/serials/export-excel", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        s.id,
        s.modelId,
        m.name as modelName,
        m.company,
        s.value as serialNumber,
        s.landingPrice,
        m.mrp,
        s.status,
        s.landingPriceReason,
        s.createdAt
      FROM Serials s
      JOIN Models m ON s.modelId = m.id
      WHERE s.isDeleted = 0 AND m.isDeleted = 0
      ORDER BY s.createdAt DESC
    `);

    const data = result.recordset.map(row => ({
      'ID': row.id,
      'Model ID': row.modelId,
      'Model Name': row.modelName,
      'Company': row.company,
      'Serial Number': row.serialNumber,
      'Landing Price': row.landingPrice,
      'MRP': row.mrp,
      'Status': row.status,
      'Price Reason': row.landingPriceReason || '',
      'Created At': row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : ''
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 8 },   // ID
      { wch: 10 },  // Model ID
      { wch: 25 },  // Model Name
      { wch: 15 },  // Company
      { wch: 25 },  // Serial Number
      { wch: 15 },  // Landing Price
      { wch: 12 },  // MRP
      { wch: 12 },  // Status
      { wch: 25 },  // Price Reason
      { wch: 20 }   // Created At
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Serials');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `serials_export_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== DISPATCH ROUTES =============
// =============================================
app.get("/api/dispatches", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const { includeDeleted } = req.query;

    let query = `
      SELECT 
        d.*,
        s.value as serialValue,
        s.modelId,
        s.landingPrice,
        m.name as modelName,
        m.company as companyName,
        m.category as modelCategory,
        p.paymentDate as paymentReceivedDate,
        p.amount as paymentReceivedAmount,
        p.utrId
      FROM Dispatches d
      LEFT JOIN Serials s ON d.serialNumberId = s.id
      LEFT JOIN Models m ON s.modelId = m.id
      LEFT JOIN Payments p ON d.id = p.dispatchId
    `;

    if (includeDeleted === "false") query += " WHERE d.isDeleted = 0";
    query += " ORDER BY d.dispatchDate DESC";

    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/dispatches/:id", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT 
          d.*,
          s.value as serialValue,
          s.modelId,
          s.landingPrice,
          m.name as modelName,
          m.company as companyName,
          m.category as modelCategory,
          p.paymentDate as paymentReceivedDate,
          p.amount as paymentReceivedAmount,
          p.utrId
        FROM Dispatches d
        LEFT JOIN Serials s ON d.serialNumberId = s.id
        LEFT JOIN Models m ON s.modelId = m.id
        LEFT JOIN Payments p ON d.id = p.dispatchId
        WHERE d.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Dispatch not found" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/dispatches/stats", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as totalDispatches,
        SUM(CASE WHEN isDeleted = 0 THEN 1 ELSE 0 END) as activeDispatches,
        SUM(CASE WHEN isDeleted = 1 THEN 1 ELSE 0 END) as cancelledDispatches,
        SUM(CASE WHEN isDeleted = 0 THEN sellingPrice ELSE 0 END) as totalRevenue,
        SUM(CASE WHEN isDeleted = 1 THEN sellingPrice ELSE 0 END) as cancelledRevenue,
        SUM(CASE WHEN (installationRequired = 1 OR installationRequired = 'true') AND isDeleted = 0 THEN 1 ELSE 0 END) as withInstallation,
        SUM(CASE WHEN (installationRequired = 1 OR installationRequired = 'true') AND installationStatus IN ('Pending', 'Scheduled') AND isDeleted = 0 THEN 1 ELSE 0 END) as pendingInstallation
      FROM Dispatches
    `);

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/dispatches", async (req, res) => {
  try {
    const {
      serialId,
      firmName,
      customer,
      customerName,
      address,
      shippingAddress,
      user,
      sellingPrice,
      status,
      orderVerified,
      orderType,
      gemOrderType,
      bidNo,
      bidNumber,
      orderDate,
      lastDeliveryDate,
      gstNumber,
      contactNumber,
      altContactNumber,
      buyerEmail,
      consigneeEmail,
      contractFile,
      contractFilename,
      installationRequired,
      installationStatus,
      technicianName,
      technicianContact,
      installationCharges,
      installationRemarks,
      scheduledDate,
      packagingCost,
      commission,
      courierPartner,
      logisticsDispatchDate,
      trackingId,
      freightCharges,
      logisticsStatus,
      podFilename,
      ewayBillFilename,
      remarks
    } = req.body;

    const pool = await getPool(res);
    if (!pool) return;

    const serialCheck = await pool
      .request()
      .input("id", sql.Int, serialId)
      .query(`
        SELECT s.status, s.value as serialValue, m.packagingCost as modelDefaultCost 
        FROM Serials s
        JOIN Models m ON s.modelId = m.id
        WHERE s.id = @id
      `);

    if (serialCheck.recordset.length === 0)
      return res.status(404).json({ message: "Serial not found" });

    const serialData = serialCheck.recordset[0];

    if (serialData.status !== "Available")
      return res.status(400).json({ message: "Serial is not available" });

    const finalPackagingCost =
      packagingCost !== undefined && packagingCost !== "" && packagingCost !== null
        ? Number(packagingCost)
        : Number(serialData.modelDefaultCost || 0);

    const finalStatus = normalizeBusinessStatus(status);
    const finalLogisticsStatus = normalizeLogisticsStatus(logisticsStatus);

    await pool
      .request()
      .input("id", sql.Int, serialId)
      .query("UPDATE Serials SET status = 'Dispatched' WHERE id = @id");

    const dispatchInsertResult = await pool
      .request()
      .input("serialId", sql.Int, serialId)
      .input("firmName", sql.NVarChar, firmName)
      .input("customer", sql.NVarChar, safeStr(customer || customerName, ""))
      .input("customerName", sql.NVarChar, safeStr(customerName || customer, ""))
      .input("address", sql.NVarChar, safeStr(address || shippingAddress, null))
      .input("shippingAddress", sql.NVarChar, safeStr(shippingAddress || address, null))
      .input("user", sql.NVarChar, user)
      .input("sellingPrice", sql.Decimal(18, 2), sellingPrice || 0)
      .input("status", sql.NVarChar, finalStatus)
      .input("gemOrderType", sql.NVarChar, orderType || gemOrderType || null)
      .input("bidNumber", sql.NVarChar, bidNo || bidNumber || null)
      .input("orderDate", sql.Date, safeDate(orderDate))
      .input("lastDeliveryDate", sql.Date, safeDate(lastDeliveryDate))
      .input("gstNumber", sql.NVarChar, gstNumber || null)
      .input("contactNumber", sql.NVarChar, contactNumber || null)
      .input("altContactNumber", sql.NVarChar, altContactNumber || null)
      .input("buyerEmail", sql.NVarChar, buyerEmail || null)
      .input("consigneeEmail", sql.NVarChar, consigneeEmail || null)
      .input("orderVerified", sql.NVarChar, orderVerified || "No")
      .input("contractFilename", sql.NVarChar, contractFile || contractFilename || null)
      .input("installationRequired", sql.Bit, toBit(installationRequired) ? 1 : 0)
      .input("installationStatus", sql.NVarChar, toBit(installationRequired) ? (installationStatus || "Pending") : null)
      .input("technicianName", sql.NVarChar, technicianName || null)
      .input("technicianContact", sql.NVarChar, technicianContact || null)
      .input("installationCharges", sql.Decimal(18, 2), installationCharges || 0)
      .input("installationRemarks", sql.NVarChar, installationRemarks || null)
      .input("scheduledDate", sql.DateTime, safeDate(scheduledDate))
      .input("packagingCost", sql.Decimal(18, 2), finalPackagingCost)
      .input("commission", sql.Decimal(18, 2), commission || 0)
      .input("courierPartner", sql.NVarChar, courierPartner || null)
      .input("logisticsDispatchDate", sql.DateTime, safeDate(logisticsDispatchDate))
      .input("trackingId", sql.NVarChar, trackingId || null)
      .input("freightCharges", sql.Decimal(18, 2), freightCharges || 0)
      .input("logisticsStatus", sql.NVarChar, finalLogisticsStatus)
      .input("podFilename", sql.NVarChar, podFilename || null)
      .input("ewayBillFilename", sql.NVarChar, ewayBillFilename || null)
      .input("remarks", sql.NVarChar, remarks || null)
      .query(`
        INSERT INTO Dispatches 
          (
            serialNumberId, firmName, customer, customerName, address, shippingAddress, dispatchedBy,
            sellingPrice, status, isDeleted, gemOrderType, bidNumber, orderDate, lastDeliveryDate,
            gstNumber, contactNumber, altContactNumber, buyerEmail, consigneeEmail, orderVerified,
            contractFilename, installationRequired, installationStatus, technicianName, technicianContact,
            installationCharges, installationRemarks, scheduledDate, packagingCost, commission,
            courierPartner, logisticsDispatchDate, trackingId, freightCharges, logisticsStatus,
            podFilename, ewayBillFilename, remarks, dispatchDate
          )
        OUTPUT INSERTED.id
        VALUES 
          (
            @serialId, @firmName, @customer, @customerName, @address, @shippingAddress, @user,
            @sellingPrice, @status, 0, @gemOrderType, @bidNumber, @orderDate, @lastDeliveryDate,
            @gstNumber, @contactNumber, @altContactNumber, @buyerEmail, @consigneeEmail, @orderVerified,
            @contractFilename, @installationRequired, @installationStatus, @technicianName, @technicianContact,
            @installationCharges, @installationRemarks, @scheduledDate, @packagingCost, @commission,
            @courierPartner, @logisticsDispatchDate, @trackingId, @freightCharges, @logisticsStatus,
            @podFilename, @ewayBillFilename, @remarks, GETDATE()
          )
      `);

    const dispatchId = dispatchInsertResult.recordset[0]?.id;

    await recordSerialMovement(pool, {
      serialNumberId: serialId,
      serialValue: serialData.serialValue,
      dispatchId,
      actionType: "Dispatched",
      status: "Dispatched",
      firmName,
      customerName: safeStr(customerName || customer, null),
      createdBy: user || "System",
      notes: `Assigned to order #${dispatchId}`
    });

    res.json({ message: "Dispatched successfully" });
  } catch (err) {
    console.error("Dispatch error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/dispatches/bulk", async (req, res) => {
  const { items } = req.body;
  const pool = await poolPromise;
  if (!pool) return res.status(500).json({ message: "Database not connected" });

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    for (const item of items) {
      let finalPackagingCost = 0;
      let serialValue = "";
      if (item.packagingCost !== undefined && item.packagingCost !== null && item.packagingCost !== '') {
        finalPackagingCost = Number(item.packagingCost);
      } else {
        const modelCheckReq = new sql.Request(transaction);
        const modelRes = await modelCheckReq
          .input("sId", sql.Int, item.serialId)
          .query(`
            SELECT m.packagingCost 
            FROM Models m 
            JOIN Serials s ON s.modelId = m.id 
            WHERE s.id = @sId
          `);
        if (modelRes.recordset.length > 0) {
          finalPackagingCost = modelRes.recordset[0].packagingCost || 0;
        }
      }

      const serialInfoReq = new sql.Request(transaction);
      const serialInfo = await serialInfoReq
        .input("sId", sql.Int, item.serialId)
        .query("SELECT value FROM Serials WHERE id = @sId");
      serialValue = serialInfo.recordset[0]?.value || "";

      const request = new sql.Request(transaction);
      await request
        .input("sId", sql.Int, item.serialId)
        .query("UPDATE Serials SET status = 'Dispatched' WHERE id = @sId");

      const request2 = new sql.Request(transaction);
      const dispatchInsertResult = await request2
        .input("serialId", sql.Int, item.serialId)
        .input("firmName", sql.NVarChar, item.firmName)
        .input("customer", sql.NVarChar, safeStr(item.customer || item.customerName, ""))
        .input("customerName", sql.NVarChar, safeStr(item.customerName || item.customer, ""))
        .input("address", sql.NVarChar, safeStr(item.address || item.shippingAddress, null))
        .input("shippingAddress", sql.NVarChar, safeStr(item.shippingAddress || item.address, null))
        .input("user", sql.NVarChar, item.user)
        .input("sellingPrice", sql.Decimal(18, 2), item.sellingPrice || 0)
        .input("status", sql.NVarChar, normalizeBusinessStatus(item.status || "Pending"))
        .input("gemOrderType", sql.NVarChar, item.orderType || item.gemOrderType || null)
        .input("bidNumber", sql.NVarChar, item.bidNo || item.bidNumber || null)
        .input("orderDate", sql.Date, safeDate(item.orderDate))
        .input("lastDeliveryDate", sql.Date, safeDate(item.lastDeliveryDate))
        .input("gstNumber", sql.NVarChar, item.gstNumber || null)
        .input("contactNumber", sql.NVarChar, item.contactNumber || null)
        .input("altContactNumber", sql.NVarChar, item.altContactNumber || null)
        .input("buyerEmail", sql.NVarChar, item.buyerEmail || null)
        .input("consigneeEmail", sql.NVarChar, item.consigneeEmail || null)
        .input("orderVerified", sql.NVarChar, item.orderVerified || "No")
        .input("contractFilename", sql.NVarChar, item.contractFile || item.contractFilename || null)
        .input("installationRequired", sql.Bit, toBit(item.installationRequired) ? 1 : 0)
        .input("installationStatus", sql.NVarChar, toBit(item.installationRequired) ? (item.installationStatus || "Pending") : null)
        .input("technicianName", sql.NVarChar, item.technicianName || null)
        .input("technicianContact", sql.NVarChar, item.technicianContact || null)
        .input("installationCharges", sql.Decimal(18, 2), item.installationCharges || 0)
        .input("installationRemarks", sql.NVarChar, item.installationRemarks || null)
        .input("scheduledDate", sql.DateTime, safeDate(item.scheduledDate))
        .input("packagingCost", sql.Decimal(18, 2), finalPackagingCost)
        .input("commission", sql.Decimal(18, 2), item.commission || 0)
        .input("courierPartner", sql.NVarChar, item.courierPartner || null)
        .input("logisticsDispatchDate", sql.DateTime, safeDate(item.logisticsDispatchDate))
        .input("trackingId", sql.NVarChar, item.trackingId || null)
        .input("freightCharges", sql.Decimal(18, 2), item.freightCharges || 0)
        .input("logisticsStatus", sql.NVarChar, normalizeLogisticsStatus(item.logisticsStatus))
        .input("podFilename", sql.NVarChar, item.podFilename || null)
        .input("ewayBillFilename", sql.NVarChar, item.ewayBillFilename || null)
        .input("remarks", sql.NVarChar, item.remarks || null)
        .query(`
          INSERT INTO Dispatches 
            (
              serialNumberId, firmName, customer, customerName, address, shippingAddress, dispatchedBy,
              sellingPrice, status, isDeleted, gemOrderType, bidNumber, orderDate, lastDeliveryDate,
              gstNumber, contactNumber, altContactNumber, buyerEmail, consigneeEmail, orderVerified,
              contractFilename, installationRequired, installationStatus, technicianName, technicianContact,
              installationCharges, installationRemarks, scheduledDate, packagingCost, commission,
              courierPartner, logisticsDispatchDate, trackingId, freightCharges, logisticsStatus,
              podFilename, ewayBillFilename, remarks, dispatchDate
            )
          OUTPUT INSERTED.id
          VALUES 
            (
              @serialId, @firmName, @customer, @customerName, @address, @shippingAddress, @user,
              @sellingPrice, @status, 0, @gemOrderType, @bidNumber, @orderDate, @lastDeliveryDate,
              @gstNumber, @contactNumber, @altContactNumber, @buyerEmail, @consigneeEmail, @orderVerified,
              @contractFilename, @installationRequired, @installationStatus, @technicianName, @technicianContact,
              @installationCharges, @installationRemarks, @scheduledDate, @packagingCost, @commission,
              @courierPartner, @logisticsDispatchDate, @trackingId, @freightCharges, @logisticsStatus,
              @podFilename, @ewayBillFilename, @remarks, GETDATE()
            )
        `);

      const dispatchId = dispatchInsertResult.recordset[0]?.id;

      await recordSerialMovement(transaction, {
        serialNumberId: item.serialId,
        serialValue,
        dispatchId,
        actionType: "Dispatched",
        status: "Dispatched",
        firmName: item.firmName,
        customerName: safeStr(item.customerName || item.customer, null),
        createdBy: item.user || "System",
        notes: `Assigned to order #${dispatchId}`
      });
    }

    await transaction.commit();
    res.json({ message: "Bulk Dispatch Successful" });
  } catch (err) {
    await transaction.rollback();
    console.error("Bulk dispatch error:", err);
    res.status(500).json({ message: "Bulk dispatch failed.", error: err.message });
  }
});

app.put("/api/dispatches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firmName,
      customer,
      customerName,
      address,
      shippingAddress,
      sellingPrice,
      serialId,
      status,
      dispatchDate,
      courierPartner,
      logisticsDispatchDate,
      trackingId,
      freightCharges,
      logisticsStatus,
      podFilename,
      invoiceNumber,
      ewayBillNumber,
      gemBillUploaded,
      invoiceFilename,
      installationRequired,
      installationStatus,
      technicianName,
      technicianContact,
      installationCharges,
      installationRemarks,
      scheduledDate,
      installationDate,
      packagingCost,
      commission,
      ewayBillFilename,
      contactNumber,
      altContactNumber,
      buyerEmail,
      consigneeEmail,
      gstNumber,
      contractFilename,
      remarks
    } = req.body;

    const pool = await getPool(res);
    if (!pool) return;

    const dispatchCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Dispatches WHERE id = @id AND isDeleted = 0");

    if (dispatchCheck.recordset.length === 0)
      return res.status(404).json({ message: "Dispatch not found" });

    const current = dispatchCheck.recordset[0];

    if (serialId && serialId !== current.serialNumberId) {
      const oldSerialInfoRes = await pool
        .request()
        .input("id", sql.Int, current.serialNumberId)
        .query("SELECT value FROM Serials WHERE id = @id");
      const newSerialInfoRes = await pool
        .request()
        .input("id", sql.Int, serialId)
        .query("SELECT value FROM Serials WHERE id = @id");
      const oldSerialValue = oldSerialInfoRes.recordset[0]?.value || "";
      const newSerialValue = newSerialInfoRes.recordset[0]?.value || "";

      await pool
        .request()
        .input("oldId", sql.Int, current.serialNumberId)
        .query("UPDATE Serials SET status = 'Available' WHERE id = @oldId AND status = 'Dispatched'");

      await pool
        .request()
        .input("newId", sql.Int, serialId)
        .query("UPDATE Serials SET status = 'Dispatched' WHERE id = @newId");

      await recordSerialMovement(pool, {
        serialNumberId: current.serialNumberId,
        serialValue: oldSerialValue,
        dispatchId: null,
        actionType: "ReassignedOut",
        status: "Available",
        firmName: current.firmName,
        customerName: safeStr(current.customerName || current.customer, null),
        createdBy: safeStr(req.body.user || req.body.updatedBy || current.dispatchedBy, "System"),
        notes: `Removed from order #${id} during serial reassignment`
      });

      await recordSerialMovement(pool, {
        serialNumberId: serialId,
        serialValue: newSerialValue,
        dispatchId: id,
        actionType: "ReassignedIn",
        status: "Dispatched",
        firmName: firmName ?? current.firmName,
        customerName: safeStr(customerName ?? customer ?? current.customerName ?? current.customer, null),
        createdBy: safeStr(req.body.user || req.body.updatedBy || current.dispatchedBy, "System"),
        notes: `Assigned to order #${id} during serial reassignment`
      });
    }

    const finalInstallationRequired =
      installationRequired === undefined
        ? current.installationRequired
        : (toBit(installationRequired) ? 1 : 0);

    const currentLogisticsStatus = normalizeLogisticsStatus(current.logisticsStatus);
    let finalStatus = status !== undefined ? normalizeBusinessStatus(status) : current.status;
    const finalLogisticsStatus = logisticsStatus !== undefined ? normalizeLogisticsStatus(logisticsStatus) : current.logisticsStatus;

    if (finalLogisticsStatus === "Delivered" && !safeStr(podFilename ?? current.podFilename, "")) {
      return res.status(400).json({ message: "POD is required before marking status as Delivered." });
    }

    if (currentLogisticsStatus === "Delivered" && hasDeliveredLogisticsFieldChange({
      dispatchDate,
      courierPartner,
      logisticsDispatchDate,
      trackingId,
      freightCharges,
      podFilename,
      packagingCost
    }, current)) {
      return res.status(400).json({ message: "Once logistics status is Delivered, only the status can be changed." });
    }

    // If logistics status is set to Delivered, set business status to Payment Pending (unless already completed or cancelled)
    if (finalLogisticsStatus === 'Delivered' && finalStatus !== 'Completed' && finalStatus !== 'Order Cancelled') {
      finalStatus = 'Payment Pending';
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("firmName", sql.NVarChar, firmName ?? current.firmName)
      .input("customer", sql.NVarChar, safeStr(customer ?? customerName ?? current.customer ?? current.customerName, null))
      .input("customerName", sql.NVarChar, safeStr(customerName ?? customer ?? current.customerName ?? current.customer, null))
      .input("address", sql.NVarChar, safeStr(address ?? shippingAddress ?? current.address ?? current.shippingAddress, null))
      .input("shippingAddress", sql.NVarChar, safeStr(shippingAddress ?? address ?? current.shippingAddress ?? current.address, null))
      .input("sellingPrice", sql.Decimal(18, 2), sellingPrice ?? current.sellingPrice)
      .input("serialId", sql.Int, serialId ?? current.serialNumberId)
      .input("status", sql.NVarChar, finalStatus)
      .input("dispatchDate", sql.DateTime, dispatchDate !== undefined ? safeDate(dispatchDate) : current.dispatchDate)
      .input("courierPartner", sql.NVarChar, courierPartner ?? current.courierPartner)
      .input("logisticsDispatchDate", sql.DateTime, logisticsDispatchDate !== undefined ? safeDate(logisticsDispatchDate) : current.logisticsDispatchDate)
      .input("trackingId", sql.NVarChar, trackingId ?? current.trackingId)
      .input("freightCharges", sql.Decimal(18, 2), freightCharges ?? current.freightCharges)
      .input("logisticsStatus", sql.NVarChar, finalLogisticsStatus)
      .input("podFilename", sql.NVarChar, podFilename ?? current.podFilename)
      .input("invoiceNumber", sql.NVarChar, invoiceNumber ?? current.invoiceNumber)
      .input("ewayBillNumber", sql.NVarChar, ewayBillNumber ?? current.ewayBillNumber)
      .input("gemBillUploaded", sql.NVarChar, gemBillUploaded ?? current.gemBillUploaded)
      .input("invoiceFilename", sql.NVarChar, invoiceFilename ?? current.invoiceFilename)
      .input("installationRequired", sql.Bit, finalInstallationRequired)
      .input("installationStatus", sql.NVarChar, installationStatus ?? current.installationStatus)
      .input("technicianName", sql.NVarChar, technicianName ?? current.technicianName)
      .input("technicianContact", sql.NVarChar, technicianContact ?? current.technicianContact)
      .input("installationCharges", sql.Decimal(18, 2), installationCharges ?? current.installationCharges)
      .input("installationRemarks", sql.NVarChar, installationRemarks ?? current.installationRemarks)
      .input("scheduledDate", sql.DateTime, scheduledDate !== undefined ? safeDate(scheduledDate) : current.scheduledDate)
      .input("installationDate", sql.DateTime, installationDate !== undefined ? safeDate(installationDate) : current.installationDate)
      .input("packagingCost", sql.Decimal(18, 2), packagingCost ?? current.packagingCost)
      .input("commission", sql.Decimal(18, 2), commission ?? current.commission)
      .input("ewayBillFilename", sql.NVarChar, ewayBillFilename ?? current.ewayBillFilename)
      .input("contactNumber", sql.NVarChar, contactNumber ?? current.contactNumber)
      .input("altContactNumber", sql.NVarChar, altContactNumber ?? current.altContactNumber)
      .input("buyerEmail", sql.NVarChar, buyerEmail ?? current.buyerEmail)
      .input("consigneeEmail", sql.NVarChar, consigneeEmail ?? current.consigneeEmail)
      .input("gstNumber", sql.NVarChar, gstNumber ?? current.gstNumber)
      .input("contractFilename", sql.NVarChar, contractFilename ?? current.contractFilename)
      .input("remarks", sql.NVarChar, remarks ?? current.remarks)
      .query(`
        UPDATE Dispatches SET 
          firmName = @firmName,
          customer = @customer,
          customerName = @customerName,
          address = @address,
          shippingAddress = @shippingAddress,
          sellingPrice = @sellingPrice,
          serialNumberId = @serialId,
          status = @status,
          dispatchDate = @dispatchDate,
          courierPartner = @courierPartner,
          logisticsDispatchDate = @logisticsDispatchDate,
          trackingId = @trackingId,
          freightCharges = @freightCharges,
          logisticsStatus = @logisticsStatus,
          podFilename = @podFilename,
          invoiceNumber = @invoiceNumber,
          ewayBillNumber = @ewayBillNumber,
          gemBillUploaded = @gemBillUploaded,
          invoiceFilename = @invoiceFilename,
          installationRequired = @installationRequired,
          installationStatus = @installationStatus,
          technicianName = @technicianName,
          technicianContact = @technicianContact,
          installationCharges = @installationCharges,
          installationRemarks = @installationRemarks,
          scheduledDate = @scheduledDate,
          installationDate = @installationDate,
          packagingCost = @packagingCost,
          commission = @commission,
          ewayBillFilename = @ewayBillFilename,
          contactNumber = @contactNumber,
          altContactNumber = @altContactNumber,
          buyerEmail = @buyerEmail,
          consigneeEmail = @consigneeEmail,
          gstNumber = @gstNumber,
          contractFilename = @contractFilename,
          remarks = @remarks
        WHERE id = @id AND isDeleted = 0
      `);

    res.json({ message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/dispatches", async (req, res) => {
  try {
    const { updates } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: "updates must be an array" });
    }

    const results = { success: [], failed: [] };

    for (const update of updates) {
      try {
        const { id, ...fields } = update;
        if (!id) {
          results.failed.push("unknown");
          continue;
        }

        const currentRes = await pool
          .request()
          .input("id", sql.Int, id)
          .query("SELECT * FROM Dispatches WHERE id = @id");

        if (currentRes.recordset.length === 0) {
          results.failed.push(id);
          continue;
        }

        const current = currentRes.recordset[0];

        const finalLogisticsStatus =
          fields.logisticsStatus !== undefined
            ? normalizeLogisticsStatus(fields.logisticsStatus)
            : normalizeLogisticsStatus(current.logisticsStatus);

        if (finalLogisticsStatus === "Delivered" && !safeStr(fields.podFilename ?? current.podFilename, "")) {
          results.failed.push(id);
          continue;
        }

        if (
          normalizeLogisticsStatus(current.logisticsStatus) === "Delivered" &&
          hasDeliveredLogisticsFieldChange(fields, current)
        ) {
          results.failed.push(id);
          continue;
        }

        const request = pool.request();
        request.input("id", sql.Int, id);

        const setClauses = [];

        for (const [key, rawValue] of Object.entries(fields)) {
          let value = rawValue;
          let type = sql.NVarChar;

          if (key === "status") value = normalizeBusinessStatus(value);
          if (key === "logisticsStatus") value = normalizeLogisticsStatus(value);

          switch (key) {
            case "sellingPrice":
            case "freightCharges":
            case "installationCharges":
            case "packagingCost":
            case "commission":
              type = sql.Decimal(18, 2);
              value = safeNum(value);
              break;

            case "installationRequired":
            case "isDeleted":
              type = sql.Bit;
              value = toBit(value);
              break;

            case "serialNumberId":
            case "serialId":
              type = sql.Int;
              value = Number(value);
              break;

            case "logisticsDispatchDate":
            case "dispatchDate":
            case "scheduledDate":
            case "installationDate":
            case "cancelledAt":
              type = sql.DateTime;
              value = safeDate(value);
              break;

            case "orderDate":
            case "lastDeliveryDate":
              type = sql.Date;
              value = safeDate(value);
              break;

            default:
              type = sql.NVarChar;
              value = value === undefined ? null : value;
          }

          const columnName = key === "serialId" ? "serialNumberId" : key;
          request.input(columnName, type, value);
          setClauses.push(`${columnName} = @${columnName}`);
        }

        // If logisticsStatus is being set to Delivered, set status to Payment Pending if not already set
        if (fields.logisticsStatus && finalLogisticsStatus === 'Delivered' && !fields.status && current.status !== 'Completed' && current.status !== 'Order Cancelled') {
          request.input('status', sql.NVarChar, 'Payment Pending');
          setClauses.push('status = @status');
        }

        if (setClauses.length === 0) {
          results.success.push(id);
          continue;
        }

        if (fields.serialId && Number(fields.serialId) !== Number(current.serialNumberId)) {
          await pool
            .request()
            .input("oldId", sql.Int, current.serialNumberId)
            .query("UPDATE Serials SET status = 'Available' WHERE id = @oldId");

          await pool
            .request()
            .input("newId", sql.Int, fields.serialId)
            .query("UPDATE Serials SET status = 'Dispatched' WHERE id = @newId");
        }

        await request.query(`UPDATE Dispatches SET ${setClauses.join(", ")} WHERE id = @id`);
        results.success.push(id);
      } catch (err) {
        console.error("Bulk update failed for id:", update?.id, err.message);
        results.failed.push(update.id || "unknown");
      }
    }

    res.json({ message: "Bulk update completed", results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update this section in your index.js
app.put("/api/dispatches/cancel", async (req, res) => {
  try {
    const { ids, reason, cancelledBy } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const results = { success: [], updatedOrders: [], failed: [] };

    for (const id of ids) {
      try {
        const dispatch = await pool
          .request()
          .input("id", sql.Int, id)
          .query("SELECT serialNumberId FROM Dispatches WHERE id = @id");

        if (dispatch.recordset.length > 0) {
          // 1. Release the serial number back to inventory
          await pool
            .request()
            .input("serialId", sql.Int, dispatch.recordset[0].serialNumberId)
            .query("UPDATE Serials SET status = 'Available' WHERE id = @serialId");

          // 2. Mark as Cancelled but DO NOT set isDeleted = 1 if you want it in main views,
          // OR update the frontend to fetch items where isDeleted = 1.
          // Recommended: Keep isDeleted = 0 but status = 'Order Cancelled'
          await pool
            .request()
            .input("id", sql.Int, id)
            .input("reason", sql.NVarChar, reason || "No reason")
            .input("cancelledBy", sql.NVarChar, cancelledBy || "Unknown")
            .query(`
              UPDATE Dispatches SET 
                status = 'Order Cancelled',
                cancelReason = @reason, 
                cancelledBy = @cancelledBy, 
                cancelledAt = GETDATE() 
              WHERE id = @id
            `);

          // 3. Fetch the updated order to send back to frontend
          const updatedOrder = await pool.request()
            .input("id", sql.Int, id)
            .query("SELECT * FROM Dispatches WHERE id = @id");
          
          results.updatedOrders.push(updatedOrder.recordset[0]);
          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    res.json({ 
      message: "Cancellation successful", 
      results,
      // Sending the updated orders back so frontend can sync immediately
      updatedData: results.updatedOrders 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/dispatches", async (req, res) => {
  try {
    const { ids, reason, cancelledBy } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const idArray = Array.isArray(ids) ? ids : [ids];
    const results = { success: [], failed: [] };

    for (const id of idArray) {
      try {
        const dispatch = await pool
          .request()
          .input("id", sql.Int, id)
          .query("SELECT serialNumberId FROM Dispatches WHERE id = @id");

        if (dispatch.recordset.length > 0) {
          await pool
            .request()
            .input("serialId", sql.Int, dispatch.recordset[0].serialNumberId)
            .query("UPDATE Serials SET status = 'Available' WHERE id = @serialId");

          await pool
            .request()
            .input("id", sql.Int, id)
            .input("reason", sql.NVarChar, reason || "No reason")
            .input("cancelledBy", sql.NVarChar, cancelledBy || "Unknown")
            .query(`
              UPDATE Dispatches SET 
                isDeleted = 1,
                status = 'Order Cancelled',
                cancelReason = @reason, 
                cancelledBy = @cancelledBy, 
                cancelledAt = GETDATE() 
              WHERE id = @id
            `);

          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    res.json({ message: "Deletion completed", results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/dispatches/restore", async (req, res) => {
  try {
    const { ids } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const idArray = Array.isArray(ids) ? ids : [ids];
    const results = { success: [], failed: [] };

    for (const id of idArray) {
      try {
        const dispatch = await pool
          .request()
          .input("id", sql.Int, id)
          .query("SELECT serialNumberId FROM Dispatches WHERE id = @id AND (isDeleted = 1 OR status = 'Order Cancelled')");

        if (dispatch.recordset.length > 0) {
          await pool
            .request()
            .input("serialId", sql.Int, dispatch.recordset[0].serialNumberId)
            .query("UPDATE Serials SET status = 'Dispatched' WHERE id = @serialId");

          await pool
            .request()
            .input("id", sql.Int, id)
            .query(`
              UPDATE Dispatches 
              SET isDeleted = 0,
                  status = CASE 
                             WHEN status = 'Order Cancelled' AND logisticsStatus = 'Delivered' THEN 'Payment Pending'
                             WHEN status = 'Order Cancelled' AND logisticsStatus IS NOT NULL AND logisticsStatus != '' THEN 'Billed'
                             WHEN status = 'Order Cancelled' THEN 'Pending' 
                             ELSE status 
                           END,
                  cancelReason = NULL, cancellationReason = NULL, 
                  cancelledBy = NULL, cancelledAt = NULL
              WHERE id = @id
            `);

          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    res.json({ message: "Restore completed", results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/dispatches/permanent", async (req, res) => {
  try {
    const { ids } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const idArray = Array.isArray(ids) ? ids : [ids];

    for (const id of idArray) {
      await pool
        .request()
        .input("id", sql.Int, id)
        .query("DELETE FROM Dispatches WHERE id = @id");
    }

    res.json({ message: "Permanently deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ INSTALLATION ROUTES
// =============================================
app.get("/api/installations", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        d.*,
        s.value as serialValue,
        s.landingPrice,
        m.name as modelName,
        m.company as companyName,
        m.category as modelCategory
      FROM Dispatches d
      LEFT JOIN Serials s ON d.serialNumberId = s.id
      LEFT JOIN Models m ON s.modelId = m.id
      WHERE (d.installationRequired = 1 OR d.installationRequired = '1' OR d.installationRequired = 'true') 
      AND d.isDeleted = 0
      ORDER BY 
        CASE 
          WHEN d.installationStatus = 'Pending' THEN 1
          WHEN d.installationStatus = 'Scheduled' THEN 2
          WHEN d.installationStatus = 'In Progress' THEN 3
          WHEN d.installationStatus = 'Completed' THEN 4
          ELSE 5
        END,
        d.dispatchDate DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Get installations error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/installations/stats", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN installationStatus = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN installationStatus = 'Scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN installationStatus = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN installationStatus = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN installationStatus = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(ISNULL(try_cast(installationCharges as decimal(18,2)), 0)) as totalCharges
      FROM Dispatches 
      WHERE (installationRequired = 1 OR installationRequired = '1' OR installationRequired = 'true') 
      AND isDeleted = 0
    `);

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Get installation stats error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/installations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          d.*,
          s.value as serialValue,
          m.name as modelName,
          m.company as companyName
        FROM Dispatches d
        LEFT JOIN Serials s ON d.serialNumberId = s.id
        LEFT JOIN Models m ON s.modelId = m.id
        WHERE d.id = @id AND (d.installationRequired = 1 OR d.installationRequired = '1' OR d.installationRequired = 'true')
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Installation not found" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/installations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      technicianName,
      technicianContact,
      installationStatus,
      installationCharges,
      installationRemarks,
      scheduledDate,
      installationDate
    } = req.body;

    const pool = await getPool(res);
    if (!pool) return;

    const current = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Dispatches WHERE id = @id");

    if (current.recordset.length === 0) {
      return res.status(404).json({ message: "Installation not found" });
    }

    const curr = current.recordset[0];

    let finalInstallDate = installationDate !== undefined ? safeDate(installationDate) : curr.installationDate;
    if (installationStatus === 'Completed' && !finalInstallDate) {
      finalInstallDate = new Date();
    }

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("technicianName", sql.NVarChar, technicianName ?? curr.technicianName)
      .input("technicianContact", sql.NVarChar, technicianContact ?? curr.technicianContact)
      .input("installationStatus", sql.NVarChar, installationStatus ?? curr.installationStatus)
      .input("installationCharges", sql.Decimal(18, 2), installationCharges ?? curr.installationCharges)
      .input("installationRemarks", sql.NVarChar, installationRemarks ?? curr.installationRemarks)
      .input("scheduledDate", sql.DateTime, scheduledDate !== undefined ? safeDate(scheduledDate) : curr.scheduledDate)
      .input("installationDate", sql.DateTime, finalInstallDate)
      .query(`
        UPDATE Dispatches SET 
          technicianName = @technicianName,
          technicianContact = @technicianContact,
          installationStatus = @installationStatus,
          installationCharges = @installationCharges,
          installationRemarks = @installationRemarks,
          scheduledDate = @scheduledDate,
          installationDate = @installationDate
        WHERE id = @id
      `);

    res.json({ message: "Installation updated successfully" });
  } catch (err) {
    console.error("Update installation error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/installations/bulk/update", async (req, res) => {
  try {
    const { ids, updates } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const { technicianName, technicianContact, installationStatus, scheduledDate } = updates;

    for (const id of ids) {
      const request = pool.request();
      request.input("id", sql.Int, id);

      let setClauses = [];

      if (technicianName !== undefined) {
        request.input("technicianName", sql.NVarChar, technicianName);
        setClauses.push("technicianName = @technicianName");
      }
      if (technicianContact !== undefined) {
        request.input("technicianContact", sql.NVarChar, technicianContact);
        setClauses.push("technicianContact = @technicianContact");
      }
      if (installationStatus !== undefined) {
        request.input("installationStatus", sql.NVarChar, installationStatus);
        setClauses.push("installationStatus = @installationStatus");
      }
      if (scheduledDate !== undefined) {
        request.input("scheduledDate", sql.DateTime, safeDate(scheduledDate));
        setClauses.push("scheduledDate = @scheduledDate");
      }

      if (setClauses.length > 0) {
        await request.query(`
          UPDATE Dispatches SET ${setClauses.join(", ")} 
          WHERE id = @id AND (installationRequired = 1 OR installationRequired = '1' OR installationRequired = 'true')
        `);
      }
    }

    res.json({ message: `${ids.length} installations updated` });
  } catch (err) {
    console.error("Bulk update error:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== RETURNS ROUTES ==============
// =============================================
app.get("/api/returns/lookup", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const rawSerialValue = safeStr(req.query.serialValue || req.query.serialNumber || req.query.serial, null);
    if (!rawSerialValue) {
      return res.status(400).json({ message: "Serial number is required" });
    }

    const normalizedSerial = rawSerialValue.trim().toUpperCase();

    const serialResult = await pool
      .request()
      .input("value", sql.NVarChar, normalizedSerial)
      .query(`
        SELECT TOP 1
          s.id,
          s.value as serialValue,
          s.modelId,
          s.status as currentStatus,
          s.returnCount,
          m.name as modelName,
          m.company as companyName,
          (
            SELECT TOP 1 r.reason
            FROM Returns r
            WHERE r.serialNumberId = s.id AND r.isDeleted = 0
            ORDER BY r.returnDate DESC, r.id DESC
          ) as latestReturnReason,
          (
            SELECT TOP 1 r.returnDate
            FROM Returns r
            WHERE r.serialNumberId = s.id AND r.isDeleted = 0
            ORDER BY r.returnDate DESC, r.id DESC
          ) as latestReturnDate,
          (
            SELECT TOP 1 r.condition
            FROM Returns r
            WHERE r.serialNumberId = s.id AND r.isDeleted = 0
            ORDER BY r.returnDate DESC, r.id DESC
          ) as latestReturnCondition
        FROM Serials s
        LEFT JOIN Models m ON m.id = s.modelId
        WHERE UPPER(s.value) = @value AND s.isDeleted = 0
      `);

    if (serialResult.recordset.length === 0) {
      return res.status(404).json({ message: `Serial number "${normalizedSerial}" not found` });
    }

    const serial = serialResult.recordset[0];

    const dispatchResult = await pool
      .request()
      .input("serialId", sql.Int, serial.id)
      .query(`
        SELECT TOP 1
          d.id,
          d.dispatchDate,
          d.invoiceNumber,
          d.status as orderStatus,
          d.logisticsStatus,
          d.installationStatus,
          d.installationRequired,
          d.firmName,
          COALESCE(d.customer, d.customerName) as customerName,
          COALESCE(d.shippingAddress, d.address) as shippingAddress
        FROM Dispatches d
        WHERE d.serialNumberId = @serialId
        ORDER BY d.dispatchDate DESC, d.id DESC
      `);

    const linkedOrder = dispatchResult.recordset[0] || null;

    let existingReturnForLinkedOrder = null;
    if (linkedOrder?.id) {
      const linkedReturnResult = await pool
        .request()
        .input("serialId", sql.Int, serial.id)
        .input("dispatchId", sql.Int, linkedOrder.id)
        .query(`
          SELECT TOP 1 id, returnDate, reason, condition
          FROM Returns
          WHERE serialNumberId = @serialId
            AND dispatchId = @dispatchId
            AND isDeleted = 0
          ORDER BY returnDate DESC, id DESC
        `);

      existingReturnForLinkedOrder = linkedReturnResult.recordset[0] || null;
    }

    const smartWarning =
      Number(serial.returnCount || 0) > 0
        ? `This serial was previously returned${serial.latestReturnReason ? ` (Reason: ${serial.latestReturnReason})` : ""}.`
        : null;

    res.json({
      ...serial,
      canReturn: serial.currentStatus === "Dispatched" && !!linkedOrder && !existingReturnForLinkedOrder,
      linkedOrder,
      existingReturnForLinkedOrder,
      smartWarning
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/serials/:id/history", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const serialId = Number(req.params.id);
    if (!Number.isFinite(serialId)) {
      return res.status(400).json({ message: "Valid serial ID is required" });
    }

    const serialResult = await pool
      .request()
      .input("serialId", sql.Int, serialId)
      .query(`
        SELECT TOP 1
          s.id,
          s.value as serialValue,
          s.status as currentStatus,
          s.returnCount,
          s.createdAt,
          m.id as modelId,
          m.name as modelName,
          m.company as companyName
        FROM Serials s
        LEFT JOIN Models m ON m.id = s.modelId
        WHERE s.id = @serialId AND s.isDeleted = 0
      `);

    if (serialResult.recordset.length === 0) {
      return res.status(404).json({ message: "Serial not found" });
    }

    const historyResult = await pool
      .request()
      .input("serialId", sql.Int, serialId)
      .query(`
        SELECT
          sm.*,
          d.dispatchDate,
          d.status as orderStatus,
          d.logisticsStatus,
          d.installationStatus,
          d.installationRequired,
          COALESCE(d.firmName, sm.firmName) as linkedFirmName,
          COALESCE(d.customer, d.customerName, sm.customerName) as linkedCustomerName,
          COALESCE(d.shippingAddress, d.address) as linkedShippingAddress,
          COALESCE(d.invoiceNumber, sm.invoiceNumber) as linkedInvoiceNumber
        FROM SerialMovements sm
        LEFT JOIN Dispatches d ON d.id = sm.dispatchId
        WHERE sm.serialNumberId = @serialId
        ORDER BY sm.createdAt DESC, sm.id DESC
      `);

    res.json({
      serial: serialResult.recordset[0],
      history: historyResult.recordset
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/returns", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        r.id,
        r.serialNumberId,
        COALESCE(NULLIF(r.serialValue, ''), s.value, '') as serialValue,
        r.condition,
        r.returnDate,
        r.returnedBy,
        COALESCE(d.firmName, r.firmName) as firmName,
        COALESCE(d.customer, d.customerName, r.customerName) as customerName,
        r.isDeleted,
        r.returnDate as createdAt,
        r.repairCost,
        r.returnCount,
        r.dispatchId,
        COALESCE(d.invoiceNumber, r.invoiceNumber) as invoiceNumber,
        r.reason,
        s.status as serialCurrentStatus,
        s.modelId,
        m.name as modelName,
        m.company as companyName,
        d.dispatchDate,
        d.status as orderStatus,
        d.logisticsStatus,
        d.installationStatus,
        COALESCE(d.shippingAddress, d.address) as shippingAddress
      FROM Returns r
      JOIN Serials s ON r.serialNumberId = s.id
      LEFT JOIN Models m ON s.modelId = m.id
      LEFT JOIN Dispatches d ON r.dispatchId = d.id
      WHERE r.isDeleted = 0
      ORDER BY r.returnDate DESC, r.id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/returns", async (req, res) => {
  try {
    const { serialValue, condition, dispatchId, returnDate, returnedBy, reason } = req.body;

    console.log('📥 Received return request:', req.body);

    const pool = await getPool(res);
    if (!pool) return;

    if (!serialValue || !serialValue.trim()) {
      return res.status(400).json({ message: "Serial number is required" });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "Return reason is required" });
    }

    const trimmedSerial = serialValue.trim().toUpperCase();

    const serialCheck = await pool
      .request()
      .input("value", sql.NVarChar, trimmedSerial)
      .query(`
        SELECT s.id, s.status, s.modelId, s.value as serialValue, s.returnCount, m.name as modelName
        FROM Serials s
        JOIN Models m ON s.modelId = m.id
        WHERE UPPER(s.value) = @value AND s.isDeleted = 0
      `);

    if (serialCheck.recordset.length === 0) {
      return res.status(404).json({ message: `Serial number "${trimmedSerial}" not found` });
    }

    const serial = serialCheck.recordset[0];

    if (serial.status !== "Dispatched") {
      return res.status(400).json({ message: `Cannot return: Item status is "${serial.status}"` });
    }

    let finalCondition = condition || "Good";
    let newSerialStatus = "Available";

    if (finalCondition === "InStock" || finalCondition === "Good") {
      finalCondition = "Good";
      newSerialStatus = "Available";
    } else if (finalCondition === "Damaged") {
      finalCondition = "Damaged";
      newSerialStatus = "Damaged";
    }

    const dispatchRequest = pool.request();
    let dispatchQuery = `
      SELECT TOP 1
        id,
        dispatchDate,
        firmName,
        COALESCE(customer, customerName) as customerName,
        invoiceNumber,
        status as orderStatus,
        logisticsStatus
      FROM Dispatches
      WHERE serialNumberId = @serialId
    `;

    dispatchRequest.input("serialId", sql.Int, serial.id);

    if (dispatchId) {
      dispatchRequest.input("dispatchId", sql.Int, Number(dispatchId));
      dispatchQuery += " AND id = @dispatchId";
    }

    dispatchQuery += " ORDER BY dispatchDate DESC, id DESC";

    const dispatchInfo = await dispatchRequest.query(dispatchQuery);

    const relatedDispatch = dispatchInfo.recordset[0] || null;
    if (!relatedDispatch?.id) {
      return res.status(400).json({ message: "No linked order found for this serial" });
    }

    const duplicateReturnCheck = await pool
      .request()
      .input("serialId", sql.Int, serial.id)
      .input("dispatchId", sql.Int, relatedDispatch.id)
      .query(`
        SELECT TOP 1 id
        FROM Returns
        WHERE serialNumberId = @serialId
          AND dispatchId = @dispatchId
          AND isDeleted = 0
        ORDER BY returnDate DESC, id DESC
      `);

    if (duplicateReturnCheck.recordset.length > 0) {
      return res.status(400).json({ message: `Return already recorded for order #${relatedDispatch.id}` });
    }

    const countCheck = await pool.request()
      .input("serialId", sql.Int, serial.id)
      .query("SELECT COUNT(*) as total FROM Returns WHERE serialNumberId = @serialId AND isDeleted = 0");
    const currentReturnCount = (countCheck.recordset[0].total || 0) + 1;

    const insertResult = await pool
      .request()
      .input("serialId", sql.Int, serial.id)
      .input("serialValue", sql.NVarChar, trimmedSerial)
      .input("condition", sql.NVarChar, finalCondition)
      .input("returnDate", sql.DateTime, returnDate ? new Date(returnDate) : new Date())
      .input("returnedBy", sql.NVarChar, returnedBy || "System")
      .input("firmName", sql.NVarChar, relatedDispatch?.firmName || null)
      .input("customerName", sql.NVarChar, relatedDispatch?.customerName || null)
      .input("returnCount", sql.Int, currentReturnCount)
      .input("dispatchId", sql.Int, relatedDispatch.id)
      .input("invoiceNumber", sql.NVarChar, relatedDispatch?.invoiceNumber || null)
      .input("reason", sql.NVarChar, String(reason).trim())
      .query(`
        INSERT INTO Returns 
          (serialNumberId, serialValue, condition, returnDate, returnedBy, firmName, customerName, returnCount, isDeleted, dispatchId, invoiceNumber, reason)
        OUTPUT INSERTED.id
        VALUES 
          (@serialId, @serialValue, @condition, @returnDate, @returnedBy, @firmName, @customerName, @returnCount, 0, @dispatchId, @invoiceNumber, @reason)
      `);

    const returnId = insertResult.recordset[0].id;

    await pool
      .request()
      .input("serialId", sql.Int, serial.id)
      .input("status", sql.NVarChar, newSerialStatus)
      .input("returnCount", sql.Int, currentReturnCount)
      .query("UPDATE Serials SET status = @status, returnCount = @returnCount WHERE id = @serialId");

    await recordSerialMovement(pool, {
      serialNumberId: serial.id,
      serialValue: serial.serialValue,
      dispatchId: relatedDispatch.id,
      actionType: "Returned",
      status: "Returned",
      condition: finalCondition,
      reason: String(reason).trim(),
      firmName: relatedDispatch.firmName,
      customerName: relatedDispatch.customerName,
      invoiceNumber: relatedDispatch.invoiceNumber,
      createdAt: returnDate || new Date(),
      createdBy: returnedBy || "System",
      notes: `Returned from order #${relatedDispatch.id}`
    });

    await recordSerialMovement(pool, {
      serialNumberId: serial.id,
      serialValue: serial.serialValue,
      dispatchId: null,
      actionType: finalCondition === "Damaged" ? "Damaged" : "InStock",
      status: newSerialStatus,
      condition: finalCondition,
      reason: String(reason).trim(),
      firmName: relatedDispatch.firmName,
      customerName: relatedDispatch.customerName,
      invoiceNumber: relatedDispatch.invoiceNumber,
      createdAt: returnDate ? new Date(new Date(returnDate).getTime() + 1000) : new Date(),
      createdBy: returnedBy || "System",
      notes: finalCondition === "Damaged" ? "Moved to damaged stock after return" : "Restocked after return"
    });

    res.status(201).json({
      message: "Return processed successfully",
      id: returnId,
      serialValue: trimmedSerial,
      condition: finalCondition,
      status: newSerialStatus,
      dispatchId: relatedDispatch.id,
      invoiceNumber: relatedDispatch.invoiceNumber,
      reason: String(reason).trim()
    });

  } catch (err) {
    console.error("❌ Error creating return:", err);
    res.status(500).json({ message: "Failed to process return", error: err.message });
  }
});

app.put("/api/returns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, repairCost, reason } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const existingReturnRes = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT TOP 1
          r.id,
          r.serialNumberId,
          COALESCE(NULLIF(r.serialValue, ''), s.value, '') as serialValue,
          r.condition,
          r.reason,
          r.firmName,
          r.customerName,
          r.invoiceNumber,
          r.dispatchId
        FROM Returns r
        LEFT JOIN Serials s ON s.id = r.serialNumberId
        WHERE r.id = @id
      `);

    if (existingReturnRes.recordset.length === 0) {
      return res.status(404).json({ message: "Return not found" });
    }

    const existingReturn = existingReturnRes.recordset[0];

    const request = pool.request().input("id", sql.Int, id);
    let setClauses = [];

    if (condition !== undefined) {
      request.input("condition", sql.NVarChar, condition);
      setClauses.push("condition = @condition");
    }
    if (repairCost !== undefined) {
      request.input("repairCost", sql.Decimal(18, 2), repairCost);
      setClauses.push("repairCost = @repairCost");
    }
    if (reason !== undefined) {
      request.input("reason", sql.NVarChar, reason);
      setClauses.push("reason = @reason");
    }

    if (setClauses.length === 0) {
      return res.json({ message: "No fields to update" });
    }

    const updateQuery = `UPDATE Returns SET ${setClauses.join(", ")} WHERE id = @id`;
    await request.query(updateQuery);

    // If changed to Repaired/Good, move serial status back to Available
    if (condition !== undefined) {
      const newStatus = (condition === 'Repaired' || condition === 'Good' || condition === 'InStock') ? 'Available' : 'Damaged';
      await pool
        .request()
        .input("serialId", sql.Int, existingReturn.serialNumberId)
        .input("status", sql.NVarChar, newStatus)
        .query("UPDATE Serials SET status = @status WHERE id = @serialId");

      await recordSerialMovement(pool, {
        serialNumberId: existingReturn.serialNumberId,
        serialValue: existingReturn.serialValue,
        dispatchId: null,
        actionType: newStatus === "Available" ? "InStock" : "Damaged",
        status: newStatus,
        condition,
        reason: reason !== undefined ? reason : existingReturn.reason,
        firmName: existingReturn.firmName,
        customerName: existingReturn.customerName,
        invoiceNumber: existingReturn.invoiceNumber,
        createdBy: "System",
        notes: `Inventory status updated from return #${id}`
      });
    }

    res.json({ message: "Return updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/returns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(res);
    if (!pool) return;

    const returnCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT TOP 1
          r.id,
          r.serialNumberId,
          COALESCE(NULLIF(r.serialValue, ''), s.value, '') as serialValue,
          r.condition,
          r.reason,
          r.firmName,
          r.customerName,
          r.invoiceNumber,
          r.dispatchId
        FROM Returns r
        LEFT JOIN Serials s ON s.id = r.serialNumberId
        WHERE r.id = @id
      `);

    if (returnCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Return not found" });
    }

    const returnRecord = returnCheck.recordset[0];

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("UPDATE Returns SET isDeleted = 1 WHERE id = @id");

    const remainingCountResult = await pool
      .request()
      .input("serialId", sql.Int, returnRecord.serialNumberId)
      .query("SELECT COUNT(*) as total FROM Returns WHERE serialNumberId = @serialId AND isDeleted = 0");
    const remainingReturnCount = remainingCountResult.recordset[0]?.total || 0;

    await pool
      .request()
      .input("serialId", sql.Int, returnRecord.serialNumberId)
      .input("returnCount", sql.Int, remainingReturnCount)
      .query("UPDATE Serials SET status = 'Dispatched', returnCount = @returnCount WHERE id = @serialId");

    await recordSerialMovement(pool, {
      serialNumberId: returnRecord.serialNumberId,
      serialValue: returnRecord.serialValue,
      dispatchId: returnRecord.dispatchId,
      actionType: "ReturnDeleted",
      status: "Dispatched",
      condition: returnRecord.condition,
      reason: returnRecord.reason,
      firmName: returnRecord.firmName,
      customerName: returnRecord.customerName,
      invoiceNumber: returnRecord.invoiceNumber,
      createdBy: "System",
      notes: `Return #${id} was deleted and order context restored`
    });

    res.json({ message: "Return record deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// =============== REPORT ROUTES ===============
// =============================================
app.get("/api/reports", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool(res);
    if (!pool) return;

    if (!startDate || !endDate)
      return res.status(400).json({ message: "Start date and end date are required" });

    const result = await pool
      .request()
      .input("start", sql.DateTime, startDate)
      .input("end", sql.DateTime, endDate)
      .query(`
        SELECT 
          d.id as _id,
          d.id as orderId,
          d.dispatchDate,
          d.status,
          d.logisticsStatus,
          d.sellingPrice,
          s.landingPrice,
          d.firmName,
              COALESCE(d.customer, d.customerName) as customerName, 
          m.name as modelName,
          s.value as serialValue,
          d.installationRequired,
          d.installationCharges,
          d.freightCharges,
          d.packagingCost as packingCharges,
          d.commission
        FROM Dispatches d
        JOIN Serials s ON d.serialNumberId = s.id
        JOIN Models m ON s.modelId = m.id
            WHERE d.dispatchDate >= @start AND d.dispatchDate <= @end
            ORDER BY d.dispatchDate DESC
      `);

    const dispatchedItems = result.recordset;

    const stockResult = await pool.request().query(`
      SELECT 
        0 as _id,
        'N/A' as orderId,
        s.createdAt as dispatchDate,
        s.status,
          NULL as logisticsStatus,
        0 as sellingPrice,
        s.landingPrice,
        'Inventory' as firmName,
        NULL as customerName,
        m.name as modelName,
        s.value as serialValue,
        0 as installationRequired,
        0 as installationCharges,
        0 as freightCharges,
        0 as packingCharges,
        0 as commission
      FROM Serials s
      JOIN Models m ON s.modelId = m.id
      WHERE s.isDeleted = 0 AND s.status IN ('Available', 'Damaged', 'Damage')
    `);

    const stockItems = stockResult.recordset;
    const allTransactions = [...dispatchedItems, ...stockItems];

    res.json({ transactions: allTransactions });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/reports/save", async (req, res) => {
  try {
    const {
      reportType,
      reportLabel,
      dateRange,
      startDate,
      endDate,
      filters,
      summary,
      transactions,
    } = req.body || {};

    const pool = await getPool(res);
    if (!pool) return;

    if (!summary || typeof summary !== "object") {
      return res.status(400).json({ message: "Report summary is required." });
    }

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ message: "Report rows are required." });
    }

    const safeSummaryJson = JSON.stringify(summary);
    const safeRowsJson = JSON.stringify(transactions);
    const safeFiltersJson = filters ? JSON.stringify(filters) : null;

    const insertResult = await pool
      .request()
      .input("reportType", sql.NVarChar, safeStr(reportType, "financial"))
      .input("reportLabel", sql.NVarChar, safeStr(reportLabel, "Financial Report"))
      .input("dateRange", sql.NVarChar, safeStr(dateRange, "all"))
      .input("startDate", sql.DateTime, safeDate(startDate) ? new Date(startDate) : null)
      .input("endDate", sql.DateTime, safeDate(endDate) ? new Date(endDate) : null)
      .input("filtersJson", sql.NVarChar, safeStr(safeFiltersJson, null))
      .input("summaryJson", sql.NVarChar, safeSummaryJson)
      .input("rowsJson", sql.NVarChar, safeRowsJson)
      .input("reportRowCount", sql.Int, Array.isArray(transactions) ? transactions.length : 0)
      .input("stockValue", sql.Decimal(18, 2), safeNum(summary.stockValue))
      .input("bookingValue", sql.Decimal(18, 2), safeNum(summary.bookingValue))
      .input("revenue", sql.Decimal(18, 2), safeNum(summary.revenue))
      .input("damageLoss", sql.Decimal(18, 2), safeNum(summary.damageLoss))
      .input("netProfit", sql.Decimal(18, 2), safeNum(summary.netProfit))
      .input("deliveredCount", sql.Int, safeNum(summary.deliveredCount))
      .input("createdByUserId", sql.Int, req.user?.id || null)
      .input("createdBy", sql.NVarChar, safeStr(req.user?.username, "System"))
      .query(`
        INSERT INTO SavedReports
          (
            reportType, reportLabel, dateRange, startDate, endDate,
            filtersJson, summaryJson, rowsJson, reportRowCount,
            stockValue, bookingValue, revenue, damageLoss, netProfit, deliveredCount,
            createdByUserId, createdBy
          )
        OUTPUT INSERTED.id
        VALUES
          (
            @reportType, @reportLabel, @dateRange, @startDate, @endDate,
            @filtersJson, @summaryJson, @rowsJson, @reportRowCount,
            @stockValue, @bookingValue, @revenue, @damageLoss, @netProfit, @deliveredCount,
            @createdByUserId, @createdBy
          )
      `);

    return res.json({
      message: "Report saved successfully",
      id: insertResult.recordset[0]?.id || null,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/reports/saved", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT TOP 100
        id,
        reportType,
        reportLabel,
        dateRange,
        startDate,
        endDate,
        reportRowCount as rowCount,
        stockValue,
        bookingValue,
        revenue,
        damageLoss,
        netProfit,
        deliveredCount,
        createdBy,
        createdAt
      FROM SavedReports
      ORDER BY createdAt DESC, id DESC
    `);

    return res.json({ reports: result.recordset });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get("/api/reports/inventory", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        m.name as modelName,
        m.company as companyName,
        m.category,
        COUNT(s.id) as totalSerials,
        SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) as availableSerials,
        SUM(CASE WHEN s.status = 'Dispatched' THEN 1 ELSE 0 END) as dispatchedSerials,
        SUM(CASE WHEN s.status = 'Damaged' THEN 1 ELSE 0 END) as damagedSerials,
        AVG(s.landingPrice) as avgLandingPrice,
        m.stockQuantity
      FROM Models m
      LEFT JOIN Serials s ON m.id = s.modelId AND s.isDeleted = 0
      WHERE m.isDeleted = 0
      GROUP BY m.id, m.name, m.company, m.category, m.stockQuantity
      ORDER BY m.name
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/reports/sales", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool(res);
    if (!pool) return;

    let query = `
      SELECT 
        d.dispatchDate,
        d.firmName,
        COALESCE(d.customer, d.customerName) as customer,
        d.sellingPrice,
        s.landingPrice,
        m.name as modelName,
        m.company as companyName,
        s.value as serialNumber,
        d.installationRequired,
        d.installationCharges,
        d.packagingCost,
        d.commission,
        d.status
      FROM Dispatches d
      JOIN Serials s ON d.serialNumberId = s.id
      JOIN Models m ON s.modelId = m.id
      WHERE d.isDeleted = 0
    `;

    const request = pool.request();

    if (startDate && endDate) {
      query += " AND d.dispatchDate >= @start AND d.dispatchDate <= @end";
      request.input("start", sql.DateTime, startDate);
      request.input("end", sql.DateTime, endDate);
    }

    query += " ORDER BY d.dispatchDate DESC";

    const result = await request.query(query);
    const sales = result.recordset;

    const summary = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + (Number(s.sellingPrice) || 0), 0),
      totalCost: sales.reduce((sum, s) => sum + (Number(s.landingPrice) || 0) + (Number(s.packagingCost) || 0) + (Number(s.commission) || 0), 0),
      totalProfit: sales.reduce((sum, s) =>
        (Number(s.sellingPrice) || 0) - ((Number(s.landingPrice) || 0) + (Number(s.packagingCost) || 0) + (Number(s.commission) || 0)), 0),
      totalInstallationCharges: sales.reduce((sum, s) => s.installationRequired ? sum + (Number(s.installationCharges) || 0) : sum, 0)
    };

    res.json({ summary, sales });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/reports/installations", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool(res);
    if (!pool) return;

    let query = `
      SELECT 
        d.id,
        d.dispatchDate,
        d.firmName,
        COALESCE(d.customer, d.customerName) as customer,
        m.name as modelName,
        s.value as serialNumber,
        d.installationStatus,
        d.installationCharges,
        d.installationRemarks,
        d.scheduledDate,
        d.installationDate,
        d.technicianName,
        d.technicianContact
      FROM Dispatches d
      JOIN Serials s ON d.serialNumberId = s.id
      JOIN Models m ON s.modelId = m.id
      WHERE (d.installationRequired = 1 OR d.installationRequired = 'true') AND d.isDeleted = 0
    `;

    const request = pool.request();

    if (startDate && endDate) {
      query += " AND d.dispatchDate >= @start AND d.dispatchDate <= @end";
      request.input("start", sql.DateTime, startDate);
      request.input("end", sql.DateTime, endDate);
    }

    query += " ORDER BY d.dispatchDate DESC";

    const result = await request.query(query);
    const installations = result.recordset;

    const summary = {
      total: installations.length,
      pending: installations.filter(i => i.installationStatus === 'Pending').length,
      scheduled: installations.filter(i => i.installationStatus === 'Scheduled').length,
      inProgress: installations.filter(i => i.installationStatus === 'In Progress').length,
      completed: installations.filter(i => i.installationStatus === 'Completed').length,
      cancelled: installations.filter(i => i.installationStatus === 'Cancelled').length,
      totalCharges: installations.reduce((sum, i) => sum + (Number(i.installationCharges) || 0), 0)
    };

    res.json({ summary, installations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ ORDERS ROUTES
// =============================================
// In index.js around line 1330
app.get("/api/orders", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const result = await pool.request().query(`
      SELECT 
        d.*, 
        s.value as serialValue, 
        m.name as modelName, 
        m.company as companyName,
        p.paymentDate as paymentReceivedDate,
        p.amount as paymentReceivedAmount,
        p.utrId
      FROM Dispatches d 
      LEFT JOIN Serials s ON d.serialNumberId = s.id
      LEFT JOIN Models m ON s.modelId = m.id
      LEFT JOIN Payments p ON d.id = p.dispatchId
      -- REMOVED: WHERE d.isDeleted = 0 to show cancelled orders
      ORDER BY d.dispatchDate DESC
    `);

    const docsResult = await pool.request().query(`
      SELECT dispatchId, docType, filename, createdAt
      FROM OrderDocuments
      ORDER BY createdAt ASC
    `);
    
    const docsMap = {};
    docsResult.recordset.forEach(doc => {
      if (!docsMap[doc.dispatchId]) docsMap[doc.dispatchId] = [];
      docsMap[doc.dispatchId].push(doc);
    });

    const finalData = result.recordset.map(row => ({
      ...row,
      documents: docsMap[row.id] || []
    }));

    res.json(finalData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingId, reason, cancelledBy } = req.body; 

    const pool = await getPool(res);
    if (!pool) return;

    const finalStatus = normalizeBusinessStatus(status);

    const currentRes = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT serialNumberId FROM Dispatches WHERE id = @id");

    if (currentRes.recordset.length === 0) return res.status(404).json({ message: "Order not found" });
    const current = currentRes.recordset[0];

    if (finalStatus === "Order Cancelled") {
      // 1. Serial ko Available karein
      await pool.request()
        .input("serialId", sql.Int, current.serialNumberId)
        .query("UPDATE Serials SET status = 'Available' WHERE id = @serialId");

      // 2. Sahi column 'cancellationReason' mein data save karein
      await pool.request()
        .input("id", sql.Int, id)
        .input("status", sql.NVarChar, finalStatus)
        .input("trackingId", sql.NVarChar, trackingId || null)
        .input("reason", sql.NVarChar, reason || "No reason provided")
        .input("cancelledBy", sql.NVarChar, cancelledBy || "Unknown")
        .query(`
          UPDATE Dispatches 
          SET status = @status, 
              trackingId = @trackingId, 
              isDeleted = 1, 
              cancellationReason = @reason,
              cancelledBy = @cancelledBy,
              cancelledAt = GETDATE()
          WHERE id = @id
        `);
    } else {
      // Normal Status Update
      await pool.request()
        .input("id", sql.Int, id)
        .input("status", sql.NVarChar, finalStatus)
        .input("trackingId", sql.NVarChar, trackingId || null)
        .query(`UPDATE Dispatches SET status = @status, trackingId = @trackingId WHERE id = @id AND isDeleted = 0`);
    }

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

  const handleReplaceOrder = async (req, res) => {
    try {
      const { id } = req.params;
      // Fallback variables to support whatever OrderTracking.jsx sends
      const targetSerialId = req.body.newSerialId || req.body.serialId;
      const reason = req.body.reason || req.body.remarks || "Replaced by user";
      const replacedBy = req.body.replacedBy || req.user?.username || "System";
      const condition = req.body.condition || "Available";

      if (!targetSerialId) {
        return res.status(400).json({ message: "New Serial ID is required for replacement." });
      }

      const pool = await getPool(res);
      if (!pool) return;

      // 1. Verify the order exists
      const dispatchRes = await pool.request()
        .input("id", sql.Int, id)
        .query("SELECT * FROM Dispatches WHERE id = @id"); // Allow replacing even if currently cancelled

      if (dispatchRes.recordset.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }
      const dispatch = dispatchRes.recordset[0];
      const oldSerialId = dispatch.serialNumberId;

      // 2. Verify the new serial exists and is Available
      const newSerialRes = await pool.request()
        .input("newId", sql.Int, targetSerialId)
        .query("SELECT * FROM Serials WHERE id = @newId AND isDeleted = 0");

      if (newSerialRes.recordset.length === 0) {
        return res.status(404).json({ message: "New serial not found" });
      }
      const newSerial = newSerialRes.recordset[0];

      if (newSerial.status !== "Available") {
        return res.status(400).json({ message: "New serial is not currently Available." });
      }

      // Get old serial value for logging
      const oldSerialRes = await pool.request()
        .input("oldId", sql.Int, oldSerialId)
        .query("SELECT value FROM Serials WHERE id = @oldId");
      const oldSerialValue = oldSerialRes.recordset[0]?.value || "Unknown";

      // 3. Mark old serial as Available (or Damaged)
      const oldStatus = condition === "Damaged" ? "Damaged" : "Available";
      await pool.request()
        .input("oldId", sql.Int, oldSerialId)
        .input("status", sql.NVarChar, oldStatus)
        .query("UPDATE Serials SET status = @status WHERE id = @oldId");

      // 4. Mark new serial as Dispatched
      await pool.request()
        .input("newId", sql.Int, targetSerialId)
        .query("UPDATE Serials SET status = 'Dispatched' WHERE id = @newId");

      // 5. Update Dispatch with new serial
      await pool.request()
        .input("id", sql.Int, id)
        .input("newId", sql.Int, targetSerialId)
        .input("reason", sql.NVarChar, reason)
        .query(`
          UPDATE Dispatches 
          SET serialNumberId = @newId,
              status = 'Send for Billing',
              logisticsStatus = NULL,
              cancellationReason = @reason,
              cancelReason = @reason,
              remarks = @reason,
              isDeleted = 0
          WHERE id = @id
        `);

      // 6. Record Movements
      await recordSerialMovement(pool, {
        serialNumberId: oldSerialId,
        serialValue: oldSerialValue,
        dispatchId: id,
        actionType: "ReplacedOut",
        status: oldStatus,
        condition: condition !== "Available" ? condition : null,
        reason: reason,
        firmName: dispatch.firmName,
        customerName: dispatch.customerName || dispatch.customer,
        createdBy: replacedBy,
        notes: `Replaced by serial ${newSerial.value}`
      });

      await recordSerialMovement(pool, {
        serialNumberId: targetSerialId,
        serialValue: newSerial.value,
        dispatchId: id,
        actionType: "ReplacedIn",
        status: "Dispatched",
        reason: reason,
        firmName: dispatch.firmName,
        customerName: dispatch.customerName || dispatch.customer,
        createdBy: replacedBy,
        notes: `Replaced into order to substitute ${oldSerialValue}`
      });

      res.json({ message: "Order replaced successfully", newSerialValue: newSerial.value });
    } catch (err) {
      console.error("Replacement error:", err);
      res.status(500).json({ message: err.message });
    }
  };

  // Register endpoint mapped to both POST and PUT for frontend compatibility
  app.post("/api/orders/:id/replace", handleReplaceOrder);
  app.put("/api/orders/:id/replace", handleReplaceOrder);

app.post("/api/orders/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { docType } = req.body;
    const filename = req.file ? req.file.filename : null;
    const userRole = normalizeRole(req.user?.role);

    if (!filename)
      return res.status(400).json({ message: "No file uploaded" });

    if (!canManageOrderDocuments(userRole, docType)) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ message: "You cannot upload this document type." });
    }

    if (id !== '0') {
      const pool = await getPool(res);
      if (!pool) return;

      let query;
      if (docType === "gemContract") {
        query = "UPDATE Dispatches SET contractFilename = @filename WHERE id = @id";
      } else if (docType === "pod") {
        query = "UPDATE Dispatches SET podFilename = @filename WHERE id = @id";
      } else if (docType === "ewayBill") {
        query = "UPDATE Dispatches SET ewayBillFilename = @filename WHERE id = @id";
      } else {
        query = "UPDATE Dispatches SET invoiceFilename = @filename WHERE id = @id";
      }

      await pool
        .request()
        .input("id", sql.Int, id)
        .input("filename", sql.NVarChar, filename)
        .query(query);

      // ✅ Record in history table to support V1, V2, V3 etc.
      await pool.request()
        .input("dispatchId", sql.Int, id)
        .input("docType", sql.NVarChar, docType)
        .input("filename", sql.NVarChar, filename)
        .query("INSERT INTO OrderDocuments (dispatchId, docType, filename) VALUES (@dispatchId, @docType, @filename)");
    }

    res.json({
      message: "File uploaded successfully",
      filename,
      url: `http://localhost:5000/uploads/${filename}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/orders/:id/payment", async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, amount, utrId, status } = req.body;

    const pool = await getPool(res);
    if (!pool) return;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const checkReq = new sql.Request(transaction);
      const checkRes = await checkReq
        .input("dispatchId", sql.Int, id)
        .query("SELECT id FROM Payments WHERE dispatchId = @dispatchId");

      const request = new sql.Request(transaction);
      request
        .input("dispatchId", sql.Int, id)
        .input("paymentDate", sql.Date, safeDate(paymentDate))
        .input("amount", sql.Decimal(18, 2), amount)
        .input("utrId", sql.NVarChar, utrId);

      if (checkRes.recordset.length > 0) {
        await request.query(`
          UPDATE Payments SET paymentDate = @paymentDate, amount = @amount, utrId = @utrId WHERE dispatchId = @dispatchId
        `);
      } else {
        await request.query(`
          INSERT INTO Payments (dispatchId, paymentDate, amount, utrId) VALUES (@dispatchId, @paymentDate, @amount, @utrId)
        `);
      }

      const request2 = new sql.Request(transaction);
      await request2
        .input("id", sql.Int, id)
        .input("status", sql.NVarChar, status || 'Completed')
        .query(`
          UPDATE Dispatches
          SET status = @status,
              logisticsStatus = CASE WHEN logisticsStatus != 'Delivered' THEN 'Delivered' ELSE logisticsStatus END
          WHERE id = @id
        `);

      await transaction.commit();
      res.json({ message: "Payment recorded and order completed." });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ BATCH PAYMENT ENDPOINT (Moves Delivered Orders to Completed)
app.post("/api/orders/batch-payment", requireAuth, async (req, res) => {
  try {
    const { itemIds, paymentDate, totalAmount, utrId, status } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
       const amountPerItem = (Number(totalAmount) / itemIds.length).toFixed(2);
       for (const id of itemIds) {
         const checkReq = new sql.Request(transaction);
         const checkRes = await checkReq.input("dispatchId", sql.Int, id).query("SELECT id FROM Payments WHERE dispatchId = @dispatchId");

         const request = new sql.Request(transaction);
         request.input("dispatchId", sql.Int, id).input("paymentDate", sql.Date, safeDate(paymentDate))
                .input("amount", sql.Decimal(18, 2), amountPerItem).input("utrId", sql.NVarChar, utrId);

         if (checkRes.recordset.length > 0) {
           await request.query("UPDATE Payments SET paymentDate = @paymentDate, amount = @amount, utrId = @utrId WHERE dispatchId = @dispatchId");
         } else {
           await request.query("INSERT INTO Payments (dispatchId, paymentDate, amount, utrId) VALUES (@dispatchId, @paymentDate, @amount, @utrId)");
         }

         const request2 = new sql.Request(transaction);
         await request2.input("id", sql.Int, id).input("status", sql.NVarChar, status || 'Completed').query("UPDATE Dispatches SET status = @status, logisticsStatus = CASE WHEN logisticsStatus != 'Delivered' THEN 'Delivered' ELSE logisticsStatus END WHERE id = @id");
       }
       await transaction.commit();
       res.json({ message: "Batch payment recorded successfully" });
    } catch (err) {
       await transaction.rollback();
       throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ DASHBOARD ROUTES
// =============================================
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const pool = await getPool(res);
    if (!pool) return;

    const modelsResult = await pool.request().query("SELECT COUNT(*) as total FROM Models WHERE isDeleted = 0");
    const totalModels = modelsResult.recordset[0].total;

    const serialsResult = await pool.request().query("SELECT COUNT(*) as total FROM Serials WHERE isDeleted = 0");
    const totalSerials = serialsResult.recordset[0].total;

    const availableResult = await pool.request().query("SELECT COUNT(*) as total FROM Serials WHERE status = 'Available' AND isDeleted = 0");
    const availableSerials = availableResult.recordset[0].total;

    const dispatchedResult = await pool.request().query("SELECT COUNT(*) as total FROM Serials WHERE status = 'Dispatched' AND isDeleted = 0");
    const dispatchedSerials = dispatchedResult.recordset[0].total;

    const dispatchesResult = await pool.request().query("SELECT COUNT(*) as total FROM Dispatches WHERE isDeleted = 0");
    const totalDispatches = dispatchesResult.recordset[0].total;

    const recentDispatchesResult = await pool.request().query(`
      SELECT COUNT(*) as total 
      FROM Dispatches 
      WHERE dispatchDate >= DATEADD(day, -30, GETDATE()) AND isDeleted = 0
    `);
    const recentDispatches = recentDispatchesResult.recordset[0].total;

    const returnsResult = await pool.request().query("SELECT COUNT(*) as total FROM Returns WHERE isDeleted = 0");
    const totalReturns = returnsResult.recordset[0].total;

    const pendingInstallationsResult = await pool.request().query(`
      SELECT COUNT(*) as total 
      FROM Dispatches 
      WHERE (installationRequired = 1 OR installationRequired = 'true') AND installationStatus IN ('Pending', 'Scheduled') AND isDeleted = 0
    `);
    const pendingInstallations = pendingInstallationsResult.recordset[0].total;

    const revenueResult = await pool.request().query(`
      SELECT SUM(sellingPrice) as total 
      FROM Dispatches 
      WHERE dispatchDate >= DATEADD(day, -30, GETDATE()) AND isDeleted = 0
    `);
    const totalRevenue = revenueResult.recordset[0].total || 0;

    res.json({
      totalModels,
      totalSerials,
      availableSerials,
      dispatchedSerials,
      totalDispatches,
      recentDispatches,
      totalReturns,
      pendingInstallations,
      totalRevenue: Number(totalRevenue)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ SEARCH ROUTES
// =============================================
app.get("/api/search", async (req, res) => {
  try {
    const { q, type } = req.query;
    const pool = await getPool(res);
    if (!pool) return;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;
    let results = [];

    if (!type || type === 'all' || type === 'models') {
      const modelsResult = await pool.request()
        .input("search", sql.NVarChar, searchTerm)
        .query(`
          SELECT 'model' as type, id, name as title, company as subtitle, category as extra
          FROM Models 
          WHERE (name LIKE @search OR company LIKE @search OR category LIKE @search) AND isDeleted = 0
          ORDER BY name
        `);
      results = results.concat(modelsResult.recordset);
    }

    if (!type || type === 'all' || type === 'serials') {
      const serialsResult = await pool.request()
        .input("search", sql.NVarChar, searchTerm)
        .query(`
          SELECT 'serial' as type, s.id, s.value as title, m.name as subtitle, s.status as extra
          FROM Serials s
          JOIN Models m ON s.modelId = m.id
          WHERE s.value LIKE @search AND s.isDeleted = 0 AND m.isDeleted = 0
          ORDER BY s.value
        `);
      results = results.concat(serialsResult.recordset);
    }

    if (!type || type === 'all' || type === 'dispatches') {
      const dispatchesResult = await pool.request()
        .input("search", sql.NVarChar, searchTerm)
        .query(`
          SELECT 'dispatch' as type, d.id, d.firmName as title, COALESCE(d.customer, d.customerName) as subtitle, d.status as extra
          FROM Dispatches d
          WHERE (d.firmName LIKE @search OR COALESCE(d.customer, d.customerName) LIKE @search OR COALESCE(d.address, d.shippingAddress) LIKE @search) AND d.isDeleted = 0
          ORDER BY d.dispatchDate DESC
        `);
      results = results.concat(dispatchesResult.recordset);
    }

    if (!type || type === 'all' || type === 'returns') {
      const returnsResult = await pool.request()
        .input("search", sql.NVarChar, searchTerm)
        .query(`
          SELECT 'return' as type, r.id, s.value as title, r.condition as subtitle, r.returnDate as extra
          FROM Returns r
          JOIN Serials s ON r.serialNumberId = s.id
          WHERE s.value LIKE @search AND r.isDeleted = 0
          ORDER BY r.returnDate DESC
        `);
      results = results.concat(returnsResult.recordset);
    }

    res.json(results.slice(0, 50));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ EXPORT ROUTES
// =============================================
app.get("/api/export/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'csv', startDate, endDate } = req.query;
    const pool = await getPool(res);
    if (!pool) return;

    let query, filename;
    const request = pool.request();

    switch (type) {
      case 'models':
        query = `
          SELECT m.name, m.company, m.category, m.colorType, m.printerType, m.description, m.mrp, m.stockQuantity, m.packagingCost,
                 COUNT(s.id) as totalSerials, SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) as availableSerials
          FROM Models m
          LEFT JOIN Serials s ON m.id = s.modelId AND s.isDeleted = 0
          WHERE m.isDeleted = 0
          GROUP BY m.id, m.name, m.company, m.category, m.colorType, m.printerType, m.description, m.mrp, m.stockQuantity, m.packagingCost
          ORDER BY m.name
        `;
        filename = 'models';
        break;

      case 'serials':
        query = `
          SELECT s.value as serialNumber, m.name as modelName, m.company, s.landingPrice, m.mrp, 
                 s.landingPriceReason, s.status, s.createdAt
          FROM Serials s
          JOIN Models m ON s.modelId = m.id
          WHERE s.isDeleted = 0 AND m.isDeleted = 0
          ORDER BY s.createdAt DESC
        `;
        filename = 'serials';
        break;

      case 'dispatches':
        query = `
          SELECT d.dispatchDate, d.firmName, COALESCE(d.customer, d.customerName) as customer,
                 COALESCE(d.address, d.shippingAddress) as address,
                 d.sellingPrice, d.packagingCost, d.commission, s.value as serialNumber, 
                 m.name as modelName, m.company, d.status, d.installationRequired, d.installationStatus,
                 d.courierPartner, d.trackingId, d.freightCharges, d.logisticsStatus, d.ewayBillFilename
          FROM Dispatches d
          JOIN Serials s ON d.serialNumberId = s.id
          JOIN Models m ON s.modelId = m.id
          WHERE d.isDeleted = 0
        `;

        if (startDate && endDate) {
          query += " AND d.dispatchDate >= @start AND d.dispatchDate <= @end";
          request.input("start", sql.DateTime, startDate);
          request.input("end", sql.DateTime, endDate);
        }

        query += " ORDER BY d.dispatchDate DESC";
        filename = 'dispatches';
        break;

      case 'returns':
        query = `
          SELECT r.returnDate, s.value as serialNumber, m.name as modelName, r.condition,
                 r.dispatchId as orderId, r.invoiceNumber, r.reason
          FROM Returns r
          JOIN Serials s ON r.serialNumberId = s.id
          JOIN Models m ON s.modelId = m.id
          WHERE r.isDeleted = 0
          ORDER BY r.returnDate DESC
        `;
        filename = 'returns';
        break;

      default:
        return res.status(400).json({ message: "Invalid export type" });
    }

    const result = await request.query(query);
    const data = result.recordset;
1
    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(404).json({ message: "No data to export" });
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row =>
        Object.values(row).map(val => `"${val || ''}"`).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ✅ BULK ORDERS & REPLACEMENTS (NEW ARCHITECTURE)
// =============================================

// 1. Create a Bulk Order
app.post("/api/bulk-orders", requireAuth, async (req, res) => {
  try {
    const { customerName, firmName, totalAmount, serialIds, invoice, dispatch } = req.body;
    const pool = await getPool(res);
    if (!pool) return;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // A. Create Parent Order
      const orderReq = new sql.Request(transaction);
      const orderRes = await orderReq
        .input("customerName", sql.NVarChar, customerName)
        .input("firmName", sql.NVarChar, firmName)
        .input("totalAmount", sql.Decimal(18, 2), totalAmount || 0)
        .input("createdBy", sql.NVarChar, req.user?.username || "System")
        .query(`
          INSERT INTO BulkOrders (customerName, firmName, totalAmount, createdBy, status)
          OUTPUT INSERTED.id VALUES (@customerName, @firmName, @totalAmount, @createdBy, 'Pending')
        `);
      const orderId = orderRes.recordset[0].id;

      // B. Link Serials & Mark as Dispatched
      for (const sId of serialIds) {
        const itemReq = new sql.Request(transaction);
        await itemReq
          .input("orderId", sql.Int, orderId)
          .input("serialId", sql.Int, sId)
          .query("INSERT INTO BulkOrderItems (orderId, serialNumberId, itemStatus) VALUES (@orderId, @serialId, 'Active')");
          
        const serialUpdateReq = new sql.Request(transaction);
        await serialUpdateReq.input("sId", sql.Int, sId).query("UPDATE Serials SET status = 'Dispatched' WHERE id = @sId");
      }

      // C. Initial Invoice (Optional)
      if (invoice && invoice.invoiceNumber) {
        const invReq = new sql.Request(transaction);
        await invReq
          .input("orderId", sql.Int, orderId)
          .input("invNum", sql.NVarChar, invoice.invoiceNumber)
          .input("ewayNum", sql.NVarChar, invoice.ewayBillNumber || null)
          .query("INSERT INTO BulkOrderInvoices (orderId, invoiceNumber, ewayBillNumber) VALUES (@orderId, @invNum, @ewayNum)");
      }

      // D. Initial Dispatch (Optional)
      if (dispatch && dispatch.trackingId) {
        const dispReq = new sql.Request(transaction);
        await dispReq
          .input("orderId", sql.Int, orderId)
          .input("trackId", sql.NVarChar, dispatch.trackingId)
          .input("partner", sql.NVarChar, dispatch.courierPartner || null)
          .query("INSERT INTO BulkOrderDispatches (orderId, trackingId, courierPartner, logisticsStatus) VALUES (@orderId, @trackId, @partner, 'Dispatched')");
      }

      await transaction.commit();
      res.status(201).json({ message: "Bulk order created successfully", orderId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Handle Replacements & Re-billing/Re-dispatching
app.post("/api/bulk-orders/:id/replace", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { replacements, invoice, dispatch, reason } = req.body; 
    // replacements = [{ oldSerialId: 1, newSerialId: 2 }]

    const pool = await getPool(res);
    if (!pool) return;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // A. Process each serial replacement
      for (const rep of replacements) {
        // 1. Mark Old Serial as Available/Damaged
        const oldReq = new sql.Request(transaction);
        await oldReq.input("oldId", sql.Int, rep.oldSerialId).query("UPDATE Serials SET status = 'Available' WHERE id = @oldId");
        
        // 2. Mark New Serial as Dispatched
        const newReq = new sql.Request(transaction);
        await newReq.input("newId", sql.Int, rep.newSerialId).query("UPDATE Serials SET status = 'Dispatched' WHERE id = @newId");

        // 3. Update Old Item Status
        const updateItemReq = new sql.Request(transaction);
        await updateItemReq.input("orderId", sql.Int, id).input("oldId", sql.Int, rep.oldSerialId)
          .query("UPDATE BulkOrderItems SET itemStatus = 'Replaced' WHERE orderId = @orderId AND serialNumberId = @oldId AND itemStatus = 'Active'");

        // 4. Insert New Item
        const insertItemReq = new sql.Request(transaction);
        await insertItemReq.input("orderId", sql.Int, id).input("newId", sql.Int, rep.newSerialId)
          .query("INSERT INTO BulkOrderItems (orderId, serialNumberId, itemStatus) VALUES (@orderId, @newId, 'Active')");

        // 5. Record History
        const histReq = new sql.Request(transaction);
        await histReq
          .input("orderId", sql.Int, id)
          .input("old", sql.Int, rep.oldSerialId)
          .input("new", sql.Int, rep.newSerialId)
          .input("reason", sql.NVarChar, reason || 'Replaced')
          .input("user", sql.NVarChar, req.user?.username || 'System')
          .query("INSERT INTO ReplacementHistory (orderId, oldSerialId, newSerialId, reason, replacedBy) VALUES (@orderId, @old, @new, @reason, @user)");
      }

      // B. Handle Re-Billing (if provided)
      if (invoice && invoice.invoiceNumber) {
        const invReq = new sql.Request(transaction);
        await invReq.input("orderId", sql.Int, id).input("invNum", sql.NVarChar, invoice.invoiceNumber).input("eway", sql.NVarChar, invoice.ewayBillNumber || null)
          .query("INSERT INTO BulkOrderInvoices (orderId, invoiceNumber, ewayBillNumber) VALUES (@orderId, @invNum, @eway)");
      }

      // C. Handle Re-Dispatch (if provided)
      if (dispatch && dispatch.trackingId) {
        const dispReq = new sql.Request(transaction);
        await dispReq.input("orderId", sql.Int, id).input("trackId", sql.NVarChar, dispatch.trackingId).input("partner", sql.NVarChar, dispatch.courierPartner || null)
          .query("INSERT INTO BulkOrderDispatches (orderId, trackingId, courierPartner, logisticsStatus) VALUES (@orderId, @trackId, @partner, 'Dispatched')");
      }

      await transaction.commit();
      res.json({ message: "Replacement processed successfully" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. Consolidated Bulk Order Payment
app.post("/api/bulk-orders/:id/payment", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, utrId, paymentDate } = req.body;

    const pool = await getPool(res);
    if (!pool) return;

    await pool.request()
      .input("orderId", sql.Int, id)
      .input("amount", sql.Decimal(18,2), amount)
      .input("utr", sql.NVarChar, utrId)
      .input("pDate", sql.DateTime, safeDate(paymentDate))
      .query(`
        INSERT INTO BulkOrderPayments (orderId, amount, utrId, paymentDate) VALUES (@orderId, @amount, @utr, @pDate);
        UPDATE BulkOrders SET status = 'Completed' WHERE id = @orderId;
      `);

    res.json({ message: "Consolidated payment recorded successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Information Tab View (Consolidated Timeline)
app.get("/api/bulk-orders/:id/consolidated", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool(res);
    if (!pool) return;

    const order = await pool.request().input("id", sql.Int, id).query("SELECT * FROM BulkOrders WHERE id = @id");
    const serials = await pool.request().input("id", sql.Int, id).query("SELECT boi.*, s.value as serialValue, m.name as modelName FROM BulkOrderItems boi JOIN Serials s ON boi.serialNumberId = s.id JOIN Models m ON s.modelId = m.id WHERE boi.orderId = @id ORDER BY boi.addedAt ASC");
    const replacements = await pool.request().input("id", sql.Int, id).query("SELECT r.*, oldS.value as oldSerial, newS.value as newSerial FROM ReplacementHistory r JOIN Serials oldS ON r.oldSerialId = oldS.id JOIN Serials newS ON r.newSerialId = newS.id WHERE r.orderId = @id ORDER BY r.createdAt ASC");
    const invoices = await pool.request().input("id", sql.Int, id).query("SELECT * FROM BulkOrderInvoices WHERE orderId = @id ORDER BY createdAt ASC");
    const dispatches = await pool.request().input("id", sql.Int, id).query("SELECT * FROM BulkOrderDispatches WHERE orderId = @id ORDER BY dispatchDate ASC");
    const payments = await pool.request().input("id", sql.Int, id).query("SELECT * FROM BulkOrderPayments WHERE orderId = @id ORDER BY createdAt ASC");

    res.json({ order: order.recordset[0], serials: serials.recordset, replacements: replacements.recordset, invoices: invoices.recordset, dispatches: dispatches.recordset, payments: payments.recordset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================================
// ✅ START SERVER
// ================================
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
