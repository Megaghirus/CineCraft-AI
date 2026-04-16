import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wand2, Globe, Cpu, Sparkles } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export function Manifesto({ isOpen, onClose, lang }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !isVisible) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        {/* Decorative Header */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-50 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-8 sm:p-10">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-zinc-500 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 rounded-full p-2 transition-colors"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-2xl mb-6 shadow-inner">
              <Sparkles className="text-indigo-400" size={24} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
              {t.manifestoTitle}
            </h2>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              {t.manifestoSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6 hover:bg-zinc-800/50 hover:border-indigo-500/30 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Wand2 className="text-indigo-400" size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-200 mb-2">{t.manifestoPillar1Title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t.manifestoPillar1Desc}
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6 hover:bg-zinc-800/50 hover:border-purple-500/30 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Cpu className="text-purple-400" size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-200 mb-2">{t.manifestoPillar2Title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t.manifestoPillar2Desc}
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6 hover:bg-zinc-800/50 hover:border-pink-500/30 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Globe className="text-pink-400" size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-200 mb-2">{t.manifestoPillar3Title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {t.manifestoPillar3Desc}
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 hover:scale-105 transition-all duration-300"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
