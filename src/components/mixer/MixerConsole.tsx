import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Zap,
  Activity,
  Headphones,
  Check,
} from 'lucide-react';
import { VirtualChannelStrip, VirtualDevice } from '../../types';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';

interface MixerConsoleProps {
  device: VirtualDevice;
  onUpdateChannels: (channels: VirtualChannelStrip[]) => void;
  masterVolumeDb: number;
  onUpdateMasterVolume: (db: number) => void;
  masterMuted: boolean;
  onToggleMasterMute: () => void;
  masterPeakL: number;
  masterPeakR: number;
  masterRmsL: number;
  masterRmsR: number;
  masterClip: boolean;
  onClearMasterClip: () => void;
}

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  device,
  onUpdateChannels,
  masterVolumeDb,
  onUpdateMasterVolume,
  masterMuted,
  onToggleMasterMute,
  masterPeakL,
  masterPeakR,
  masterRmsL,
  masterRmsR,
  masterClip,
  onClearMasterClip,
}) => {
  const [isMonoChecked, setIsMonoChecked] = useState(false);
  const [isDimActive, setIsDimActive] = useState(false);
  const [isSpectrumOpen, setIsSpectrumOpen] = useState(true);
  const [spectrumTarget, setSpectrumTarget] = useState<'master' | number>('master');

  // Check if any channel is in solo
  const isAnySolo = device.channels.some((c) => c.isSolo);

  const handleUpdateChannel = (chNum: number, updates: Partial<VirtualChannelStrip>) => {
    const updated = device.channels.map((ch) =>
      ch.channelNumber === chNum ? { ...ch, ...updates } : ch
    );
    onUpdateChannels(updated);
  };

  const handleResetAllFaders = () => {
    const updated = device.channels.map((ch) => ({
      ...ch,
      faderDb: 0.0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isPhaseInverted: false,
      isHpfActive: false,
    }));
    onUpdateChannels(updated);
  };

  const handleResetMeterPeaks = () => {
    const updated = device.channels.map((ch) => ({
      ...ch,
      peakHoldL: -60,
      peakHoldR: -60,
      isClipping: false,
    }));
    onUpdateChannels(updated);
    onClearMasterClip();
  };

  // Convert dB (-60 to +12) to percentage height (0% to 100%)
  const dbToHeightPercent = (db: number) => {
    if (db <= -60) return 0;
    // -60 to 0 is 0% to 80%, 0 to +12 is 80% to 100%
    if (db <= 0) {
      return ((db + 60) / 60) * 80;
    } else {
      return 80 + (db / 12) * 20;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950 select-none overflow-hidden">
      {/* Top Console Action Bar */}
      <div className="px-5 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-200 font-semibold">
              Virtual Channel Console ({device.channelCount} Channels)
            </span>
          </div>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {/* Quick Utility Actions */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleResetMeterPeaks}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors border border-neutral-700/80"
              title="Reset all Peak & Clip indicator latches"
            >
              <RotateCcw className="w-3 h-3 text-neutral-400" />
              <span>Reset VU Peaks</span>
            </button>

            <button
              onClick={handleResetAllFaders}
              className="px-2.5 py-1 rounded-md bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors border border-neutral-800"
              title="Set all channel faders to 0.0 dB Unity Gain"
            >
              Zero All Faders
            </button>

            <button
              onClick={() => setIsMonoChecked(!isMonoChecked)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                isMonoChecked
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                  : 'bg-neutral-800/60 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
              }`}
              title="Check mono phase compatibility"
            >
              Mono Check
            </button>

            <button
              onClick={() => setIsDimActive(!isDimActive)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                isDimActive
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold'
                  : 'bg-neutral-800/60 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
              }`}
              title="Dim monitor volume by -20 dB"
            >
              -20dB DIM
            </button>

            <button
              onClick={() => setIsSpectrumOpen(!isSpectrumOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all border ${
                isSpectrumOpen
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-neutral-800/60 text-neutral-400 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-200'
              }`}
              title="Toggle real-time FFT frequency response spectrum analyzer"
            >
              <Activity className={`w-3.5 h-3.5 ${isSpectrumOpen ? 'text-emerald-400' : 'text-neutral-400'}`} />
              <span>FFT Spectrum</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSpectrumOpen ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Faders: Precision 0.1dB Step</span>
          </span>
          <span>•</span>
          <span>Double-click Fader for 0.0dB Unity</span>
        </div>
      </div>

      {/* Real-Time Fast Fourier Transform (FFT) Spectrum Analyzer */}
      {isSpectrumOpen && (
        <SpectrumAnalyzer
          device={device}
          selectedTarget={spectrumTarget}
          onSelectTarget={setSpectrumTarget}
          onClose={() => setIsSpectrumOpen(false)}
        />
      )}

      {/* Channel Strips Area */}
      <div className="flex-1 flex min-h-0 overflow-x-auto p-4 gap-3">
        {/* Render Virtual Channels */}
        {device.channels.map((ch) => {
          const effectiveFader = ch.faderDb;
          const peakHeightL = dbToHeightPercent(ch.peakDbL);
          const peakHeightR = dbToHeightPercent(ch.peakDbR);
          const rmsHeightL = dbToHeightPercent(ch.rmsDbL);
          const rmsHeightR = dbToHeightPercent(ch.rmsDbR);

          return (
            <div
              key={ch.channelNumber}
              className="w-32 shrink-0 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex flex-col justify-between shadow-xl relative overflow-hidden"
            >
              {/* Channel Header */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-bold">
                    CH {ch.channelNumber}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* FFT Probe Button */}
                    <button
                      onClick={() => {
                        setIsSpectrumOpen(true);
                        setSpectrumTarget(ch.channelNumber);
                      }}
                      className={`text-[9px] font-mono px-1 py-0.5 rounded transition-colors ${
                        isSpectrumOpen && spectrumTarget === ch.channelNumber
                          ? 'bg-emerald-600 text-white font-bold ring-1 ring-emerald-400'
                          : 'bg-neutral-800 text-neutral-400 hover:text-emerald-300'
                      }`}
                      title={`Probe Ch ${ch.channelNumber} on FFT Spectrum Analyzer`}
                    >
                      FFT
                    </button>
                    {/* HPF Toggle */}
                    <button
                      onClick={() =>
                        handleUpdateChannel(ch.channelNumber, {
                          isHpfActive: !ch.isHpfActive,
                        })
                      }
                      className={`text-[9px] font-mono px-1 py-0.5 rounded transition-colors ${
                        ch.isHpfActive
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="80Hz High Pass Filter"
                    >
                      HPF
                    </button>
                    {/* Phase Invert */}
                    <button
                      onClick={() =>
                        handleUpdateChannel(ch.channelNumber, {
                          isPhaseInverted: !ch.isPhaseInverted,
                        })
                      }
                      className={`text-[9px] font-mono px-1 py-0.5 rounded transition-colors ${
                        ch.isPhaseInverted
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Phase Invert 180°"
                    >
                      Ø
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={ch.name}
                  onChange={(e) =>
                    handleUpdateChannel(ch.channelNumber, { name: e.target.value })
                  }
                  className="w-full bg-transparent text-neutral-200 text-xs font-semibold focus:outline-none focus:bg-neutral-800 rounded px-1 py-0.5 truncate"
                />
              </div>

              {/* Rotary Pan Control */}
              <div className="my-2 bg-neutral-950/60 p-1.5 rounded-xl border border-neutral-800/80 flex flex-col items-center">
                <div className="flex items-center justify-between w-full text-[9px] font-mono text-neutral-400 mb-1">
                  <span>PAN</span>
                  <span
                    className="cursor-pointer hover:text-white"
                    onDoubleClick={() =>
                      handleUpdateChannel(ch.channelNumber, { pan: 0 })
                    }
                    title="Double click to center"
                  >
                    {ch.pan === 0
                      ? 'C'
                      : ch.pan < 0
                      ? `${Math.abs(ch.pan)}L`
                      : `${ch.pan}R`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={ch.pan}
                  onChange={(e) =>
                    handleUpdateChannel(ch.channelNumber, { pan: Number(e.target.value) })
                  }
                  className="w-full h-1.5 accent-emerald-500 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Mute & Solo Buttons */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  onClick={() =>
                    handleUpdateChannel(ch.channelNumber, { isMuted: !ch.isMuted })
                  }
                  className={`py-1 rounded font-mono text-[11px] font-bold transition-all border ${
                    ch.isMuted
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-700'
                  }`}
                  title="Mute Channel"
                >
                  MUTE
                </button>
                <button
                  onClick={() =>
                    handleUpdateChannel(ch.channelNumber, { isSolo: !ch.isSolo })
                  }
                  className={`py-1 rounded font-mono text-[11px] font-bold transition-all border ${
                    ch.isSolo
                      ? 'bg-blue-500 text-neutral-950 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-700'
                  }`}
                  title="Solo Channel"
                >
                  SOLO
                </button>
              </div>

              {/* Fader & Stereo VU Meter Section */}
              <div className="flex-1 flex items-center justify-center gap-3 my-2 min-h-[190px]">
                {/* Dual LED VU Meter */}
                <div className="flex items-center gap-0.5 h-full py-1">
                  {/* Left Meter */}
                  <div className="w-1.5 h-full bg-neutral-950 rounded-full flex flex-col justify-end overflow-hidden p-0.5 border border-neutral-800 relative">
                    {/* Meter fill */}
                    <div
                      className="w-full rounded-full transition-all duration-75"
                      style={{
                        height: `${peakHeightL}%`,
                        background:
                          ch.peakDbL > -0.5
                            ? '#ef4444'
                            : ch.peakDbL > -12
                            ? '#f59e0b'
                            : '#10b981',
                      }}
                    />
                  </div>

                  {/* Right Meter */}
                  <div className="w-1.5 h-full bg-neutral-950 rounded-full flex flex-col justify-end overflow-hidden p-0.5 border border-neutral-800 relative">
                    <div
                      className="w-full rounded-full transition-all duration-75"
                      style={{
                        height: `${peakHeightR}%`,
                        background:
                          ch.peakDbR > -0.5
                            ? '#ef4444'
                            : ch.peakDbR > -12
                            ? '#f59e0b'
                            : '#10b981',
                      }}
                    />
                  </div>

                  {/* Scale Markings */}
                  <div className="flex flex-col justify-between h-full text-[8px] font-mono text-neutral-500 pl-1 leading-none py-1">
                    <span>+12</span>
                    <span>+6</span>
                    <span className="text-emerald-400 font-bold">0</span>
                    <span>-6</span>
                    <span>-12</span>
                    <span>-24</span>
                    <span>-48</span>
                    <span>-∞</span>
                  </div>
                </div>

                {/* Vertical Fader */}
                <div className="relative h-full flex items-center justify-center w-8">
                  {/* Fader Track Line */}
                  <div className="absolute top-2 bottom-2 w-1.5 bg-neutral-950 border border-neutral-800 rounded-full" />

                  {/* HTML Range Input rotated vertical */}
                  <input
                    type="range"
                    min="-60"
                    max="12"
                    step="0.2"
                    value={ch.faderDb}
                    onChange={(e) =>
                      handleUpdateChannel(ch.channelNumber, {
                        faderDb: Number(e.target.value),
                      })
                    }
                    onDoubleClick={() =>
                      handleUpdateChannel(ch.channelNumber, { faderDb: 0.0 })
                    }
                    className="w-40 h-8 -rotate-90 cursor-pointer accent-neutral-200 bg-transparent absolute"
                    style={{ zIndex: 10 }}
                    title="Double-click to set 0.0 dB unity"
                  />
                </div>
              </div>

              {/* Fader Readout & Clip Indicator */}
              <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                <button
                  onClick={() =>
                    handleUpdateChannel(ch.channelNumber, { isClipping: false })
                  }
                  className={`w-3 h-3 rounded-full border transition-all ${
                    ch.isClipping
                      ? 'bg-red-500 border-red-300 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      : 'bg-neutral-950 border-neutral-800'
                  }`}
                  title={ch.isClipping ? 'Clip detected! Click to reset' : 'No clip'}
                />

                <div
                  className="font-mono text-xs font-bold text-neutral-200 cursor-pointer hover:text-emerald-400"
                  onDoubleClick={() =>
                    handleUpdateChannel(ch.channelNumber, { faderDb: 0.0 })
                  }
                  title="Double click to reset to 0.0 dB"
                >
                  {ch.faderDb <= -59
                    ? '-∞ dB'
                    : `${ch.faderDb > 0 ? '+' : ''}${ch.faderDb.toFixed(1)} dB`}
                </div>
              </div>
            </div>
          );
        })}

        {/* Master Output Bus Strip */}
        <div className="w-40 shrink-0 bg-neutral-900/90 border-2 border-emerald-500/50 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />

          {/* Master Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold uppercase tracking-wider">
                Master Bus
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsSpectrumOpen(true);
                    setSpectrumTarget('master');
                  }}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                    isSpectrumOpen && spectrumTarget === 'master'
                      ? 'bg-emerald-600 text-white font-bold ring-1 ring-emerald-400'
                      : 'bg-neutral-800 text-neutral-400 hover:text-emerald-300'
                  }`}
                  title="Probe Master Mix on FFT Spectrum Analyzer"
                >
                  FFT
                </button>
                <button
                  onClick={onClearMasterClip}
                  className={`w-3.5 h-3.5 rounded-full border transition-all ${
                    masterClip
                      ? 'bg-red-500 border-red-300 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                      : 'bg-neutral-950 border-neutral-800'
                  }`}
                  title="Master clip status"
                />
              </div>
            </div>
            <div className="font-bold text-neutral-100 text-sm">
              CoreAudio Main Out
            </div>
            <div className="text-[10px] font-mono text-neutral-400">
              Zero-Latency Mix Engine
            </div>
          </div>

          {/* Master Mute */}
          <div className="my-2">
            <button
              onClick={onToggleMasterMute}
              className={`w-full py-1.5 rounded-lg font-mono text-xs font-bold transition-all border ${
                masterMuted
                  ? 'bg-red-600 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700'
              }`}
            >
              {masterMuted ? 'MASTER MUTED' : 'MASTER LIVE'}
            </button>
          </div>

          {/* Master Fader & Precision VU Meter */}
          <div className="flex-1 flex items-center justify-center gap-3 my-2 min-h-[190px]">
            {/* Dual Stereo Master VU Meter */}
            <div className="flex items-center gap-1 h-full py-1">
              <div className="w-2.5 h-full bg-neutral-950 rounded-full flex flex-col justify-end overflow-hidden p-0.5 border border-neutral-800">
                <div
                  className="w-full rounded-full transition-all duration-75"
                  style={{
                    height: `${dbToHeightPercent(masterPeakL)}%`,
                    background:
                      masterPeakL > -0.5
                        ? '#ef4444'
                        : masterPeakL > -12
                        ? '#f59e0b'
                        : '#10b981',
                  }}
                />
              </div>
              <div className="w-2.5 h-full bg-neutral-950 rounded-full flex flex-col justify-end overflow-hidden p-0.5 border border-neutral-800">
                <div
                  className="w-full rounded-full transition-all duration-75"
                  style={{
                    height: `${dbToHeightPercent(masterPeakR)}%`,
                    background:
                      masterPeakR > -0.5
                        ? '#ef4444'
                        : masterPeakR > -12
                        ? '#f59e0b'
                        : '#10b981',
                  }}
                />
              </div>

              {/* Master Scale */}
              <div className="flex flex-col justify-between h-full text-[9px] font-mono text-neutral-400 pl-1 leading-none py-1">
                <span className="text-red-400 font-bold">+12</span>
                <span>+6</span>
                <span className="text-emerald-400 font-bold">0</span>
                <span>-6</span>
                <span>-12</span>
                <span>-24</span>
                <span>-48</span>
                <span>-∞</span>
              </div>
            </div>

            {/* Master Fader */}
            <div className="relative h-full flex items-center justify-center w-8">
              <div className="absolute top-2 bottom-2 w-2 bg-neutral-950 border border-neutral-700 rounded-full" />
              <input
                type="range"
                min="-60"
                max="12"
                step="0.2"
                value={masterVolumeDb}
                onChange={(e) => onUpdateMasterVolume(Number(e.target.value))}
                onDoubleClick={() => onUpdateMasterVolume(0.0)}
                className="w-40 h-8 -rotate-90 cursor-pointer accent-emerald-400 bg-transparent absolute"
                style={{ zIndex: 10 }}
                title="Double-click to set 0.0 dB unity"
              />
            </div>
          </div>

          {/* Master Numeric Readout */}
          <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-[10px] font-mono text-neutral-400">LEVEL:</span>
            <div
              className="font-mono text-xs font-bold text-emerald-400 cursor-pointer hover:underline"
              onDoubleClick={() => onUpdateMasterVolume(0.0)}
              title="Double click to set 0.0 dB"
            >
              {masterVolumeDb <= -59
                ? '-∞ dB'
                : `${masterVolumeDb > 0 ? '+' : ''}${masterVolumeDb.toFixed(1)} dB`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
