require("dotenv").config();

const express = require("express");
const serverless = require("serverless-http");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// ---------- Express ----------
const app = express();
app.use(express.json());

// ---------- CORS FIX ----------
const allowedOrigins = [
  "http://localhost:5173",
  "https://startling-cupcake-39922c.netlify.app"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// ---------- Firebase ----------
// Initialize Firebase Admin on startup
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  let serviceAccount;

  try {
    // Production (Vercel) → use env var
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT missing in production");
      }
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      serviceAccount = require("./firebase-service-account.json"); // ← create this file
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log("Firebase Admin initialized successfully");
  } catch (e) {
    console.error("Firebase init failed:", e.message);
    // Don't crash the whole server locally if you're just testing
    if (process.env.NODE_ENV !== "production") {
      console.log("Running without Firebase auth (local dev only)");
      firebaseInitialized = false; // auth will 401 but server stays up
    } else {
      throw e; // crash in production if env var is broken
    }
  }
}

initFirebase(); // Call it here to ensure it's ready

// Authentication middleware to verify Firebase ID token
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Missing token" });
  }

  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Attach user info (e.g., uid) to req
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
}

// ---------- MongoDB ----------
const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI not found");

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

// ---------- Helper ----------
const handle = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  });

// ---------- Routes ----------

// Get all movies (public, no auth needed)
app.get("/api/movies", handle(async (req, res) => {
  const db = await getDb();
  const movies = await db.collection("movies").find().toArray();
  res.json(movies);
}));

// Get movie by ID (public)
app.get("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const movie = await db.collection("movies").findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!movie) return res.status(404).json({ message: "Not found" });
  res.json(movie);
}));

// Add movie (require auth)
app.post("/api/movies", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, createdAt: new Date() };
  const result = await db.collection("movies").insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
}));

// Update movie (require auth)
app.put("/api/movies/:id", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { ...req.body, updatedAt: new Date() } }
  );

  if (!result.matchedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Updated" });
}));

// Delete movie (require auth)
app.delete("/api/movies/:id", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").deleteOne({
    _id: new ObjectId(req.params.id),
  });

  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}));

// ---------- Watchlist ----------

// Insert (require auth, set addedBy from token, ignore body addedBy)
app.post("/api/watchListInsert", verifyToken, handle(async (req, res) => {
  const db = await getDb();
  const movie = {
    ...req.body,
    addedBy: req.user.uid, // Enforce from authenticated user
    createdAt: new Date()
  };
  const result = await db.collection("watchList").insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
}));

// Get user's watchlist (require auth, verify addedBy matches user)
app.get("/api/myWatchList/:addedBy", verifyToken, handle(async (req, res) => {
  if (req.params.addedBy !== req.user.uid) {
    return res.status(403).json({ message: "Forbidden: Not your watchlist" });
  }
  const db = await getDb();
  const items = await db.collection("watchList").find({
    addedBy: req.params.addedBy,
  }).toArray();

  if (!items.length) return res.status(404).json({ message: "Watchlist empty" });
  res.json(items);
}));

// Delete from watchlist (require auth, verify addedBy matches user)
app.delete("/api/watchListDelete/:addedBy/:movieId", verifyToken, handle(async (req, res) => {
  if (req.params.addedBy !== req.user.uid) {
    return res.status(403).json({ message: "Forbidden: Not your watchlist" });
  }
  const db = await getDb();
  const result = await db.collection("watchList").deleteOne({
    addedBy: req.params.addedBy,
    movieId: req.params.movieId,
  });

  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ success: true, message: "Removed" });
}));

// Check if movie is in watchlist (require auth, verify addedBy matches user)
app.get("/api/watchlist/check/:addedBy/:movieId", verifyToken, handle(async (req, res) => {
  if (req.params.addedBy !== req.user.uid) {
    return res.status(403).json({ message: "Forbidden: Not your watchlist" });
  }
  const db = await getDb();
  const item = await db.collection("watchList").findOne({
    addedBy: req.params.addedBy,
    movieId: req.params.movieId,
  });
  res.json({ inWatchlist: !!item });
}));

// Root route
app.get("/", (req, res) => res.send("MovieMaster Server Running!"));

// ---------- Export ----------
module.exports = app;
module.exports.handler = serverless(app);