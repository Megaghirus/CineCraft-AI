import React, { useState, useEffect, useCallback } from 'react';
import { Project, Language, migrateScene } from './types';
import { translations } from './i18n';
import { RightSidebar } from './components/RightSidebar';
import { ProjectEditor } from './components/ProjectEditor';
import { Languages, Film, Settings, Trash2 } from 'lucide-react';
import { Logo } from './components/Logo';
import { Manifesto } from './components/Manifesto';
import { SettingsModal } from './components/SettingsModal';
import { invalidateModelCache, hasLocalKey } from './services/gemini';

export default function App() {
  const [hasKey, setHasKey] = useState(false);
  const [lang, setLang] = useState<Language>('ro');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showManifesto, setShowManifesto] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // Migrate old project format (separated dialogue from description)
  const migrateProject = (p: Project): Project => ({
    ...p,
    scenes: p.scenes.map(migrateScene),
  });

  // Load projects from server SQLite DB; fall back to localStorage for migration
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data: Project[] = await res.json();
        if (data.length > 0) {
          const migrated = data.map(migrateProject);
          setProjects(migrated);
          setActiveProjectId(migrated[0].id);
          return;
        }
      }
    } catch { /* server not ready yet */ }

    // Migrate from localStorage on first run
    const saved = localStorage.getItem('cartoon_projects');
    if (saved) {
      try {
        const parsed: Project[] = JSON.parse(saved);
        const migrated = parsed.map(migrateProject);
        setProjects(migrated);
        if (migrated.length > 0) setActiveProjectId(migrated[0].id);
        // Persist to server
        for (const p of migrated) {
          await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          }).catch(() => {});
        }
      } catch { /* ignore parse errors */ }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // Check localStorage for API key (each user has their own key)
      setHasKey(hasLocalKey('gemini'));

      await loadProjects();

      const hasSeenManifesto = localStorage.getItem('has_seen_manifesto');
      if (!hasSeenManifesto) {
        setShowManifesto(true);
        localStorage.setItem('has_seen_manifesto', 'true');
      }

      setLoading(false);
    };
    init();
  }, [loadProjects]);

  const persistProject = async (project: Project) => {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    }).catch(console.error);
  };

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      title: '',
      story: '',
      actors: [],
      scenes: [],
      updatedAt: Date.now(),
    };
    saveProjects([newProject, ...projects]);
    setActiveProjectId(newProject.id);
    persistProject(newProject);
  };

  const handleUpdateProject = (updated: Project) => {
    updated.updatedAt = Date.now();
    saveProjects(projects.map(p => p.id === updated.id ? updated : p));
    persistProject(updated);
  };

  const handleDeleteProject = async (id: string) => {
    const newProjects = projects.filter(p => p.id !== id);
    saveProjects(newProjects);
    if (activeProjectId === id) {
      setActiveProjectId(newProjects.length > 0 ? newProjects[0].id : null);
    }
    await fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const t = translations[lang];

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center">
        <div className="text-zinc-500 text-sm animate-pulse">Loading CineCraft AI...</div>
      </div>
    );
  }

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowManifesto(true)}>
            <Logo />
          </div>

          <div className="flex items-center gap-4">
            {!hasKey && (
              <span className="text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">
                ⚠️ Gemini key not configured — open Settings
              </span>
            )}
            <button
              onClick={() => {
                if (window.confirm('Ești sigur că vrei să ștergi memoria cache? Proiectele rămân pe server. API key-urile rămân salvate.')) {
                  const keys = localStorage.getItem('cinecraft_keys');
                  localStorage.clear();
                  if (keys) localStorage.setItem('cinecraft_keys', keys);
                  window.location.reload();
                }
              }}
              className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-900/20 flex items-center gap-2 text-sm font-medium"
              title="Șterge Cache Local"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline">Șterge Cache</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-zinc-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-800"
              title={t.settings}
            >
              <Settings size={20} />
            </button>
            <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
              <Languages size={16} className="text-zinc-500" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                className="bg-zinc-800 border border-zinc-700 text-sm rounded-md px-2 py-1 outline-none focus:border-indigo-500"
              >
                <option value="en">English</option>
                <option value="ro">Română</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
        </header>

        {/* Editor */}
        <main className="flex-1 overflow-hidden">
          {activeProject ? (
            <ProjectEditor
              project={activeProject}
              onChange={handleUpdateProject}
              lang={lang}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <Film size={48} className="mb-4 opacity-20" />
              <p>Selectează un proiect sau creează unul nou</p>
              <button
                onClick={handleCreateProject}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {t.newProject}
              </button>
            </div>
          )}
        </main>
      </div>

      <RightSidebar
        projects={projects}
        activeId={activeProjectId}
        onSelect={setActiveProjectId}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
        lang={lang}
      />

      <Manifesto isOpen={showManifesto} onClose={() => setShowManifesto(false)} lang={lang} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          invalidateModelCache();
          setHasKey(hasLocalKey('gemini'));
        }}
        lang={lang}
      />
    </div>
  );
}
