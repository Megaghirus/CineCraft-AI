import React, { useState, useEffect } from 'react';
import { Project, Language } from './types';
import { translations } from './i18n';
import { ApiKeyScreen } from './components/ApiKeyScreen';
import { RightSidebar } from './components/RightSidebar';
import { ProjectEditor } from './components/ProjectEditor';
import { Languages, Film, Sparkles, Settings, Trash2 } from 'lucide-react';
import { Logo } from './components/Logo';
import { Manifesto } from './components/Manifesto';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [hasKey, setHasKey] = useState(false);
  const [lang, setLang] = useState<Language>('ro');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showManifesto, setShowManifesto] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // We have a hardcoded fallback key, so we always have a key
    setHasKey(true);

    // Load projects from local storage
    const saved = localStorage.getItem('cartoon_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProjects(parsed);
        if (parsed.length > 0) setActiveProjectId(parsed[0].id);
      } catch (e) {
        console.error('Failed to load projects', e);
      }
    }

    // Show manifesto on load if not seen
    const hasSeenManifesto = localStorage.getItem('has_seen_manifesto');
    if (!hasSeenManifesto) {
      setShowManifesto(true);
      localStorage.setItem('has_seen_manifesto', 'true');
    }
  }, []);

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    localStorage.setItem('cartoon_projects', JSON.stringify(newProjects));
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      title: '',
      story: '',
      actors: [],
      scenes: [],
      updatedAt: Date.now()
    };
    saveProjects([newProject, ...projects]);
    setActiveProjectId(newProject.id);
  };

  const handleUpdateProject = (updated: Project) => {
    updated.updatedAt = Date.now();
    saveProjects(projects.map(p => p.id === updated.id ? updated : p));
  };

  const handleDeleteProject = (id: string) => {
    const newProjects = projects.filter(p => p.id !== id);
    saveProjects(newProjects);
    if (activeProjectId === id) {
      setActiveProjectId(newProjects.length > 0 ? newProjects[0].id : null);
    }
  };

  if (!hasKey) {
    return <ApiKeyScreen lang={lang} onKeySelected={() => setHasKey(true)} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const t = translations[lang];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2" onClick={() => setShowManifesto(true)}>
            <Logo />
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.confirm('Ești sigur că vrei să ștergi memoria cache? Toate proiectele și setările vor fi șterse definitiv.')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-900/20 flex items-center gap-2 text-sm font-medium"
              title="Șterge Cache (Resetare Aplicație)"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline">Șterge Cache</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-zinc-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-800"
              title={t.settings || 'Settings'}
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
              <p>Select a project or create a new one</p>
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

      {/* Right Sidebar - Projects */}
      <RightSidebar 
        projects={projects}
        activeId={activeProjectId}
        onSelect={setActiveProjectId}
        onCreate={handleCreateProject}
        onDelete={handleDeleteProject}
        lang={lang}
      />

      <Manifesto isOpen={showManifesto} onClose={() => setShowManifesto(false)} lang={lang} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} lang={lang} />
    </div>
  );
}
