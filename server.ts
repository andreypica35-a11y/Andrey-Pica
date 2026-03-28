import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore } from "firebase/firestore";
import { initializeApp as initializeAdminApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Client SDK for legacy/other uses if needed
const firebaseConfig = JSON.parse(readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Admin SDK
// We explicitly provide the projectId and databaseId to ensure it connects to the correct Firestore instance.
const adminApp = !getApps().length 
  ? initializeAdminApp({
      credential: applicationDefault(),
      projectId: firebaseConfig.projectId,
    })
  : getApps()[0];

const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
const adminAuth = getAdminAuth(adminApp);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Middleware to verify Firebase ID Token
const verifyToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// Cleanup expired gigs (Admin only or system)
app.post("/api/gigs/cleanup", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log(`Running cleanup for gigs older than ${sevenDaysAgo.toISOString()}`);

    const gigsRef = adminDb.collection("gigs");
    const snapshot = await gigsRef.where("status", "==", "open").get();

    if (snapshot.empty) {
      console.log("No open gigs found for cleanup.");
      return res.json({ success: true, count: 0 });
    }

    console.log(`Found ${snapshot.size} open gigs. Checking for expiration...`);

    const batch = adminDb.batch();
    let count = 0;
    snapshot.docs.forEach((document) => {
      const data = document.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt);
      
      const dateValue = createdAt instanceof Date ? createdAt : (createdAt ? new Date(createdAt) : null);

      if (dateValue && dateValue < sevenDaysAgo) {
        console.log(`Expiring gig: ${document.id} (Created at: ${dateValue.toISOString()})`);
        batch.update(adminDb.doc(`gigs/${document.id}`), { status: "expired" });
        count++;
      }
    });

    if (count > 0) {
      console.log(`Committing batch update for ${count} gigs...`);
      await batch.commit();
      console.log("Batch update successful.");
    } else {
      console.log("No gigs met the expiration criteria.");
    }
    res.json({ success: true, count });
  } catch (error) {
    console.error(`Cleanup error (Project: ${firebaseConfig.projectId}, DB: ${firebaseConfig.firestoreDatabaseId}):`, error);
    res.status(500).json({ error: "Failed to cleanup gigs", details: error.message });
  }
});

