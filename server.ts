import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp as initializeAdminApp, getApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import axios from "axios";
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  doc as clientDoc, 
  increment as clientIncrement, 
  collection as clientCollection, 
  serverTimestamp as clientServerTimestamp,
  runTransaction as clientRunTransaction
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. SAFE CONFIG LOADING
let firebaseConfig: any = {};
try {
  // Use process.cwd() for more reliable pathing in Vercel
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  firebaseConfig = JSON.parse(readFileSync(configPath, "utf8"));
} catch (error) {
  console.error("CRITICAL: Could not load firebase-applet-config.json", error);
  // Fallback to Env Vars if file is missing
  firebaseConfig = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID
  };
}

// Initialize Firebase Admin SDK
let adminApp;
try {
  adminApp = getApps().length > 0 ? getApps()[0] : initializeAdminApp({
    projectId: firebaseConfig.projectId,
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
}

// Try to use the named database, fallback to (default) if it fails
let adminDb: any;
if (adminApp) {
  try {
    adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    console.log(`Using Firestore database: ${firebaseConfig.firestoreDatabaseId}`);
  } catch (e) {
    console.warn("Failed to initialize with named database, falling back to (default)");
    adminDb = getAdminFirestore(adminApp);
  }
  adminDb.settings({ ignoreUndefinedProperties: true });
}

// Explicitly create a default database instance for cleanup
let cleanupDb: any;
if (adminApp) {
  cleanupDb = getAdminFirestore(adminApp);
  cleanupDb.settings({ ignoreUndefinedProperties: true });
}

const adminAuth = adminApp ? getAdminAuth(adminApp) : null;

// Initialize Firebase Client SDK
let clientApp;
let clientDb;
try {
  clientApp = initializeClientApp(firebaseConfig);
  clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Failed to initialize Firebase Client SDK:", error);
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[API Request] ${req.method} ${req.path}`);
  }
  next();
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    // Test Firestore connection
    await adminDb.collection("health_check").doc("admin").set({
      lastCheck: FieldValue.serverTimestamp(),
      status: "ok"
    }, { merge: true });
    res.json({ 
      status: "ok", 
      firestore: "connected",
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error("Health check failed:", error);
    res.status(500).json({ 
      success: false,
      message: error.message,
      status: "error", 
      firestore: "disconnected",
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      timestamp: new Date().toISOString() 
    });
  }
});

// Middleware to verify Firebase ID Token
const verifyToken = async (req: any, res: any, next: any) => {
  console.log(`[VerifyToken] Path: ${req.path}, Body:`, req.body);
  if (!adminAuth) {
    console.error("Firebase Admin Auth not initialized");
    return res.status(500).json({ success: false, message: "Internal Server Error: Auth not initialized" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
  }
};

// Test Admin DB connectivity
app.get("/api/test-admin-db", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("gigs").limit(1).get();
    res.json({ 
      success: true, 
      count: snapshot.size,
      database: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId,
      using: "admin-sdk"
    });
  } catch (error) {
    console.error("[Test Admin DB Error]", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      database: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId
    });
  }
});

// Cleanup expired gigs (Admin only or system)
let lastCleanup = 0;
app.post("/api/gigs/cleanup", async (req, res) => {
  if (Date.now() - lastCleanup < 3600000) {
    return res.json({ success: true, message: "Skipped: Cleanup run too recently" });
  }
  
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log(`[Cleanup] Running for gigs older than ${sevenDaysAgo.toISOString()}`);
    
    const gigsRef = cleanupDb.collection("gigs");
    
    try {
      const check = await gigsRef.limit(1).get();
      if (check.empty) {
        lastCleanup = Date.now();
        return res.json({ success: true, count: 0 });
      }
    } catch (accessError: any) {
      if (accessError.code === 5) { // NOT_FOUND
        lastCleanup = Date.now();
        return res.json({ success: true, count: 0 });
      }
      throw accessError;
    }

    const snapshot = await gigsRef.where("status", "==", "open").get();
    lastCleanup = Date.now();

    if (snapshot.empty) {
      return res.json({ success: true, count: 0 });
    }

    const batch = cleanupDb.batch();
    let count = 0;
    
    for (const document of snapshot.docs) {
      const data = document.data();
      const createdAtRaw = data.createdAt;
      let dateValue: Date | null = null;

      if (createdAtRaw) {
        if (typeof createdAtRaw.toDate === 'function') {
          dateValue = createdAtRaw.toDate();
        } else if (createdAtRaw instanceof Timestamp) {
          dateValue = createdAtRaw.toDate();
        } else if (createdAtRaw instanceof Date) {
          dateValue = createdAtRaw;
        } else if (typeof createdAtRaw === 'string' || typeof createdAtRaw === 'number') {
          dateValue = new Date(createdAtRaw);
        }
      }

      if (dateValue && dateValue < sevenDaysAgo) {
        const gigDocRef = adminDb.doc(`gigs/${document.id}`);
        batch.update(gigDocRef, { status: "expired" });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`[Cleanup] Successfully expired ${count} gigs.`);
    }

    res.json({ success: true, count });
  } catch (error: any) {
    console.error(`[Cleanup Error]:`, error);
    res.status(500).json({ success: false, message: error.message || "Failed to cleanup gigs" });
  }
});

// Secure Payment Processing Endpoint
app.post("/api/payments/process", verifyToken, async (req: any, res) => {
  const { amount, gigId, employerId, workerId, method } = req.body;
  const currentUserUid = req.user.uid;

  if (!amount || !gigId || !employerId || !workerId || !method) {
    return res.status(400).json({ success: false, message: "Missing required payment fields" });
  }

  if (employerId !== currentUserUid) {
    return res.status(403).json({ success: false, message: "Forbidden: You are not the employer of this gig" });
  }

  try {
    console.log(`[Payment Process] Request for gig ${gigId}, amount ${amount}`);
    
    if (adminDb) {
      try {
        console.log(`[Payment Process] Attempting Admin SDK transaction for gig ${gigId}`);
        const result = await adminDb.runTransaction(async (transaction: any) => {
          const gigRef = adminDb.doc(`gigs/${gigId}`);
          const gigDoc = await transaction.get(gigRef);

          if (!gigDoc.exists) throw new Error("Gig not found");
          const gigData = gigDoc.data();
          if (gigData?.employerId !== employerId) throw new Error("Employer ID mismatch");
          if (gigData?.status !== "in-progress" && gigData?.status !== "review") throw new Error("Gig is not in a payable state");

          const employerFee = amount * 0.10;
          const totalCharge = amount + employerFee;
          const workerAmount = amount;
          const transactionId = `${method.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

          const employerPrivateRef = adminDb.doc(`users_private/${employerId}`);
          const employerDoc = await transaction.get(employerPrivateRef);
          if (!employerDoc.exists) throw new Error("Employer profile not found");
          const employerBalance = employerDoc.data()?.balance || 0;
          if (employerBalance < totalCharge) throw new Error(`Insufficient balance. Total charge is ₱${totalCharge.toLocaleString()}`);

          transaction.update(gigRef, { 
            status: "completed",
            completedAt: FieldValue.serverTimestamp(),
            totalPaid: totalCharge,
            serviceFee: employerFee
          });

          const employerTxRef = adminDb.collection("transactions").doc();
          transaction.set(employerTxRef, {
            userId: employerId,
            employerId,
            workerId,
            gigId,
            amount: totalCharge,
            baseAmount: amount,
            serviceFee: employerFee,
            workerAmount,
            method,
            status: "completed",
            type: "payment",
            transactionId,
            createdAt: FieldValue.serverTimestamp()
          });

          const workerTxRef = adminDb.collection("transactions").doc();
          transaction.set(workerTxRef, {
            userId: workerId,
            employerId,
            workerId,
            gigId,
            amount: workerAmount,
            serviceFee: 0,
            workerAmount,
            method,
            status: "completed",
            type: "payment",
            transactionId,
            createdAt: FieldValue.serverTimestamp()
          });

          const workerPrivateRef = adminDb.doc(`users_private/${workerId}`);
          transaction.update(workerPrivateRef, { balance: FieldValue.increment(workerAmount) });
          transaction.update(employerPrivateRef, { balance: FieldValue.increment(-totalCharge) });

          return { success: true, transactionId, amount: totalCharge, method, status: "completed" };
        });
        return res.json(result);
      } catch (adminError: any) {
        console.warn(`[Payment Process Admin SDK Failed] Gig: ${gigId}, Error: ${adminError.message}`);
      }
    }

    console.log(`[Payment Process] Attempting Client SDK fallback for gig ${gigId}`);
    const result = await clientRunTransaction(clientDb, async (transaction) => {
      const gigRef = clientDoc(clientDb, "gigs", gigId);
      const gigDoc = await transaction.get(gigRef);
      if (!gigDoc.exists()) throw new Error("Gig not found");
      const gigData = gigDoc.data();
      if (gigData?.employerId !== employerId) throw new Error("Employer ID mismatch");

      const employerFee = amount * 0.10;
      const totalCharge = amount + employerFee;
      const workerAmount = amount;
      const transactionId = `${method.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const employerPrivateRef = clientDoc(clientDb, "users_private", employerId);
      const employerDoc = await transaction.get(employerPrivateRef);
      if (!employerDoc.exists()) throw new Error("Employer profile not found");
      const employerBalance = employerDoc.data()?.balance || 0;
      if (employerBalance < totalCharge) throw new Error(`Insufficient balance. Total charge is ₱${totalCharge.toLocaleString()}`);

      transaction.update(gigRef, { 
        status: "completed",
        completedAt: clientServerTimestamp(),
        totalPaid: totalCharge,
        serviceFee: employerFee
      });

      const employerTxRef = clientDoc(clientCollection(clientDb, "transactions"));
      transaction.set(employerTxRef, {
        userId: employerId,
        employerId,
        workerId,
        gigId,
        amount: totalCharge,
        baseAmount: amount,
        serviceFee: employerFee,
        workerAmount,
        method,
        status: "completed",
        type: "payment",
        transactionId,
        createdAt: clientServerTimestamp()
      });

      const workerTxRef = clientDoc(clientCollection(clientDb, "transactions"));
      transaction.set(workerTxRef, {
        userId: workerId,
        employerId,
        workerId,
        gigId,
        amount: workerAmount,
        serviceFee: 0,
        workerAmount,
        method,
        status: "completed",
        type: "payment",
        transactionId,
        createdAt: clientServerTimestamp()
      });

      const workerPrivateRef = clientDoc(clientDb, "users_private", workerId);
      transaction.update(workerPrivateRef, { balance: clientIncrement(workerAmount) });
      transaction.update(employerPrivateRef, { balance: clientIncrement(-totalCharge) });

      return { success: true, transactionId, amount: totalCharge, method, status: "completed" };
    });
    res.json(result);
  } catch (error: any) {
    console.error("[Payment Process Final Error]", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process payment" });
  }
});

// PayMongo Integration Configuration
const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || "";

const getPaymongoAuth = () => {
  if (!PAYMONGO_SECRET_KEY) throw new Error("PayMongo Secret Key is missing.");
  return {
    headers: {
      Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
  };
};

// Create Payment Intent
app.post("/api/paymongo/payment-intent", verifyToken, async (req: any, res) => {
  try {
    const { amount, currency, description } = req.body;
    const response = await axios.post(`${PAYMONGO_API_BASE}/payment_intents`, {
      data: {
        attributes: {
          amount: amount * 100,
          currency: currency || "PHP",
          payment_method_allowed: ["card", "gcash", "paymaya"],
          description: description || "Payment for gig"
        }
      }
    }, getPaymongoAuth());
    res.json(response.data);
  } catch (error: any) {
    console.error("PayMongo Payment Intent Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to create payment intent" });
  }
});

// Create Payment Link
app.post("/api/paymongo/payment-link", verifyToken, async (req: any, res) => {
  try {
    const { amount, description } = req.body;
    const response = await axios.post(`${PAYMONGO_API_BASE}/links`, {
      data: {
        attributes: {
          amount: amount * 100,
          description: description || "Payment link"
        }
      }
    }, getPaymongoAuth());
    res.json(response.data);
  } catch (error: any) {
    console.error("PayMongo Payment Link Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to create payment link" });
  }
});

// Get Payment Status
app.get("/api/paymongo/payment/:id", verifyToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PAYMONGO_API_BASE}/payments/${id}`, getPaymongoAuth());
    res.json(response.data);
  } catch (error: any) {
    console.error("PayMongo Payment Status Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to retrieve payment status" });
  }
});

