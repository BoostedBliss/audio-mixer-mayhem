import React, { useState } from 'react';
import {
  X,
  Cpu,
  Zap,
  Activity,
  Download,
  Copy,
  Check,
  Terminal,
  Shield,
  Layers,
  HardDrive,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { VirtualDevice, BufferSize, SampleRate } from '../../types';

interface DriverConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: VirtualDevice;
  onUpdateDevice: (device: VirtualDevice) => void;
}

export const DriverConfigModal: React.FC<DriverConfigModalProps> = ({
  isOpen,
  onClose,
  device,
  onUpdateDevice,
}) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedPlist, setCopiedPlist] = useState(false);

  if (!isOpen) return null;

  const latencyMs = ((device.bufferSize / device.sampleRate) * 1000).toFixed(2);

  const sampleRates: SampleRate[] = [44100, 48000, 88200, 96000, 192000];
  const bufferSizes: BufferSize[] = [32, 64, 128, 256, 512];

  const handleToggleZeroLatency = () => {
    onUpdateDevice({
      ...device,
      zeroLatencyPassthrough: !device.zeroLatencyPassthrough,
    });
  };

  const handleSetClockMaster = (
    clock: 'Internal CoreAudio' | 'Host Device Lock' | 'Drift Corrected SPSC'
  ) => {
    onUpdateDevice({ ...device, clockMaster: clock });
  };

  const driverInstallShellScript = `# LoopCore macOS AudioServerPlugIn HAL Driver
# Install into macOS CoreAudio HAL directory:
sudo mkdir -p /Library/Audio/Plug-Ins/HAL
sudo cp -R ./LoopCore.driver /Library/Audio/Plug-Ins/HAL/
sudo chown -R root:wheel /Library/Audio/Plug-Ins/HAL/LoopCore.driver
sudo chmod -R 755 /Library/Audio/Plug-Ins/HAL/LoopCore.driver

# Restart CoreAudio Daemon to reload virtual HAL driver:
sudo killall -9 coreaudiod

echo "LoopCore HAL Driver v2.4 successfully loaded with ${device.channelCount} virtual channels!"`;

  const infoPlistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>${device.uid}</string>
    <key>CFBundleName</key>
    <string>${device.name}</string>
    <key>CFBundlePackageType</key>
    <string>BNDL</string>
    <key>AudioServerPlugIn_FactoryFunction</key>
    <string>LoopCoreAudioServerPlugInFactory</string>
    <key>LoopCore_SampleRate</key>
    <integer>${device.sampleRate}</integer>
    <key>LoopCore_BufferSize</key>
    <integer>${device.bufferSize}</integer>
    <key>LoopCore_ChannelCount</key>
    <integer>${device.channelCount}</integer>
    <key>LoopCore_LocklessRingBuffer</key>
    <true/>
</dict>
</plist>`;

  const handleCopy = (text: string, type: 'script' | 'plist') => {
    navigator.clipboard.writeText(text);
    if (type === 'script') {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedPlist(true);
      setTimeout(() => setCopiedPlist(false), 2000);
    }
  };

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(device, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${device.id}-loopcore-config.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">
                CoreAudio HAL Driver Engine Configuration
              </h3>
              <p className="text-xs text-neutral-400">
                Lockless ring buffer, latency optimization, and DriverKit bundle export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Zero-Latency Pass-Through Engine Card */}
          <div className="bg-neutral-950/80 border border-emerald-500/40 rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-neutral-100 text-sm">
                    Zero-Latency Direct Ring Buffer (SPSC)
                  </span>
                </div>
                <p className="text-neutral-400 text-xs">
                  Passes audio directly via lockless single-producer single-consumer shared
                  memory. Eliminates kernel-space context switching and adds zero additional latency.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={device.zeroLatencyPassthrough}
                  onChange={handleToggleZeroLatency}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-neutral-800/80 font-mono text-[11px]">
              <div>
                <span className="text-neutral-500 block">IO Frame Latency:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {latencyMs} ms
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Thread Priority:</span>
                <span className="text-neutral-200 font-bold">
                  Workgroup RT (0x60)
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Memory Paging:</span>
                <span className="text-neutral-200 font-bold">mlock() Wired</span>
              </div>
            </div>
          </div>

          {/* Buffer & Sample Rate Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
              <label className="block text-[11px] font-mono text-neutral-400 uppercase">
                Hardware Buffer Size:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {bufferSizes.map((buf) => (
                  <button
                    key={buf}
                    onClick={() => onUpdateDevice({ ...device, bufferSize: buf })}
                    className={`p-2 rounded-lg font-mono text-center transition-all border ${
                      device.bufferSize === buf
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div>{buf}</div>
                    <div className="text-[9px] text-neutral-500">
                      {((buf / device.sampleRate) * 1000).toFixed(2)}ms
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
              <label className="block text-[11px] font-mono text-neutral-400 uppercase">
                Sample Rate (CoreAudio Clock):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {sampleRates.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => onUpdateDevice({ ...device, sampleRate: rate })}
                    className={`p-2 rounded-lg font-mono text-center transition-all border ${
                      device.sampleRate === rate
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div>{(rate / 1000).toFixed(1)} kHz</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clock Master & Drift Compensation */}
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <label className="block text-[11px] font-mono text-neutral-400 uppercase">
              Clock Synchronization & Drift Compensation:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'Internal CoreAudio' as const,
                  title: 'Internal CoreAudio',
                  desc: 'High precision host clock',
                },
                {
                  id: 'Host Device Lock' as const,
                  title: 'Device Lock',
                  desc: 'Locks to primary audio interface',
                },
                {
                  id: 'Drift Corrected SPSC' as const,
                  title: 'SPSC Drift Sync',
                  desc: 'Adaptive micro-resampling (0 jitter)',
                },
              ].map((clock) => (
                <button
                  key={clock.id}
                  onClick={() => handleSetClockMaster(clock.id)}
                  className={`p-2.5 rounded-lg text-left transition-all border ${
                    device.clockMaster === clock.id
                      ? 'bg-neutral-800 border-indigo-500 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850'
                  }`}
                >
                  <div className="font-semibold text-xs text-neutral-200">
                    {clock.title}
                  </div>
                  <div className="text-[10px] text-neutral-500">{clock.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* CoreAudio Install Shell Script */}
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-mono text-[11px] text-neutral-300">
                  macOS HAL Plug-In Install Command
                </span>
              </div>
              <button
                onClick={() => handleCopy(driverInstallShellScript, 'script')}
                className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300"
              >
                {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedScript ? 'Copied' : 'Copy Bash'}</span>
              </button>
            </div>
            <pre className="p-3 bg-neutral-900 rounded-lg text-[10px] font-mono text-neutral-400 overflow-x-auto leading-relaxed border border-neutral-800/80">
              {driverInstallShellScript}
            </pre>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-neutral-500 font-mono text-[11px]">
              UID: {device.uid}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(infoPlistXml, 'plist')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors border border-neutral-700"
              >
                {copiedPlist ? <Check className="w-3.5 h-3.5" /> : <FileCode className="w-3.5 h-3.5" />}
                <span>{copiedPlist ? 'Plist Copied' : 'Copy Info.plist'}</span>
              </button>

              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Device Preset (.json)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
