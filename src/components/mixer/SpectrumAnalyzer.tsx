import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Activity,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Volume2,
  Radio,
  Eye,
  Info,
  X,
} from 'lucide-react';
import { VirtualDevice } from '../../types';
import { audioEngine } from '../../services/audioEngine';

// ISO 31-Band Standard 1/3-Octave Center Frequencies (Hz)
const ISO_31_BANDS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
  10000, 12500, 16000, 20000,
];

// Major Logarithmic Grid Frequencies for Axis Markers
const GRID_FREQUENCIES = [
  { freq: 20, label: '20' },
  { freq: 50, label: '50' },
  { freq: 100, label: '100' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2000, label: '2k' },
  { freq: 5000, label: '5k' },
  { freq: 10000, label: '10k' },
  { freq: 20000, label: '20k' },
];

// Frequency Range Acoustic Regions
const REGIONS = [
  { name: 'SUB', min: 20, max: 60, color: 'text-rose-400' },
  { name: 'BASS', min: 60, max: 250, color: 'text-amber-400' },
  { name: 'LOW MID', min: 250, max: 500, color: 'text-yellow-400' },
  { name: 'MID', min: 500, max: 2000, color: 'text-emerald-400' },
  { name: 'HIGH MID', min: 2000, max: 6000, color: 'text-teal-400' },
  { name: 'HIGH / AIR', min: 6000, max: 20000, color: 'text-cyan-400' },
];

