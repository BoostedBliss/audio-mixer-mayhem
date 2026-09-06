import React from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  Layers,
  Settings,
  Bookmark,
  Sparkles,
  Save,
} from 'lucide-react';
import { VirtualDevice, BufferSize, SampleRate } from '../../types';

interface TitleBarProps {
  devices: VirtualDevice[];
  currentDevice: VirtualDevice;
  onSelectDevice: (device: VirtualDevice) => void;
  onAddNewDevice: () => void;
  onDeleteDevice: (id: string) => void;
  activeTab: 'patchbay' | 'mixer' | 'driver';
  onChangeTab: (tab: 'patchbay' | 'mixer' | 'driver') => void;
  onOpenDriverConfig: () => void;
  isMonitorMuted: boolean;
  onToggleMonitorMute: () => void;
  monitorVolume: number;
  onChangeMonitorVolume: (db: number) => void;
  isDriverActive: boolean;
  onToggleDriverActive: () => void;
  onChangeBuffer: (buffer: BufferSize) => void;
  onChangeSampleRate: (rate: SampleRate) => void;
  activeProfileName?: string;
  onOpenProfileManager: () => void;
  onQuickSaveProfile: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  devices,
  currentDevice,
  onSelectDevice,
  onAddNewDevice,
  onDeleteDevice,
  activeTab,
  onChangeTab,
  onOpenDriverConfig,
  isMonitorMuted,
  onToggleMonitorMute,
  monitorVolume,
  onChangeMonitorVolume,
  isDriverActive,
  onToggleDriverActive,
  onChangeBuffer,
  onChangeSampleRate,
  activeProfileName = 'Streaming Setup',
  onOpenProfileManager,
  onQuickSaveProfile,
}) => {
  const latencyMs = (
    (currentDevice.bufferSize / currentDevice.sampleRate) *
    1000
  ).toFixed(2);

  const [deviceMenuOpen, setDeviceMenuOpen] = React.useState(false);

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 select-none text-neutral-200">
      {/* macOS Window Top Chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80">
        {/* Left: macOS Traffic Lights & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 group">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer shadow-inner flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-[8px] text-neutral-900 font-bold leading-none">
                ×
              </span>
            </div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] cursor-pointer shadow-inner flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-[8px] text-neutral-900 font-bold leading-none">
                −
              </span>
            </div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer shadow-inner flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-[8px] text-neutral-900 font-bold leading-none">
                +
              </span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

          {/* App Branding */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-sm text-neutral-950 font-black text-xs">
              LC
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-neutral-100">
                LoopCore
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                macOS HAL Driver v2.4
              </span>
            </div>
          </div>
        </div>

        {/* Center: Device Picker Dropdown & Profile Hub */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setDeviceMenuOpen(!deviceMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700/80 text-xs font-medium transition-all shadow-sm"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-neutral-200 font-semibold max-w-[170px] truncate">
                {currentDevice.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 font-mono">
                {currentDevice.channelCount} Ch
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {deviceMenuOpen && (
              <div
                className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setDeviceMenuOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                  Virtual Devices ({devices.length})
                </div>
                <div className="space-y-0.5 my-1">
                  {devices.map((dev) => (
                    <div
                      key={dev.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        dev.id === currentDevice.id
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'hover:bg-neutral-800 text-neutral-300'
                      }`}
                      onClick={() => {
                        onSelectDevice(dev);
                        setDeviceMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            dev.isDriverActive ? 'bg-emerald-400' : 'bg-neutral-600'
                          }`}
                        />
                        <span className="font-medium truncate">{dev.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-neutral-400">
                          {dev.channelCount}ch
                        </span>
                        {devices.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDevice(dev.id);
                            }}
                            className="p-1 hover:text-red-400 text-neutral-500 rounded"
                            title="Delete Virtual Device"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-neutral-800 pt-1 mt-1">
                  <button
                    onClick={() => {
                      onAddNewDevice();
                      setDeviceMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    New Virtual Loopback Device
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile & Routing Templates Hub */}
          <div className="flex items-center gap-1.5 bg-[#16161A] px-2.5 py-1 rounded-xl border border-white/10 shadow-inner">
            <button
              onClick={onOpenProfileManager}
              className="flex items-center gap-1.5 text-xs hover:text-white transition-colors group"
              title="Open Profiles & Preset Templates Hub"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Profile:</span>
              <span className="font-semibold text-white/90 text-xs max-w-[130px] truncate">
                {activeProfileName}
              </span>
            </button>
            <div className="h-3 w-[1px] bg-white/10 mx-0.5" />
            <button
              onClick={onQuickSaveProfile}
              className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
              title="Save current routing and volume settings to profile"
            >
              <Save className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Driver Status & Hardware Telemetry */}
        <div className="flex items-center gap-3">
          {/* Driver Active Toggle */}
          <button
            onClick={onToggleDriverActive}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all border ${
              isDriverActive
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
            title="CoreAudio HAL Kernel Plug-in status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isDriverActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
              }`}
            />
            <span>{isDriverActive ? 'HAL DRIVER ONLINE' : 'DRIVER STANDBY'}</span>
          </button>

          {/* CoreAudio Config Trigger */}
          <button
            onClick={onOpenDriverConfig}
            className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 transition-colors"
            title="DriverKit HAL Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-bar: Buffer / Latency / Tabs / Monitoring Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/90 text-xs border-b border-neutral-800">
        {/* Left: View Navigation Tabs */}
        <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
          <button
            onClick={() => onChangeTab('patchbay')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
              activeTab === 'patchbay'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Visual Routing Patchbay</span>
          </button>

          <button
            onClick={() => onChangeTab('mixer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
              activeTab === 'mixer'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Channel Mixer & Meters</span>
          </button>

          <button
            onClick={() => onChangeTab('driver')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
              activeTab === 'driver'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>HAL Engine & Specs</span>
          </button>
        </div>

        {/* Center: Zero-Latency Hardware Specs & Fast Buffer Controls */}
        <div className="flex items-center gap-3 bg-neutral-950/70 px-3 py-1 rounded-lg border border-neutral-800/80">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-mono text-neutral-400">Pass-Through Latency:</span>
            <span className="font-mono font-bold text-emerald-400">{latencyMs} ms</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase font-mono tracking-wider">
              Zero Added
            </span>
          </div>

          <div className="h-3.5 w-[1px] bg-neutral-800" />

          {/* Buffer Picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-400 font-mono">Buffer:</span>
            <select
              value={currentDevice.bufferSize}
              onChange={(e) => onChangeBuffer(Number(e.target.value) as BufferSize)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 font-mono text-[11px] rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value={32}>32 samples (0.67ms)</option>
              <option value={64}>64 samples (1.33ms)</option>
              <option value={128}>128 samples (2.67ms)</option>
              <option value={256}>256 samples (5.33ms)</option>
              <option value={512}>512 samples (10.67ms)</option>
            </select>
          </div>

          {/* Sample Rate Picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-400 font-mono">Rate:</span>
            <select
              value={currentDevice.sampleRate}
              onChange={(e) => onChangeSampleRate(Number(e.target.value) as SampleRate)}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 font-mono text-[11px] rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:border-emerald-500"
            >
              <option value={44100}>44.1 kHz (CD)</option>
              <option value={48000}>48.0 kHz (Broadcast)</option>
              <option value={88200}>88.2 kHz</option>
              <option value={96000}>96.0 kHz (Hi-Res)</option>
              <option value={192000}>192.0 kHz (Master)</option>
            </select>
          </div>
        </div>

        {/* Right: Local Audio Monitor Output (Headphone/Speaker Listen) */}
        <div className="flex items-center gap-2 bg-neutral-950/80 px-2.5 py-1 rounded-lg border border-neutral-800">
          <button
            onClick={onToggleMonitorMute}
            className={`p-1 rounded transition-colors ${
              isMonitorMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
            title={isMonitorMuted ? 'Unmute Audio Monitor' : 'Mute Audio Monitor'}
          >
            {isMonitorMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-neutral-400 font-mono">Monitor:</span>
            <input
              type="range"
              min="-36"
              max="6"
              step="0.5"
              value={isMonitorMuted ? -36 : monitorVolume}
              onChange={(e) => onChangeMonitorVolume(Number(e.target.value))}
              disabled={isMonitorMuted}
              className="w-16 h-1.5 accent-emerald-500 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] text-neutral-400 w-8 text-right">
              {isMonitorMuted ? 'MUTED' : `${monitorVolume > 0 ? '+' : ''}${monitorVolume}dB`}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
