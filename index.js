require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Middlewares
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gekes.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let questionCollection; // ✅ Define in global scope

async function run() {
    try {
        const questionCollection = client.db("devDB").collection("questions");

    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
}

run();

app.get("/questions", async (req, res) => {
    try {
        const questions = await questionCollection.find().toArray();
        res.send(questions);
    } catch (error) {
        res.status(500).send({ message: "Error fetching questions", error });
    }
})

// ✅ GET a question by ID
app.get("/questions/:id", async (req, res) => {
    try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid ID format" });
        }
        const query = { _id: new ObjectId(id) };
        const result = await questionCollection.findOne(query);

        if (!result) {
            return res.status(404).send({ message: "Question not found" });
        }

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Error fetching question", error });
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
