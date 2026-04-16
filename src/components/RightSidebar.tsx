import React from 'react';
import { Project, Language } from '../types';
import { translations } from '../i18n';
import { Plus, Trash2, FileVideo } from 'lucide-react';

interface Props {
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  lang: Language;
}

export function RightSidebar({ projects, activeId, onSelect, onCreate, onDelete, lang }: Props) {
  const t = translations[lang];

  return (
    <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-100">{t.projects}</h2>
        <button 
          onClick={onCreate}
          className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
          title={t.newProject}
        >
          <Plus size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projects.sort((a,b) => b.updatedAt - a.updatedAt).map(p => (
          <div 
            key={p.id}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
              activeId === p.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
            onClick={() => onSelect(p.id)}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <FileVideo size={16} className="shrink-0" />
              <span className="truncate text-sm font-medium">{p.title || t.untitled}</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="text-center p-4 text-sm text-zinc-600">
            No projects yet
          </div>
        )}
      </div>
    </div>
  );
}
