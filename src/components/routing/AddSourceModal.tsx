import React, { useState } from 'react';
import {
  X,
  Plus,
  Music,
  MessageSquare,
  Globe,
  Sliders,
  Tv,
  Gamepad2,
  Radio,
  Film,
  Mic,
  Headphones,
  Check,
} from 'lucide-react';
import { AudioSource } from '../../types';
import { AVAILABLE_APP_PRESETS, AVAILABLE_HARDWARE_PRESETS } from '../../data/defaultDevices';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: AudioSource) => void;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
}) => {
  const [sourceType, setSourceType] = useState<'application' | 'hardware_input'>('application');
  const [name, setName] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [channels, setChannels] = useState<number>(2);
  const [selectedColor, setSelectedColor] = useState('#10b981');
  const [autoGain, setAutoGain] = useState(true);

  if (!isOpen) return null;

  const handleSelectPreset = (app: { name: string; bundleId: string; color: string }) => {
    setName(app.name);
    setBundleId(app.bundleId);
    setSelectedColor(app.color);
  };

  const handleSelectHardwarePreset = (hw: { name: string; channels: number }) => {
    setName(hw.name);
    setChannels(hw.channels);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const estimatedIncoming = sourceType === 'hardware_input' ? -24.0 : -18.0;
    const normOffset = autoGain ? Number((-12.0 - estimatedIncoming).toFixed(1)) : 0.0;

    const newSource: AudioSource = {
      id: `src-${Date.now()}`,
      name: name.trim(),
      type: sourceType,
      bundleId: sourceType === 'application' ? (bundleId || `com.custom.${name.toLowerCase().replace(/\s+/g, '')}`) : undefined,
      icon: sourceType === 'hardware_input' ? 'Mic' : 'Music',
      channels,
      processId: Math.floor(10000 + Math.random() * 80000),
      isActive: true,
      gainDb: normOffset,
      isMuted: false,
      color: selectedColor,
      autoGain,
      targetRmsDb: -12.0,
      incomingRmsDb: estimatedIncoming,
      normalizedOffsetDb: normOffset,
    };

    onAddSource(newSource);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Add Audio Source</h3>
            <p className="text-xs text-neutral-400">
              Capture application audio or physical input interface
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Source Type Selector */}
          <div className="flex rounded-lg bg-neutral-950 p-1 border border-neutral-800">
            <button
              type="button"
              onClick={() => setSourceType('application')}
              className={`flex-1 py-1.5 rounded-md font-medium text-xs transition-all ${
                sourceType === 'application'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Running Application
            </button>
            <button
              type="button"
              onClick={() => setSourceType('hardware_input')}
              className={`flex-1 py-1.5 rounded-md font-medium text-xs transition-all ${
                sourceType === 'hardware_input'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Physical Hardware Input
            </button>
          </div>

          {/* Presets List */}
          <div>
            <label className="block text-[11px] font-mono text-neutral-400 uppercase mb-2">
              {sourceType === 'application' ? 'Quick Select Running App:' : 'Hardware Devices:'}
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {sourceType === 'application'
                ? AVAILABLE_APP_PRESETS.map((app) => (
                    <button
                      key={app.bundleId}
                      type="button"
                      onClick={() => handleSelectPreset(app)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                        name === app.name
                          ? 'bg-neutral-800 border-emerald-500 text-neutral-100'
                          : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/60 text-neutral-300'
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: app.color }}
                      />
                      <span className="truncate font-medium">{app.name}</span>
                    </button>
                  ))
                : AVAILABLE_HARDWARE_PRESETS.map((hw) => (
                    <button
                      key={hw.name}
                      type="button"
                      onClick={() => handleSelectHardwarePreset(hw)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                        name === hw.name
                          ? 'bg-neutral-800 border-emerald-500 text-neutral-100'
                          : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-800/60 text-neutral-300'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5 text-amber-400" />
                      <span className="truncate font-medium">{hw.name}</span>
                    </button>
                  ))}
            </div>
          </div>

          {/* Name & Bundle ID */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                Source Display Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Discord Voice, Spotify, OBS Music"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            {sourceType === 'application' && (
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  macOS Bundle Identifier
                </label>
                <input
                  type="text"
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  placeholder="e.g. com.spotify.client"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-400 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Channels & Color */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  Channel Format
                </label>
                <select
                  value={channels}
                  onChange={(e) => setChannels(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                >
                  <option value={1}>1 Channel (Mono)</option>
                  <option value={2}>2 Channels (Stereo L/R)</option>
                  <option value={4}>4 Channels (Quad)</option>
                  <option value={6}>6 Channels (5.1 Surround)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  Color Tag
                </label>
                <div className="flex items-center gap-2 pt-1">
                  {['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Auto-Gain Normalization Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-200">
                    Enable Auto-Gain Normalization
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    -12dB RMS
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Automatically balances incoming stream levels to the nominal -12 dBFS RMS target.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoGain}
                onClick={() => setAutoGain(!autoGain)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoGain ? 'bg-emerald-500' : 'bg-neutral-700 hover:bg-neutral-600'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    autoGain ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-neutral-950 font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Source
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
