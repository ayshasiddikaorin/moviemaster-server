// index.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// হার্ডকোডেড MongoDB URI (কোনো .env লাগবে না)
const uri = "mongodb+srv://movemasterdb:f61CTQ2Q8CYXnWRy@cluster0.tbqceff.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("movemasterdb");
    const movieCollection = db.collection("movies");

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

    app.get("/", (req, res) => res.send("MovieMaster Server Running!"));
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server: http://localhost:${port}`);
});