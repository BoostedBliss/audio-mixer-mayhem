import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Minimize2,
  Maximize2,
  X,
  RefreshCw,
  Zap,
  Sliders,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  Move,
  CornerDownRight,
} from 'lucide-react';
import { VirtualDevice, BufferSize } from '../../types';

interface PerformanceOverlayProps {
  device: VirtualDevice;
  onUpdateBufferSize: (size: BufferSize) => void;
  isDriverActive: boolean;
  onClose?: () => void;
}

interface MetricHistoryPoint {
  cpu: number; // 0 - 100%
  bufferHealth: number; // 0 - 100%
  isDropout: boolean;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  device,
  onUpdateBufferSize,
  isDriverActive,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [dockPosition, setDockPosition] = useState<'bottom-right' | 'top-right' | 'bottom-left'>('bottom-right');
  
  // Real-time telemetry state
  const [cpuUsage, setCpuUsage] = useState(0.22); // Percentage
  const [dspTimeUsedMs, setDspTimeUsedMs] = useState(0.08); // ms
  const [bufferHealth, setBufferHealth] = useState(99.6); // Percentage
  const [jitterUs, setJitterUs] = useState(14); // Microseconds
  const [underruns, setUnderruns] = useState(0);
  const [overruns, setOverruns] = useState(0);
  const [lastDropoutTime, setLastDropoutTime] = useState<string | null>(null);
  const [isSpiking, setIsSpiking] = useState(false);
  const [troubleshootingMessage, setTroubleshootingMessage] = useState<string | null>(null);

