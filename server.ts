import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import Database from "better-sqlite3";
import fs from "fs";
import crypto from "crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ── Directories ────────────────────────────────────────────────────────────────
const TEMP_DIR    = path.join(process.cwd(), "temp");
const VIDEOS_DIR  = path.join(TEMP_DIR, "videos");
const AUDIO_DIR   = path.join(TEMP_DIR, "audio");
const OUTPUT_DIR  = path.join(TEMP_DIR, "output");
[VIDEOS_DIR, AUDIO_DIR, OUTPUT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Database ───────────────────────────────────────────────────────────────────
const db = new Database("cinecraft.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const getConfig  = (key: string): string | null =>
  (db.prepare("SELECT value FROM config WHERE key = ?").get(key) as any)?.value ?? null;

const setConfig  = (key: string, value: string) =>
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);

// env var takes priority over DB-stored key
const getApiKey  = (service: string): string | null => {
  const envMap: Record<string, string> = {
    gemini:     "GEMINI_API_KEY",
    elevenlabs: "ELEVENLABS_API_KEY",
    synclabs:   "SYNCLABS_API_KEY",
    videogen:   "VIDEOGEN_API_KEY",
  };
  return process.env[envMap[service]] || getConfig(`key_${service}`);
};

// ── Helpers ────────────────────────────────────────────────────────────────────
async function downloadToFile(url: string, destDir: string, ext: string, extraHeaders: Record<string,string> = {}): Promise<string> {
  const filename = `${crypto.randomUUID()}.${ext}`;
  const destPath = path.join(destDir, filename);
  const res = await fetch(url, { headers: extraHeaders });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
  return filename;
}

// ── Express app ────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Serve temp media (videos, audio, output)
  app.use("/api/media", express.static(TEMP_DIR));

  // ── Config ──────────────────────────────────────────────────────────────────
  app.get("/api/config/status", (_req, res) => {
    res.json({
      gemini:     !!getApiKey("gemini"),
      elevenlabs: !!getApiKey("elevenlabs"),
      synclabs:   !!getApiKey("synclabs"),
      videogen:   !!getApiKey("videogen"),
    });
  });

  app.post("/api/config/set-key", (req, res) => {
    const { service, key } = req.body as { service: string; key: string };
    if (!service || !key) return res.status(400).json({ error: "service and key required" });
    setConfig(`key_${service}`, key.trim());
    res.json({ ok: true });
  });

  app.get("/api/config/models", (_req, res) => {
    res.json({
      textModel:  getConfig("gemini_text_model")  || "gemini-2.0-flash",
      videoModel: getConfig("gemini_video_model") || "veo-3.1-generate-preview",
    });
  });

  app.post("/api/config/set-model", (req, res) => {
    const { textModel, videoModel } = req.body as { textModel?: string; videoModel?: string };
    if (textModel)  setConfig("gemini_text_model",  textModel);
    if (videoModel) setConfig("gemini_video_model", videoModel);
    res.json({ ok: true });
  });

  // ── Projects (SQLite persistence) ──────────────────────────────────────────
  app.get("/api/projects", (_req, res) => {
    const rows = db.prepare("SELECT data FROM projects ORDER BY updated_at DESC").all() as any[];
    res.json(rows.map(r => JSON.parse(r.data)));
  });

  app.post("/api/projects", (req, res) => {
    const project = req.body;
    if (!project?.id) return res.status(400).json({ error: "project.id required" });
    db.prepare("INSERT OR REPLACE INTO projects (id, data, updated_at) VALUES (?, ?, ?)")
      .run(project.id, JSON.stringify(project), project.updatedAt || Date.now());
    res.json({ ok: true });
  });

  app.delete("/api/projects/:id", (req, res) => {
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // ── Gemini — text generation ────────────────────────────────────────────────
  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      const apiKey = getApiKey("gemini");
      if (!apiKey) return res.status(400).json({ error: "Gemini API key not configured. Add it in Settings." });

      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;
      const response = await ai.models.generateContent({ model, contents, config });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini generateContent error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Gemini — video generation ───────────────────────────────────────────────
  app.post("/api/gemini/generateVideos", async (req, res) => {
    try {
      const apiKey = getApiKey("gemini");
      if (!apiKey) return res.status(400).json({ error: "Gemini API key not configured." });

      const ai = new GoogleGenAI({ apiKey });
      const { model, prompt, config } = req.body;
      const operation = await ai.models.generateVideos({ model, prompt, config });
      res.json(operation);
    } catch (err: any) {
      console.error("Gemini generateVideos error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/getVideosOperation", async (req, res) => {
    try {
      const apiKey = getApiKey("gemini");
      if (!apiKey) return res.status(400).json({ error: "Gemini API key not configured." });

      const ai = new GoogleGenAI({ apiKey });
      const { operation } = req.body;
      const updated = await ai.operations.getVideosOperation({ operation });
      res.json(updated);
    } catch (err: any) {
      console.error("Gemini getVideosOperation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Download Gemini video → save to disk → return server URL
  app.get("/api/gemini/downloadVideo", async (req, res) => {
    try {
      const apiKey = getApiKey("gemini");
      if (!apiKey) return res.status(400).json({ error: "Gemini API key not configured." });

      const uri = req.query.uri as string;
      if (!uri) return res.status(400).json({ error: "Missing uri parameter" });

      const filename = await downloadToFile(uri, VIDEOS_DIR, "mp4", { "x-goog-api-key": apiKey });
      res.json({ url: `/api/media/videos/${filename}` });
    } catch (err: any) {
      console.error("Gemini downloadVideo error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── VideoGen — proxy for Sora 2, Kling 3, Seedance 2 ──────────────────────
  app.post("/api/videogen/generate", async (req, res) => {
    try {
      const apiKey = getApiKey("videogen");
      if (!apiKey) return res.status(400).json({ error: "VideoGen API key not configured. Add it in Settings." });

      const { prompt, provider } = req.body;
      const response = await fetch("https://videogenapi.com/api/v1/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: provider, add_audio: false }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `VideoGen: ${errText}` });
      }

      const data = await response.json();
      const taskId = data.generation_id || data.id || data.task_id;
      if (!taskId) return res.status(502).json({ error: "No task ID returned from VideoGen" });

      res.json({ taskId });
    } catch (err: any) {
      console.error("VideoGen generate error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/videogen/status/:taskId", async (req, res) => {
    try {
      const apiKey = getApiKey("videogen");
      if (!apiKey) return res.status(400).json({ error: "VideoGen API key not configured." });

      const { taskId } = req.params;
      const statusRes = await fetch(`https://videogenapi.com/api/v1/status/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!statusRes.ok) return res.status(statusRes.status).json({ error: "VideoGen status check failed" });

      const data = await statusRes.json();

      // If completed, download video to server and return local URL
      if (data.status === "completed" || data.status === "succeeded") {
        const videoSrcUrl = data.video_url || data.url || data.output;
        if (videoSrcUrl) {
          const filename = await downloadToFile(videoSrcUrl, VIDEOS_DIR, "mp4");
          return res.json({ status: "completed", url: `/api/media/videos/${filename}` });
        }
      }

      res.json(data);
    } catch (err: any) {
      console.error("VideoGen status error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── ElevenLabs — TTS ────────────────────────────────────────────────────────
  app.post("/api/elevenlabs/tts", async (req, res) => {
    try {
      const apiKey = getApiKey("elevenlabs");
      if (!apiKey) return res.status(400).json({ error: "ElevenLabs API key not configured. Add it in Settings." });

      const { text, voiceId, lang } = req.body as { text: string; voiceId?: string; lang?: string };
      if (!text?.trim()) return res.status(400).json({ error: "Text is required" });

      const selectedVoice = voiceId
        || process.env.ELEVENLABS_DEFAULT_VOICE_ID
        || "21m00Tcm4TlvDq8ikWAM"; // Rachel — multilingual

      const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
        }),
      });

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        return res.status(ttsRes.status).json({ error: `ElevenLabs: ${errText}` });
      }

      const buf = await ttsRes.arrayBuffer();
      const filename = `${crypto.randomUUID()}.mp3`;
      fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(buf));
      res.json({ url: `/api/media/audio/${filename}` });
    } catch (err: any) {
      console.error("ElevenLabs TTS error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get available ElevenLabs voices
  app.get("/api/elevenlabs/voices", async (_req, res) => {
    try {
      const apiKey = getApiKey("elevenlabs");
      if (!apiKey) return res.json({ voices: [] });

      const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      if (!voicesRes.ok) return res.json({ voices: [] });
      res.json(await voicesRes.json());
    } catch (err: any) {
      res.json({ voices: [] });
    }
  });

  // ── Sync.Labs — Lip-sync ────────────────────────────────────────────────────
  app.post("/api/synclabs/lipsync", async (req, res) => {
    try {
      const apiKey = getApiKey("synclabs");
      if (!apiKey) return res.status(400).json({ error: "Sync.Labs API key not configured. Add it in Settings." });

      const { videoUrl, audioUrl } = req.body as { videoUrl: string; audioUrl: string };
      if (!videoUrl || !audioUrl) return res.status(400).json({ error: "videoUrl and audioUrl are required" });

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const absVideo = videoUrl.startsWith("/") ? `${appUrl}${videoUrl}` : videoUrl;
      const absAudio = audioUrl.startsWith("/") ? `${appUrl}${audioUrl}` : audioUrl;

      const syncRes = await fetch("https://api.synclabs.so/lipsync", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: absVideo, audioUrl: absAudio, model: "sync-1.6.0", synergize: true }),
      });

      if (!syncRes.ok) {
        const errText = await syncRes.text();
        return res.status(syncRes.status).json({ error: `Sync.Labs: ${errText}` });
      }

      res.json(await syncRes.json());
    } catch (err: any) {
      console.error("Sync.Labs lipsync error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/synclabs/status/:jobId", async (req, res) => {
    try {
      const apiKey = getApiKey("synclabs");
      if (!apiKey) return res.status(400).json({ error: "Sync.Labs API key not configured." });

      const statusRes = await fetch(`https://api.synclabs.so/lipsync/${req.params.jobId}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!statusRes.ok) return res.status(statusRes.status).json({ error: "Sync.Labs status check failed" });

      const data = await statusRes.json();

      // If completed, download synced video to server
      if (data.status === "completed" && data.url) {
        const filename = await downloadToFile(data.url, OUTPUT_DIR, "mp4");
        return res.json({ status: "completed", url: `/api/media/output/${filename}` });
      }

      res.json(data);
    } catch (err: any) {
      console.error("Sync.Labs status error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── FFmpeg — Stitch scenes into final film ─────────────────────────────────
  app.post("/api/stitch", async (req, res) => {
    try {
      const { sceneUrls } = req.body as { sceneUrls: string[] };
      if (!sceneUrls?.length) return res.status(400).json({ error: "sceneUrls array is required" });

      // Convert /api/media/... URLs to absolute file paths
      const filePaths = sceneUrls.map(url => {
        const relative = url.replace(/^\/api\/media\//, "");
        return path.join(TEMP_DIR, relative);
      });

      // Verify all files exist
      for (const fp of filePaths) {
        if (!fs.existsSync(fp)) throw new Error(`File not found: ${fp}`);
      }

      // Write concat list
      const concatId = crypto.randomUUID();
      const concatFile = path.join(OUTPUT_DIR, `concat-${concatId}.txt`);
      const concatContent = filePaths.map(fp => `file '${fp.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(concatFile, concatContent, "utf8");

      const outputFilename = `final-${concatId}.mp4`;
      const outputPath = path.join(OUTPUT_DIR, outputFilename);

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatFile)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .outputOptions(["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"])
          .output(outputPath)
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });

      // Clean up concat file
      fs.unlinkSync(concatFile);

      res.json({ url: `/api/media/output/${outputFilename}` });
    } catch (err: any) {
      console.error("FFmpeg stitch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Vite (dev) / static (prod) ──────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🎬 CineCraft AI running on http://localhost:${PORT}`);
    console.log(`   Gemini:     ${getApiKey("gemini")     ? "✅ configured" : "❌ missing"}`);
    console.log(`   ElevenLabs: ${getApiKey("elevenlabs") ? "✅ configured" : "⚠️  optional"}`);
    console.log(`   Sync.Labs:  ${getApiKey("synclabs")   ? "✅ configured" : "⚠️  optional"}`);
    console.log(`   VideoGen:   ${getApiKey("videogen")   ? "✅ configured" : "⚠️  optional"}\n`);
  });
}

startServer().catch(console.error);
