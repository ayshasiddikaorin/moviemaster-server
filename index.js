// index.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
// require("dotevn").config
const serviceAccount = require("./moviemaster-pro-ce383-firebase-adminsdk-fbsvc-29a273bd30.json");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.tbqceff.mongodb.net/?appName=Cluster0`;
const uri = `mongodb+srv://movemasterdb:f61CTQ2Q8CYXnWRy@cluster0.tbqceff.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("movemasterdb");
    const movieCollection = db.collection("movies");
    const watchListCollection = db.collection("watchList");

    console.log("MongoDB Connected!");

    // GET: All Movies
    app.get("/api/movies", async (req, res) => {
      const movies = await movieCollection.find().toArray();
      res.json(movies);
    });


    // GET: Single Movie
    app.get("/api/movies/:id", async (req, res) => {
      const movie = await movieCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!movie) return res.status(404).json({ message: "Not found" });
      res.json(movie);
    });

    // POST: Add Movie
    app.post("/api/movies", async (req, res) => {
      const movie = { ...req.body, createdAt: new Date() };
      const result = await movieCollection.insertOne(movie);
      res.status(201).json({ _id: result.insertedId, ...movie });
    });

    // POST: Add WatchList
    app.post("/api/watchListInsert", async (req, res) => {
      const movie = { ...req.body, createdAt: new Date() };
      const result = await watchListCollection.insertOne(movie);
      res.status(201).json({ _id: result.insertedId, ...movie });
    });

    app.get("/api/watchlist/check/:addedBy/:movieId", async (req, res) => {
      try {
        const { addedBy, movieId } = req.params;

        const existing = await watchListCollection.findOne({
          addedBy,
          movieId  // both are strings → perfect match
        });

        res.json({ exists: !!existing });
      } catch (err) {
        console.error("GET /api/watchlist/check error:", err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // PUT: Update Movie
    app.put("/api/movies/:id", async (req, res) => {
      const result = await movieCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { ...req.body, updatedAt: new Date() } }
      );
      if (result.matchedCount === 0) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Updated" });
    });

    // DELETE: Delete Movie
    app.delete("/api/movies/:id", async (req, res) => {
      const result = await movieCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      if (result.deletedCount === 0) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted" });
    });

    // MY watch List - Fixed
    app.get("/api/myWatchList/:addedBy", async (req, res) => {
      try {
        const { addedBy } = req.params;

        // Find all watchlist items where addedBy matches the email (string)
        const watchListItems = await watchListCollection.find({ addedBy }).toArray();

        if (!watchListItems || watchListItems.length === 0) {
          return res.status(404).json({ message: "Watchlist not found" });
        }

        res.json(watchListItems);
      } catch (error) {
        console.error("Error fetching watchlist:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // DELETE: Delete WatchList Item by addedBy and movieId
    app.delete("/api/watchListDelete/:addedBy/:movieId", async (req, res) => {
      try {
        const { addedBy, movieId } = req.params;

        const result = await watchListCollection.deleteOne({
          addedBy,
          movieId
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Watchlist item not found" });
        }

        res.json({ success: true, message: "Removed from watchlist" });
      } catch (err) {
        console.error("DELETE /api/watchListDelete error:", err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/", (req, res) => res.send("MovieMaster Server Running!"));
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server: http://localhost:${port}`);
});