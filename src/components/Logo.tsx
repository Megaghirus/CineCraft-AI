import React from 'react';
import { Film, Sparkles } from 'lucide-react';

export function Logo() {
  return (
    <div className="relative flex items-center gap-2 group cursor-pointer select-none">
      <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300 group-hover:scale-105">
        <Film size={16} className="text-white absolute transform group-hover:rotate-12 transition-transform duration-300" />
        <Sparkles size={10} className="text-pink-200 absolute -top-1 -right-1 animate-pulse" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 group-hover:from-indigo-300 group-hover:via-purple-300 group-hover:to-pink-300 transition-all duration-300">
          CineCraft AI
        </span>
      </div>
    </div>
  );
}