// Secure Payment Processing Endpoint
app.post("/api/payments/process", verifyToken, async (req: any, res) => {
  const { amount, gigId, employerId, workerId, method } = req.body;
  const currentUserUid = req.user.uid;

  if (!amount || !gigId || !employerId || !workerId || !method) {
    return res.status(400).json({ error: "Missing required payment fields" });
  }

  if (employerId !== currentUserUid) {
    return res.status(403).json({ error: "Forbidden: You are not the employer of this gig" });
  }

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const gigRef = adminDb.doc(`gigs/${gigId}`);
      const gigDoc = await transaction.get(gigRef);

      if (!gigDoc.exists) {
        throw new Error("Gig not found");
      }

      const gigData = gigDoc.data();
      if (gigData?.employerId !== employerId) {
        throw new Error("Employer ID mismatch");
      }

      if (gigData?.status !== "in-progress" && gigData?.status !== "review") {
        throw new Error("Gig is not in a payable state");
      }

      const serviceFee = amount * 0.05;
      const workerAmount = amount - serviceFee;
      const transactionId = `${method.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // 1. Update gig status
      transaction.update(gigRef, { 
        status: "completed",
        completedAt: FieldValue.serverTimestamp()
      });

      // 2. Create transaction record for employer
      const employerTxRef = adminDb.collection("transactions").doc();
      transaction.set(employerTxRef, {
        userId: employerId,
        employerId,
        workerId,
        gigId,
        amount,
        serviceFee,
        workerAmount,
        method,
        status: "completed",
        type: "payment",
        transactionId,
        createdAt: FieldValue.serverTimestamp()
      });

      // 3. Create transaction record for worker
      const workerTxRef = adminDb.collection("transactions").doc();
      transaction.set(workerTxRef, {
        userId: workerId,
        employerId,
        workerId,
        gigId,
        amount,
        serviceFee,
        workerAmount,
        method,
        status: "completed",
        type: "payment",
        transactionId,
        createdAt: FieldValue.serverTimestamp()
      });

      // 4. Update worker balance
      const workerPrivateRef = adminDb.doc(`users_private/${workerId}`);
      transaction.update(workerPrivateRef, {
        balance: FieldValue.increment(workerAmount)
      });

      return {
        success: true,
        transactionId,
        amount,
        serviceFee,
        workerAmount,
        method,
        status: "completed",
        employerId,
        workerId,
        gigId
      };
    });

    console.log(`Successfully processed ${method} payment for gig ${gigId}`);
    res.json(result);
  } catch (error: any) {
    console.error("Payment processing error:", error);
    res.status(500).json({ error: error.message || "Failed to process payment" });
  }
});

// Secure Top-up Endpoint
app.post("/api/payments/topup", verifyToken, async (req: any, res) => {
  const { amount, method } = req.body;
  const userId = req.user.uid;

  if (!amount || amount <= 0 || !method) {
    return res.status(400).json({ error: "Invalid top-up request" });
  }

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const privateRef = adminDb.doc(`users_private/${userId}`);
      const txRef = adminDb.collection("transactions").doc();

      // 1. Update balance
      transaction.update(privateRef, {
        balance: FieldValue.increment(amount)
      });

      // 2. Create transaction record
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

    res.json(result);
  } catch (error: any) {
    console.error("Top-up error:", error);
    res.status(500).json({ error: error.message || "Failed to process top-up" });
  }
});

// Secure Withdrawal Endpoint
app.post("/api/payments/withdraw", verifyToken, async (req: any, res) => {
  const { amount, method } = req.body;
  const userId = req.user.uid;

  if (!amount || amount < 100 || !method) {
    return res.status(400).json({ error: "Invalid withdrawal request. Minimum ₱100." });
  }

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const privateRef = adminDb.doc(`users_private/${userId}`);
      const privateDoc = await transaction.get(privateRef);

      if (!privateDoc.exists) {
        throw new Error("User profile not found");
      }

      const currentBalance = privateDoc.data()?.balance || 0;
      if (currentBalance < amount) {
        throw new Error("Insufficient balance");
      }

      const txRef = adminDb.collection("transactions").doc();

      // 1. Decrement balance
      transaction.update(privateRef, {
        balance: FieldValue.increment(-amount)
      });

      // 2. Create transaction record
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

    res.json(result);
  } catch (error: any) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: error.message || "Failed to process withdrawal" });
  }
});

// Automated ID Verification Endpoint
app.post("/api/verify-id", verifyToken, async (req: any, res) => {
  const { idType, idNumber, idImageURL } = req.body;
  const userId = req.user.uid;

  if (!idType || !idNumber) {
    return res.status(400).json({ error: "Missing required ID information" });
  }

  try {
    // Simulate automated check (e.g., OCR or external service)
    // In a real app, you'd process the idImageURL here
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`Verifying ID for user: ${userId}, ID Type: ${idType}`);

    const publicRef = adminDb.doc(`users/${userId}`);
    const privateRef = adminDb.doc(`users_private/${userId}`);

    await adminDb.runTransaction(async (transaction) => {
      transaction.update(publicRef, {
        isVerified: true,
        verificationStatus: 'verified',
        idType,
        idNumber
      });
      transaction.update(privateRef, {
        idType,
        idNumber,
        idImageURL,
        verifiedAt: FieldValue.serverTimestamp()
      });
    });

    console.log(`ID verification successful for user: ${userId}`);
    res.json({ success: true, message: "ID verified successfully!" });
  } catch (error: any) {
    console.error("Verification error:", error);
    res.status(500).json({ error: error.message || "Failed to verify ID" });
  }
});

async function startServer() {
  const PORT = 3000;

  // Test Admin Firestore connection
  try {
    console.log(`Testing Admin Firestore connection to project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId}`);
    await adminDb.collection("health_check").doc("admin").set({
      lastChecked: FieldValue.serverTimestamp(),
      status: "ok"
    }, { merge: true });
    console.log("Admin Firestore connection test successful.");
  } catch (error) {
    console.error("Admin Firestore connection test failed:", error);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
