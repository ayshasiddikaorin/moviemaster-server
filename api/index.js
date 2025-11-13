// api/index.js
const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin using environment variable
const firebaseConfig = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
});

// MongoDB connection
const uri = process.env.MONGO_URI; // Store in Vercel env vars
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function connectDB() {
  if (!client.isConnected?.()) await client.connect();
  return client.db("moviemasterdb");
}

// Routes

app.get("/api/movies", async (req, res) => {
  try {
    const db = await connectDB();
    const movies = await db.collection("movies").find().toArray();
    res.json(movies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/movies/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const movie = await db.collection("movies").findOne({ _id: new ObjectId(req.params.id) });
    if (!movie) return res.status(404).json({ message: "Not found" });
    res.json(movie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/movies", async (req, res) => {
  try {
    const db = await connectDB();
    const movie = { ...req.body, createdAt: new Date() };
    const result = await db.collection("movies").insertOne(movie);
    res.status(201).json({ _id: result.insertedId, ...movie });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/movies/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection("movies").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/movies/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection("movies").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Watchlist routes
app.post("/api/watchListInsert", async (req, res) => {
  try {
    const db = await connectDB();
    const movie = { ...req.body, createdAt: new Date() };
    const result = await db.collection("watchList").insertOne(movie);
    res.status(201).json({ _id: result.insertedId, ...movie });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/myWatchList/:addedBy", async (req, res) => {
  try {
    const db = await connectDB();
    const items = await db.collection("watchList").find({ addedBy: req.params.addedBy }).toArray();
    if (!items.length) return res.status(404).json({ message: "Watchlist not found" });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/watchListDelete/:addedBy/:movieId", async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection("watchList").deleteOne({
      addedBy: req.params.addedBy,
      movieId: req.params.movieId,
    });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Watchlist item not found" });
    res.json({ success: true, message: "Removed from watchlist" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Default route
app.get("/", (req, res) => res.send("MovieMaster Server Running!"));

// Export serverless handler
module.exports = app;
module.exports.handler = serverless(app);
