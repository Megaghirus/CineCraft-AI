export type Language = 'en' | 'ro' | 'ru';
export type VideoProvider = 'gemini' | 'sora-2' | 'kling-3' | 'seedance-2';

export interface Actor {
  id: string;
  name: string;
  description: string;
}

export interface Scene {
  id: string;
  description: string;
  prompt: string;
  provider: VideoProvider;
  videoUrl?: string;
  status: 'idle' | 'generating' | 'done' | 'error';
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
  updatedAt: number;
}
