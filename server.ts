import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const { model, contents, config } = req.body;
      
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/generateVideos", async (req, res) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const { model, prompt, config } = req.body;
      
      const operation = await ai.models.generateVideos({
        model,
        prompt,
        config
      });
      
      res.json(operation);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/getVideosOperation", async (req, res) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const { operation } = req.body;
      
      const updatedOperation = await ai.operations.getVideosOperation({ operation });
      
      res.json(updatedOperation);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/gemini/downloadVideo", async (req, res) => {
    try {
      const uri = req.query.uri as string;
      if (!uri) throw new Error("Missing uri");

      const response = await fetch(uri, {
        method: 'GET',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY as string,
        },
      });

      if (!response.ok) throw new Error('Failed to download video from Google');
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
