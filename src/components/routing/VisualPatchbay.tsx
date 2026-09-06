import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Sliders,
  Grid,
  Maximize2,
  Activity,
  Zap,
  Check,
  X,
  HelpCircle,
  Radio,
  Music,
  Globe,
  MessageSquare,
  Mic,
  Cpu,
  Tv,
  Sparkles,
  Bookmark,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react';
import {
  VirtualDevice,
  AudioSource,
  AudioDestination,
  AudioRoute,
} from '../../types';

// Target broadcast/streaming nominal RMS level
export const TARGET_RMS_DB = -12.0;

// Resolve base incoming nominal RMS level by source hardware or app profile
export const getSourceBaseIncomingRms = (source: AudioSource): number => {
  if (source.incomingRmsDb !== undefined) {
    return source.incomingRmsDb;
  }
  if (source.type === 'hardware_input') {
    return -24.0;
  }
  const nameLower = source.name.toLowerCase();
  const bundleLower = (source.bundleId || '').toLowerCase();
  if (nameLower.includes('discord') || bundleLower.includes('discord') || nameLower.includes('voice')) {
    return -22.5;
  }
  if (nameLower.includes('spotify') || bundleLower.includes('spotify') || nameLower.includes('music')) {
    return -17.5;
  }
  if (nameLower.includes('chrome') || nameLower.includes('safari') || bundleLower.includes('chrome')) {
    return -19.0;
  }
  if (nameLower.includes('game') || bundleLower.includes('steam')) {
    return -15.5;
  }
  return -18.0;
};

// Calculates required normalization gain offset to normalize to target -12 dB RMS
export const calculateAutoGainOffset = (
  incomingRms: number,
  targetRms: number = TARGET_RMS_DB
): number => {
  const diff = targetRms - incomingRms;
  // Bound to sensible audio gain range: -24 dB to +18 dB
  return Math.max(-24, Math.min(18, Number(diff.toFixed(1))));
};

interface VisualPatchbayProps {
  device: VirtualDevice;
  onUpdateDevice: (updated: VirtualDevice) => void;
  onOpenAddSource: () => void;
  onOpenAddDestination: () => void;
  isSignalActive: boolean;
  onOpenProfileManager?: () => void;
  onApplyPresetTemplate?: (templateId: string) => void;
  activeProfileId?: string | null;
}

