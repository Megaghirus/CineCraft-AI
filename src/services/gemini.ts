import { VideoProvider } from '../types';

const ANTHRO_CONSTRAINT = "CRITICAL: All characters (even animals, aliens, or objects) MUST be highly anthropomorphic. They must stand on two legs, have human-like posture, wear human clothing, and exhibit human behavior, gestures, and facial expressions.";

// ── localStorage key storage (per-user, client-side) ──────────────────────────
const LS_KEYS = 'cinecraft_keys';

const getLocalKeys = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LS_KEYS) || '{}'); } catch { return {}; }
};

export const getLocalKey = (service: string): string => getLocalKeys()[service] || '';

export const setLocalKey = (service: string, value: string) => {
  const keys = getLocalKeys();
  if (value) keys[service] = value; else delete keys[service];
  localStorage.setItem(LS_KEYS, JSON.stringify(keys));
};

export const hasLocalKey = (service: string): boolean => !!getLocalKeys()[service];

export const getAllLocalKeys = (): Record<string, string> => getLocalKeys();
export const saveAllLocalKeys = (keys: Record<string, string>) =>
  localStorage.setItem(LS_KEYS, JSON.stringify(keys));

const buildHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
  const k = getLocalKeys();
  const h: Record<string, string> = { ...extra };
  if (k.gemini)     h['x-gemini-key']     = k.gemini;
  if (k.elevenlabs) h['x-elevenlabs-key'] = k.elevenlabs;
  if (k.synclabs)   h['x-synclabs-key']   = k.synclabs;
  if (k.videogen)   h['x-videogen-key']   = k.videogen;
  return h;
};

// ── Model cache (text model only — video model is per-scene) ──────────────────
let _textModel: string | null = null;

async function fetchTextModel() {
  try {
    const res = await fetch('/api/config/models');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    _textModel = data.textModel || 'gemini-2.5-flash';
  } catch {
    _textModel = _textModel || 'gemini-2.5-flash';
  }
}

async function getTextModel(): Promise<string> {
  if (!_textModel) await fetchTextModel();
  return _textModel!;
}

export function invalidateModelCache() {
  _textModel = null;
}

// Tracked blob URLs for cleanup
const trackedBlobUrls = new Set<string>();

export function revokeBlobUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
    trackedBlobUrls.delete(url);
  }
}

// ── Retry helper ───────────────────────────────────────────────────────────────
const withRetry = async <T>(operation: () => Promise<T>, maxRetries = 5, baseDelay = 2000): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      const isTransient =
        error?.status === 503 || error?.status === 429 ||
        String(error?.message).includes('503') ||
        String(error?.message).includes('429') ||
        String(error?.message).includes('RESOURCE_EXHAUSTED');
      if (!isTransient) throw error;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`API retry ${attempt}/${maxRetries} in ${delay}ms`, error?.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries reached');
};

// ── Fetch helpers ─────────────────────────────────────────────────────────────
const post = async (endpoint: string, body: unknown) => {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
};

const get = async (endpoint: string) => {
  const res = await fetch(endpoint, { headers: buildHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
};

const generateContent = (model: string, contents: string, config?: any) =>
  withRetry(() => post('/api/gemini/generateContent', { model, contents, config }));

// ── Safe JSON parse ────────────────────────────────────────────────────────────
function safeParseJSON<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    // Gemini sometimes wraps JSON in markdown fences
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch { /* fall through */ }
    }
    console.warn('Failed to parse JSON response:', text.slice(0, 200));
    return fallback;
  }
}

// ── Language helpers ───────────────────────────────────────────────────────────
const LANG_NAMES: Record<string, string> = { en: 'English', ro: 'Romanian', ru: 'Russian' };
const storyLang = (lang: string, dialogueLanguage: string) =>
  dialogueLanguage || LANG_NAMES[lang] || lang;

// ── Story enhancement ──────────────────────────────────────────────────────────
export const enhanceStory = async (story: string, lang: string, animationStyle = '', dialogueLanguage = '') => {
  const outputLang = storyLang(lang, dialogueLanguage);
  const prompt = `
    Take the following rough story idea and expand it into a detailed, engaging, and well-structured narrative for a cartoon.
    Make it highly descriptive, focusing on character motivations, setting the scene, and a clear plot progression (beginning, middle, climax, end).
    ${animationStyle ? `The intended animation style is: ${animationStyle}. Keep this in mind for the atmosphere.` : ''}
    ${ANTHRO_CONSTRAINT}
    The output MUST be just the story text, written entirely in ${outputLang}. Do NOT use any other language.
    Language: ${outputLang}
    Rough Idea: ${story}
  `;
  const response = await generateContent(await getTextModel(), prompt);
  return response.text || story;
};

