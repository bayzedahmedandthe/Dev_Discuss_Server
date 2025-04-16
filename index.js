const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()


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

        const database = client.db("Dev_Discuss")
        const blogsCollection = database.collection("Blogs")

        app.get("/", (req, res) => {
            res.send("Dev Discuss Server is running now")
        });
        app.get("/screet", (req, res) => {
            res.send("questions")
        });



        // app.get("/blogs",async(req,res)=>{
        //     const query={}
        //     const result=await blogsCollection.find(query).toArray()
        //     res.send(result)
        // });

        app.post("/blogs", async (req, res) => {
            const blogs = req.body;
            const result = await blogsCollection.insertOne(blogs);
            res.send(result)
        })

        console.log("Pinged you have successfully connected");
    } finally {

    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Dev Discuss Server is running on port ${port}`);
});