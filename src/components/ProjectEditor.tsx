import React, { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Project, Language, Actor, Scene, migrateScene } from '../types';
import { translations } from '../i18n';
import {
  generateVideoPrompt, generateVideo, enhanceStory, generateScenes,
  generateActors, getDirectorAdvice, generateSpeech, startLipsync,
  pollLipsync, stitchFilm, revokeBlobUrl,
} from '../services/gemini';
import {
  Play, Plus, Trash2, Wand2, Loader2, Download, Film,
  Sparkles, MessageSquareWarning, Mic, Mic2, Link2, Scissors,
} from 'lucide-react';

interface Props {
  project: Project;
  onChange: (p: Project) => void;
  lang: Language;
}

export function ProjectEditor({ project, onChange, lang }: Props) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'story' | 'scenes' | 'timeline'>('story');

  const updateField = (field: keyof Project, value: any) =>
    onChange({ ...project, [field]: value });

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <input
          type="text"
          value={project.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="bg-transparent text-2xl font-bold text-white outline-none w-full placeholder-zinc-600"
          placeholder={t.untitled}
        />
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-zinc-800">
        {(['story', 'scenes', 'timeline'] as const).map(tabId => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tabId
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t[tabId]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'story'    && <StoryTab    project={project} onChange={onChange} lang={lang} />}
        {activeTab === 'scenes'   && <ScenesTab   project={project} onChange={onChange} lang={lang} />}
        {activeTab === 'timeline' && <TimelineTab project={project} onChange={onChange} lang={lang} />}
      </div>
    </div>
  );
}

