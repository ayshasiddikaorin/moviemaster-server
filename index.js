// index.js
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// app.get('/test',)
// Test Route
app.get('/', (req, res) => {
  res.send('MovieMaster Server is running!');
});



//f61CTQ2Q8CYXnWRy
//movemasterdb


const uri = "mongodb+srv://movemasterdb:f61CTQ2Q8CYXnWRy@cluster0.tbqceff.mongodb.net/?appName=Cluster0";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    //movemasterdb
    //movies

    const db = client.db('movemasterdb')
    const movieCollection = db.collection('movies')

    app.get('/movies', async(req, res) =>{

      const result = await movieCollection.find().toArray()
      res.send(result)
    })






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);




// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});