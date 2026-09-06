import React from 'react';
import {
  Play,
  Square,
  Mic,
  Music,
  Activity,
  Waves,
  Radio,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { SignalSourceMode } from '../../types';

interface AudioTestBarProps {
  currentMode: SignalSourceMode;
  onSelectMode: (mode: SignalSourceMode) => void;
  latencyMs: string;
  sampleRate: number;
  bufferSize: number;
}

export const AudioTestBar: React.FC<AudioTestBarProps> = ({
  currentMode,
  onSelectMode,
  latencyMs,
  sampleRate,
  bufferSize,
}) => {
  const isPlaying = currentMode !== 'off';

  const modes: { id: SignalSourceMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'chords',
      label: 'Ambient Chords',
      icon: <Music className="w-3.5 h-3.5 text-emerald-400" />,
      desc: 'Polyphonic analog synthesizer progression',
    },
    {
      id: 'synth_lead',
      label: 'Synth Lead',
      icon: <Sparkles className="w-3.5 h-3.5 text-indigo-400" />,
      desc: 'Upbeat arpeggiated melodic lead',
    },
    {
      id: 'beat_pulse',
      label: 'Lo-Fi Beats',
      icon: <Activity className="w-3.5 h-3.5 text-pink-400" />,
      desc: 'Synthesized kick, snare, and percussion pulse',
    },
    {
      id: 'microphone',
      label: 'Live Microphone',
      icon: <Mic className="w-3.5 h-3.5 text-amber-400" />,
      desc: 'Capture live mic and route through loopback',
    },
    {
      id: '1khz_tone',
      label: '1 kHz Ref Tone',
      icon: <Waves className="w-3.5 h-3.5 text-blue-400" />,
      desc: '-18 dBFS standard broadcast calibration tone',
    },
    {
      id: 'pink_noise',
      label: 'Pink Noise',
      icon: <Radio className="w-3.5 h-3.5 text-purple-400" />,
      desc: 'Acoustic testing & wideband frequency response',
    },
  ];

  return (
    <div className="bg-neutral-950/90 border-b border-neutral-800/90 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Left: Quick Generator Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          Test Signal Generator:
        </span>

        {/* Master Stop / Play Toggle */}
        <button
          onClick={() => onSelectMode(isPlaying ? 'off' : 'chords')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition-all border ${
            isPlaying
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-emerald-600 hover:bg-emerald-500 text-neutral-950 border-emerald-400 shadow-sm'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span>Stop Signal</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Start Test Stream</span>
            </>
          )}
        </button>

        {/* Signal Modes */}
        <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
          {modes.map((mode) => {
            const active = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(active ? 'off' : mode.id)}
                title={mode.desc}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all ${
                  active
                    ? 'bg-neutral-800 text-neutral-100 font-medium shadow-sm ring-1 ring-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Real-Time Stream Status & Buffer Statistics */}
      <div className="flex items-center gap-3 font-mono text-[11px]">
        {isPlaying && (
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Active Signal Flowing
            </span>
          </div>
        )}

        <div className="text-neutral-400 flex items-center gap-2">
          <span>CoreAudio Ring:</span>
          <span className="text-neutral-200 font-bold">Lockless SPSC</span>
          <span className="text-neutral-600">•</span>
          <span>Buffer:</span>
          <span className="text-neutral-200 font-bold">{bufferSize} smp</span>
          <span className="text-neutral-600">•</span>
          <span>Sample Drift:</span>
          <span className="text-emerald-400 font-bold">0 frames</span>
        </div>
      </div>
    </div>
  );
};