// ── Actors generation ─────────────────────────────────────────────────────────
export const generateActors = async (story: string, lang: string, animationStyle = '', dialogueLanguage = '') => {
  const outputLang = storyLang(lang, dialogueLanguage);
  const prompt = `
    Based on the following story, identify and generate a list of the main characters/actors.
    For each actor, provide a name and a detailed description including their role, appearance, and personality.
    ${animationStyle ? `Animation style: ${animationStyle}.` : ''}
    Characters should have names/traits appropriate for a story in ${outputLang}.
    ${ANTHRO_CONSTRAINT}
    Output MUST be valid JSON: { "actors": [{ "name": "string", "description": "string" }] }
    Write all text fields (name, description) in ${outputLang}.
    Story: ${story}
  `;
  const response = await generateContent(await getTextModel(), prompt, { responseMimeType: 'application/json' });
  return safeParseJSON<{ actors: any[] }>(response.text, { actors: [] });
};

// ── Scene generation ───────────────────────────────────────────────────────────
export const generateScenes = async (story: string, actors: any[], lang: string, animationStyle = '', dialogueLanguage = '') => {
  const outputLang = storyLang(lang, dialogueLanguage);
  const prompt = `
    Based on the following story and actors, break the story into a sequence of scenes.
    For each scene provide:
    1. description: the visual action (no dialogue), written in ${outputLang}.
    2. dialogue: ALL spoken lines, strictly in ${outputLang}. Do not mix languages.
    3. prompt: a detailed English visual prompt for a video AI.

    PROMPT RULES:
    - Always in English.
    - ${animationStyle ? `Animation Style: ${animationStyle}.` : 'Animation Style: High quality 2D cartoon animation, masterpiece.'}
    - ${ANTHRO_CONSTRAINT}
    - Keep camera movement minimal to prevent background morphing.
    - Describe characters clearly and consistently.
    - Focus on slow, deliberate actions.
    - Do NOT include spoken dialogue in the visual prompt — describe mouth movement instead.

    Output MUST be valid JSON: { "scenes": [{ "description": "string", "dialogue": "string", "prompt": "string" }] }
    Story: ${story}
    Actors: ${JSON.stringify(actors)}
    Language for description/dialogue: ${outputLang}
  `;
  const response = await generateContent(await getTextModel(), prompt, { responseMimeType: 'application/json' });
  const parsed = safeParseJSON<{ scenes: any[] }>(response.text, { scenes: [] });
  if (!parsed.scenes?.length) throw new Error('Gemini nu a returnat scene. Verifică cheia API și limita de cheltuieli.');
  return parsed;
};

// ── Video prompt generation ────────────────────────────────────────────────────
export const generateVideoPrompt = async (story: string, actors: any[], sceneDesc: string, lang: string, animationStyle = '') => {
  const prompt = `
    Write a detailed visual prompt for a video AI to create a specific cartoon scene.
    Output ONLY the prompt text. The prompt MUST be in English.

    RULES:
    1. ${animationStyle ? `Animation Style: ${animationStyle}.` : 'Animation Style: High quality 2D cartoon animation, masterpiece.'}
    2. ${ANTHRO_CONSTRAINT}
    3. Keep camera movement minimal or static.
    4. Describe characters clearly and consistently.
    5. Focus on simple, deliberate actions.
    6. Describe lighting and atmosphere clearly.
    7. If the scene has dialogue, include it in quotes with the language tag so the model can attempt lip-sync (e.g., saying in Romanian: "Bună ziua!").

    Story: ${story}
    Actors: ${JSON.stringify(actors)}
    Scene Description: ${sceneDesc}
    Language: ${lang}
  `;
  const response = await generateContent(await getTextModel(), prompt);
  return response.text as string;
};

// ── Director advice ────────────────────────────────────────────────────────────
export const getDirectorAdvice = async (sceneDesc: string, prompt: string, lang: string) => {
  const sysPrompt = `
    You are an expert AI Video Director. Review the scene description and video prompt.
    Provide 3 short, actionable tips to improve visual generation, avoid AI artifacts (morphing), and make the scene look professional.
    Remind the user: if they want synchronized voice, generate the audio first with ElevenLabs, then use Lip-Sync to merge.
    Output in the language for code '${lang}'. Use bullet points. Keep it concise.
    Scene: ${sceneDesc}
    Prompt: ${prompt}
  `;
  const response = await generateContent(await getTextModel(), sysPrompt);
  return response.text as string;
};

