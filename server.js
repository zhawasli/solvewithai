require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// upload to temp folder
const upload = multer({ dest: path.join(__dirname, "uploads") });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Accept BOTH:
// 1) multipart/form-data with optional file field name "photo"
// 2) JSON body { question, level }
app.post("/solve", upload.single("photo"), async (req, res) => {
  const level = (req.body.level || "middle").trim();

  // question might come from multipart or JSON
  const question = ((req.body.question || "") + "").trim();

  // If an image was uploaded, read it as base64 and send to AI
  let imageDataUrl = null;
  if (req.file) {
    const filePath = req.file.path;
    const mime = req.file.mimetype || "image/png";
    const buf = fs.readFileSync(filePath);
    imageDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    // cleanup
    fs.unlink(filePath, () => {});
  }

  if (!question && !imageDataUrl) {
    return res.json({ answer: "Type a math problem or upload a picture 🙂" });
  }

  const systemPrompt =
    "You are a precise math tutor.\n\n" +
    "Return ONLY valid JSON in this EXACT format:\n" +
    "{\n" +
    '  "finalAnswer": "ONE SHORT LINE ONLY",\n' +
    '  "steps": [ { "title": "Step title", "text": "1–2 short sentences" } ],\n' +
    '  "examples": [ { "problem": "short similar problem", "answer": "short answer" } ],\n' +
    '  "visual": { "type":"none" } OR { "type":"graph", "expr":"2*x+53", "xMin":-10, "xMax":10 }\n' +
    "}\n\n" +
    "Rules:\n" +
    "- finalAnswer MUST be one short line only (NO derivation chains).\n" +
    "- steps MUST NEVER be empty. Always return at least 2 steps.\n" +
    "- If the request is to GRAPH something, steps should explain how to graph it (slope/intercept or key points).\n" +
    "- Max 5 steps.\n" +
    "- Max 1 example.\n" +
    '- If user asks to graph y = ..., return visual type "graph" with expr as the right side ONLY, using * for multiplication.\n' +
    "- Use student-friendly language for level: " + level + "\n" +
    "- JSON only. No markdown. No extra text.\n";

  try {
    const userParts = [];
    if (question) userParts.push({ type: "text", text: question });
    if (imageDataUrl) {
      userParts.push({
        type: "text",
        text: "The user uploaded a picture. Read the math problem from the image and solve it."
      });
      userParts.push({ type: "image_url", image_url: { url: imageDataUrl } });
    }

    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.0,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts }
        ]
      },
     { signal: AbortSignal.timeout(45000) }
    );

    const raw = completion.choices[0].message.content;

    let solution;
    try {
      solution = JSON.parse(raw);
    } catch {
      return res.json({ answer: raw });
    }

    if (!Array.isArray(solution.steps) || solution.steps.length === 0) {
      solution.steps = [
        { title: "Plan", text: "We will identify key information and solve step-by-step." },
        { title: "Check", text: "We verify the answer quickly to make sure it makes sense." }
      ];
    }

    return res.json({ solution });
  } catch (err) {
    const status = err?.status || err?.response?.status;
    console.error("Solve error:", err);

    if (status === 429) {
      return res.status(429).json({
        answer: "AI is unavailable (quota limit). Try again later."
      });
    }

    return res.status(500).json({
      answer: "AI error. Check server terminal for details."
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
