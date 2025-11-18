require("dotenv").config();

const express = require("express");
const serverless = require("serverless-http");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// ---------- Express ----------
const app = express();
app.use(express.json());

// ---------- CORS ----------
const allowedOrigins = [
  "http://localhost:5173",
  "https://startling-cupcake-39922c.netlify.app",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// ---------- Firebase Admin Init (Works on Vercel + Local) ----------
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  try {
    let serviceAccount;

    // On Vercel / Production → use environment variable
    if (process.env.VERCEL || process.env.FIREBASE_SERVICE_ACCOUNT) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
      // serviceAccount = JSON.parse(raw);
      serviceAccount = JSON.parse(
        raw.replace(/\\n/g, "\n")  
      );
    }
    // Local development → try file first (safe & easy)
    else {
      serviceAccount = require("../firebase-service-account.json"); // <-- place file in project root
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase init failed:", error.message);
    // Don't crash locally if you're just testing
    if (!process.env.VERCEL) {
      console.log("Running without auth (local dev only)");
    } else {
      throw error; // Crash in production if config is wrong
    }
  }
}

initFirebase(); // ← This runs on server start

// ---------- Auth Middleware ----------
async function verifyToken(req, res, next) {
  if (!firebaseInitialized) {
    return res.status(503).json({ message: "Auth not available" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // ← contains uid, email, etc.
    next();
  } catch (err) {
    console.error("Token error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ---------- MongoDB ----------
const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI missing");

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let dbPromise = null;
async function getDb() {
  if (!dbPromise) {
    await client.connect();
    console.log("MongoDB connected");
    dbPromise = client.db("movemasterdb");
  }
  return dbPromise;
}

const handle = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  });

// ---------- Routes ----------

// Public routes (no auth)
app.get("/api/movies", handle(async (req, res) => {
  const db = await getDb();
  const movies = await db.collection("movies").find().toArray();
  res.json(movies);
}));

app.get("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const movie = await db.collection("movies").findOne({ _id: new ObjectId(req.params.id) });
  if (!movie) return res.status(404).json({ message: "Not found" });
  res.json(movie);
}));

// Protected routes (require login)
app.post("/api/movies", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, createdAt: new Date() };
  const result = await db.collection("movies").insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
}));

app.put("/api/movies/:id", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { ...req.body, updatedAt: new Date() } }
  );
  if (!result.matchedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Updated" });
}));

app.delete("/api/movies/:id", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}));

// Watchlist routes (protected + user-enforced)
app.post("/api/watchListInsert", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, addedBy: req.user.uid, createdAt: new Date() };
  const result = await db.collection("watchList").insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
}));

app.get("/api/myWatchList/:addedBy", verifyToken, handle(async (req, res) => {
  if (req.params.addedBy !== req.user.uid) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const db = await getDb();
  const items = await db.collection("watchList").find({ addedBy: req.user.uid }).toArray();
  res.json(items.length ? items : []);
}));

app.delete("/api/watchListDelete/:addedBy/:movieId", verifyToken, handle(async (req, res) => {
  if (req.params.addedBy !== req.user.uid) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const db = await getDb();
  const result = await db.collection("watchList").deleteOne({
    addedBy: req.user.uid,
    movieId: req.params.movieId,
  });
  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ success: true, message: "Removed from watchlist" });
}));

app.get("/api/watchlist/check/:addedBy/:movieId", verifyToken, handle(async (req, res) => {
  if (req.params.addedBy !== req.user.uid) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const db = await getDb();
  const item = await db.collection("watchList").findOne({
    addedBy: req.user.uid,
    movieId: req.params.movieId,
  });
  res.json({ inWatchlist: !!item });
}));

// Root
app.get("/", (req, res) => res.send("MovieMaster Server Running!"));

// Export
module.exports = app;
module.exports.handler = serverless(app);