// ── Video generation ───────────────────────────────────────────────────────────
export const generateVideo = async (
  prompt: string,
  provider: VideoProvider = 'veo-3.1-generate-preview',
  onProgress?: (status: string) => void
): Promise<string> => {
  const isVeo = provider === 'veo-3.1-generate-preview' || provider === 'veo-2.0-generate-001';
  if (isVeo) {
    const veoLabel = provider === 'veo-3.1-generate-preview' ? 'Veo 3.1' : 'Veo 2.0';

    // Start generation — pass the exact model name from provider
    let operation = await withRetry(() =>
      post('/api/gemini/generateVideos', {
        model: provider,
        prompt,
        config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9', generateAudio: false },
      })
    );

    // Poll until done
    while (!operation.done) {
      onProgress?.(`Generating video with ${veoLabel}... please wait.`);
      await new Promise(r => setTimeout(r, 10000));
      operation = await withRetry(() =>
        post('/api/gemini/getVideosOperation', { operation })
      );
    }

    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) throw new Error('Video generation completed but no video URI returned');

    // Download to server, get server URL
    onProgress?.('Downloading video...');
    const data = await get(`/api/gemini/downloadVideo?uri=${encodeURIComponent(uri)}`);
    return data.url as string;

  } else {
    // VideoGen providers (Kling 3, Sora 2, Seedance 2) — all proxied through server
    onProgress?.(`Submitting to ${provider} via VideoGen...`);
    const { taskId } = await post('/api/videogen/generate', { prompt, provider });

    // Poll with exponential backoff
    let attempts = 0;
    const maxAttempts = 120;
    let delay = 5000;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, delay));
      attempts++;
      delay = Math.min(delay * 1.2, 15000); // gentle backoff, cap at 15s

      const data = await get(`/api/videogen/status/${taskId}`);

      if (data.status === 'completed' || data.status === 'succeeded') {
        return data.url as string;
      } else if (data.status === 'failed' || data.status === 'error') {
        throw new Error(data.error || data.message || `${provider} video generation failed`);
      }

      const progressMsg = data.message ? ` — ${data.message}` : '';
      onProgress?.(`${provider} status: ${data.status || 'processing'}${progressMsg}`);
    }

    throw new Error(`Video generation timed out after ${Math.round(maxAttempts * 10 / 60)} minutes (task: ${taskId})`);
  }
};

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
export const generateSpeech = async (
  text: string,
  voiceId?: string,
  lang?: string
): Promise<string> => {
  const data = await post('/api/elevenlabs/tts', { text, voiceId, lang });
  return data.url as string;
};

// ── Sync.Labs — Lip-sync ──────────────────────────────────────────────────────
export const startLipsync = async (videoUrl: string, audioUrl: string): Promise<string> => {
  const data = await post('/api/synclabs/lipsync', { videoUrl, audioUrl });
  const jobId = data.id || data.jobId;
  if (!jobId) throw new Error('Sync.Labs did not return a job ID');
  return jobId as string;
};

export const pollLipsync = async (
  jobId: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 120; // 10 min at 5s intervals

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;

    const data = await get(`/api/synclabs/status/${jobId}`);

    if (data.status === 'completed') {
      return data.url as string;
    } else if (data.status === 'failed' || data.status === 'error') {
      throw new Error(data.error || 'Lip-sync failed');
    }

    onProgress?.(`Lip-sync processing... ${data.status || 'pending'}`);
  }

  throw new Error('Lip-sync timed out after 10 minutes');
};

// ── FFmpeg — Stitch final film ─────────────────────────────────────────────────
export const stitchFilm = async (
  sceneUrls: string[],
  onProgress?: (status: string) => void
): Promise<string> => {
  onProgress?.('Stitching scenes into final film...');
  const data = await post('/api/stitch', { sceneUrls });
  return data.url as string;
};

// ── ElevenLabs voices list ─────────────────────────────────────────────────────
export const fetchVoices = async (): Promise<{ voice_id: string; name: string }[]> => {
  const data = await get('/api/elevenlabs/voices');
  return data.voices || [];
};
