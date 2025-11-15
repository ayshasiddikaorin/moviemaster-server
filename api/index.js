// api/index.js
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
let firebaseInitialized = false;
function initFirebase() {
  if (firebaseInitialized) return;

  try {
    const cfg = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(cfg) });
    firebaseInitialized = true;
    console.log("Firebase Admin initialized");
  } catch (e) {
    console.error("Firebase init error:", e);
    throw e;
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

// Get all movies
app.get("/api/movies", handle(async (req, res) => {
  const db = await getDb();
  const movies = await db.collection("movies").find().toArray();
  res.json(movies);
}));

// Get movie by ID
app.get("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const movie = await db.collection("movies").findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!movie) return res.status(404).json({ message: "Not found" });
  res.json(movie);
}));

// Add movie
app.post("/api/movies", handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, createdAt: new Date() };
  const result = await db.collection("movies").insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
}));

// Update movie
app.put("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { ...req.body, updatedAt: new Date() } }
  );

  if (!result.matchedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Updated" });
}));
 
// Delete movie
app.delete("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").deleteOne({
    _id: new ObjectId(req.params.id),
  });

  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}));

// ---------- Watchlist ----------

// Insert
app.post("/api/watchListInsert", handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, createdAt: new Date() };
  const result = await db.collection("watchList").insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
}));

// Get user's watchlist
app.get("/api/myWatchList/:addedBy", handle(async (req, res) => {
  const db = await getDb();
  const items = await db.collection("watchList").find({
    addedBy: req.params.addedBy,
  }).toArray();

  if (!items.length) return res.status(404).json({ message: "Watchlist empty" });
  res.json(items);
}));

// Delete from watchlist
app.delete("/api/watchListDelete/:addedBy/:movieId", handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("watchList").deleteOne({
    addedBy: req.params.addedBy,
    movieId: req.params.movieId,
  });

  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ success: true, message: "Removed" });
}));

// Check if movie is in watchlist
app.get("/api/watchlist/check/:addedBy/:movieId", handle(async (req, res) => {
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