// Musical Note Calculation from Frequency
export const hzToNote = (hz: number): string => {
  if (hz < 16 || hz > 22000 || !isFinite(hz)) return '—';
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  if (midi < 0 || midi > 127) return '—';
  const noteName = notes[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
};

export type SpectrumMode = 'curve' | 'rta31' | 'bars64';
export type FftResolution = 512 | 1024 | 2048;
export type SmoothingMode = 0.6 | 0.8 | 0.92;

interface SpectrumAnalyzerProps {
  device: VirtualDevice;
  className?: string;
  selectedTarget?: 'master' | number;
  onSelectTarget?: (target: 'master' | number) => void;
  onClose?: () => void;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  device,
  className = '',
  selectedTarget: controlledTarget,
  onSelectTarget,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Analyzer Configuration
  const [internalTarget, setInternalTarget] = useState<'master' | number>('master');
  const selectedTarget = controlledTarget !== undefined ? controlledTarget : internalTarget;

  const handleTargetChange = (target: 'master' | number) => {
    if (onSelectTarget) {
      onSelectTarget(target);
    }
    setInternalTarget(target);
    handleResetPeaks();
  };

  const [displayMode, setDisplayMode] = useState<SpectrumMode>('curve');
  const [fftSize, setFftSize] = useState<FftResolution>(1024);
  const [smoothing, setSmoothing] = useState<SmoothingMode>(0.8);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isTiltEnabled, setIsTiltEnabled] = useState(false); // +3dB/octave slope tilt compensation
  const [heightPreset, setHeightPreset] = useState<'compact' | 'normal' | 'expanded'>('normal');

  // Peak detection state
  const [peakFreq, setPeakFreq] = useState<number>(0);
  const [peakDb, setPeakDb] = useState<number>(-90);

  // Hover crosshair state
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    freq: number;
    db: number;
    note: string;
  } | null>(null);

  // Peak hold array ref (stores previous max peak per pixel/bin for smooth decay)
  const peakHoldRef = useRef<Float32Array>(new Float32Array(1024).fill(-90));
  const rtaPeakHoldRef = useRef<Float32Array>(new Float32Array(ISO_31_BANDS.length).fill(-90));

  // Update audio engine settings when FFT size or smoothing changes
  useEffect(() => {
    audioEngine.setFftResolution(fftSize, smoothing);
  }, [fftSize, smoothing]);

  // Main Canvas Render Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Buffer for reading raw FFT frequency data (0 to 255 byte values)
    const bufferLength = fftSize / 2;
    const dataArray = new Uint8Array(bufferLength);

    const LOG_MIN = Math.log10(20);
    const LOG_MAX = Math.log10(20000);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Handle freezing
      if (!isFrozen) {
        const analyser = audioEngine.getSpectrumAnalyser(selectedTarget);
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
        } else {
          // If no analyser active, clear data
          dataArray.fill(0);
        }
      }

      // Clear Canvas with sleek dark studio background
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, width, height);

      // Decibel Scale Boundaries
      const MIN_DB = -72;
      const MAX_DB = 6;
      const DB_RANGE = MAX_DB - MIN_DB;

      // Helper: converts frequency to X coordinate (Logarithmic)
      const freqToX = (freq: number) => {
        const clampedFreq = Math.max(20, Math.min(20000, freq));
        const logF = Math.log10(clampedFreq);
        const norm = (logF - LOG_MIN) / (LOG_MAX - LOG_MIN);
        return norm * width;
      };

      // Helper: converts dB to Y coordinate
      const dbToY = (db: number) => {
        const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, db));
        const norm = (MAX_DB - clampedDb) / DB_RANGE;
        return norm * height;
      };

      // 1. Draw Acoustic Frequency Region Background Bands
      REGIONS.forEach((reg, idx) => {
        const x1 = freqToX(reg.min);
        const x2 = freqToX(reg.max);
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.005)';
        ctx.fillRect(x1, 0, x2 - x1, height);

        // Region name watermark at top
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.textAlign = 'center';
        ctx.fillText(reg.name, (x1 + x2) / 2, 14);
      });

      // 2. Draw Horizontal Decibel Grid Lines
      const dbLines = [6, 0, -6, -12, -18, -24, -36, -48, -60, -72];
      dbLines.forEach((db) => {
        const y = dbToY(db);

        // Grid line
        ctx.beginPath();
        if (db === 0) {
          // 0 dBFS digital ceiling: prominent dashed line
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.setLineDash([4, 4]);
        } else if (db === -12) {
          // -12 dBFS broadcast nominal target: cyan/emerald line
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.setLineDash([3, 3]);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.setLineDash([]);
        }

        ctx.lineWidth = 1;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Decibel label on right side
        ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle =
          db === 0
            ? '#ef4444'
            : db === -12
            ? '#10b981'
            : 'rgba(255, 255, 255, 0.3)';
        ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, width - 6, y - 3);
      });

      // 3. Draw Vertical Frequency Grid Lines
      GRID_FREQUENCIES.forEach(({ freq, label }) => {
        const x = freqToX(freq);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Frequency label at bottom
        ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`${label}Hz`, x, height - 6);
      });

      // Determine AudioContext Sample Rate (typically 44100 or 48000)
      const audioCtx = audioEngine.getAudioContext();
      const sampleRate = audioCtx ? audioCtx.sampleRate : device.sampleRate;
      const binWidth = sampleRate / fftSize;

      // Find Global Peak Frequency in current frame
      let maxVal = 0;
      let maxIndex = 0;
      for (let i = 1; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }

      const calculatedPeakFreq = Math.round(maxIndex * binWidth);
      const calculatedPeakDb = Math.round(((maxVal / 255) * DB_RANGE + MIN_DB) * 10) / 10;
      if (maxVal > 5) {
        setPeakFreq(calculatedPeakFreq);
        setPeakDb(calculatedPeakDb);
      } else {
        setPeakFreq(0);
        setPeakDb(-90);
      }

      // 4. Render Spectrum Modes
      if (displayMode === 'curve') {
        // MODE A: Continuous Logarithmic Bezier Curve with Gradient Fill
        ctx.beginPath();
        ctx.moveTo(0, height);

        const points: { x: number; y: number }[] = [];
        const numSampleSteps = Math.min(width, 320);

        for (let s = 0; s <= numSampleSteps; s++) {
          const normX = s / numSampleSteps;
          const logFreq = LOG_MIN + normX * (LOG_MAX - LOG_MIN);
          const freq = Math.pow(10, logFreq);

          // Find closest FFT frequency bin
          const bin = Math.min(bufferLength - 1, Math.max(0, Math.round(freq / binWidth)));
          let byteVal = dataArray[bin] || 0;

          // Optional +3dB/octave slope tilt compensation (pink noise flatting)
          if (isTiltEnabled && freq > 20) {
            const octavesAbove20 = Math.log2(freq / 20);
            const tiltDb = octavesAbove20 * 3.0;
            const tiltVal = (tiltDb / DB_RANGE) * 255;
            byteVal = Math.min(255, byteVal + tiltVal * 0.4);
          }

          // Map byte (0-255) to dB (-72 to +6)
          const db = (byteVal / 255) * DB_RANGE + MIN_DB;
          const pxX = normX * width;
          const pxY = dbToY(db);
          points.push({ x: pxX, y: pxY });
        }

        // Connect points with smooth line
        if (points.length > 0) {
          ctx.lineTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          }
          ctx.lineTo(width, points[points.length - 1].y);
          ctx.lineTo(width, height);
          ctx.closePath();

          // Gradient Fill
          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
          gradient.addColorStop(0.3, 'rgba(20, 184, 166, 0.3)');
          gradient.addColorStop(0.7, 'rgba(14, 116, 144, 0.15)');
          gradient.addColorStop(1, 'rgba(10, 15, 25, 0.0)');
          ctx.fillStyle = gradient;
          ctx.fill();

          // Glowing Outline Stroke
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(52, 211, 153, 0.6)';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Peak Hold Line with Gravity Falloff
          ctx.beginPath();
          let hasPeakDrawn = false;
          for (let i = 0; i < points.length; i++) {
            const currentY = points[i].y;
            const oldPeak = peakHoldRef.current[i] || height;
            // Peak stays at maximum, falls slowly by 0.3px per frame
            const newPeak = Math.min(currentY, oldPeak + 0.3);
            peakHoldRef.current[i] = newPeak;

            if (newPeak < height - 5) {
              if (!hasPeakDrawn) {
                ctx.moveTo(points[i].x, newPeak);
                hasPeakDrawn = true;
              } else {
                ctx.lineTo(points[i].x, newPeak);
              }
            }
          }
          if (hasPeakDrawn) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      } else if (displayMode === 'rta31') {
        // MODE B: ISO 31-Band 1/3-Octave Graphic Analyzer Bars
        const bandCount = ISO_31_BANDS.length;
        const totalGap = (bandCount - 1) * 3;
        const barWidth = Math.max(3, (width - 40 - totalGap) / bandCount);

        ISO_31_BANDS.forEach((centerFreq, bIdx) => {
          const lowerFreq = centerFreq * Math.pow(2, -1 / 6);
          const upperFreq = centerFreq * Math.pow(2, 1 / 6);

          const lowerBin = Math.max(0, Math.floor(lowerFreq / binWidth));
          const upperBin = Math.min(bufferLength - 1, Math.ceil(upperFreq / binWidth));

          let sum = 0;
          let count = 0;
          for (let k = lowerBin; k <= upperBin; k++) {
            sum += dataArray[k];
            count++;
          }
          const avgByte = count > 0 ? sum / count : 0;
          const db = (avgByte / 255) * DB_RANGE + MIN_DB;

          const x = 20 + bIdx * (barWidth + 3);
          const barY = dbToY(db);
          const barHeight = height - barY;

          // Draw Segmented LED Bar
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, '#059669');
          gradient.addColorStop(0.6, '#10b981');
          gradient.addColorStop(0.85, '#f59e0b');
          gradient.addColorStop(1, '#ef4444');

          ctx.fillStyle = gradient;
          ctx.fillRect(x, barY, barWidth, barHeight);

          // Subtle rounded border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, barY, barWidth, barHeight);

          // RTA Peak Cap with smooth decay
          const oldPeak = rtaPeakHoldRef.current[bIdx] || height;
          const newPeak = Math.min(barY, oldPeak + 0.4);
          rtaPeakHoldRef.current[bIdx] = newPeak;

          if (newPeak < height - 5) {
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(x, newPeak, barWidth, 2);
          }
        });
      } else {
        // MODE C: Dense 64-Band Spectrum Visualizer
        const numBars = 64;
        const barWidth = (width - 20) / numBars;

        for (let i = 0; i < numBars; i++) {
          const norm = i / numBars;
          const logF = LOG_MIN + norm * (LOG_MAX - LOG_MIN);
          const freq = Math.pow(10, logF);
          const bin = Math.min(bufferLength - 1, Math.max(0, Math.round(freq / binWidth)));

          const byteVal = dataArray[bin] || 0;
          const db = (byteVal / 255) * DB_RANGE + MIN_DB;
          const barY = dbToY(db);
          const barHeight = height - barY;
          const x = 10 + i * barWidth;

          const barGrad = ctx.createLinearGradient(0, height, 0, barY);
          barGrad.addColorStop(0, 'rgba(6, 182, 212, 0.6)');
          barGrad.addColorStop(1, 'rgba(52, 211, 153, 0.95)');

          ctx.fillStyle = barGrad;
          ctx.fillRect(x + 1, barY, barWidth - 2, barHeight);
        }
      }

      // 5. Draw Interactive Hover Crosshair
      if (hoverData) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.moveTo(hoverData.x, 0);
        ctx.lineTo(hoverData.x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hover point dot
        ctx.beginPath();
        ctx.arc(hoverData.x, hoverData.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [selectedTarget, displayMode, fftSize, isFrozen, isTiltEnabled, hoverData]);

  // Sync canvas width and height with container using ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [heightPreset]);

  // Mouse Move Handler for Dynamic Cursor Frequency Inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clientX / rect.width));
    const LOG_MIN = Math.log10(20);
    const LOG_MAX = Math.log10(20000);
    const freq = Math.round(Math.pow(10, LOG_MIN + normX * (LOG_MAX - LOG_MIN)));

    const MIN_DB = -72;
    const MAX_DB = 6;
    const normY = Math.max(0, Math.min(1, clientY / rect.height));
    const db = Math.round((MAX_DB - normY * (MAX_DB - MIN_DB)) * 10) / 10;
    const note = hzToNote(freq);

    setHoverData({
      x: clientX,
      y: clientY,
      freq,
      db,
      note,
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  // Reset Peak Holds
  const handleResetPeaks = () => {
    peakHoldRef.current.fill(-90);
    rtaPeakHoldRef.current.fill(-90);
    setPeakFreq(0);
    setPeakDb(-90);
  };

  const heightClasses = {
    compact: 'h-32',
    normal: 'h-48',
    expanded: 'h-64',
  };

  return (
    <div
      className={`border-b border-neutral-800/90 bg-neutral-950 flex flex-col relative overflow-hidden select-none shadow-2xl ${className}`}
    >
      {/* Top Header / Control Toolbar */}
      <div className="px-4 py-2 bg-neutral-900/80 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5 z-10">
        {/* Left: Title, Live Status & Channel Probe Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-200">
                  FFT Spectrum Analyzer
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full border transition-all ${
                    isFrozen
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isFrozen ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span>{isFrozen ? 'PAUSED' : 'REAL-TIME'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {/* Target Probe Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-neutral-400">
              Probe:
            </span>
            <select
              value={selectedTarget}
              onChange={(e) => {
                const val = e.target.value;
                handleTargetChange(val === 'master' ? 'master' : Number(val));
              }}
              className="bg-neutral-950 border border-neutral-700 hover:border-neutral-600 rounded-lg px-2 py-1 text-xs font-mono text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="master">Master Bus (Main Out)</option>
              {device.channels.map((ch) => (
                <option key={ch.channelNumber} value={ch.channelNumber}>
                  Ch {ch.channelNumber}: {ch.name || `Channel ${ch.channelNumber}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Live Peak Detector Readout */}
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-center gap-2 font-mono text-xs shadow-inner">
            <span className="text-neutral-400 text-[10px] uppercase">
              Peak:
            </span>
            {peakFreq > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">
                  {peakFreq >= 1000
                    ? `${(peakFreq / 1000).toFixed(2)} kHz`
                    : `${peakFreq} Hz`}
                </span>
                <span className="text-neutral-400 text-[11px]">
                  ({peakDb > 0 ? `+${peakDb}` : peakDb} dBFS)
                </span>
                <span className="px-1 py-0.2 rounded bg-neutral-800 text-amber-300 text-[10px] font-bold">
                  {hzToNote(peakFreq)}
                </span>
              </div>
            ) : (
              <span className="text-neutral-400 text-[11px]">Signal Floor</span>
            )}
          </div>
        </div>

        {/* Right: Display Mode, Resolution, Smoothing & View Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Mode Selector */}
          <div className="flex items-center rounded-lg bg-neutral-950 p-0.5 border border-neutral-800 font-mono text-[11px]">
            <button
              onClick={() => setDisplayMode('curve')}
              className={`px-2 py-1 rounded-md transition-colors ${
                displayMode === 'curve'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Continuous DAW contour curve with filled gradient"
            >
              Curve
            </button>
            <button
              onClick={() => setDisplayMode('rta31')}
              className={`px-2 py-1 rounded-md transition-colors ${
                displayMode === 'rta31'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="ISO Standard 31-Band 1/3-Octave RTA"
            >
              31-Band RTA
            </button>
            <button
              onClick={() => setDisplayMode('bars64')}
              className={`px-2 py-1 rounded-md transition-colors ${
                displayMode === 'bars64'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Dense 64-Band Spectrum"
            >
              64-Band
            </button>
          </div>

          {/* FFT Resolution Dropdown */}
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span className="text-neutral-400 text-[10px]">FFT:</span>
            <select
              value={fftSize}
              onChange={(e) => setFftSize(Number(e.target.value) as FftResolution)}
              className="bg-neutral-950 border border-neutral-700 hover:border-neutral-600 rounded px-1.5 py-1 text-[11px] font-mono text-neutral-300 focus:outline-none"
              title="FFT Window Size: Higher provides finer frequency resolution"
            >
              <option value="512">512</option>
              <option value="1024">1024 (Std)</option>
              <option value="2048">2048 (Hi-Res)</option>
            </select>
          </div>

          {/* Tilt Slope Toggle */}
          <button
            onClick={() => setIsTiltEnabled(!isTiltEnabled)}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
              isTiltEnabled
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Tilt compensation (+3dB/octave slope for perceived loudness matching)"
          >
            +3dB Tilt
          </button>

          {/* Freeze / Live Toggle */}
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
              isFrozen
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Freeze/Pause audio frame for static inspection"
          >
            {isFrozen ? (
              <>
                <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 text-neutral-400" />
                <span>Freeze</span>
              </>
            )}
          </button>

          {/* Reset Peaks */}
          <button
            onClick={handleResetPeaks}
            className="p-1 rounded bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
            title="Reset peak hold envelope"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Height Preset Toggle */}
          <div className="flex items-center rounded bg-neutral-950 border border-neutral-800 p-0.5">
            <button
              onClick={() =>
                setHeightPreset(
                  heightPreset === 'compact'
                    ? 'normal'
                    : heightPreset === 'normal'
                    ? 'expanded'
                    : 'compact'
                )
              }
              className="p-1 text-neutral-400 hover:text-neutral-200"
              title={`Resize Spectrum Height (Current: ${heightPreset})`}
            >
              {heightPreset === 'expanded' ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 border border-neutral-800 transition-colors"
              title="Close Spectrum Analyzer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Spectrum Canvas Stage */}
      <div
        ref={containerRef}
        className={`w-full ${heightClasses[heightPreset]} relative bg-[#080a0f] cursor-crosshair overflow-hidden`}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />

        {/* Hover Tooltip Overlay */}
        {hoverData && (
          <div
            className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded-lg bg-neutral-950/95 border border-neutral-700/80 shadow-2xl text-[11px] font-mono text-neutral-200 flex items-center gap-2 transform -translate-x-1/2 -translate-y-full mb-2 backdrop-blur-md"
            style={{
              left: `${hoverData.x}px`,
              top: `${hoverData.y}px`,
            }}
          >
            <span className="text-emerald-400 font-bold">
              {hoverData.freq >= 1000
                ? `${(hoverData.freq / 1000).toFixed(2)} kHz`
                : `${hoverData.freq} Hz`}
            </span>
            <span className="text-neutral-400">•</span>
            <span className="text-neutral-300">
              {hoverData.db > 0 ? `+${hoverData.db}` : hoverData.db} dBFS
            </span>
            <span className="text-neutral-400">•</span>
            <span className="text-amber-400 font-semibold">{hoverData.note}</span>
          </div>
        )}
      </div>
    </div>
  );
};
