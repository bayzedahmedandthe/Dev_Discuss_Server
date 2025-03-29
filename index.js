require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// ✅ CORS Middleware
app.use(cors({
    origin: ["http://localhost:5173", "https://null-car.surge.sh"],
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
        await client.db("admin").command({ ping: 1 }); // ✅ Ensure connection is live
        console.log("✅ Successfully connected to MongoDB!");

        questionCollection = client.db("devDB").collection("questions"); // ✅ Assign collection
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
}
run();

// ✅ GET All Questions
app.get("/questions", async (req, res) => {
    try {
        const questions = await questionCollection.find({}).toArray();
        res.send(questions);
    } catch (error) {
        res.status(500).send({ message: "Error fetching questions", error });
    }
});

// ✅ GET Single Question by ID
app.get("/questions/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ error: "Invalid question ID format" });
        }

        const question = await questionCollection.findOne({ _id: new ObjectId(id) });

        if (!question) {
            return res.status(404).send({ error: "Question not found" });
        }

        res.send(question);
    } catch (error) {
        res.status(500).send({ error: "Server error" });
    }
});

// ✅ POST New Question
app.post("/questions", async (req, res) => {
    try {
        const newQuestion = { ...req.body, votes: 0, comments: [] };
        const result = await questionCollection.insertOne(newQuestion);
        res.status(201).send(result);
    } catch (error) {
        res.status(500).send({ error: "Error adding question" });
    }
});

// ✅ GET Comments for a Specific Question
app.get("/questions/comments/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ error: "Invalid question ID format" });
        }

        const question = await questionCollection.findOne({ _id: new ObjectId(id) });

        if (!question) {
            return res.status(404).send({ error: "Question not found" });
        }

        // ✅ Return the comments array if available
        res.send(question.comments || []);
    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).send({ error: "Error fetching comments" });
    }
});

// ✅ GET Tags (Unique Tags with Counts from Questions Collection)
app.get("/tags", async (req, res) => {
    try {
        const questions = await questionCollection.find({}).toArray();
        const tagsCount = {};

        // Loop through the questions and count tags
        questions.forEach((question) => {
            if (Array.isArray(question.tag)) {
                question.tag.forEach((tag) => {
                    if (tagsCount[tag]) {
                        tagsCount[tag]++;
                    } else {
                        tagsCount[tag] = 1;
                    }
                });
            } else {
                if (tagsCount[question.tag]) {
                    tagsCount[question.tag]++;
                } else {
                    tagsCount[question.tag] = 1;
                }
            }
        });

        // Convert the tagsCount object into an array of objects
        const tagsWithCount = Object.keys(tagsCount).map((tag) => ({
            tag,
            count: tagsCount[tag],
        }));

        res.send(tagsWithCount);
    } catch (error) {
        res.status(500).send({ message: "Error fetching tags", error });
    }
});


// ✅ POST Comment on a Specific Question
app.post("/questions/comments/:id", async (req, res) => {
    try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ error: "Invalid question ID format" });
        }

        // ✅ Check if the question exists before adding a comment
        const question = await questionCollection.findOne({ _id: new ObjectId(id) });
        if (!question) {
            return res.status(404).send({ error: "Question not found" });
        }

        // ✅ Create new comment
        const newComment = { text: req.body.text, createdAt: new Date() };

        const result = await questionCollection.updateOne(
            { _id: new ObjectId(id) },
            { $push: { comments: newComment } }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).send({ error: "Comment could not be added" });
        }

        res.status(201).send(newComment); // ✅ Return the added comment
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send({ error: "Error adding comment" });
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
