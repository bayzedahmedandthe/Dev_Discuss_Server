require('dotenv').config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gekes.mongodb.net/?appName=Cluster0`;

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
        const questionCollection = client.db("devDB").collection("questions");

        // Questions related apis
        app.post("/questions", async(req, res) => {
            const question = req.body;
            const result = await questionCollection.insertOne(question);
            res.send(result);
        });


        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
// run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Dev Discuss Server is running now in vision")
});
app.listen(port, () => {
    console.log(`Dev Discuss Server is running on port ${port}`);
});