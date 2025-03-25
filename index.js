require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// ✅ CORS Middleware
app.use(cors({
    origin: "*",
    credentials: true
}));
app.use(express.json());

// ✅ MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gekes.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let questionCollection; // ✅ Define collection globally

async function run() {
    try {
        await client.db("admin").command({ ping: 1 }); // ✅ Ping database
        console.log("✅ Successfully connected to MongoDB!");

        // ✅ Assign collection to global variable
        questionCollection = client.db("devDB").collection("questions");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
}
run();

// ✅ GET All Questions
app.get("/questions", async (req, res) => {
    try {
        const questions = await questionCollection.find({}).toArray();
        
        if (!questions.length) {
            return res.status(404).send({ message: "No questions found" });
        }

        res.send(questions);
    } catch (error) {
        res.status(500).send({ message: "Error fetching questions", error });
    }
});


app.get("/questions/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await questionCollection.findOne(query);
    res.send(result);
});

// ✅ POST New Question (Fix 404 Error)
app.post("/questions", async (req, res) => {
    try {
        const newQuestion = req.body;
        const result = await questionCollection.insertOne(newQuestion);

        res.status(201).send(result);
    } catch (error) {
        res.status(500).send({ message: "Error adding question", error });
    }
});

// ✅ Root API
app.get("/", (req, res) => {
    res.send("🚀 Dev Discuss Server is running now");
});

// ✅ Start Server
app.listen(port, () => {
    console.log(`🚀 Dev Discuss Server is running on port ${port}`);
});
