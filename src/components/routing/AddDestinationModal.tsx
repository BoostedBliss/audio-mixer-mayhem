import React, { useState } from 'react';
import { X, Plus, Radio, Headphones, Tv, Cpu } from 'lucide-react';
import { AudioDestination, DestinationType } from '../../types';

interface AddDestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDestination: (destination: AudioDestination) => void;
}

export const AddDestinationModal: React.FC<AddDestinationModalProps> = ({
  isOpen,
  onClose,
  onAddDestination,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<DestinationType>('virtual_output');
  const [channels, setChannels] = useState<number>(2);
  const [selectedColor, setSelectedColor] = useState('#8b5cf6');

  if (!isOpen) return null;

  const presets = [
    { name: 'OBS Stream Broadcast (Ch 1-2)', type: 'virtual_output' as const, color: '#ef4444' },
    { name: 'Headphone Cue Monitor (Ch 3-4)', type: 'monitor_cue' as const, color: '#8b5cf6' },
    { name: 'DAW Submix Recorder (Ch 5-6)', type: 'virtual_output' as const, color: '#06b6d4' },
    { name: 'Discord Virtual Microphone', type: 'virtual_output' as const, color: '#6366f1' },
    { name: 'Hardware Studio Monitors', type: 'hardware_output' as const, color: '#10b981' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newDest: AudioDestination = {
      id: `dest-${Date.now()}`,
      name: name.trim(),
      type,
      channels,
      isMonitor: type === 'monitor_cue',
      color: selectedColor,
    };

    onAddDestination(newDest);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Add Output Destination</h3>
            <p className="text-xs text-neutral-400">
              Create virtual output bus, monitor cue, or hardware bridge
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-mono text-neutral-400 uppercase mb-2">
              Common Destinations:
            </label>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {presets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setName(p.name);
                    setType(p.type);
                    setSelectedColor(p.color);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                    name === p.name
                      ? 'bg-neutral-800 border-indigo-500 text-neutral-100'
                      : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/60 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">
                    {p.type.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-neutral-400 mb-1">
              Destination Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Broadcast Output (Ch 1-2)"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DestinationType)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              >
                <option value="virtual_output">Virtual Output Bus</option>
                <option value="monitor_cue">Headphone Monitor Cue</option>
                <option value="hardware_output">Hardware DAC / Speakers</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                Channels
              </label>
              <select
                value={channels}
                onChange={(e) => setChannels(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              >
                <option value={2}>Stereo (2 Channels)</option>
                <option value={1}>Mono (1 Channel)</option>
                <option value={4}>Quad (4 Channels)</option>
                <option value={6}>5.1 Surround</option>
              </select>
            </div>
          </div>

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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Destination
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
