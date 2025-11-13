const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./moviemaster-pro-ce383-firebase-adminsdk-fbsvc-29a273bd30.json");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase init (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// MongoDB connection (persistent reuse)
const uri = `mongodb+srv://movemasterdb:f61CTQ2Q8CYXnWRy@cluster0.tbqceff.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let db, movieCollection, watchListCollection;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("movemasterdb");
    movieCollection = db.collection("movies");
    watchListCollection = db.collection("watchList");
    console.log(" MongoDB connected");
  }
}
connectDB();

//  Routes

app.get("/", (req, res) => {
  res.json({ message: "🎬 MovieMaster API is live on Vercel!" });
});

app.get("/api/movies", async (req, res) => {
  await connectDB();
  const movies = await movieCollection.find().toArray();
  res.json(movies);
});

app.get("/api/movies/:id", async (req, res) => {
  await connectDB();
  const movie = await movieCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!movie) return res.status(404).json({ message: "Not found" });
  res.json(movie);
});

app.post("/api/movies", async (req, res) => {
  await connectDB();
  const movie = { ...req.body, createdAt: new Date() };
  const result = await movieCollection.insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
});

app.put("/api/movies/:id", async (req, res) => {
  await connectDB();
  const result = await movieCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { ...req.body, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Updated" });
});

app.delete("/api/movies/:id", async (req, res) => {
  await connectDB();
  const result = await movieCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted" });
});

app.post("/api/watchListInsert", async (req, res) => {
  await connectDB();
  const movie = { ...req.body, createdAt: new Date() };
  const result = await watchListCollection.insertOne(movie);
  res.status(201).json({ _id: result.insertedId, ...movie });
});

app.get("/api/myWatchList/:addedBy", async (req, res) => {
  await connectDB();
  const { addedBy } = req.params;
  const items = await watchListCollection.find({ addedBy }).toArray();
  res.json(items);
});

app.delete("/api/watchListDelete/:addedBy/:movieId", async (req, res) => {
  await connectDB();
  const { addedBy, movieId } = req.params;
  const result = await watchListCollection.deleteOne({ addedBy, movieId });
  if (result.deletedCount === 0) return res.status(404).json({ message: "Watchlist item not found" });
  res.json({ success: true, message: "Removed from watchlist" });
});


module.exports = app;
