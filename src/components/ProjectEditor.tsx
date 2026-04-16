import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import TextareaAutosize from 'react-textarea-autosize';
import { Project, Language, Actor, Scene } from '../types';
import { translations } from '../i18n';
import { generateVideoPrompt, generateVideo, enhanceStory, generateScenes, generateActors, getDirectorAdvice } from '../services/gemini';
import { Play, Plus, Trash2, Wand2, Loader2, Download, Film, Sparkles, MessageSquareWarning, Settings, X } from 'lucide-react';

interface Props {
  project: Project;
  onChange: (p: Project) => void;
  lang: Language;
}

export function ProjectEditor({ project, onChange, lang }: Props) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'story' | 'scenes' | 'timeline'>('story');

  const updateField = (field: keyof Project, value: any) => {
    onChange({ ...project, [field]: value });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
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
        {[
          { id: 'story', label: t.story },
          { id: 'scenes', label: t.scenes },
          { id: 'timeline', label: t.timeline }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-indigo-500 text-indigo-400' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'story' && <StoryTab project={project} onChange={onChange} lang={lang} />}
        {activeTab === 'scenes' && <ScenesTab project={project} onChange={onChange} lang={lang} />}
        {activeTab === 'timeline' && <TimelineTab project={project} lang={lang} />}
      </div>
    </div>
  );
}

function StoryTab({ project, onChange, lang }: Props) {
  const t = translations[lang];
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingActors, setIsGeneratingActors] = useState(false);

  const handleEnhanceStory = async () => {
    if (!project.story) return;
    setIsGenerating(true);
    try {
      const improvedStory = await enhanceStory(project.story, lang, project.animationStyle, project.dialogueLanguage);
      
      onChange({
        ...project,
        story: improvedStory
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error enhancing story');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateActors = async () => {
    if (!project.story) return;
    setIsGeneratingActors(true);
    try {
      const data = await generateActors(project.story, lang, project.animationStyle, project.dialogueLanguage);
      const newActors = data.actors.map((a: any) => ({
        id: crypto.randomUUID(),
        name: a.name,
        description: a.description
      }));
      
      onChange({
        ...project,
        actors: [...project.actors, ...newActors]
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error generating actors');
    } finally {
      setIsGeneratingActors(false);
    }
  };

  const addActor = () => {
    onChange({
      ...project,
      actors: [...project.actors, { id: crypto.randomUUID(), name: '', description: '' }]
    });
  };

  const updateActor = (id: string, field: keyof Actor, value: string) => {
    onChange({
      ...project,
      actors: project.actors.map(a => a.id === id ? { ...a, [field]: value } : a)
    });
  };

  const removeActor = (id: string) => {
    onChange({
      ...project,
      actors: project.actors.filter(a => a.id !== id)
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-zinc-200">{t.story}</h3>
          <div className="flex items-center gap-4">
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
              disabled={isGenerating || !project.story}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? t.generating : t.enhanceStory}
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

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-200">{t.actors}</h3>
          <div className="flex gap-2">
            <button 
              onClick={handleGenerateActors}
              disabled={isGeneratingActors || !project.story}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              {isGeneratingActors ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isGeneratingActors ? t.generating : t.generateActors}
            </button>
            <button onClick={addActor} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 px-2">
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

function ScenesTab({ project, onChange, lang }: Props) {
  const t = translations[lang];
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateScenes = async () => {
    if (!project.story) return;
    setIsGenerating(true);
    try {
      const details = await generateScenes(project.story, project.actors, lang, project.animationStyle, project.dialogueLanguage);
      
      const newScenes = details.scenes.map((s: any) => ({
        id: crypto.randomUUID(),
        description: `${s.description}\n\nDialogue: ${s.dialogue}`,
        prompt: s.prompt || '',
        status: 'idle',
        provider: 'gemini'
      }));

      onChange({
        ...project,
        scenes: [...project.scenes, ...newScenes]
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error generating scenes');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMissingPrompts = async () => {
    const scenesToUpdate = project.scenes.filter(s => s.description && !s.prompt);
    if (scenesToUpdate.length === 0) return;
    
    setIsGenerating(true);
    try {
      // Set loading state
      const loadingScenes = project.scenes.map(s => 
        (s.description && !s.prompt) ? { ...s, prompt: 'Generating prompt...' } : s
      );
      onChange({ ...project, scenes: loadingScenes });

      // Generate in parallel
      const promises = scenesToUpdate.map(async (scene) => {
        try {
          const prompt = await generateVideoPrompt(project.story, project.actors, scene.description, lang, project.animationStyle);
          return { id: scene.id, prompt: prompt };
        } catch (err) {
          console.error(`Error generating prompt for scene ${scene.id}`, err);
          return { id: scene.id, prompt: 'Error generating prompt' };
        }
      });

      const results = await Promise.all(promises);
      const resultsMap = new Map(results.map(r => [r.id, r.prompt]));

      // Update with final prompts
      // We use the current project state from the closure, which might be slightly stale if edited during generation,
      // but it's acceptable for this use case.
      onChange({
        ...project,
        scenes: project.scenes.map(s => 
          resultsMap.has(s.id) ? { ...s, prompt: resultsMap.get(s.id)! } : s
        )
      });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error generating missing prompts');
    } finally {
      setIsGenerating(false);
    }
  };

  const addScene = () => {
    onChange({
      ...project,
      scenes: [...project.scenes, { id: crypto.randomUUID(), description: '', prompt: '', status: 'idle', provider: 'gemini' }]
    });
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    onChange({
      ...project,
      scenes: project.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const removeScene = (id: string) => {
    onChange({
      ...project,
      scenes: project.scenes.filter(s => s.id !== id)
    });
  };

  const handleGeneratePrompt = async (scene: Scene) => {
    try {
      updateScene(scene.id, { prompt: 'Generating prompt...' });
      const prompt = await generateVideoPrompt(project.story, project.actors, scene.description, lang, project.animationStyle);
      updateScene(scene.id, { prompt: prompt });
    } catch (e) {
      console.error(e);
      updateScene(scene.id, { prompt: 'Error generating prompt' });
    }
  };

  const handleGetAdvice = async (scene: Scene) => {
    try {
      updateScene(scene.id, { directorAdvice: 'Loading advice...' });
      const advice = await getDirectorAdvice(scene.description, scene.prompt, lang);
      updateScene(scene.id, { directorAdvice: advice });
    } catch (e) {
      console.error(e);
      updateScene(scene.id, { directorAdvice: 'Error getting advice.' });
    }
  };

  const handleGenerateVideo = async (scene: Scene) => {
    if (!scene.prompt) return;
    try {
      updateScene(scene.id, { status: 'generating', error: undefined });
      const videoUrl = await generateVideo(scene.prompt, scene.provider);
      updateScene(scene.id, { status: 'done', videoUrl });
    } catch (e: any) {
      console.error(e);
      updateScene(scene.id, { status: 'error', error: e.message || 'Failed to generate video' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-zinc-200">{t.scenes}</h3>
        <div className="flex gap-2">
          <button 
            onClick={handleGenerateMissingPrompts}
            disabled={isGenerating || project.scenes.filter(s => s.description && !s.prompt).length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {isGenerating ? t.generating : t.generateMissingPrompts}
          </button>
          <button 
            onClick={handleGenerateScenes}
            disabled={isGenerating || !project.story}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isGenerating ? t.generating : 'AI Generate Scenes'}
          </button>
          <button onClick={addScene} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
            <Plus size={16} /> {t.addScene}
          </button>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-200/80 text-sm">
        <MessageSquareWarning className="shrink-0" size={20} />
        <p>{t.audioWarning}</p>
      </div>

      <div className="space-y-6">
        {project.scenes.map((scene, index) => (
          <div key={scene.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-zinc-800/50 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-zinc-300">Scene {index + 1}</span>
                <select
                  value={scene.provider}
                  onChange={(e) => updateScene(scene.id, { provider: e.target.value as any })}
                  className="bg-zinc-950 border border-zinc-700 text-xs rounded px-2 py-0.5 text-zinc-300 outline-none focus:border-indigo-500"
                >
                  <option value="gemini">Google Veo (Built-in)</option>
                  <option value="sora-2">Sora 2</option>
                  <option value="kling-3">Kling 3</option>
                  <option value="seedance-2">Seedance 2</option>
                </select>
              </div>
              <button onClick={() => removeScene(scene.id)} className="text-zinc-500 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="p-4 flex gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1 uppercase tracking-wider">{t.sceneDesc}</label>
                  <TextareaAutosize
                    minRows={3}
                    value={scene.description}
                    onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs text-zinc-500 uppercase tracking-wider">{t.scenePrompt}</label>
                    <button 
                      onClick={() => handleGeneratePrompt(scene)}
                      className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                    >
                      <Wand2 size={12} /> {t.generatePrompt}
                    </button>
                  </div>
                  <TextareaAutosize
                    minRows={3}
                    value={scene.prompt}
                    onChange={(e) => updateScene(scene.id, { prompt: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {scene.directorAdvice && (
                  <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Sparkles size={14} /> {t.aiDirector}
                    </h4>
                    <div className="text-sm text-indigo-100/80 whitespace-pre-wrap">
                      {scene.directorAdvice}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-64 flex flex-col gap-3 border-l border-zinc-800 pl-6">
                <div className="aspect-video bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden relative">
                  {scene.videoUrl ? (
                    <video src={scene.videoUrl} controls className="w-full h-full object-cover" />
                  ) : scene.status === 'generating' ? (
                    <div className="flex flex-col items-center text-indigo-400">
                      <Loader2 size={24} className="animate-spin mb-2" />
                      <span className="text-xs">{t.generating}</span>
                    </div>
                  ) : (
                    <Film size={32} className="text-zinc-700" />
                  )}
                </div>
                
                <button
                  onClick={() => handleGenerateVideo(scene)}
                  disabled={!scene.prompt || scene.status === 'generating'}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {scene.status === 'generating' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  {t.generate}
                </button>
                
                <button
                  onClick={() => handleGetAdvice(scene)}
                  disabled={!scene.prompt || scene.directorAdvice === 'Loading advice...'}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-300 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {scene.directorAdvice === 'Loading advice...' ? <Loader2 size={16} className="animate-spin" /> : <MessageSquareWarning size={16} />}
                  {t.getAdvice}
                </button>
                
                {scene.error && (
                  <div className="text-xs text-red-400 text-center">{scene.error}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {project.scenes.length === 0 && (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
            Add scenes to start generating your cartoon.
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineTab({ project, lang }: { project: Project, lang: Language }) {
  const t = translations[lang];
  const completedScenes = project.scenes.filter(s => s.videoUrl);

  return (
    <div className="max-w-5xl mx-auto">
      <h3 className="text-lg font-semibold text-zinc-200 mb-6">{t.timeline}</h3>
      
      {completedScenes.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-600">
          Generate some scene videos first to see them in the timeline.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Simple sequential player */}
          <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl mx-auto max-w-3xl">
            {/* We could implement a playlist player here, but for simplicity we'll just show the first one or a combined view */}
            <video 
              src={completedScenes[0].videoUrl} 
              controls 
              className="w-full h-full"
              autoPlay
            />
          </div>

          {/* Timeline track */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {completedScenes.map((scene, i) => (
                <div key={scene.id} className="w-48 flex flex-col gap-2">
                  <div className="aspect-video bg-zinc-950 rounded-lg overflow-hidden border border-zinc-700 relative group">
                    <video src={scene.videoUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={scene.videoUrl} download={`scene-${i+1}.mp4`} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white">
                        <Download size={16} />
                      </a>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400 truncate px-1">
                    Scene {i + 1}: {scene.description}
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
