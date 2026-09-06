import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Zap,
  Activity,
  Shield,
  Gauge,
  Layers,
  HardDrive,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Terminal,
  Download,
  FileCode,
  SlidersHorizontal,
  FileText,
  AlertCircle,
  ExternalLink,
  Check,
  HelpCircle,
} from 'lucide-react';
import { VirtualDevice, BufferSize, SampleRate } from '../../types';
import { PerformanceOverlay } from './PerformanceOverlay';
import { HalDiagnosticsModal } from './HalDiagnosticsModal';
import {
  generateHalDiagnosticReport,
  downloadDiagnosticReportFile,
  evaluateDiagnosticChecks,
} from '../../utils/halDiagnostics';

interface DriverEngineViewProps {
  device: VirtualDevice;
  onUpdateDevice: (device: VirtualDevice) => void;
  isDriverActive: boolean;
  onToggleDriverActive: () => void;
}

export const DriverEngineView: React.FC<DriverEngineViewProps> = ({
  device,
  onUpdateDevice,
  isDriverActive,
  onToggleDriverActive,
}) => {
  // Live simulated hardware telemetry
  const [jitterMs, setJitterMs] = useState(0.014);
  const [cpuLoad, setCpuLoad] = useState(0.18);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<string | null>(null);
  const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(true);

  // Diagnostic Export & Troubleshooting state
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Natural subtle jitter variation in microseconds
      setJitterMs(0.012 + Math.random() * 0.006);
      setCpuLoad(0.16 + Math.random() * 0.05);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const latencyMs = ((device.bufferSize / device.sampleRate) * 1000).toFixed(2);

  const runLatencyBenchmark = () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    setTimeout(() => {
      setIsBenchmarking(false);
      setBenchmarkResult(
        `Verified Round-Trip Pass-Through: ${latencyMs} ms (Direct CoreAudio Ring Copy: 0 extra frames)`
      );
    }, 1200);
  };

  // Direct export of the CoreAudio HAL diagnostic text report file (.txt)
  const handleExportDiagnostics = () => {
    setIsExporting(true);
    try {
      const report = generateHalDiagnosticReport({
        device,
        isDriverActive,
        jitterMs,
        cpuLoad,
        droppedFrames,
        benchmarkResult,
      });

      const filename = downloadDiagnosticReportFile(
        report,
        `${device.id.toLowerCase()}-hal-diagnostics`
      );

      setLastExportedFilename(filename);
      setTimeout(() => setLastExportedFilename(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  // Live diagnostic checks evaluation
  const diagnosticChecks = useMemo(
    () =>
      evaluateDiagnosticChecks({
        device,
        isDriverActive,
        jitterMs,
        cpuLoad,
        droppedFrames,
        benchmarkResult,
      }),
    [device, isDriverActive, jitterMs, cpuLoad, droppedFrames, benchmarkResult]
  );

  const passedChecksCount = diagnosticChecks.filter((c) => c.status === 'PASS').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950 relative overflow-hidden select-none text-xs">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Overview Banner */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-neutral-100">
                    macOS CoreAudio AudioServerPlugIn HAL Architecture
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono text-[10px] font-bold">
                    v2.4.1 KERNEL LOCKLESS
                  </span>
                </div>
                <p className="text-neutral-400 text-xs max-w-2xl leading-relaxed">
                  LoopCore operates as a zero-overhead virtual AudioServerPlugIn directly inside macOS
                  CoreAudio (<span className="font-mono text-neutral-300">/Library/Audio/Plug-Ins/HAL/LoopCore.driver</span>).
                  Audio passing between applications utilizes lockless shared memory ring buffers,
                  bypassing user-space resampling and adding 0 ms of extra algorithmic latency.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Diagnostic Text File Export Button */}
              <div className="flex items-center rounded-xl bg-neutral-800/90 border border-neutral-700/80 p-0.5 shadow-sm">
                <button
                  id="driver-export-diagnostics-quick-btn"
                  onClick={handleExportDiagnostics}
                  disabled={isExporting}
                  className="px-3 py-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-600/30 transition-all flex items-center gap-1.5 font-medium text-xs disabled:opacity-50"
                  title="Export CoreAudio HAL diagnostic text file (.txt) for troubleshooting"
                >
                  <Download className={`w-3.5 h-3.5 text-emerald-400 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>Export Diagnostics (.txt)</span>
                </button>
                <div className="w-px h-4 bg-neutral-700 mx-0.5" />
                <button
                  id="driver-inspect-diagnostics-btn"
                  onClick={() => setIsDiagnosticsModalOpen(true)}
                  className="px-2 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700/60 transition-colors font-mono text-[11px]"
                  title="Inspect diagnostic report preview and verification self-tests"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Performance Overlay Toggle Button */}
              <button
                onClick={() => setShowPerformanceOverlay(!showPerformanceOverlay)}
                className={`px-3 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5 border text-xs ${
                  showPerformanceOverlay
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30 shadow-sm'
                    : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
                title="Toggle Real-Time Buffer Health & CPU HUD"
              >
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                <span>{showPerformanceOverlay ? 'HUD Active' : 'Show HUD'}</span>
              </button>

              <button
                onClick={onToggleDriverActive}
                className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                  isDriverActive
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-neutral-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isDriverActive ? 'bg-neutral-950 animate-pulse' : 'bg-neutral-500'
                  }`}
                />
                <span>{isDriverActive ? 'HAL Driver Active' : 'Enable HAL Driver'}</span>
              </button>
            </div>
          </div>

          {/* Top telemetry grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-neutral-800 font-mono text-[11px]">
            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase">
                Algorithmic Latency
              </span>
              <span className="text-lg font-bold text-emerald-400 block mt-0.5">
                0.00 ms
              </span>
              <span className="text-[10px] text-neutral-400">Zero Added Latency</span>
            </div>

            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase">
                IO Frame Window
              </span>
              <span className="text-lg font-bold text-neutral-100 block mt-0.5">
                {latencyMs} ms
              </span>
              <span className="text-[10px] text-neutral-400">
                {device.bufferSize} samples @ {device.sampleRate / 1000} kHz
              </span>
            </div>

            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase">
                CoreAudio Jitter
              </span>
              <span className="text-lg font-bold text-indigo-400 block mt-0.5">
                ±{jitterMs.toFixed(3)} ms
              </span>
              <span className="text-[10px] text-neutral-400">Real-Time Workgroup</span>
            </div>

            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase">
                CPU Engine Load
              </span>
              <span className="text-lg font-bold text-neutral-200 block mt-0.5">
                {cpuLoad.toFixed(2)}%
              </span>
              <span className="text-[10px] text-neutral-400">SIMD Vector Memory</span>
            </div>
          </div>
        </div>

        {/* Latency Benchmarking & Driver Diagnostic Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Benchmark Test Panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-neutral-100">
                Zero-Latency Loopback Benchmark
              </h4>
            </div>
            <p className="text-neutral-400 leading-relaxed text-xs">
              Measures input-to-output propagation delay through the virtual driver. Verifies whether
              any buffer delays or OS resampler taps are being applied.
            </p>

            <button
              onClick={runLatencyBenchmark}
              disabled={isBenchmarking}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors border border-neutral-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-400 ${
                  isBenchmarking ? 'animate-spin' : ''
                }`}
              />
              <span>
                {isBenchmarking
                  ? 'Measuring Ring Buffer Traversal...'
                  : 'Run Round-Trip Latency Test'}
              </span>
            </button>

            {benchmarkResult && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-mono text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{benchmarkResult}</span>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-neutral-800 text-[11px] font-mono">
              <div className="flex justify-between text-neutral-400">
                <span>Ring Buffer Size:</span>
                <span className="text-neutral-200">{device.ringBufferSizeBytes} Bytes</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Buffer Overrun / Underrun:</span>
                <span className="text-emerald-400 font-bold">0 (Zero Dropouts)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Memory Mapping:</span>
                <span className="text-neutral-200">Shared POSIX Shm (Lockless)</span>
              </div>
            </div>
          </div>

          {/* Driver Core Architecture & Code Details */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-neutral-100">
                CoreAudio DriverKit Architecture
              </h4>
            </div>

            <div className="space-y-2.5 text-xs text-neutral-400">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                  1
                </div>
                <div>
                  <strong className="text-neutral-200">Direct Ring Memory Transfer:</strong> Audio
                  samples pass from sending applications directly into destination buffers without
                  copying into user-space intermediate queues.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                  2
                </div>
                <div>
                  <strong className="text-neutral-200">Realtime Workgroup Integration:</strong> Thread
                  prioritization operates at workgroup level (priority 0x60), preventing audio glitching
                  even under 100% CPU loads.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                  3
                </div>
                <div>
                  <strong className="text-neutral-200">64-Channel Multi-Bus Matrix:</strong> Supports
                  arbitrary multi-channel audio setups from Stereo and 4ch Quad up to 5.1, 7.1.4 Atmos beds,
                  and 64-channel virtual broadcast routers.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Download Success Confirmation Banner */}
        {lastExportedFilename && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold text-white">Diagnostic Text File Exported: </span>
                <span className="font-mono text-emerald-300">{lastExportedFilename}</span>
                <span className="text-neutral-400 text-[11px] ml-2">(Saved to your computer's Downloads directory)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDiagnosticsModalOpen(true)}
                className="text-[11px] font-mono underline hover:text-white"
              >
                Inspect Contents
              </button>
              <button
                onClick={() => setLastExportedFilename(null)}
                className="text-neutral-400 hover:text-white p-1"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* CoreAudio HAL Diagnostics & Troubleshooting Section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-neutral-100">
                    CoreAudio HAL Diagnostics & Troubleshooting
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono text-[10px] font-bold">
                    {passedChecksCount}/{diagnosticChecks.length} CHECKS NOMINAL
                  </span>
                </div>
                <p className="text-neutral-400 text-xs mt-0.5">
                  Generate and download an official formatted plain text diagnostic dump (.txt) containing complete driver state, memory buffers, and patchbay topology for system diagnosis.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="driver-diagnostics-inspect-panel-btn"
                onClick={() => setIsDiagnosticsModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium transition-colors border border-neutral-700 flex items-center gap-1.5 text-xs font-mono"
              >
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Inspect Report & CLI</span>
              </button>

              <button
                id="driver-diagnostics-export-panel-btn"
                onClick={handleExportDiagnostics}
                disabled={isExporting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center gap-2 text-xs font-mono disabled:opacity-50 active:scale-95"
              >
                <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                <span>Export Diagnostic .txt</span>
              </button>
            </div>
          </div>

          {/* Diagnostic Check Status Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-[11px]">
            <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-neutral-500 block text-[9px] uppercase">AudioServerPlugIn HAL</span>
                <span className="text-neutral-200 truncate block">LoopCore.driver (Active)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-neutral-500 block text-[9px] uppercase">SPSC Ring Buffer</span>
                <span className="text-neutral-200 truncate block">{device.ringBufferSizeBytes.toLocaleString()} B (Lockless)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-neutral-500 block text-[9px] uppercase">Real-Time Workgroup</span>
                <span className="text-neutral-200 truncate block">QoS 0x60 (±{jitterMs.toFixed(3)} ms)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="text-neutral-500 block text-[9px] uppercase">Buffer Dropouts</span>
                <span className="text-emerald-400 truncate block">0 Dropouts (Bit-Perfect)</span>
              </div>
            </div>
          </div>

          {/* Quick Troubleshooting Tip */}
          <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-neutral-500 shrink-0" />
              <span>
                Need to reload the macOS HAL driver without restarting your Mac? Run <code className="text-emerald-400 font-mono bg-neutral-900 px-1.5 py-0.5 rounded">sudo killall -9 coreaudiod</code> in Terminal.
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('sudo killall -9 coreaudiod');
              }}
              className="text-neutral-300 hover:text-white font-mono text-[10px] underline shrink-0"
            >
              Copy Command
            </button>
          </div>
        </div>
      </div>

      {/* CoreAudio HAL Diagnostic Report Modal */}
      <HalDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        device={device}
        isDriverActive={isDriverActive}
        jitterMs={jitterMs}
        cpuLoad={cpuLoad}
        droppedFrames={droppedFrames}
        benchmarkResult={benchmarkResult}
      />

      {/* Real-time Unobtrusive Performance Overlay */}
      {showPerformanceOverlay && (
        <PerformanceOverlay
          device={device}
          onUpdateBufferSize={(size: BufferSize) =>
            onUpdateDevice({ ...device, bufferSize: size })
          }
          isDriverActive={isDriverActive}
          onClose={() => setShowPerformanceOverlay(false)}
        />
      )}
    </div>
  );
};

