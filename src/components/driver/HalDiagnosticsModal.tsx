import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Terminal,
  Activity,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { VirtualDevice } from '../../types';
import {
  generateHalDiagnosticReport,
  downloadDiagnosticReportFile,
  evaluateDiagnosticChecks,
  HalDiagnosticParameters,
} from '../../utils/halDiagnostics';

interface HalDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: VirtualDevice;
  isDriverActive: boolean;
  jitterMs: number;
  cpuLoad: number;
  droppedFrames?: number;
  benchmarkResult?: string | null;
}

export const HalDiagnosticsModal: React.FC<HalDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  device,
  isDriverActive,
  jitterMs,
  cpuLoad,
  droppedFrames = 0,
  benchmarkResult,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadedFilename, setDownloadedFilename] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportTimestamp, setReportTimestamp] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'preview' | 'checks' | 'cli'>('preview');

  // Re-generate timestamp when modal opens
  useEffect(() => {
    if (isOpen) {
      setReportTimestamp(new Date());
      setDownloadedFilename(null);
    }
  }, [isOpen]);

  const diagnosticParams: HalDiagnosticParameters = useMemo(
    () => ({
      device,
      isDriverActive,
      jitterMs,
      cpuLoad,
      droppedFrames,
      benchmarkResult,
      timestamp: reportTimestamp,
    }),
    [device, isDriverActive, jitterMs, cpuLoad, droppedFrames, benchmarkResult, reportTimestamp]
  );

  const reportText = useMemo(
    () => generateHalDiagnosticReport(diagnosticParams),
    [diagnosticParams]
  );

  const checks = useMemo(
    () => evaluateDiagnosticChecks(diagnosticParams),
    [diagnosticParams]
  );

  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;

  if (!isOpen) return null;

  const handleDownload = () => {
    const filename = downloadDiagnosticReportFile(
      reportText,
      `${device.id.toLowerCase()}-hal-diagnostics`
    );
    setDownloadedFilename(filename);
    setTimeout(() => setDownloadedFilename(null), 4000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setReportTimestamp(new Date());
      setIsRefreshing(false);
    }, 400);
  };

  return (
    <div
      id="hal-diagnostics-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="hal-diagnostics-modal-container"
        className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-neutral-200 text-xs"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">
                  CoreAudio HAL Diagnostic Report
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono text-[10px] font-bold">
                  {passCount}/{checks.length} CHECKS PASSED
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Exportable diagnostic text dump for engine status, buffer timing, and CoreAudio troubleshooting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Text File Button */}
            <button
              id="hal-diagnostics-download-btn-header"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold font-mono text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
              title="Download diagnostic text file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .txt File</span>
            </button>

            {/* Close Button */}
            <button
              id="hal-diagnostics-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Summary & Navigation Strip */}
        <div className="px-6 py-2.5 bg-neutral-950 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
              Driver: <strong className={isDriverActive ? 'text-emerald-400' : 'text-amber-400'}>{isDriverActive ? 'Active' : 'Paused'}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
              Sample Rate: <strong className="text-neutral-100">{device.sampleRate} Hz</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
              Buffer: <strong className="text-neutral-100">{device.bufferSize} smp</strong> ({((device.bufferSize / device.sampleRate) * 1000).toFixed(2)} ms)
            </span>
            <span className="px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
              CPU: <strong className="text-neutral-100">{cpuLoad.toFixed(2)}%</strong>
            </span>
          </div>

          {/* View Mode Selector Tabs & Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-neutral-900 p-0.5 border border-neutral-800 text-[11px]">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Diagnostic Dump (.txt)
              </button>
              <button
                onClick={() => setActiveTab('checks')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'checks'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Verification Checks ({passCount}/{checks.length})
              </button>
              <button
                onClick={() => setActiveTab('cli')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeTab === 'cli'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                macOS Commands
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors disabled:opacity-50"
              title="Rescan current telemetry metrics"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[360px] bg-neutral-950">
          {downloadedFilename && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-600 text-emerald-300 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Diagnostic report exported to <strong className="font-mono text-white">{downloadedFilename}</strong>
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Saved to Downloads</span>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs font-bold text-neutral-300">
                    RAW TEXT REPORT PREVIEW (ASCII FORMATTED)
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    ~{(reportText.length / 1024).toFixed(1)} KB • UTF-8 Plain Text
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono text-xs transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 font-mono text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>

              {/* Monospace Code / Text Viewer */}
              <div className="relative rounded-xl border border-neutral-800 bg-[#06080d] p-4 overflow-x-auto shadow-inner">
                <pre className="font-mono text-[11px] leading-relaxed text-neutral-300 select-text whitespace-pre">
                  {reportText}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'checks' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
                <h4 className="text-sm font-bold text-neutral-100 mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>CoreAudio HAL Integrity Self-Tests</span>
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Automatic validation checks run against the virtual device architecture, shared ring buffer,
                  and real-time audio thread priority.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 font-mono">
                {checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800/80 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {chk.status === 'PASS' ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700 flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        ) : chk.status === 'WARN' ? (
                          <span className="w-5 h-5 rounded-full bg-amber-950 text-amber-400 border border-amber-700 flex items-center justify-center text-[10px] font-bold">
                            !
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-700 flex items-center justify-center text-[10px] font-bold">
                            ✕
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-100 text-xs">
                            {chk.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                            {chk.category}
                          </span>
                        </div>
                        <p className="text-neutral-400 text-[11px] mt-0.5">
                          {chk.detail}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shrink-0 ${
                        chk.status === 'PASS'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : chk.status === 'WARN'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {chk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800">
                <h4 className="text-sm font-bold text-neutral-100 mb-1 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>macOS CoreAudio CLI Troubleshooting Guide</span>
                </h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Terminal commands for inspecting driver registrations, querying live kernel workgroup logs,
                  and resetting the audio daemon if experiencing device dropouts.
                </p>
              </div>

              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5">
                  <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                    1. Force Restart CoreAudio Daemon (Reloads All HAL Plugins)
                  </span>
                  <div className="p-2.5 rounded-lg bg-[#06080d] border border-neutral-800/80 text-emerald-400 flex items-center justify-between">
                    <code>sudo killall -9 coreaudiod</code>
                    <button
                      onClick={() => navigator.clipboard.writeText('sudo killall -9 coreaudiod')}
                      className="text-neutral-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-neutral-800"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Kills the macOS audio daemon process. launchd will automatically restart it within 50ms, reloading all plugins.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5">
                  <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                    2. Stream CoreAudio System Logs
                  </span>
                  <div className="p-2.5 rounded-lg bg-[#06080d] border border-neutral-800/80 text-indigo-300 flex items-center justify-between">
                    <code>log stream --predicate 'process == "coreaudiod"' --level debug</code>
                    <button
                      onClick={() => navigator.clipboard.writeText('log stream --predicate \'process == "coreaudiod"\' --level debug')}
                      className="text-neutral-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-neutral-800"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Live tail of real-time audio threads, buffer underruns, and workgroup clock jitter.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5">
                  <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                    3. List Registered CoreAudio Audio Devices
                  </span>
                  <div className="p-2.5 rounded-lg bg-[#06080d] border border-neutral-800/80 text-amber-300 flex items-center justify-between">
                    <code>system_profiler SPAudioDataType</code>
                    <button
                      onClick={() => navigator.clipboard.writeText('system_profiler SPAudioDataType')}
                      className="text-neutral-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-neutral-800"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Queries the macOS system hardware profiler for all registered physical and virtual audio devices.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between font-mono text-[11px]">
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Format: Standard ASCII Plain Text (.txt)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download Diagnostic .txt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
