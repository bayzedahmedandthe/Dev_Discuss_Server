require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

const systemTheme = process.env.SYSTEM_INFO;
const genAI = new GoogleGenerativeAI(process.env.AI_SECRET_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemTheme });

// ✅ CORS Middleware
app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json());

// ✅ MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gekes.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let questionCollection;
let savesQuestionsCollection;
let blogCollection;

async function run() {
    try {
        await client.db("admin").command({ ping: 1 });
        console.log("✅ Successfully connected to MongoDB!");
        questionCollection = client.db("devDB").collection("questions");
        savesQuestionsCollection = client.db("devDB").collection("saveQuestions");
        blogCollection = client.db("devDB").collection("blogs");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
}
run();

// Helper function for Gemini AI
const generateGeminiPrompt = async (promptText) => {
    try {
        const result = await model.generateContent(promptText);
        const response = result.response;
        return response.text();
    } catch (err) {
        console.error(`error ${err}`);
        return "AI failed to generate response.";
    }
};

// ✅ Root API
app.get("/", (req, res) => {
    res.send("🚀 Dev Discuss Server is running now on vercel.");
});

// ✅ GET All Questions
app.get("/questions", async (req, res) => {
    try {
        const questions = await questionCollection.find({}).sort({ _id: -1 }).toArray();
        if (!questions.length) {
            return res.status(404).send({ message: "No questions found" });
        }
        res.send(questions);
    } catch (error) {
        res.status(500).send({ message: "Error fetching questions", error });
    }
});

// ✅ GET Questions by Tag
app.get("/questions/tag/:tag", async (req, res) => {
    try {
        const { tag } = req.params;
        const questions = await questionCollection.find({ tag: tag }).toArray();
        res.send(questions);
    } catch (error) {
        res.status(500).send({ message: "Error fetching questions by tag", error });
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

// ✅ GET Tags with Counts
app.get("/tags", async (req, res) => {
    try {
        const questions = await questionCollection.find({}).toArray();
        const tagsCount = {};

        questions.forEach((question) => {
            if (Array.isArray(question.tag)) {
                question.tag.forEach((tag) => {
                    tagsCount[tag] = (tagsCount[tag] || 0) + 1;
                });
            } else {
                tagsCount[question.tag] = (tagsCount[question.tag] || 0) + 1;
            }
        });

        const tagsWithCount = Object.keys(tagsCount).map((tag) => ({ tag, count: tagsCount[tag] }));
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

        const { text, userName, photoURL } = req.body;

        if (!text || !userName) {
            return res.status(400).send({ error: "Text and userName are required" });
        }

        const newComment = {
            text,
            userName,
            photoURL: photoURL || "", // Default empty string if no photo is provided
            createdAt: new Date().toISOString(), // Standard date format
        };

        const result = await questionCollection.updateOne(
            { _id: new ObjectId(id) },
            { $push: { comments: newComment } }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).send({ error: "Comment could not be added" });
        }

        res.status(201).send(newComment);
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send({ error: "Error adding comment" });
    }
});

// get single user question
app.get("/userQuestions", async (req, res) => {
    try {
        const email = req.query.email;
        let query = {};
        if (email) {
            query = { userEmail: email };
        }
        const result = await questionCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: "Error fetching user questions" });
    }
});

// Saves questions related apis
app.post("/saves", async (req, res) => {
    try {
        const savesQuestions = req.body;
        const result = await savesQuestionsCollection.insertOne(savesQuestions);
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: "Error saving question" });
    }
});

app.get("/saves", async (req, res) => {
    try {
        const email = req.query.email;
        let query = {};
        if (email) {
            query = { email: email };
        }
        const result = await savesQuestionsCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: "Error fetching saved questions" });
    }
});

// AI Chat API
const chat = model.startChat({ history: [] });

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

// Error analyzer API
app.post("/fixFlow", async (req, res) => {
    const { userInput, selectedOption } = req.body;
  
    const prompt = `This is the error: ${userInput}. What would be the most relevant tag (like 'react', 'security', 'nodejs', etc.) for this error? Only return one word.`;

    const topic = await generateGeminiPrompt(prompt);
    const cleanedTopic = topic.trim().toLowerCase(); 
    try {
        if (selectedOption === "blog") {
            const blogs = await blogCollection.find({
                tags: {
                    $elemMatch: {
                        $regex: new RegExp(cleanedTopic, "i")
                    }
                }
            }).toArray();
            
            return res.json({ type: "blog", topic, blogs });
        }
  
        if (selectedOption === "question") {
            const questions = await questionCollection.find({
                tag: { $regex: cleanedTopic, $options: 'i' }
            }).toArray();
              
            return res.json({ type: "question", questions });
        }
  
        if (selectedOption === "ai_code") {
            const fixPrompt = `A user encountered this error: "${userInput}". Can you provide a possible fix or improved version of the code with explanation?`;
            const aiResponse = await generateGeminiPrompt(fixPrompt);
      
            return res.json({ type: "ai_code", aiResponse });
        }
  
        res.status(400).json({ error: "Invalid option selected" });
    } catch (err) {
        console.error("❌ Error in /fixFlow:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Blogs related APIs
app.post('/blogs', async (req, res) => {
    try {
        const blog = req.body;
        const result = await blogCollection.insertOne(blog);
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: "Error adding blog" });
    }
});

app.get('/blogs', async (req, res) => {
    try {
        const blogs = await blogCollection.find().toArray();
        res.send(blogs);
    } catch (error) {
        res.status(500).send({ error: "Error fetching blogs" });
    }
});

// ✅ Start Server
app.listen(port, () => {
    console.log(`🚀 Dev Discuss Server is running on port ${port}`);
});