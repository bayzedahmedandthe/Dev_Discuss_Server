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
let problemCollection;


async function run() {
    try {
        // await client.db("admin").command({ ping: 1 });
        // console.log("✅ Successfully connected to MongoDB!");
        questionCollection = client.db("devDB").collection("questions");
        savesQuestionsCollection = client.db("devDB").collection("saveQuestions");
        blogCollection = client.db("devDB").collection("blogs");
        problemCollection= client.db('devDB').collection('problems')
        
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
}
run();
        const problemProgressCollection = client.db('devDB').collection('problemProgress')
        const shortQuestionCollection = client.db('devDB').collection('shortQuestions')
        const shortQuestionProgressCollection = client.db('devDB').collection('shortQProgress')
// Helper function for Gemini AI
const aiResponseCache = new Map();

const generateGeminiPrompt = async (promptText) => {
    // Check cache first
    const cacheKey = promptText.substring(0, 100); // Use part of prompt as cache key
    if (aiResponseCache.has(cacheKey)) {
        return aiResponseCache.get(cacheKey);
    }

    try {
        const result = await model.generateContent(promptText);
        const response = result.response;
        const responseText = response.text();

        // Cache the result (limit cache size)
        if (aiResponseCache.size > 100) {
            // Remove oldest entry if cache is too large
            const firstKey = aiResponseCache.keys().next().value;
            aiResponseCache.delete(firstKey);
        }
        aiResponseCache.set(cacheKey, responseText);

        return responseText;
    } catch (err) {
        console.error(`Error generating AI response: ${err}`);
        return "AI failed to generate response due to an error.";
    }
};

// Helper function to extract likely tag from error text
function extractLikelyTag(errorText, commonTags) {
    const lowerCaseError = errorText.toLowerCase();
    for (const tag of commonTags) {
        if (lowerCaseError.includes(tag)) {
            return tag;
        }
    }

    // Look for common error patterns
    if (lowerCaseError.includes("syntax")) return "syntax";
    if (lowerCaseError.includes("undefined") || lowerCaseError.includes("null")) return "javascript";
    if (lowerCaseError.includes("import") || lowerCaseError.includes("export")) return "javascript";
    if (lowerCaseError.includes("component")) return "react";
    if (lowerCaseError.includes("request") || lowerCaseError.includes("response")) return "api";

    return null;
}

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

        const query = ObjectId.isValid(id)
            ? { _id: new ObjectId(id) }
            : { _id: id };

        const question = await questionCollection.findOne(query);

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

app.delete("/userQuestions/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const email = req.query.email;

        // Check if id and email are present
        if (!id || !email) {
            return res.status(400).send({ error: "Email or ID missing" });
        }

        // Check if the ID is a valid ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ error: "Invalid ID format" });
        }
        const query = {
            userEmail: email,
            _id: new ObjectId(id)
        };
        const result = await questionCollection.deleteOne(query);

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "No matching document found to delete." });
        }
        res.send({
            message: "Successfully deleted the question.",
            result
        });

    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).send({ error: "Error deleting user question" });
    }
});

app.post('/questions/:id/like', async (req, res) => {
    const { id } = req.params;
    const { userEmail } = req.body;

    const question = await questionCollection.findOne({ _id: new ObjectId(id) });

    if (!question) return res.status(404).send({ message: "Question not found" });

    let updatedLikes;

    if (question.likes?.includes(userEmail)) {
        updatedLikes = question.likes.filter(email => email !== userEmail);
    } else {
        updatedLikes = [...(question.likes || []), userEmail];
    }

    await questionCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { likes: updatedLikes } }
    );

    res.send({ likes: updatedLikes });
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

// Event related APi 
// short question event related apis

app.get('/shortQ',async(req,res)=>{
  const email = req.query.email
 const filter = {email}
 let currentSolveIndex = 0;
  const isUserProgressExist = await shortQuestionProgressCollection.findOne(filter)
  if(!isUserProgressExist){
    const insertProgress={
      email,
      answerQuestion:[],
      currentSolveIndex:0,
      totalScore:0
    }
    await shortQuestionProgressCollection.insertOne(insertProgress)
  }else{
currentSolveIndex += isUserProgressExist.currentSolveIndex
  }
  const totalQuestion = await shortQuestionCollection.estimatedDocumentCount()
  const result = await shortQuestionCollection.find().toArray()
  res.send({result,totalQuestion,currentSolveIndex})
})
app.post('/shortQ/:id',async(req,res)=>{
  const id = req.params.id;
  const {email,question,answer}=req.body;
  const filter = { email };
  const isQuestionSolved = await shortQuestionProgressCollection.findOne(filter);
  
  if (isQuestionSolved && isQuestionSolved.answerQuestion && 
      isQuestionSolved.answerQuestion.some(problemId => String(problemId) === String(id))) {
      return res.send({ message: "You already finished this problem!" });
  }

  const feedbackFromGemini = await generateGeminiPrompt(
    `Be honest and strict. Read the Question and answer properly, then rate the answer from 0 to 10. Just mention the number. This is the question: ${question} and this is the answer: ${answer}`
);

const score = parseInt(feedbackFromGemini);

const updateDoc = {
    $push: { answerQuestion: id },
    $inc: {
       currentSolveIndex: 1,
        totalScore: score,
    },
};

const data = await shortQuestionProgressCollection.updateOne(filter, updateDoc);

res.send({
    message: `🎉 Congratulation! Your progress is uploaded. Your score for this task is ${score}`,
});

})
// get single short question
app.get('/shortQ/:id',async(req,res)=>{
  const id = req.params.id
  const filter = {_id: new ObjectId(id)}
  const result = await shortQuestionCollection.findOne(filter)
  res.send(result)
})
// get all problems based on user
 app.get('/problems',async(req,res)=>{ 
    const email = req.query.email 
    const filter = {email}  
    let currentProblemIndex =0;    
     const userProgressIsExist = await problemProgressCollection.findOne(filter)
     if(!userProgressIsExist){
        const insertProgress = {
            email : email,
            solvedProblem:[],
            currentProblemIndex:0,
            totalScore:0
        }
        await problemProgressCollection.insertOne(insertProgress)
     }else{
     currentProblemIndex +=userProgressIsExist.currentProblemIndex
     }

    const result = await problemCollection.find().toArray()
    res.send({result,currentProblemIndex})
})


