import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Save, CheckCircle2, Loader2, AlertCircle, Cpu } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n';

const TEXT_MODELS = [
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro — cel mai nou (💰💰💰)' },
  { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro — capabil, stabil (💰💰💰)' },
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash — recomandat, rapid (💰)' },
  { id: 'gemini-2.0-flash-lite',  label: 'Gemini 2.0 Flash Lite — buget minim (💰)' },
];

const VIDEO_MODELS = [
  { id: 'veo-3.1-generate-preview', label: 'Veo 3.1 — cel mai nou, premium (💰💰💰)' },
  { id: 'veo-2.0-generate-001', label: 'Veo 2.0 — stabil, mai ieftin (💰💰)' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

interface KeyStatus {
  configured: boolean;
  checking: boolean;
  error?: string;
}

const PROVIDERS = [
  { id: 'gemini',     name: 'Google Gemini / Veo 3',    descKey: 'geminiDesc'     },
  { id: 'elevenlabs', name: 'ElevenLabs (TTS)',          descKey: 'elevenLabsDesc' },
  { id: 'synclabs',   name: 'Sync.Labs (Lip-Sync)',      descKey: 'syncLabsDesc'   },
  { id: 'videogen',   name: 'VideoGen Gateway',          descKey: 'videoGenDesc'   },
];

export function SettingsModal({ isOpen, onClose, lang }: Props) {
  const t = translations[lang];
  const [keys, setKeys]           = useState<Record<string, string>>({});
  const [statuses, setStatuses]   = useState<Record<string, KeyStatus>>({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [models, setModels]       = useState({ textModel: 'gemini-2.0-flash', videoModel: 'veo-3.1-generate-preview' });

  // Load current server-side key status and models on open
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/config/status')
      .then(r => r.json())
      .then((data: Record<string, boolean>) => {
        const s: Record<string, KeyStatus> = {};
        for (const [k, v] of Object.entries(data)) {
          s[k] = { configured: v, checking: false };
        }
        setStatuses(s);
      })
      .catch(() => {});
    fetch('/api/config/models')
      .then(r => r.json())
      .then(data => setModels(data))
      .catch(() => {});
    setKeys({});
    setSaved(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = async (providerId: string) => {
    const key = keys[providerId];
    if (!key?.trim()) return;

    setStatuses(prev => ({ ...prev, [providerId]: { configured: false, checking: true } }));

    try {
      // Save key first (also updates process.env on server)
      await fetch('/api/config/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: providerId, key: key.trim() }),
      });

      // Real verification — lightweight API check (no generation call)
      const verifyRes = await fetch('/api/config/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: providerId, key: key.trim() }),
      });
      const verifyData = await verifyRes.json().catch(() => ({ valid: false, error: `Server error ${verifyRes.status}` }));

      setStatuses(prev => ({
        ...prev,
        [providerId]: {
          configured: verifyData.valid ?? false,
          checking: false,
          error: verifyData.valid ? undefined : (verifyData.error || 'Cheie invalidă'),
        },
      }));
    } catch (err: any) {
      setStatuses(prev => ({
        ...prev,
        [providerId]: { configured: false, checking: false, error: err.message },
      }));
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const [service, key] of Object.entries(keys)) {
        if (key?.trim()) {
          await fetch('/api/config/set-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, key: key.trim() }),
          });
        }
      }
      await fetch('/api/config/set-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(models),
      });
      // Refresh statuses
      const statusRes = await fetch('/api/config/status');
      const data = await statusRes.json();
      const s: Record<string, KeyStatus> = {};
      for (const [k, v] of Object.entries(data)) {
        s[k] = { configured: v as boolean, checking: false };
      }
      setStatuses(s);
      setKeys({});
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (err: any) {
      alert(`Error saving keys: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-indigo-400" />
            {t.settings}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-zinc-400 text-sm">{t.settingsDesc}</p>

          {/* AI Model Selector */}
          <div className="bg-zinc-900/50 border border-indigo-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <Cpu size={16} />
              {(t as any).modelSettings || 'AI Model Selection'}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">{(t as any).textModelLabel || 'Text Model (Story / Scenes)'}</label>
                <select
                  value={models.textModel}
                  onChange={e => setModels(prev => ({ ...prev, textModel: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  {TEXT_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">{(t as any).videoModelLabel || 'Video Model (Veo)'}</label>
                <select
                  value={models.videoModel}
                  onChange={e => setModels(prev => ({ ...prev, videoModel: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  {VIDEO_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {PROVIDERS.map(provider => {
            const status = statuses[provider.id];
            const desc = (t as any)[provider.descKey] || '';
            return (
              <div key={provider.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-semibold text-zinc-200">{provider.name}</span>
                    <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                  </div>
                  {status?.configured && !keys[provider.id] && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                      {t.verified}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keys[provider.id] || ''}
                    onChange={(e) => {
                      setKeys(prev => ({ ...prev, [provider.id]: e.target.value }));
                      setStatuses(prev => ({ ...prev, [provider.id]: { configured: false, checking: false, error: undefined } }));
                    }}
                    placeholder={status?.configured ? '••••••••••••• (already configured)' : `Enter ${provider.name} API Key...`}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={() => handleVerify(provider.id)}
                    disabled={!keys[provider.id]?.trim() || status?.checking}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors flex items-center gap-2 min-w-[90px] justify-center"
                  >
                    {status?.checking ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : status?.configured && keys[provider.id] ? (
                      <><CheckCircle2 size={15} className="text-emerald-400" /> OK</>
                    ) : (
                      t.verify
                    )}
                  </button>
                </div>

                {status?.error && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} /> {status.error}
                  </p>
                )}
              </div>
            );
          })}

          {/* Sync.Labs note */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200/80">
            ⚠️ {t.lipsyncWarning}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 shrink-0 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium py-2 px-6 rounded-lg transition-all flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : (
              <Save size={18} />
            )}
            {saved ? t.saved : t.saveKeys}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
