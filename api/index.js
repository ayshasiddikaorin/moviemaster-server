// api/index.js
require('dotenv').config();

const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// ---------- Express ----------
const app = express();
app.use(express.json());

// ---------- CORS FIX ----------
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://startling-cupcake-39922c.netlify.app");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Optional additional CORS middleware
app.use(cors({
  origin: "https://startling-cupcake-39922c.netlify.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

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
if (!uri) throw new Error("MONGO_URI env var missing");

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let dbPromise = null;
async function getDb() {
  if (!dbPromise) {
    await client.connect();
    console.log("MongoDB connected");
    dbPromise = client.db("moviemasterdb");
  }
  return dbPromise;
}

// ---------- Helper ----------
const handle = fn => (req, res) =>
  fn(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  });

// ---------- Routes ----------
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

app.post("/api/movies", handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, createdAt: new Date() };
  const { insertedId } = await db.collection("movies").insertOne(movie);
  res.status(201).json({ _id: insertedId, ...movie });
}));

app.put("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { ...req.body, updatedAt: new Date() } }
  );
  if (!result.matchedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Updated" });
}));

app.delete("/api/movies/:id", handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("movies").deleteOne({ _id: new ObjectId(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
}));

// ---------- Watchlist ----------
app.post("/api/watchListInsert", handle(async (req, res) => {
  const db = await getDb();
  const movie = { ...req.body, createdAt: new Date() };
  const { insertedId } = await db.collection("watchList").insertOne(movie);
  res.status(201).json({ _id: insertedId, ...movie });
}));

app.get("/api/myWatchList/:addedBy", handle(async (req, res) => {
  const db = await getDb();
  const items = await db.collection("watchList").find({ addedBy: req.params.addedBy }).toArray();
  if (!items.length) return res.status(404).json({ message: "Watchlist empty" });
  res.json(items);
}));

app.delete("/api/watchListDelete/:addedBy/:movieId", handle(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("watchList").deleteOne({
    addedBy: req.params.addedBy,
    movieId: req.params.movieId,
  });
  if (!result.deletedCount) return res.status(404).json({ message: "Not found" });
  res.json({ success: true, message: "Removed" });
}));

app.get("/", (req, res) => res.send("MovieMaster Server Running!"));

// ---------- Export ----------
module.exports = app;
module.exports.handler = serverless(app);
