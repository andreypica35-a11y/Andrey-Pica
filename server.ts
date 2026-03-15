import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Generic Payment Processing Endpoint
  app.post("/api/payments/process", (req, res) => {
    const { amount, gigId, employerId, workerId, method } = req.body;
    
    if (!amount || !gigId || !employerId || !workerId || !method) {
      return res.status(400).json({ error: "Missing required payment fields" });
    }

    const serviceFee = amount * 0.05;
    const workerAmount = amount - serviceFee;

    // Simulate different payment processing logic
    console.log(`Processing ${method} payment of ₱${amount} for gig ${gigId}`);
    
    res.json({
      success: true,
      transactionId: `${method.toUpperCase()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      amount,
      serviceFee,
      workerAmount,
      method,
      status: "completed"
    });
  });

  // Keep legacy GCash endpoint for backward compatibility
  app.post("/api/payments/gcash", (req, res) => {
    const { amount, gigId, employerId, workerId } = req.body;
    
    if (!amount || !gigId || !employerId || !workerId) {
      return res.status(400).json({ error: "Missing required payment fields" });
    }

    const serviceFee = amount * 0.05;
    const workerAmount = amount - serviceFee;

    res.json({
      success: true,
      transactionId: `GCASH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      amount,
      serviceFee,
      workerAmount,
      method: "gcash",
      status: "completed"
    });
  });

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