// Save question delete related APIs
app.delete("/saves/:id", async (req, res) => {
    const id = req.params.id;
    const query = { questionID: id }
    const result = await savesQuestionsCollection.deleteOne(query);
    res.send(result);

});



//  markDown problem solve via gemini
app.post('/problemProgress/:id', async (req, res) => {
  const id = req.params.id;
  const { problemDes, userCode, email } = req.body;
  const filter = { email };
  
  const isProblemSolved = await problemProgressCollection.findOne(filter);

  
  // Fix the comparison by using String() or toString() for consistent comparison
  if (isProblemSolved && isProblemSolved.solvedProblem && 
      isProblemSolved.solvedProblem.some(problemId => String(problemId) === String(id))) {
      return res.send({ message: "You already finished this problem!" });
  }
  

  const feedbackFromGemini = await generateGeminiPrompt(
      `Be honest and strict. Read the problem and code properly, then rate the code from 0 to 10. Just mention the number. This is the problem: ${problemDes} and this is the code: ${userCode}`
  );
  
  const score = parseInt(feedbackFromGemini);
  
  const updateDoc = {
      $push: { solvedProblem: id },
      $inc: {
          currentProblemIndex: 1,
          totalScore: score,
      },
  };
  
  await problemProgressCollection.updateOne(filter, updateDoc);
  
  res.send({
      message: `🎉 Congratulation! Your progress is uploaded. Your score for this task is ${score}`,
  });
});
  
// get single Problem
app.get('/problem/:id',async(req,res)=>{
    const id = req.params.id
    const filter = {_id : new ObjectId(id)}
    const result = await problemCollection.findOne(filter)
    res.send(result)
})
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

    // Set a timeout for the entire request processing
    const requestTimeout = setTimeout(() => {
        res.status(504).json({ error: "Request timed out. Please try with a simpler error." });
    }, 25000); // 25 seconds timeout

    try {
        // Use a more efficient prompt - shorter and more direct
        const tagPrompt = `Analyze this code error and return only one word that best describes the technology or framework related to this error: "${userInput.substring(0, 500)}"`; // Limit input size

        // Add timeout to Gemini API call
        const topicPromise = Promise.race([
            generateGeminiPrompt(tagPrompt),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI tag generation timed out")), 10000)
            )
        ]);

        let cleanedTopic;
        try {
            const topic = await topicPromise;
            cleanedTopic = topic.trim().toLowerCase();
        } catch (error) {
            console.log("Tag generation timed out, using fallback method");
            // Fallback: Extract likely tag from error text
            const commonTags = ["react", "javascript", "nodejs", "python", "typescript", "html", "css", "mongodb", "sql", "api"];
            cleanedTopic = extractLikelyTag(userInput, commonTags) || "error";
        }

        if (selectedOption === "blog") {
            // Limit number of results and use efficient query
            const blogs = await blogCollection
                .find({
                    tags: { $regex: new RegExp(cleanedTopic, "i") }
                })
                .limit(5) // Only get top 5 results
                .project({ title: 1, excerpt: 1, description: 1, createdAt: 1, author: 1 }) // Only get needed fields
                .toArray();

            clearTimeout(requestTimeout);
            return res.json({ type: "blog", topic: cleanedTopic, blogs });
        }

        if (selectedOption === "question") {
            // Limit number of results and use efficient query
            const questions = await questionCollection
                .find({
                    tag: { $regex: cleanedTopic, $options: 'i' }
                })
                .limit(5) // Only get top 5 results
                .project({ title: 1, body: 1, date: 1, userName: 1, comments: { $slice: 0 }, votes: 1 }) // Only get needed fields
                .toArray();

            clearTimeout(requestTimeout);
            return res.json({ type: "question", questions });
        }

        if (selectedOption === "ai_code") {
            // Create a more focused prompt and limit input size to prevent long processing
            const fixPrompt = `Fix this error (respond in under 500 words): "${userInput.substring(0, 1000)}"`;

            // Add timeout to AI response
            const aiResponsePromise = Promise.race([
                generateGeminiPrompt(fixPrompt),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("AI response generation timed out")), 15000)
                )
            ]);

            try {
                const aiResponse = await aiResponsePromise;
                clearTimeout(requestTimeout);
                return res.json({ type: "ai_code", aiResponse });
            } catch (error) {
                console.log("AI fix generation timed out");
                clearTimeout(requestTimeout);
                return res.status(408).json({
                    error: "AI processing took too long. Please try with a simpler error.",
                    type: "ai_code",
                    aiResponse: "The error analysis timed out. Please try submitting a shorter or simpler error description."
                });
            }
        }

        clearTimeout(requestTimeout);
        res.status(400).json({ error: "Invalid option selected" });
    } catch (err) {
        clearTimeout(requestTimeout);
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


