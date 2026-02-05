console.log("BOOT: starting server.js");

// ===== IMPORTS =====
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const OpenAI = require("openai");

// ===== APP SETUP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== FILE UPLOAD SETUP =====
const upload = multer({ dest: "uploads/" });

// ===== OPENAI SETUP =====
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== SERVE FRONTEND (IMPORTANT FOR RENDER) =====
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===== SOLVE ROUTE =====
app.post("/solve", upload.single("photo"), async (req, res) => {
  try {
    const question = req.body.question || "";
    const level = req.body.level || "middle";

    if (!question) {
      return res.json({ answer: "Please enter a math problem." });
    }

    const prompt = `
You are a math tutor.
Answer the problem clearly.
First give the FINAL ANSWER only.
Then give a short explanation.
If graphing is relevant, describe the graph.

Grade level: ${level}
Problem: ${question}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const answer = completion.choices[0].message.content;

    res.json({ answer });
  } catch (err) {
    console.error("Solve error:", err);
    res.status(500).json({
      answer: "AI error. Please try again later.",
    });
  }
});

// ===== START SERVER (RENDER FIX) =====
const PORT = process.env.PORT || 3000;
console.log("BOOT: about to listen");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