// Secure Top-up Endpoint
app.post("/api/payments/topup", verifyToken, async (req: any, res) => {
  console.log(`[Top-up] req.body:`, req.body);
  const { amount, method } = req.body;
  const userId = req.user.uid;

  console.log(`[Top-up Request] User: ${userId}, Amount: ${amount}, Method: ${method}`);

  if (!amount || isNaN(amount) || amount <= 0 || !method) {
    console.error(`[Top-up] Invalid request: amount=${amount}, method=${method}`);
    return res.status(400).json({ success: false, message: "Invalid top-up request" });
  }

  try {
    if (adminDb) {
      try {
        console.log(`[Top-up] Attempting Admin SDK transaction for user ${userId}`);
        const result = await adminDb.runTransaction(async (transaction: any) => {
          const privateRef = adminDb.doc(`users_private/${userId}`);
          const txRef = adminDb.collection("transactions").doc();

          transaction.set(privateRef, { balance: FieldValue.increment(amount) }, { merge: true });
          transaction.set(txRef, {
            userId,
            amount,
            serviceFee: 0,
            workerAmount: amount,
            method,
            status: "completed",
            type: "deposit",
            createdAt: FieldValue.serverTimestamp()
          });

          return { success: true, amount, method };
        });
        return res.json(result);
      } catch (adminError: any) {
        console.warn(`[Top-up Admin SDK Failed] User: ${userId}, Error: ${adminError.message}`);
      }
    }

    console.log(`[Top-up] Attempting Client SDK fallback for user ${userId}`);
    try {
      await clientRunTransaction(clientDb, async (transaction) => {
        console.log(`[Top-up] Inside Client SDK transaction`);
        const privateRef = clientDoc(clientDb, "users_private", userId);
        transaction.set(privateRef, { balance: clientIncrement(amount) }, { merge: true });

        const newTxRef = clientDoc(clientCollection(clientDb, "transactions"));
        transaction.set(newTxRef, {
          userId,
          amount,
          serviceFee: 0,
          workerAmount: amount,
          method,
          status: "completed",
          type: "deposit",
          createdAt: clientServerTimestamp()
        });
      });
      res.json({ success: true, amount, method });
    } catch (clientError: any) {
      console.error("[Top-up Client SDK Failed]", clientError);
      res.status(500).json({ success: false, message: clientError.message || "Failed to process top-up via Client SDK" });
    }
  } catch (error: any) {
    console.error("[Top-up Final Error]", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process top-up" });
  }
});

// Secure Withdrawal Endpoint
app.post("/api/payments/withdraw", verifyToken, async (req: any, res) => {
  const { amount, method } = req.body;
  const userId = req.user.uid;

  if (!amount || amount < 100 || !method) {
    return res.status(400).json({ success: false, message: "Invalid withdrawal request. Minimum ₱100." });
  }

  try {
    if (adminDb) {
      try {
        console.log(`[Withdrawal] Attempting Admin SDK transaction for user ${userId}`);
        const result = await adminDb.runTransaction(async (transaction: any) => {
          const privateRef = adminDb.doc(`users_private/${userId}`);
          const privateDoc = await transaction.get(privateRef);
          if (!privateDoc.exists) throw new Error("User profile not found");
          const currentBalance = privateDoc.data()?.balance || 0;
          if (currentBalance < amount) throw new Error("Insufficient balance");

          const txRef = adminDb.collection("transactions").doc();
          transaction.update(privateRef, { balance: FieldValue.increment(-amount) });
          transaction.set(txRef, {
            userId,
            amount,
            serviceFee: 0,
            workerAmount: amount,
            method,
            status: "pending",
            type: "withdrawal",
            createdAt: FieldValue.serverTimestamp()
          });

          return { success: true, amount, method };
        });
        return res.json(result);
      } catch (adminError: any) {
        console.warn(`[Withdrawal Admin SDK Failed] User: ${userId}, Error: ${adminError.message}`);
      }
    }

    console.log(`[Withdrawal] Attempting Client SDK fallback for user ${userId}`);
    const result = await clientRunTransaction(clientDb, async (transaction) => {
      const privateRef = clientDoc(clientDb, "users_private", userId);
      const privateDoc = await transaction.get(privateRef);
      if (!privateDoc.exists()) throw new Error("User profile not found");
      const currentBalance = privateDoc.data()?.balance || 0;
      if (currentBalance < amount) throw new Error("Insufficient balance");

      const txRef = clientDoc(clientCollection(clientDb, "transactions"));
      transaction.update(privateRef, { balance: clientIncrement(-amount) });
      transaction.set(txRef, {
        userId,
        amount,
        serviceFee: 0,
        workerAmount: amount,
        method,
        status: "pending",
        type: "withdrawal",
        createdAt: clientServerTimestamp()
      });

      return { success: true, amount, method };
    });
    res.json(result);
  } catch (error: any) {
    console.error("[Withdrawal Final Error]", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process withdrawal" });
  }
});

// Automated ID Verification Endpoint
app.post("/api/verify-id", verifyToken, async (req: any, res) => {
  if (!adminDb) return res.status(500).json({ success: false, message: "Firestore Admin not initialized" });
  const { idType, idNumber, idImageURL } = req.body;
  const userId = req.user.uid;

  if (!idType || !idNumber) return res.status(400).json({ success: false, message: "Missing required ID information" });

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const publicRef = adminDb.doc(`users/${userId}`);
    const privateRef = adminDb.doc(`users_private/${userId}`);

    await adminDb.runTransaction(async (transaction) => {
      transaction.update(publicRef, { isVerified: true, verificationStatus: 'verified', idType, idNumber });
      transaction.update(privateRef, { idType, idNumber, idImageURL, verifiedAt: FieldValue.serverTimestamp() });
    });

    res.json({ success: true, message: "ID verified successfully!" });
  } catch (error: any) {
    console.error("Verification error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to verify ID" });
  }
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[Global Error Handler]", err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: "Internal Server Error", details: err.message });
  }
});

// 2. PREVENT app.listen IN PRODUCTION (Vercel)
async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

if (process.env.NODE_ENV !== "production") {
  startServer();
}

// 3. EXPORT FOR VERCEL
export default app;
