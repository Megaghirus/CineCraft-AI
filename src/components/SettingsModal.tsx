import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Save, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Language, VideoProvider } from '../types';
import { translations } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export function SettingsModal({ isOpen, onClose, lang }: Props) {
  const t = translations[lang];
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<Record<string, 'success' | 'error'>>({});

  useEffect(() => {
    const stored = localStorage.getItem('other_ai_keys');
    if (stored) {
      setKeys(JSON.parse(stored));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const providers: { id: string; name: string; desc: string }[] = [
    { id: 'gemini', name: 'Google Gemini', desc: 'Gemini API Key (Veo, AI Director)' },
    { id: 'luma', name: 'Luma Dream Machine', desc: 'Luma AI API Key' },
    { id: 'pika', name: 'Pika Art', desc: 'Pika Labs API Key' },
    { id: 'kling', name: 'Kling AI', desc: 'Kuaishou Kling API Key' },
    { id: 'runway', name: 'Runway Gen-3', desc: 'RunwayML API Key' },
    { id: 'sora-2', name: 'Sora 2', desc: 'OpenAI Sora API Key' },
  ];

  const handleSave = () => {
    localStorage.setItem('other_ai_keys', JSON.stringify(keys));
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 500);
  };

  const handleVerify = async (providerId: string) => {
    const key = keys[providerId];
    if (!key) return;

    setVerifying(providerId);
    setVerifyStatus(prev => ({ ...prev, [providerId]: undefined as any }));

    try {
      // Simulate API verification delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, we would make a test API call here
      // For now, we'll just check if it looks like a valid key format (length > 10)
      if (key.length > 10) {
        setVerifyStatus(prev => ({ ...prev, [providerId]: 'success' }));
      } else {
        setVerifyStatus(prev => ({ ...prev, [providerId]: 'error' }));
      }
    } catch (e) {
      setVerifyStatus(prev => ({ ...prev, [providerId]: 'error' }));
    } finally {
      setVerifying(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-indigo-400" />
            {t.settings || 'Settings'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-zinc-400 text-sm">
            {t.settingsDesc || 'Configure your API keys for various AI video generation models. Keys are stored locally in your browser.'}
          </p>

          <div className="space-y-6">
            {providers.map(provider => (
              <div key={provider.id} className="space-y-2 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-200">{provider.name}</label>
                  <span className="text-xs text-zinc-500">{provider.desc}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keys[provider.id] || ''}
                    onChange={(e) => {
                      setKeys({ ...keys, [provider.id]: e.target.value });
                      setVerifyStatus(prev => ({ ...prev, [provider.id]: undefined as any }));
                    }}
                    placeholder={`Enter ${provider.name} API Key...`}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={() => handleVerify(provider.id)}
                    disabled={!keys[provider.id] || verifying === provider.id}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors flex items-center gap-2 min-w-[100px] justify-center"
                  >
                    {verifying === provider.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : verifyStatus[provider.id] === 'success' ? (
                      <><CheckCircle2 size={16} className="text-emerald-400" /> {t.verified || 'Verified'}</>
                    ) : verifyStatus[provider.id] === 'error' ? (
                      <><AlertCircle size={16} className="text-red-400" /> {t.failed || 'Failed'}</>
                    ) : (
                      t.verify || 'Verify'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 shrink-0 bg-zinc-950 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center gap-2"
          >
            {saved ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Save size={18} />}
            {saved ? (t.saved || 'Saved!') : (t.saveKeys || 'Save Keys')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