  // Sparkline rolling data history
  const [history, setHistory] = useState<MetricHistoryPoint[]>(() => {
    return Array.from({ length: 30 }, () => ({
      cpu: 0.2 + Math.random() * 0.1,
      bufferHealth: 99.5 + Math.random() * 0.5,
      isDropout: false,
    }));
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Buffer cycle deadline calculation (ms)
  // Deadline = bufferSize / sampleRate * 1000
  const bufferDurationMs = (device.bufferSize / device.sampleRate) * 1000;

  // Real-time simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      // If currently simulating a spike
      if (isSpiking) return;

      if (!isDriverActive) {
        setCpuUsage(0.02);
        setBufferHealth(100);
        setDspTimeUsedMs(0.01);
        return;
      }

      // Base CPU variance based on buffer size: smaller buffer = slightly higher interrupt frequency
      const bufferFactor = 64 / device.bufferSize; // 0.125 to 2
      const baseCpu = 0.18 + bufferFactor * 0.08;
      const currentCpu = Math.max(0.05, baseCpu + (Math.random() - 0.5) * 0.08);

      // DSP time consumed per cycle
      const dspTime = (currentCpu / 100) * bufferDurationMs * 8; // realistic sub-millisecond execution
      const headroomRatio = Math.max(0.85, 1 - dspTime / bufferDurationMs);
      const healthPct = Math.min(100, Math.max(92, headroomRatio * 100 + (Math.random() - 0.5) * 0.4));
      const jitter = Math.round(10 + Math.random() * 8 + bufferFactor * 3);

      setCpuUsage(currentCpu);
      setDspTimeUsedMs(dspTime);
      setBufferHealth(healthPct);
      setJitterUs(jitter);

      setHistory((prev) => {
        const next = [
          ...prev.slice(1),
          {
            cpu: currentCpu * 20, // scale visually for graph
            bufferHealth: healthPct,
            isDropout: false,
          },
        ];
        return next;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [device.bufferSize, device.sampleRate, isDriverActive, isSpiking, bufferDurationMs]);

  // Render rolling sparkline graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isMinimized) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.25);
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();

    const step = width / (history.length - 1);

    // 1. Draw Buffer Health Line (Green to Cyan gradient)
    ctx.beginPath();
    history.forEach((point, i) => {
      // Map 80-100% to canvas height (top is 100%, bottom is 80%)
      const normalized = Math.max(0, Math.min(1, (point.bufferHealth - 75) / 25));
      const y = height - normalized * (height - 8) - 4;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#34d399'; // emerald-400
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Draw CPU Load Line (Amber/Rose)
    ctx.beginPath();
    history.forEach((point, i) => {
      // Map 0-15% to canvas height
      const normalized = Math.max(0, Math.min(1, point.cpu / 15));
      const y = height - normalized * (height - 8) - 4;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f59e0b'; // amber-500
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Highlight any dropouts
    history.forEach((point, i) => {
      if (point.isDropout) {
        const x = i * step;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(x - 3, 0, 6, height);
        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    });
  }, [history, isMinimized]);

  // Simulate CPU load spike / dropout test
  const triggerSpikeSimulation = () => {
    if (isSpiking) return;
    setIsSpiking(true);
    setCpuUsage(94.2);
    setDspTimeUsedMs(bufferDurationMs * 1.35); // Exceeds deadline!
    setBufferHealth(48.5);
    setUnderruns((prev) => prev + 1);
    const now = new Date().toLocaleTimeString();
    setLastDropoutTime(now);

    setTroubleshootingMessage(
      `Buffer underrun triggered! DSP render time (${(bufferDurationMs * 1.35).toFixed(
        2
      )} ms) exceeded cycle deadline (${bufferDurationMs.toFixed(
        2
      )} ms). Audio ring buffer starved, producing a click/crackle. Fix: increase buffer size.`
    );

    // Record dropout in history
    setHistory((prev) => [
      ...prev.slice(1),
      {
        cpu: 94.2,
        bufferHealth: 48.5,
        isDropout: true,
      },
    ]);

    setTimeout(() => {
      setIsSpiking(false);
      // Gradually recover
      setCpuUsage(1.2);
      setBufferHealth(92.0);
    }, 900);
  };

  const handleResetCounters = () => {
    setUnderruns(0);
    setOverruns(0);
    setLastDropoutTime(null);
    setTroubleshootingMessage(null);
  };

  // Determine overall status
  const isHealthy = bufferHealth >= 95 && underruns === 0;
  const isWarning = bufferHealth < 95 && bufferHealth >= 80 && underruns === 0;
  const isCritical = bufferHealth < 80 || underruns > 0;

  // Next suggested buffer size for quick fix
  const getNextSafeBufferSize = (): BufferSize | null => {
    const sizes: BufferSize[] = [32, 64, 128, 256, 512, 1024];
    const currentIndex = sizes.indexOf(device.bufferSize);
    if (currentIndex >= 0 && currentIndex < sizes.length - 1) {
      return sizes[currentIndex + 1];
    }
    return null;
  };

  const nextSafeBuffer = getNextSafeBufferSize();

  // Positioning classes
  const getPositionClasses = () => {
    switch (dockPosition) {
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  return (
    <div
      className={`absolute z-30 transition-all duration-200 ${getPositionClasses()}`}
      style={{ maxWidth: 'calc(100% - 32px)' }}
    >
      {isMinimized ? (
        /* MINIMIZED PILL: Unobtrusive HUD badge */
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#141418]/95 backdrop-blur-md border border-white/10 shadow-2xl text-xs text-neutral-200 hover:border-white/20 transition-all group">
          {/* Status Glow Dot */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !isDriverActive
                  ? 'bg-neutral-500'
                  : isCritical
                  ? 'bg-red-500 animate-pulse'
                  : isWarning
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="font-mono font-bold text-[11px] text-white/90">
              {isCritical ? 'XRUN' : 'HUD'}
            </span>
          </div>

          <div className="h-3 w-[1px] bg-white/10" />

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-white/40">CPU:</span>
            <span className={cpuUsage > 10 ? 'text-amber-400 font-bold' : 'text-neutral-200'}>
              {cpuUsage.toFixed(2)}%
            </span>

            <span className="text-white/20">•</span>

            <span className="text-white/40">Health:</span>
            <span
              className={`font-bold ${
                bufferHealth >= 95
                  ? 'text-emerald-400'
                  : bufferHealth >= 80
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {bufferHealth.toFixed(1)}%
            </span>

            <span className="text-white/20">•</span>

            <span className="text-white/40">Drops:</span>
            <span className={underruns > 0 ? 'text-red-400 font-bold' : 'text-white/70'}>
              {underruns}
            </span>
          </div>

          <div className="h-3 w-[1px] bg-white/10" />

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Expand Performance Overlay"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* EXPANDED PERFORMANCE OVERLAY HUD */
        <div className="w-[380px] bg-[#121216]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E0E0] select-none animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-2.5 bg-[#17171C] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isCritical
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : isWarning
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white/90">Buffer Health & CPU</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                      !isDriverActive
                        ? 'bg-neutral-800 text-neutral-400'
                        : isCritical
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {!isDriverActive ? 'Driver Off' : isCritical ? 'Dropouts' : 'Real-time'}
                  </span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 text-white/40">
              <button
                onClick={() =>
                  setDockPosition((pos) =>
                    pos === 'bottom-right'
                      ? 'top-right'
                      : pos === 'top-right'
                      ? 'bottom-left'
                      : 'bottom-right'
                  )
                }
                className="p-1 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                title={`Change dock position (current: ${dockPosition})`}
              >
                <Move className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                title="Minimize to floating pill"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                  title="Close Overlay"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3.5 text-xs">
            {/* Sparkline Canvas Graph */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-emerald-400 rounded-full" />
                    <span className="text-emerald-400">Buffer Health %</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-amber-400 rounded-full" />
                    <span className="text-amber-400">CPU DSP %</span>
                  </span>
                </div>
                <span>Rolling 20s Window</span>
              </div>

              <div className="h-16 w-full bg-black/40 rounded-xl border border-white/5 p-1 relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={56}
                  className="w-full h-full block"
                />
              </div>
            </div>

            {/* Real-time Gauges Grid */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              {/* CPU Engine Load */}
              <div className="bg-[#17171C] p-2.5 rounded-xl border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-white/40 text-[10px] uppercase">
                  <span>Audio Thread CPU</span>
                  <Cpu className="w-3 h-3 text-amber-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-bold text-white/90">
                    {cpuUsage.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-white/40">
                    {dspTimeUsedMs.toFixed(2)} ms / {bufferDurationMs.toFixed(2)} ms
                  </span>
                </div>
                {/* Visual bar */}
                <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      cpuUsage > 70
                        ? 'bg-red-500'
                        : cpuUsage > 25
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, (dspTimeUsedMs / bufferDurationMs) * 100)}%` }}
                  />
                </div>
                <div className="text-[9px] text-white/30 flex justify-between">
                  <span>Cycle Load</span>
                  <span>{Math.round((dspTimeUsedMs / bufferDurationMs) * 100)}% of Budget</span>
                </div>
              </div>

              {/* Buffer Headroom & Health */}
              <div className="bg-[#17171C] p-2.5 rounded-xl border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-white/40 text-[10px] uppercase">
                  <span>Buffer Headroom</span>
                  <Gauge className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-base font-bold ${
                      bufferHealth >= 95
                        ? 'text-emerald-400'
                        : bufferHealth >= 80
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {bufferHealth.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-white/40">
                    ±{jitterUs} µs Jitter
                  </span>
                </div>
                {/* Visual bar */}
                <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      bufferHealth >= 95
                        ? 'bg-emerald-400'
                        : bufferHealth >= 80
                        ? 'bg-amber-400'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, bufferHealth)}%` }}
                  />
                </div>
                <div className="text-[9px] text-white/30 flex justify-between">
                  <span>Ring Buffer</span>
                  <span>{device.bufferSize} smp ({bufferDurationMs.toFixed(2)}ms)</span>
                </div>
              </div>
            </div>

            {/* XRUNs & Crackle Status */}
            <div className="bg-[#17171C] p-2.5 rounded-xl border border-white/5 flex items-center justify-between font-mono text-[11px]">
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-white/40">
                  Buffer XRUNs (Dropouts)
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold ${
                      underruns > 0 ? 'text-red-400 text-sm' : 'text-emerald-400'
                    }`}
                  >
                    {underruns} Underruns
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="text-white/60">{overruns} Overruns</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {underruns > 0 && (
                  <button
                    onClick={handleResetCounters}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] transition-colors"
                    title="Reset XRUN Counter"
                  >
                    Reset
                  </button>
                )}

                <button
                  onClick={triggerSpikeSimulation}
                  disabled={isSpiking}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 text-[10px] font-bold transition-colors flex items-center gap-1"
                  title="Simulate CPU interrupt spike to test dropout detection"
                >
                  <Zap className={`w-3 h-3 text-amber-400 ${isSpiking ? 'animate-bounce' : ''}`} />
                  <span>{isSpiking ? 'Spiking...' : 'Simulate Spike'}</span>
                </button>
              </div>
            </div>

            {/* Troubleshooting & Diagnostic Advice */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-1.5 text-white/70 font-semibold text-[11px]">
                {underruns > 0 ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>Troubleshooting Diagnosis:</span>
              </div>

              <p className="text-[11px] text-white/60 leading-relaxed">
                {troubleshootingMessage ||
                  (device.bufferSize <= 64 ? (
                    <span>
                      Ultra-low buffer ({device.bufferSize} samples / {bufferDurationMs.toFixed(2)} ms).
                      Audio processing must complete within {bufferDurationMs.toFixed(2)} ms every cycle.
                      If you hear clicks during multitasking, increase to 128 samples.
                    </span>
                  ) : device.bufferSize === 128 ? (
                    <span>
                      Balanced latency ({bufferDurationMs.toFixed(2)} ms) with robust safety margin.
                      Zero acoustic crackling expected under standard audio production workloads.
                    </span>
                  ) : (
                    <span>
                      High buffer safety margin ({device.bufferSize} samples / {bufferDurationMs.toFixed(2)} ms).
                      Immune to CPU scheduling jitter and background spikes.
                    </span>
                  ))}
              </p>

              {/* Quick Fix Button if underrun occurred or buffer is very tight */}
              {nextSafeBuffer && (underruns > 0 || device.bufferSize <= 64) && (
                <div className="pt-1 flex items-center justify-between border-t border-white/5">
                  <span className="text-[10px] text-white/40">Suggested Adjustment:</span>
                  <button
                    onClick={() => {
                      onUpdateBufferSize(nextSafeBuffer);
                      setTroubleshootingMessage(
                        `Buffer size increased to ${nextSafeBuffer} samples (${(
                          (nextSafeBuffer / device.sampleRate) *
                          1000
                        ).toFixed(2)} ms window). Headroom doubled.`
                      );
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[10px] font-bold transition-all"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Switch to {nextSafeBuffer} Samples</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Telemetry */}
          <div className="px-4 py-2 bg-[#17171C] border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-white/40">
            <span>Workgroup: 0x60 (Realtime)</span>
            <span>Shared Shm: 4096B Lockless</span>
          </div>
        </div>
      )}
    </div>
  );
};