// ── Story Tab ─────────────────────────────────────────────────────────────────
function StoryTab({ project, onChange, lang }: Props) {
  const t = translations[lang];
  const [enhancing, setEnhancing]       = useState(false);
  const [genActors, setGenActors]       = useState(false);

  const handleEnhanceStory = async () => {
    if (!project.story) return;
    setEnhancing(true);
    try {
      const improved = await enhanceStory(project.story, lang, project.animationStyle, project.dialogueLanguage);
      onChange({ ...project, story: improved });
    } catch (e: any) {
      alert(e.message || 'Error enhancing story');
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerateActors = async () => {
    if (!project.story) {
      alert('No story found. Please write or generate a story first.');
      return;
    }
    setGenActors(true);
    try {
      const data = await generateActors(project.story, lang, project.animationStyle, project.dialogueLanguage);
      if (!data.actors?.length) {
        alert('AI returned 0 actors. Try again or check your Gemini API key in Settings.');
        return;
      }
      const newActors: Actor[] = data.actors.map((a: any) => ({
        id: crypto.randomUUID(),
        name: a.name,
        description: a.description,
      }));
      onChange({ ...project, actors: [...project.actors, ...newActors] });
    } catch (e: any) {
      alert(e.message || 'Error generating actors');
    } finally {
      setGenActors(false);
    }
  };

  const addActor = () =>
    onChange({ ...project, actors: [...project.actors, { id: crypto.randomUUID(), name: '', description: '' }] });

  const updateActor = (id: string, field: keyof Actor, value: string) =>
    onChange({ ...project, actors: project.actors.map(a => a.id === id ? { ...a, [field]: value } : a) });

  const removeActor = (id: string) =>
    onChange({ ...project, actors: project.actors.filter(a => a.id !== id) });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Story */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-zinc-200">{t.story}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={project.dialogueLanguage || ''}
              onChange={(e) => onChange({ ...project, dialogueLanguage: e.target.value })}
              className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-2 text-zinc-300 outline-none focus:border-indigo-500"
            >
              <option value="">{t.langDefault}</option>
              <option value="English">{t.langEnglish}</option>
              <option value="Romanian">{t.langRomanian}</option>
              <option value="Russian">{t.langRussian}</option>
              <option value="Spanish">{t.langSpanish}</option>
              <option value="French">{t.langFrench}</option>
              <option value="Japanese">{t.langJapanese}</option>
            </select>
            <select
              value={project.animationStyle || ''}
              onChange={(e) => onChange({ ...project, animationStyle: e.target.value })}
              className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-2 text-zinc-300 outline-none focus:border-indigo-500"
            >
              <option value="">{t.styleDefault}</option>
              <option value="Anime (Studio Ghibli style)">{t.styleAnime}</option>
              <option value="Modern 3D (Pixar/Disney style)">{t.stylePixar}</option>
              <option value="Classic 90s Cartoon">{t.styleClassic}</option>
              <option value="Vintage Rubber Hose (1930s)">{t.styleVintage}</option>
              <option value="Watercolor Animation">{t.styleWatercolor}</option>
              <option value="Stop Motion / Claymation / Plasticine">{t.styleStopMotion}</option>
              <option value="Pencil Sketch / Hand-drawn">{t.stylePencil}</option>
              <option value="Psychedelic / Surreal">{t.stylePsychedelic}</option>
              <option value="Paper Cutout / Origami">{t.stylePaperCutout}</option>
              <option value="Pixel Art (16-bit)">{t.stylePixelArt}</option>
              <option value="Oil Painting (Van Gogh style)">{t.styleOilPainting}</option>
              <option value="Steampunk Animation">{t.styleSteampunk}</option>
              <option value="Film Noir / Black & White">{t.styleNoir}</option>
              <option value="Low Poly 3D">{t.styleLowPoly}</option>
              <option value="Chibi / Kawaii Anime">{t.styleChibi}</option>
              <option value="Synthwave / 80s Retro">{t.styleSynthwave}</option>
              <option value="Gothic (Tim Burton style)">{t.styleGothic}</option>
              <option value="Comic Book / Spider-Verse style">{t.styleComicBook}</option>
              <option value="Cyberpunk Anime">{t.styleCyberpunk}</option>
            </select>
            <button
              onClick={handleEnhanceStory}
              disabled={enhancing || !project.story}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {enhancing ? t.generating : t.enhanceStory}
            </button>
          </div>
        </div>
        <TextareaAutosize
          minRows={5}
          value={project.story}
          onChange={(e) => onChange({ ...project, story: e.target.value })}
          placeholder={t.storyPlaceholder}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </section>

      {/* Actors */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-200">{t.actors}</h3>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateActors}
              disabled={genActors}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              {genActors ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {genActors ? t.generating : t.generateActors}
            </button>
            <button
              onClick={addActor}
              className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 px-2"
            >
              <Plus size={16} /> {t.addActor}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {project.actors.map(actor => (
            <div key={actor.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4">
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={actor.name}
                  onChange={(e) => updateActor(actor.id, 'name', e.target.value)}
                  placeholder={t.actorName}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <TextareaAutosize
                  minRows={2}
                  value={actor.description}
                  onChange={(e) => updateActor(actor.id, 'description', e.target.value)}
                  placeholder={t.actorDesc}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <input
                  type="text"
                  value={actor.voiceId || ''}
                  onChange={(e) => updateActor(actor.id, 'voiceId', e.target.value)}
                  placeholder={`${t.actorVoice}: ElevenLabs voice ID (${t.actorVoiceDefault})`}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button onClick={() => removeActor(actor.id)} className="text-zinc-500 hover:text-red-400 self-start p-2">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {project.actors.length === 0 && (
            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
              No actors defined yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Scenes Tab ────────────────────────────────────────────────────────────────
function ScenesTab({ project, onChange, lang }: Props) {
  const t = translations[lang];
  const [bulkGenerating, setBulkGenerating] = useState(false);
  // Track which scene is running what operation
  const [sceneOps, setSceneOps] = useState<Record<string, string>>({});

  const setOp    = (id: string, op: string) => setSceneOps(prev => ({ ...prev, [id]: op }));
  const clearOp  = (id: string)             => setSceneOps(prev => { const n = { ...prev }; delete n[id]; return n; });

  const updateScene = (id: string, updates: Partial<Scene>) =>
    onChange({ ...project, scenes: project.scenes.map(s => s.id === id ? { ...s, ...updates } : s) });

  // ── Bulk generate scenes ──
  const handleGenerateScenes = async () => {
    if (!project.story) return;
    setBulkGenerating(true);
    try {
      const data = await generateScenes(project.story, project.actors, lang, project.animationStyle, project.dialogueLanguage);
      const newScenes: Scene[] = data.scenes.map((s: any) => migrateScene({
        description: s.description,
        dialogue: s.dialogue || '',
        prompt: s.prompt || '',
        provider: 'gemini',
      }));
      onChange({ ...project, scenes: [...project.scenes, ...newScenes] });
    } catch (e: any) {
      alert(e.message || 'Error generating scenes');
    } finally {
      setBulkGenerating(false);
    }
  };

  // ── Bulk fill missing prompts ──
  const handleGenerateMissingPrompts = async () => {
    const toFill = project.scenes.filter(s => s.description && !s.prompt);
    if (!toFill.length) return;
    setBulkGenerating(true);
    try {
      const results = await Promise.all(
        toFill.map(async (scene) => {
          try {
            const prompt = await generateVideoPrompt(
              project.story, project.actors, scene.description, lang, project.animationStyle
            );
            return { id: scene.id, prompt };
          } catch {
            return { id: scene.id, prompt: '' };
          }
        })
      );
      const map = new Map(results.map(r => [r.id, r.prompt]));
      onChange({
        ...project,
        scenes: project.scenes.map(s => map.has(s.id) && map.get(s.id) ? { ...s, prompt: map.get(s.id)! } : s),
      });
    } catch (e: any) {
      alert(e.message || 'Error generating prompts');
    } finally {
      setBulkGenerating(false);
    }
  };

  const addScene = () =>
    onChange({
      ...project,
      scenes: [...project.scenes, migrateScene({ description: '', dialogue: '', prompt: '', provider: 'gemini' })],
    });

  const removeScene = (id: string) =>
    onChange({ ...project, scenes: project.scenes.filter(s => s.id !== id) });

  // ── Per-scene actions ──
  const handleGeneratePrompt = async (scene: Scene) => {
    setOp(scene.id, 'prompt');
    try {
      const prompt = await generateVideoPrompt(
        project.story, project.actors, scene.description, lang, project.animationStyle
      );
      updateScene(scene.id, { prompt });
    } catch (e: any) {
      alert(e.message);
    } finally {
      clearOp(scene.id);
    }
  };

  const handleGetAdvice = async (scene: Scene) => {
    setOp(scene.id, 'advice');
    try {
      const advice = await getDirectorAdvice(scene.description, scene.prompt, lang);
      updateScene(scene.id, { directorAdvice: advice });
    } catch (e: any) {
      alert(e.message);
    } finally {
      clearOp(scene.id);
    }
  };

  const handleGenerateVideo = async (scene: Scene) => {
    if (!scene.prompt) return;
    updateScene(scene.id, { videoStatus: 'generating', error: undefined });
    setOp(scene.id, 'video');
    try {
      const videoUrl = await generateVideo(
        scene.prompt,
        scene.provider,
        (status) => updateScene(scene.id, { error: status })
      );
      updateScene(scene.id, { videoStatus: 'done', videoUrl, error: undefined });
    } catch (e: any) {
      updateScene(scene.id, { videoStatus: 'error', error: e.message });
    } finally {
      clearOp(scene.id);
    }
  };

  const handleGenerateVoice = async (scene: Scene) => {
    const text = scene.dialogue?.trim();
    if (!text) {
      alert('Please fill in the dialogue field first.');
      return;
    }
    updateScene(scene.id, { audioStatus: 'generating', error: undefined });
    setOp(scene.id, 'audio');
    try {
      // Use first matching actor voice ID (if actors have voiceIds assigned)
      const actorVoice = project.actors.find(a => a.voiceId)?.voiceId;
      const audioUrl = await generateSpeech(text, actorVoice, project.dialogueLanguage || lang);
      updateScene(scene.id, { audioStatus: 'done', audioUrl, error: undefined });
    } catch (e: any) {
      updateScene(scene.id, { audioStatus: 'error', error: e.message });
    } finally {
      clearOp(scene.id);
    }
  };

  const handleLipsync = async (scene: Scene) => {
    if (!scene.videoUrl || !scene.audioUrl) return;
    updateScene(scene.id, { syncStatus: 'syncing', error: undefined });
    setOp(scene.id, 'sync');
    try {
      const jobId = await startLipsync(scene.videoUrl, scene.audioUrl);
      updateScene(scene.id, { syncJobId: jobId });
      const syncedUrl = await pollLipsync(
        jobId,
        (status) => updateScene(scene.id, { error: status })
      );
      updateScene(scene.id, { syncStatus: 'done', syncedVideoUrl: syncedUrl, error: undefined });
    } catch (e: any) {
      updateScene(scene.id, { syncStatus: 'error', error: e.message });
    } finally {
      clearOp(scene.id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top controls */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-lg font-semibold text-zinc-200">{t.scenes}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateMissingPrompts}
            disabled={bulkGenerating || project.scenes.filter(s => s.description && !s.prompt).length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {bulkGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {bulkGenerating ? t.generating : t.generateMissingPrompts}
          </button>
          <button
            onClick={handleGenerateScenes}
            disabled={bulkGenerating || !project.story}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {bulkGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {bulkGenerating ? t.generating : t.generateScenes}
          </button>
          <button
            onClick={addScene}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <Plus size={16} /> {t.addScene}
          </button>
        </div>
      </div>

      {/* Pipeline tip */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 text-indigo-200/80 text-sm">
        <MessageSquareWarning className="shrink-0 mt-0.5" size={18} />
        <p>{t.audioWarning}</p>
      </div>

      {/* Scene cards */}
      <div className="space-y-6">
        {project.scenes.map((scene, index) => {
          const op = sceneOps[scene.id];
          const isVideoGenerating  = op === 'video'  || scene.videoStatus === 'generating';
          const isAudioGenerating  = op === 'audio'  || scene.audioStatus === 'generating';
          const isSyncing          = op === 'sync'   || scene.syncStatus  === 'syncing';
          const isPromptGenerating = op === 'prompt';
          const isAdviceGenerating = op === 'advice';
          const displayVideo       = scene.syncedVideoUrl || scene.videoUrl;

          return (
            <div key={scene.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Scene header */}
              <div className="bg-zinc-800/50 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-zinc-300">Scene {index + 1}</span>
                  {scene.syncedVideoUrl && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {t.lipsyncReady}
                    </span>
                  )}
                  <select
                    value={scene.provider}
                    onChange={(e) => updateScene(scene.id, { provider: e.target.value as any })}
                    className="bg-zinc-950 border border-zinc-700 text-xs rounded px-2 py-0.5 text-zinc-300 outline-none focus:border-indigo-500"
                  >
                    <optgroup label="Google / Gemini">
                      <option value="veo-3.1-generate-preview">Veo 3.1 — premium</option>
                      <option value="veo-2.0-generate-001">Veo 2.0 — stabil</option>
                    </optgroup>
                    <optgroup label="VideoGen Gateway">
                      <option value="kling-3">Kling 3</option>
                      <option value="sora-2">Sora 2</option>
                      <option value="seedance-2">Seedance 2</option>
                    </optgroup>
                  </select>
                </div>
                <button onClick={() => removeScene(scene.id)} className="text-zinc-500 hover:text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="p-4 flex gap-6">
                {/* Left: text fields */}
                <div className="flex-1 space-y-4 min-w-0">
                  {/* Description */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1 uppercase tracking-wider">{t.sceneDesc}</label>
                    <TextareaAutosize
                      minRows={2}
                      value={scene.description}
                      onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {/* Dialogue */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1 uppercase tracking-wider">
                      {t.sceneDialogue}
                    </label>
                    <TextareaAutosize
                      minRows={2}
                      value={scene.dialogue}
                      onChange={(e) => updateScene(scene.id, { dialogue: e.target.value })}
                      placeholder="Dialogue spoken in this scene..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {/* Prompt */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs text-zinc-500 uppercase tracking-wider">{t.scenePrompt}</label>
                      <button
                        onClick={() => handleGeneratePrompt(scene)}
                        disabled={isPromptGenerating || !scene.description}
                        className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                      >
                        {isPromptGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        {t.generatePrompt}
                      </button>
                    </div>
                    <TextareaAutosize
                      minRows={3}
                      value={scene.prompt}
                      onChange={(e) => updateScene(scene.id, { prompt: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {/* Audio player (when voice is generated) */}
                  {scene.audioUrl && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic2 size={14} className="text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-medium">{t.voiceReady}</span>
                      </div>
                      <audio controls src={scene.audioUrl} className="w-full h-8" />
                    </div>
                  )}

                  {/* Director advice */}
                  {scene.directorAdvice && scene.directorAdvice !== 'Loading advice...' && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Sparkles size={14} /> {t.aiDirector}
                      </h4>
                      <div className="text-sm text-indigo-100/80 whitespace-pre-wrap">
                        {scene.directorAdvice}
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {scene.error && !isVideoGenerating && !isAudioGenerating && !isSyncing && (
                    <p className="text-xs text-red-400 bg-red-900/10 border border-red-900/20 rounded-lg p-2">
                      {scene.error}
                    </p>
                  )}
                </div>

                {/* Right: video + action buttons */}
                <div className="w-60 flex flex-col gap-2 border-l border-zinc-800 pl-5 shrink-0">
                  {/* Video preview */}
                  <div className="aspect-video bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden relative">
                    {displayVideo ? (
                      <video src={displayVideo} controls className="w-full h-full object-cover" />
                    ) : isVideoGenerating ? (
                      <div className="flex flex-col items-center gap-2 text-indigo-400 px-2 text-center">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-xs">{scene.error || t.generating}</span>
                      </div>
                    ) : (
                      <Film size={28} className="text-zinc-700" />
                    )}
                  </div>

                  {/* 1. Generate Video */}
                  <button
                    onClick={() => handleGenerateVideo(scene)}
                    disabled={!scene.prompt || isVideoGenerating}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isVideoGenerating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    {t.generate}
                  </button>

                  {/* 2. Generate Voice (ElevenLabs) */}
                  <button
                    onClick={() => handleGenerateVoice(scene)}
                    disabled={!scene.dialogue?.trim() || isAudioGenerating}
                    className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                    title={!scene.dialogue?.trim() ? 'Fill in the Dialogue field first' : ''}
                  >
                    {isAudioGenerating ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                    {isAudioGenerating ? t.generatingVoice : t.generateVoice}
                  </button>

                  {/* 3. Lip-Sync (Sync.Labs) */}
                  <button
                    onClick={() => handleLipsync(scene)}
                    disabled={!scene.videoUrl || !scene.audioUrl || isSyncing}
                    className="w-full bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                    title={!scene.videoUrl ? 'Generate video first' : !scene.audioUrl ? 'Generate voice first' : ''}
                  >
                    {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    {isSyncing ? t.lipsyncing : t.lipsync}
                  </button>

                  {/* 4. Director advice */}
                  <button
                    onClick={() => handleGetAdvice(scene)}
                    disabled={!scene.prompt || isAdviceGenerating}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-300 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isAdviceGenerating ? <Loader2 size={14} className="animate-spin" /> : <MessageSquareWarning size={14} />}
                    {t.getAdvice}
                  </button>

                  {/* Synced video note */}
                  {scene.syncedVideoUrl && (
                    <p className="text-xs text-emerald-400 text-center">{t.lipsyncReady}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {project.scenes.length === 0 && (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
            Add scenes to start generating your cartoon.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────
function TimelineTab({ project, onChange, lang }: { project: Project; onChange: (p: Project) => void; lang: Language }) {
  const t = translations[lang];
  const [exporting, setExporting] = useState(false);
  const [activeIdx, setActiveIdx]  = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Prefer synced video, fallback to base video
  const completedScenes = project.scenes.filter(s => s.videoUrl || s.syncedVideoUrl);
  const displayUrl      = (s: Scene) => s.syncedVideoUrl || s.videoUrl || '';

  const handleExportFilm = async () => {
    const urls = completedScenes.map(displayUrl).filter(Boolean);
    if (!urls.length) return;

    // Only server-side URLs (/api/media/...) can be stitched
    const serverUrls = urls.filter(u => u.startsWith('/api/media/'));
    if (!serverUrls.length) {
      alert('Stitching requires videos generated through this session (stored on server). External URLs cannot be stitched directly.');
      return;
    }

    setExporting(true);
    try {
      const filmUrl = await stitchFilm(serverUrls);
      onChange({ ...project, finalFilmUrl: filmUrl });
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleVideoEnd = () => {
    if (activeIdx < completedScenes.length - 1) {
      setActiveIdx(prev => prev + 1);
      setTimeout(() => videoRef.current?.play(), 50);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-zinc-200">
          {t.timeline}
          {completedScenes.length > 0 && (
            <span className="ml-2 text-sm text-zinc-500 font-normal">
              ({completedScenes.length} {completedScenes.length === 1 ? t.sceneCount : t.scenesCount})
            </span>
          )}
        </h3>

        <div className="flex gap-3 items-center">
          {project.finalFilmUrl && (
            <a
              href={project.finalFilmUrl}
              download="cinecraft-final.mp4"
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} /> {t.downloadFilm}
            </a>
          )}
          <button
            onClick={handleExportFilm}
            disabled={exporting || completedScenes.length === 0}
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
            {exporting ? t.exportingFilm : t.exportFilm}
          </button>
        </div>
      </div>

      {completedScenes.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
          {t.noVideosForExport}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Final film (if exported) */}
          {project.finalFilmUrl && (
            <div className="bg-zinc-900 border border-emerald-700/30 rounded-2xl overflow-hidden p-4">
              <p className="text-sm text-emerald-400 font-medium mb-3 flex items-center gap-2">
                <Scissors size={14} /> {t.filmReady}
              </p>
              <video
                src={project.finalFilmUrl}
                controls
                className="w-full rounded-xl max-h-[50vh]"
              />
            </div>
          )}

          {/* Sequential player */}
          <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl mx-auto max-w-3xl">
            <video
              ref={videoRef}
              key={completedScenes[activeIdx]?.id}
              src={displayUrl(completedScenes[activeIdx])}
              controls
              autoPlay
              className="w-full h-full"
              onEnded={handleVideoEnd}
            />
          </div>

          {/* Scene thumbnail strip */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {completedScenes.map((scene, i) => (
                <div key={scene.id} className="w-44 flex flex-col gap-2 shrink-0">
                  <div
                    onClick={() => { setActiveIdx(i); setTimeout(() => videoRef.current?.play(), 50); }}
                    className={`aspect-video rounded-lg overflow-hidden border cursor-pointer relative group transition-all ${
                      i === activeIdx ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <video src={displayUrl(scene)} className="w-full h-full object-cover" muted />
                    {scene.syncedVideoUrl && (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                        synced
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={displayUrl(scene)}
                        download={`scene-${i + 1}.mp4`}
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 truncate px-1">
                    Scene {i + 1}{scene.syncedVideoUrl ? ' ✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
