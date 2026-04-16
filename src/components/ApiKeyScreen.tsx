import React, { useState, useEffect } from 'react';
import { translations } from '../i18n';
import { Language, VideoProvider } from '../types';
import { Key, Save, CheckCircle2 } from 'lucide-react';

export function ApiKeyScreen({ lang, onKeySelected }: { lang: Language, onKeySelected: () => void }) {
  const t = translations[lang];
  const [otherKeys, setOtherKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('other_ai_keys');
    if (stored) {
      setOtherKeys(JSON.parse(stored));
    }
  }, []);

  const handleSaveOtherKeys = () => {
    localStorage.setItem('other_ai_keys', JSON.stringify(otherKeys));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // We can only proceed if we have a Gemini key (since it's required for the core app)
    if (otherKeys.gemini && otherKeys.gemini.length > 10) {
       onKeySelected();
    }
  };

  const providers: { id: VideoProvider; name: string; desc: string }[] = [
    { id: 'sora-2', name: 'Sora 2', desc: 'OpenAI Sora 2 via VideoGen API' },
    { id: 'kling-3', name: 'Kling 3', desc: 'Kling 3 via VideoGen API' },
    { id: 'seedance-2', name: 'Seedance 2', desc: 'Seedance 2 via VideoGen API' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-8">
        {/* Gemini Section */}
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-800 text-center">
          <h1 className="text-2xl font-bold mb-4">{t.apiKeyRequired}</h1>
          <p className="text-zinc-400 mb-6">{t.apiKeyDesc}</p>

          <div className="text-left space-y-2 mb-4">
            <label className="text-sm font-medium text-zinc-300">Google Gemini API Key</label>
            <input
              type="password"
              value={otherKeys['gemini'] || ''}
              onChange={(e) => setOtherKeys({ ...otherKeys, gemini: e.target.value })}
              placeholder={`Enter Gemini API Key...`}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 underline"
          >
            {t.billingDocs}
          </a>
        </div>

        {/* Other Providers Section */}
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-800">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Key size={20} className="text-indigo-400" />
            {t.otherKeys}
          </h2>
          
          <div className="space-y-6">
            {providers.map(provider => (
              <div key={provider.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-300">{provider.name}</label>
                  <span className="text-xs text-zinc-500">{provider.desc}</span>
                </div>
                <input
                  type="password"
                  value={otherKeys[provider.id] || ''}
                  onChange={(e) => setOtherKeys({ ...otherKeys, [provider.id]: e.target.value })}
                  placeholder={`${t.enterKey} ${provider.name}...`}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveOtherKeys}
            className="w-full mt-8 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {saved ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Save size={20} />}
            {t.saveKeys}
          </button>
        </div>
      </div>
    </div>
  );
}
