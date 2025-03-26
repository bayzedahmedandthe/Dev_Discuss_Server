require('dotenv').config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { GoogleGenerativeAI } = require("@google/generative-ai");

const systemTheme = process.env.SYSTEM_INFO
const genAI = new GoogleGenerativeAI(process.env.AI_SECRET_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemTheme, });
// Middlewares
app.use(cors());
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

        // Ai Assistance api 
        const chat = model.startChat({ history: [] })

        app.post("/chat", async (req, res) => {
            try {
                const { message } = req.body;

                if (!message) {
                    return res.status(400).json({ error: "Message is required" });
                }

                let result = await chat.sendMessageStream(message);
                let responseText = "";

                for await (const chunk of result.stream) {
                    responseText += chunk.text();
                }

                res.json({ response: responseText });
            } catch (error) {
                console.error("Error:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });







        // Questions related apis
        app.post("/questions", async (req, res) => {
            const question = req.body;
            const result = await questionCollection.insertOne(question);
            res.send(result);
        });

        app.get("/questions/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await questionCollection.findOne(query);
            res.send(result);
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Dev Discuss Server is running now")
});
app.listen(port, () => {
    console.log(`Dev Discuss Server is running on port ${port}`);
});