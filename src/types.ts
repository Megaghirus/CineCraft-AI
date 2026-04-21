export type Language = 'en' | 'ro' | 'ru';
export type VideoProvider = 'gemini' | 'sora-2' | 'kling-3' | 'seedance-2';

export interface Actor {
  id: string;
  name: string;
  description: string;
  voiceId?: string; // ElevenLabs voice ID for this character
}

export interface Scene {
  id: string;
  description: string;
  dialogue: string;       // Spoken dialogue text (for TTS generation)
  prompt: string;
  provider: VideoProvider;

  // Video pipeline
  videoUrl?: string;             // Base generated video (/api/media/videos/...)
  videoStatus: 'idle' | 'generating' | 'done' | 'error';

  // Audio pipeline
  audioUrl?: string;             // ElevenLabs generated audio (/api/media/audio/...)
  audioStatus: 'idle' | 'generating' | 'done' | 'error';

  // Lip-sync pipeline
  syncedVideoUrl?: string;       // Final synced video (/api/media/output/...)
  syncJobId?: string;            // Sync.Labs job ID for polling
  syncStatus: 'idle' | 'syncing' | 'done' | 'error';

  error?: string;
  directorAdvice?: string;
}

export interface Project {
  id: string;
  title: string;
  story: string;
  animationStyle?: string;
  dialogueLanguage?: string;
  actors: Actor[];
  scenes: Scene[];
  finalFilmUrl?: string;         // FFmpeg-stitched final film
  updatedAt: number;
}

// Migration helper: converts old scene format (dialogue embedded in description) to new format
export function migrateScene(s: Partial<Scene> & { status?: string }): Scene {
  let description = s.description || '';
  let dialogue = s.dialogue || '';

  // Old format: "description\n\nDialogue: dialogue"
  if (!dialogue && description.includes('\n\nDialogue: ')) {
    const parts = description.split('\n\nDialogue: ');
    description = parts[0];
    dialogue = parts.slice(1).join('\n\nDialogue: ');
  }

  return {
    id: s.id || crypto.randomUUID(),
    description,
    dialogue,
    prompt: s.prompt || '',
    provider: s.provider || 'gemini',
    videoUrl: s.videoUrl,
    videoStatus: (s as any).status === 'done' ? 'done'
      : (s as any).status === 'error' ? 'error'
      : (s as any).status === 'generating' ? 'generating'
      : s.videoStatus || 'idle',
    audioUrl: s.audioUrl,
    audioStatus: s.audioStatus || 'idle',
    syncedVideoUrl: s.syncedVideoUrl,
    syncJobId: s.syncJobId,
    syncStatus: s.syncStatus || 'idle',
    error: s.error,
    directorAdvice: s.directorAdvice,
  };
}