export const VisualPatchbay: React.FC<VisualPatchbayProps> = ({
  device,
  onUpdateDevice,
  onOpenAddSource,
  onOpenAddDestination,
  isSignalActive,
  onOpenProfileManager,
  onApplyPresetTemplate,
  activeProfileId,
}) => {
  const [viewMode, setViewMode] = useState<'cables' | 'matrix'>('cables');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Connecting state for drag-and-drop or pin click
  const [connectingSource, setConnectingSource] = useState<{
    sourceId: string;
    channel: number;
  } | null>(null);

  // Quick route actions
  const handleToggleRouteMute = (routeId: string) => {
    const updatedRoutes = device.routes.map((r) =>
      r.id === routeId ? { ...r, isMuted: !r.isMuted } : r
    );
    onUpdateDevice({ ...device, routes: updatedRoutes });
  };

  const handleDeleteRoute = (routeId: string) => {
    const updatedRoutes = device.routes.filter((r) => r.id !== routeId);
    onUpdateDevice({ ...device, routes: updatedRoutes });
    if (selectedRouteId === routeId) setSelectedRouteId(null);
  };

  const handleUpdateRouteGain = (routeId: string, gainDb: number) => {
    const updatedRoutes = device.routes.map((r) =>
      r.id === routeId ? { ...r, gainDb } : r
    );
    onUpdateDevice({ ...device, routes: updatedRoutes });
  };

  const handleToggleRouteHpf = (routeId: string) => {
    const updatedRoutes = device.routes.map((r) =>
      r.id === routeId ? { ...r, highPassFilter: !r.highPassFilter } : r
    );
    onUpdateDevice({ ...device, routes: updatedRoutes });
  };

  const handleToggleRoutePhase = (routeId: string) => {
    const updatedRoutes = device.routes.map((r) =>
      r.id === routeId ? { ...r, isPhaseInverted: !r.isPhaseInverted } : r
    );
    onUpdateDevice({ ...device, routes: updatedRoutes });
  };

  const handleConnectPin = (destId: string, destChannel: number) => {
    if (!connectingSource) return;

    // Check if route already exists
    const existing = device.routes.find(
      (r) =>
        r.sourceId === connectingSource.sourceId &&
        r.sourceChannel === connectingSource.channel &&
        r.destinationId === destId &&
        r.destinationChannel === destChannel
    );

    if (existing) {
      // Toggle off / remove
      handleDeleteRoute(existing.id);
    } else {
      // Add new route
      const newRoute: AudioRoute = {
        id: `route-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sourceId: connectingSource.sourceId,
        sourceChannel: connectingSource.channel,
        destinationId: destId,
        destinationChannel: destChannel,
        gainDb: 0.0,
        pan: 0,
        isMuted: false,
        isSolo: false,
        isPhaseInverted: false,
        highPassFilter: false,
      };
      onUpdateDevice({ ...device, routes: [...device.routes, newRoute] });
    }

    setConnectingSource(null);
  };

  const handleDeleteSource = (sourceId: string) => {
    const updatedSources = device.sources.filter((s) => s.id !== sourceId);
    const updatedRoutes = device.routes.filter((r) => r.sourceId !== sourceId);
    onUpdateDevice({ ...device, sources: updatedSources, routes: updatedRoutes });
  };

  const handleDeleteDestination = (destId: string) => {
    const updatedDestinations = device.destinations.filter((d) => d.id !== destId);
    const updatedRoutes = device.routes.filter((r) => r.destinationId !== destId);
    onUpdateDevice({
      ...device,
      destinations: updatedDestinations,
      routes: updatedRoutes,
    });
  };

  const handleToggleSourceMute = (sourceId: string) => {
    const updatedSources = device.sources.map((s) =>
      s.id === sourceId ? { ...s, isMuted: !s.isMuted } : s
    );
    onUpdateDevice({ ...device, sources: updatedSources });
  };

  const handleToggleSourceAutoGain = (sourceId: string) => {
    const updatedSources = device.sources.map((s) => {
      if (s.id !== sourceId) return s;
      const willBeActive = !s.autoGain;
      const baseIncoming = getSourceBaseIncomingRms(s);
      const normOffset = calculateAutoGainOffset(baseIncoming, TARGET_RMS_DB);

      return {
        ...s,
        autoGain: willBeActive,
        targetRmsDb: TARGET_RMS_DB,
        incomingRmsDb: baseIncoming,
        normalizedOffsetDb: normOffset,
        // When auto-gain activates, apply normalized gain offset to reach -12dB RMS
        gainDb: willBeActive ? normOffset : s.gainDb,
      };
    });
    onUpdateDevice({ ...device, sources: updatedSources });
  };

  const handleUpdateSourceGain = (sourceId: string, gainDb: number) => {
    const updatedSources = device.sources.map((s) =>
      s.id === sourceId
        ? {
            ...s,
            gainDb,
            // If user adjusts manual fader, turn off automatic normalization override
            autoGain: false,
          }
        : s
    );
    onUpdateDevice({ ...device, sources: updatedSources });
  };

  const handleNormalizeAllSources = () => {
    const allEnabled = device.sources.every((s) => s.autoGain);
    const targetState = !allEnabled;
    const updatedSources = device.sources.map((s) => {
      const baseIncoming = getSourceBaseIncomingRms(s);
      const normOffset = calculateAutoGainOffset(baseIncoming, TARGET_RMS_DB);
      return {
        ...s,
        autoGain: targetState,
        targetRmsDb: TARGET_RMS_DB,
        incomingRmsDb: baseIncoming,
        normalizedOffsetDb: normOffset,
        gainDb: targetState ? normOffset : s.gainDb,
      };
    });
    onUpdateDevice({ ...device, sources: updatedSources });
  };

  const handleAutoRoute1to1 = () => {
    // Automatically map sources to destinations in stereo pairs
    const newRoutes: AudioRoute[] = [];
    let destIndex = 0;

    device.sources.forEach((src) => {
      const dest = device.destinations[destIndex % device.destinations.length];
      if (dest) {
        newRoutes.push({
          id: `auto-${src.id}-1-${dest.id}-1`,
          sourceId: src.id,
          sourceChannel: 1,
          destinationId: dest.id,
          destinationChannel: 1,
          gainDb: 0.0,
          pan: 0,
          isMuted: false,
          isSolo: false,
          isPhaseInverted: false,
          highPassFilter: false,
        });
        if (src.channels > 1 && dest.channels > 1) {
          newRoutes.push({
            id: `auto-${src.id}-2-${dest.id}-2`,
            sourceId: src.id,
            sourceChannel: 2,
            destinationId: dest.id,
            destinationChannel: 2,
            gainDb: 0.0,
            pan: 0,
            isMuted: false,
            isSolo: false,
            isPhaseInverted: false,
            highPassFilter: false,
          });
        }
      }
      destIndex++;
    });

    onUpdateDevice({ ...device, routes: newRoutes });
  };

  const handleClearAllCables = () => {
    onUpdateDevice({ ...device, routes: [] });
    setSelectedRouteId(null);
  };

  // Selected route object
  const activeRoute = device.routes.find((r) => r.id === selectedRouteId);
  const activeRouteSource = activeRoute
    ? device.sources.find((s) => s.id === activeRoute.sourceId)
    : null;
  const activeRouteDest = activeRoute
    ? device.destinations.find((d) => d.id === activeRoute.destinationId)
    : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950 select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-5 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
            <button
              onClick={() => setViewMode('cables')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'cables'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Patch Cables View</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'matrix'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dante Matrix Grid</span>
            </button>
          </div>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {/* Preset Audio Routing Templates Quick Switcher */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/5 gap-1">
            <span className="text-[10px] uppercase font-bold text-white/40 px-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Templates:</span>
            </span>
            <button
              onClick={() => onApplyPresetTemplate?.('template-streaming')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                activeProfileId === 'template-streaming'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Streaming Setup: Microphone & Game to OBS with monitoring"
            >
              Streaming
            </button>
            <button
              onClick={() => onApplyPresetTemplate?.('template-podcasting')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                activeProfileId === 'template-podcasting'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Podcasting Setup: Host Mic & Discord to DAW with mix-minus"
            >
              Podcasting
            </button>
            <button
              onClick={() => onApplyPresetTemplate?.('template-music-production')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                activeProfileId === 'template-music-production'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Music Production: DAW to Studio Monitors & Aux to DAW"
            >
              Music Prod
            </button>
            {onOpenProfileManager && (
              <button
                onClick={onOpenProfileManager}
                className="px-1.5 py-1 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs font-medium transition-colors"
                title="Open Profile & Template Manager"
              >
                More...
              </button>
            )}
          </div>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {/* Action shortcuts */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoRoute1to1}
              className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 text-xs font-medium transition-colors border border-neutral-700/80"
              title="Auto-route sources to destinations in stereo pairs"
            >
              Auto 1:1 Stereo Map
            </button>
            <button
              onClick={handleClearAllCables}
              className="px-2.5 py-1 rounded-md bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 text-xs transition-colors border border-neutral-800"
              title="Disconnect all virtual audio patch cables"
            >
              Unpatch All
            </button>
          </div>
        </div>

        {/* Cable connection instruction */}
        <div className="flex items-center gap-2 text-xs">
          {connectingSource ? (
            <div className="flex items-center gap-2 bg-indigo-950/80 text-indigo-300 px-3 py-1 rounded-full border border-indigo-700 animate-pulse">
              <span>
                Select a Destination Channel pin on the right to complete patch...
              </span>
              <button
                onClick={() => setConnectingSource(null)}
                className="hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-mono">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {device.routes.length} Active Virtual Routes (Zero-Latency Direct Memory Copy)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Routing Stage */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Column: Audio Sources */}
        <div className="w-84 border-r border-neutral-800/80 bg-neutral-900/30 flex flex-col min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="sticky top-0 bg-neutral-950/90 backdrop-blur py-1 z-10 space-y-2 border-b border-neutral-800/60 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  Audio Sources ({device.sources.length})
                </span>
              </div>
              <button
                onClick={onOpenAddSource}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-neutral-950 font-bold text-xs transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Source
              </button>
            </div>

            {/* Global Auto-Gain Normalizer Bar */}
            <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-mono text-neutral-300">
                  Target: <strong className="text-emerald-400">-12 dB RMS</strong>
                </span>
              </div>
              <button
                onClick={handleNormalizeAllSources}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                  device.sources.every((s) => s.autoGain)
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                }`}
                title="Toggle Auto-Gain normalization across all sources"
              >
                {device.sources.every((s) => s.autoGain) ? 'All Norm ON' : 'Norm All'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {device.sources.map((source) => {
              const baseIncoming = getSourceBaseIncomingRms(source);
              const normOffset = calculateAutoGainOffset(baseIncoming, TARGET_RMS_DB);

              return (
                <div
                  key={source.id}
                  className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/80 rounded-xl p-3 shadow-md transition-all relative overflow-hidden group"
                >
                  <div
                    className="absolute top-0 left-0 bottom-0 w-1"
                    style={{ backgroundColor: source.color }}
                  />

                  <div className="flex items-start justify-between gap-2 pl-2">
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-inner"
                        style={{ backgroundColor: `${source.color}33`, color: source.color }}
                      >
                        {source.type === 'hardware_input' ? (
                          <Mic className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-neutral-100 text-xs truncate">
                          {source.name}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400 truncate">
                          {source.bundleId || 'CoreAudio Hardware In'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleSourceMute(source.id)}
                        className={`p-1 rounded text-xs transition-colors ${
                          source.isMuted
                            ? 'bg-red-500/20 text-red-400'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title={source.isMuted ? 'Unmute Source' : 'Mute Source'}
                      >
                        {source.isMuted ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {device.sources.length > 1 && (
                        <button
                          onClick={() => handleDeleteSource(source.id)}
                          className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
                          title="Delete Source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Auto-Gain Normalization (-12dB RMS) & Level Controls */}
                  <div className="mt-2.5 pt-2.5 border-t border-neutral-800/80 pl-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                          Auto-Gain
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                            source.autoGain
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                              : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/50'
                          }`}
                          title="Normalizes incoming level to nominal -12dB RMS"
                        >
                          -12dB RMS
                        </span>
                      </div>

                      {/* Auto-Gain Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!source.autoGain}
                        onClick={() => handleToggleSourceAutoGain(source.id)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          source.autoGain ? 'bg-emerald-500' : 'bg-neutral-700 hover:bg-neutral-600'
                        }`}
                        title={
                          source.autoGain
                            ? 'Auto-Gain ON: Normalizing to -12dB RMS'
                            : 'Enable Auto-Gain: Normalize to -12dB RMS'
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            source.autoGain ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Dynamic Auto-Gain Status or Manual Trim Slider */}
                    {source.autoGain ? (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[10px] font-mono">
                        <div className="flex items-center justify-between text-neutral-300">
                          <span className="text-neutral-400">Raw In:</span>
                          <span className="text-neutral-300">{baseIncoming.toFixed(1)} dBFS</span>
                          <span className="text-neutral-500">➔</span>
                          <span className="text-emerald-400 font-bold">-12.0 dB RMS</span>
                        </div>

                        {/* Visual RMS meter bar showing alignment with -12dB target line */}
                        <div className="mt-1.5 relative h-2 bg-neutral-950 rounded overflow-hidden border border-neutral-800">
                          {/* Target -12dB marker line at 65% scale */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                            style={{ left: '65%' }}
                            title="Nominal -12dB RMS Target Alignment"
                          />
                          {/* Normalized bar filling to the target marker */}
                          <div
                            className={`h-full transition-all duration-300 ${
                              isSignalActive && !source.isMuted
                                ? 'bg-gradient-to-r from-teal-500 via-emerald-400 to-emerald-300'
                                : 'bg-emerald-600/70'
                            }`}
                            style={{ width: '65%' }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[9px] text-neutral-400">
                          <span className="text-emerald-400/90 flex items-center gap-1 font-semibold">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Normalized</span>
                          </span>
                          <span className="text-neutral-300 font-mono">
                            Offset: {normOffset >= 0 ? `+${normOffset.toFixed(1)}` : normOffset.toFixed(1)} dB
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Manual Trim when Auto-Gain is OFF */
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-neutral-400">Gain Trim:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-200 font-semibold">
                              {source.gainDb > 0 ? '+' : ''}
                              {source.gainDb.toFixed(1)} dB
                            </span>
                            {source.gainDb !== 0 && (
                              <button
                                onClick={() => handleUpdateSourceGain(source.id, 0)}
                                className="text-[9px] text-neutral-500 hover:text-neutral-300 underline"
                                title="Reset trim to 0dB"
                              >
                                0dB
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="-24"
                            max="12"
                            step="0.5"
                            value={source.gainDb}
                            onChange={(e) =>
                              handleUpdateSourceGain(source.id, parseFloat(e.target.value))
                            }
                            className="flex-1 h-1.5 accent-indigo-500 bg-neutral-950 rounded cursor-pointer"
                          />
                          <button
                            onClick={() => handleToggleSourceAutoGain(source.id)}
                            className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[9px] font-mono transition-colors border border-neutral-700/60"
                            title="Click to automatically normalize incoming level to -12dB RMS"
                          >
                            Norm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Output Pins */}
                  <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between pl-2">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Output Pins:
                  </span>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: source.channels }, (_, i) => i + 1).map(
                      (chNum) => {
                        const isPinConnecting =
                          connectingSource?.sourceId === source.id &&
                          connectingSource?.channel === chNum;
                        const hasRoutes = device.routes.some(
                          (r) => r.sourceId === source.id && r.sourceChannel === chNum
                        );

                        return (
                          <button
                            key={chNum}
                            onClick={() =>
                              setConnectingSource(
                                isPinConnecting ? null : { sourceId: source.id, channel: chNum }
                              )
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-all border ${
                              isPinConnecting
                                ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400 animate-pulse'
                                : hasRoutes
                                ? 'bg-neutral-800 text-neutral-200 border-neutral-600 hover:border-indigo-400'
                                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                            }`}
                            title={`Patch from ${source.name} Ch ${chNum}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSignalActive && hasRoutes && !source.isMuted
                                  ? 'bg-emerald-400 animate-ping'
                                  : 'bg-neutral-500'
                              }`}
                            />
                            <span>Ch {chNum === 1 ? 'L' : chNum === 2 ? 'R' : chNum}</span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Center Canvas: Visual Cables OR Cross-Point Matrix */}
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950/60 p-4 overflow-y-auto">
          {viewMode === 'cables' ? (
            <div className="flex-1 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  Virtual Routing Cable Patchbay
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Click a route to inspect & adjust trim fader
                </span>
              </div>

              {device.routes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-neutral-800/80 rounded-2xl bg-neutral-900/20">
                  <Zap className="w-10 h-10 text-neutral-600 mb-2" />
                  <h4 className="text-sm font-semibold text-neutral-300">
                    No Virtual Cables Patched
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mt-1">
                    Connect an audio source channel on the left to an output destination on
                    the right, or click below for an automated setup.
                  </p>
                  <button
                    onClick={handleAutoRoute1to1}
                    className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs transition-colors shadow-sm"
                  >
                    Auto 1:1 Stereo Map
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {device.routes.map((route) => {
                    const src = device.sources.find((s) => s.id === route.sourceId);
                    const dest = device.destinations.find((d) => d.id === route.destinationId);
                    const isSelected = selectedRouteId === route.id;

                    if (!src || !dest) return null;

                    return (
                      <div
                        key={route.id}
                        onClick={() => setSelectedRouteId(isSelected ? null : route.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? 'bg-neutral-900 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg'
                            : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {/* Audio Pulse Line */}
                        <div
                          className={`absolute top-0 left-0 right-0 h-0.5 ${
                            isSignalActive && !route.isMuted && !src.isMuted
                              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 animate-pulse'
                              : 'bg-neutral-800'
                          }`}
                        />

                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: src.color }}
                            />
                            <span className="text-xs font-semibold text-neutral-200">
                              {src.name} (Ch {route.sourceChannel === 1 ? 'L' : route.sourceChannel === 2 ? 'R' : route.sourceChannel})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">➔</span>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: dest.color }}
                            />
                            <span className="text-xs font-semibold text-neutral-200">
                              {dest.name} (Ch {route.destinationChannel})
                            </span>
                          </div>
                        </div>

                        {/* Inline Controls */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-800/80">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRouteMute(route.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                route.isMuted
                                  ? 'bg-red-500/20 text-red-400 font-bold'
                                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                              }`}
                            >
                              {route.isMuted ? 'MUTED' : 'ACTIVE'}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRouteHpf(route.id);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                route.highPassFilter
                                  ? 'bg-indigo-500/30 text-indigo-300 font-bold'
                                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                              }`}
                              title="80Hz High Pass Filter"
                            >
                              HPF 80Hz
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRoutePhase(route.id);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                route.isPhaseInverted
                                  ? 'bg-amber-500/30 text-amber-300 font-bold'
                                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                              }`}
                              title="Phase Inversion"
                            >
                              Ø Phase
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-neutral-400">
                              Trim:
                            </span>
                            <input
                              type="range"
                              min="-24"
                              max="6"
                              step="0.5"
                              value={route.gainDb}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleUpdateRouteGain(route.id, Number(e.target.value))
                              }
                              className="w-14 h-1 accent-indigo-500 bg-neutral-800 rounded-lg cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-neutral-300 w-8 text-right">
                              {route.gainDb > 0 ? '+' : ''}
                              {route.gainDb}dB
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRoute(route.id);
                              }}
                              className="p-1 text-neutral-500 hover:text-red-400 transition-colors ml-1"
                              title="Delete Cable"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Matrix View: Dante / Broadcast Style Cross-Point Grid */
            <div className="flex-1 flex flex-col min-h-0 overflow-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  CoreAudio Crosspoint Matrix (Dante / Evertz Grid)
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Rows = Sources • Columns = Destination Channels
                </span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto shadow-xl">
                <table className="w-full border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-neutral-950 border-b border-neutral-800">
                      <th className="p-2.5 text-left text-neutral-400 font-medium">
                        Source Channels
                      </th>
                      {device.destinations.map((dest) =>
                        Array.from({ length: dest.channels }, (_, i) => i + 1).map((chNum) => (
                          <th
                            key={`${dest.id}-${chNum}`}
                            className="p-2 text-center text-neutral-300 font-medium border-l border-neutral-800/80 min-w-[70px]"
                          >
                            <div className="truncate max-w-[70px] text-[10px] text-neutral-400">
                              {dest.name}
                            </div>
                            <div className="text-neutral-100 font-bold">Ch {chNum}</div>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {device.sources.map((source) =>
                      Array.from({ length: source.channels }, (_, chIdx) => chIdx + 1).map(
                        (srcCh) => (
                          <tr
                            key={`${source.id}-${srcCh}`}
                            className="border-b border-neutral-800/60 hover:bg-neutral-800/40 transition-colors"
                          >
                            <td className="p-2.5 text-neutral-200">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: source.color }}
                                  />
                                  <span className="font-semibold">{source.name}</span>
                                  <span className="text-neutral-400 text-[11px]">
                                    Ch {srcCh === 1 ? 'L' : srcCh === 2 ? 'R' : srcCh}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleToggleSourceAutoGain(source.id)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                                    source.autoGain
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                                      : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300'
                                  }`}
                                  title={
                                    source.autoGain
                                      ? 'Auto-Gain active (-12dB RMS nominal)'
                                      : 'Click to enable Auto-Gain (-12dB RMS)'
                                  }
                                >
                                  {source.autoGain ? 'Auto -12dB' : 'Manual'}
                                </button>
                              </div>
                            </td>

                            {device.destinations.map((dest) =>
                              Array.from({ length: dest.channels }, (_, destChIdx) => destChIdx + 1).map(
                                (destCh) => {
                                  const route = device.routes.find(
                                    (r) =>
                                      r.sourceId === source.id &&
                                      r.sourceChannel === srcCh &&
                                      r.destinationId === dest.id &&
                                      r.destinationChannel === destCh
                                  );
                                  const isConnected = !!route;

                                  return (
                                    <td
                                      key={`${dest.id}-${destCh}`}
                                      className="p-2 text-center border-l border-neutral-800/80"
                                    >
                                      <button
                                        onClick={() => {
                                          if (route) {
                                            handleDeleteRoute(route.id);
                                          } else {
                                            const newRoute: AudioRoute = {
                                              id: `route-${Date.now()}-${Math.random()
                                                .toString(36)
                                                .substr(2, 4)}`,
                                              sourceId: source.id,
                                              sourceChannel: srcCh,
                                              destinationId: dest.id,
                                              destinationChannel: destCh,
                                              gainDb: 0.0,
                                              pan: 0,
                                              isMuted: false,
                                              isSolo: false,
                                              isPhaseInverted: false,
                                              highPassFilter: false,
                                            };
                                            onUpdateDevice({
                                              ...device,
                                              routes: [...device.routes, newRoute],
                                            });
                                          }
                                        }}
                                        className={`w-7 h-7 rounded-lg font-bold text-xs transition-all border flex items-center justify-center mx-auto ${
                                          isConnected
                                            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                                            : 'bg-neutral-950/80 hover:bg-neutral-800 text-neutral-500 border-neutral-800 hover:border-neutral-700'
                                        }`}
                                        title={
                                          isConnected
                                            ? `Disconnect ${source.name} -> ${dest.name} Ch ${destCh}`
                                            : `Connect ${source.name} -> ${dest.name} Ch ${destCh}`
                                        }
                                      >
                                        {isConnected ? (
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        ) : (
                                          '·'
                                        )}
                                      </button>
                                    </td>
                                  );
                                }
                              )
                            )}
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Audio Destinations */}
        <div className="w-80 border-l border-neutral-800/80 bg-neutral-900/30 flex flex-col min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between sticky top-0 bg-neutral-950/90 backdrop-blur py-1 z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                Destinations ({device.destinations.length})
              </span>
            </div>
            <button
              onClick={onOpenAddDestination}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Output
            </button>
          </div>

          <div className="space-y-3">
            {device.destinations.map((dest) => (
              <div
                key={dest.id}
                className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700/80 rounded-xl p-3 shadow-md transition-all relative overflow-hidden group"
              >
                <div
                  className="absolute top-0 right-0 bottom-0 w-1"
                  style={{ backgroundColor: dest.color }}
                />

                <div className="flex items-start justify-between gap-2 pr-2">
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-inner"
                      style={{ backgroundColor: `${dest.color}33`, color: dest.color }}
                    >
                      {dest.isMonitor ? (
                        <Radio className="w-4 h-4" />
                      ) : (
                        <Tv className="w-4 h-4" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-neutral-100 text-xs truncate">
                        {dest.name}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 truncate">
                        {dest.type.replace('_', ' ').toUpperCase()} • {dest.channels} Ch
                      </div>
                    </div>
                  </div>

                  {device.destinations.length > 1 && (
                    <button
                      onClick={() => handleDeleteDestination(dest.id)}
                      className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
                      title="Delete Destination"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Input Pins */}
                <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between pr-2">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Input Channels:
                  </span>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: dest.channels }, (_, i) => i + 1).map((chNum) => {
                      const incomingRoutes = device.routes.filter(
                        (r) => r.destinationId === dest.id && r.destinationChannel === chNum
                      );
                      const hasIncoming = incomingRoutes.length > 0;

                      return (
                        <button
                          key={chNum}
                          onClick={() => handleConnectPin(dest.id, chNum)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-all border ${
                            connectingSource
                              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500 hover:bg-indigo-600 hover:text-white cursor-pointer ring-1 ring-indigo-400'
                              : hasIncoming
                              ? 'bg-neutral-800 text-neutral-200 border-neutral-600'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                          }`}
                          title={`Patch into ${dest.name} Channel ${chNum}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSignalActive && hasIncoming
                                ? 'bg-emerald-400 animate-ping'
                                : 'bg-neutral-500'
                            }`}
                          />
                          <span>Ch {chNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
