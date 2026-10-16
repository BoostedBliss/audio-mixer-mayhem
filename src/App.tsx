import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TitleBar } from './components/macOSWindow/TitleBar';
import { AudioTestBar } from './components/generator/AudioTestBar';
import { VisualPatchbay } from './components/routing/VisualPatchbay';
import { MixerConsole } from './components/mixer/MixerConsole';
import { DriverEngineView } from './components/driver/DriverEngineView';
import { DriverConfigModal } from './components/driver/DriverConfigModal';
import { AddSourceModal } from './components/routing/AddSourceModal';
import { AddDestinationModal } from './components/routing/AddDestinationModal';
import { INITIAL_DEVICES, createDefaultChannels } from './data/defaultDevices';
import {
  VirtualDevice,
  VirtualChannelStrip,
  BufferSize,
  SampleRate,
  SignalSourceMode,
  AudioSource,
  AudioDestination,
} from './types';
import { audioEngine, MeterData } from './services/audioEngine';
import { ProfileManagerModal } from './components/profiles/ProfileManagerModal';
import { RoutingProfile } from './types';
import {
  PRESET_ROUTING_TEMPLATES,
  loadUserProfiles,
  saveUserProfiles,
  getActiveProfileId,
  setActiveProfileId,
  applyProfileToDevice,
} from './data/routingTemplates';

export default function App() {
  const [devices, setDevices] = useState<VirtualDevice[]>(INITIAL_DEVICES);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(INITIAL_DEVICES[0].id);
  const [activeTab, setActiveTab] = useState<'patchbay' | 'mixer' | 'driver'>('patchbay');

  // Modals
  const [isDriverConfigOpen, setIsDriverConfigOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // User Profiles & Routing Presets
  const [savedProfiles, setSavedProfiles] = useState<RoutingProfile[]>(() => loadUserProfiles());
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    () => getActiveProfileId() || 'template-streaming'
  );

  // Audio stream state
  const [signalMode, setSignalMode] = useState<SignalSourceMode>('off');
  const [isDriverActive, setIsDriverActive] = useState(true);

  // Master Meter State
  const [masterPeakL, setMasterPeakL] = useState(-60);
  const [masterPeakR, setMasterPeakR] = useState(-60);
  const [masterRmsL, setMasterRmsL] = useState(-60);
  const [masterRmsR, setMasterRmsR] = useState(-60);
  const [masterClip, setMasterClip] = useState(false);

  // Current selected device
  const currentDevice = devices.find((d) => d.id === currentDeviceId) || devices[0];

  // Ref to hold current channels without triggering effect recreation loops
  const channelsRef = useRef(currentDevice.channels);
  channelsRef.current = currentDevice.channels;

  // Initialize Web Audio engine channels when current device or channel count changes
  useEffect(() => {
    audioEngine.ensureContext().then(() => {
      audioEngine.initChannels(currentDevice.channelCount);
      const isAnySolo = currentDevice.channels.some((c) => c.isSolo);
      audioEngine.updateChannelParameters(currentDevice.channels, isAnySolo);
      audioEngine.updateMasterVolume(currentDevice.masterVolumeDb, currentDevice.masterMuted);
      audioEngine.setMonitorOutput(!currentDevice.monitorMuted, currentDevice.monitorVolumeDb);
    });
  }, [currentDevice.id, currentDevice.channelCount]);

  // Update audio engine when channel parameters change
  useEffect(() => {
    const isAnySolo = currentDevice.channels.some((c) => c.isSolo);
    audioEngine.updateChannelParameters(currentDevice.channels, isAnySolo);
  }, [
    currentDevice.channels.map((c) => `${c.channelNumber}:${c.faderDb}:${c.pan}:${c.isMuted}:${c.isSolo}:${c.isPhaseInverted}:${c.isHpfActive}`).join('|'),
  ]);

  // Update master volume
  useEffect(() => {
    audioEngine.updateMasterVolume(currentDevice.masterVolumeDb, currentDevice.masterMuted);
  }, [currentDevice.masterVolumeDb, currentDevice.masterMuted]);

  // Update monitor volume
  useEffect(() => {
    audioEngine.setMonitorOutput(!currentDevice.monitorMuted, currentDevice.monitorVolumeDb);
  }, [currentDevice.monitorMuted, currentDevice.monitorVolumeDb]);

  // Subscribe to real-time 60fps VU meters
  useEffect(() => {
    const unsubscribe = audioEngine.subscribeMeters((channelMeters, masterMeter) => {
      // Update master meter
      setMasterPeakL(masterMeter.peakL);
      setMasterPeakR(masterMeter.peakR);
      setMasterRmsL(masterMeter.rmsL);
      setMasterRmsR(masterMeter.rmsR);
      if (masterMeter.isClipping) {
        setMasterClip(true);
      }

      // Update channel meters smoothly
      setDevices((prevDevices) =>
        prevDevices.map((dev) => {
          if (dev.id !== currentDeviceId) return dev;

          let hasChanges = false;
          const newChannels = dev.channels.map((ch) => {
            const meter = channelMeters.get(ch.channelNumber);
            if (!meter) return ch;

            // Decay peak hold
            const newPeakHoldL = Math.max(meter.peakL, ch.peakHoldL - 0.5);
            const newPeakHoldR = Math.max(meter.peakR, ch.peakHoldR - 0.5);
            const isClipping = ch.isClipping || meter.isClipping;

            if (
              Math.abs(ch.peakDbL - meter.peakL) > 0.5 ||
              Math.abs(ch.peakDbR - meter.peakR) > 0.5 ||
              isClipping !== ch.isClipping
            ) {
              hasChanges = true;
              return {
                ...ch,
                peakDbL: meter.peakL,
                peakDbR: meter.peakR,
                rmsDbL: meter.rmsL,
                rmsDbR: meter.rmsR,
                peakHoldL: newPeakHoldL,
                peakHoldR: newPeakHoldR,
                isClipping,
              };
            }
            return ch;
          });

          return hasChanges ? { ...dev, channels: newChannels } : dev;
        })
      );
    });

    return () => {
      unsubscribe();
    };
  }, [currentDeviceId]);

  // Handle Signal source toggle
  const handleSelectSignalMode = async (mode: SignalSourceMode) => {
    setSignalMode(mode);
    await audioEngine.setSignalSource(mode);
  };

  // Device update helper
  const handleUpdateCurrentDevice = useCallback((updated: VirtualDevice) => {
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const handleAddNewDevice = () => {
    const newId = `dev-${Date.now()}`;
    const newDev: VirtualDevice = {
      id: newId,
      name: `LoopCore Virtual Device ${devices.length + 1}`,
      icon: 'Radio',
      uid: `com.loopcore.audio.hal.vdevice.${Date.now()}`,
      sampleRate: 48000,
      bufferSize: 64,
      channelCount: 4,
      clockMaster: 'Internal CoreAudio',
      isDriverActive: true,
      zeroLatencyPassthrough: true,
      ringBufferSizeBytes: 16384,
      sources: [
        {
          id: `src-${Date.now()}-1`,
          name: 'App Audio Feed',
          type: 'application',
          icon: 'Music',
          channels: 2,
          isActive: true,
          gainDb: 0.0,
          isMuted: false,
          color: '#10b981',
        },
      ],
      destinations: [
        {
          id: `dest-${Date.now()}-1`,
          name: 'Virtual Output (Ch 1-2)',
          type: 'virtual_output',
          channels: 2,
          isMonitor: false,
          color: '#8b5cf6',
        },
      ],
      routes: [
        {
          id: `r-${Date.now()}-1`,
          sourceId: `src-${Date.now()}-1`,
          sourceChannel: 1,
          destinationId: `dest-${Date.now()}-1`,
          destinationChannel: 1,
          gainDb: 0.0,
          pan: 0,
          isMuted: false,
          isSolo: false,
          isPhaseInverted: false,
          highPassFilter: false,
        },
        {
          id: `r-${Date.now()}-2`,
          sourceId: `src-${Date.now()}-1`,
          sourceChannel: 2,
          destinationId: `dest-${Date.now()}-1`,
          destinationChannel: 2,
          gainDb: 0.0,
          pan: 0,
          isMuted: false,
          isSolo: false,
          isPhaseInverted: false,
          highPassFilter: false,
        },
      ],
      channels: createDefaultChannels(4),
      masterVolumeDb: 0.0,
      masterMuted: false,
      monitorVolumeDb: -3.0,
      monitorMuted: false,
    };

    setDevices((prev) => [...prev, newDev]);
    setCurrentDeviceId(newId);
  };

  const handleDeleteDevice = (id: string) => {
    if (devices.length <= 1) return;
    const remaining = devices.filter((d) => d.id !== id);
    setDevices(remaining);
    if (currentDeviceId === id) {
      setCurrentDeviceId(remaining[0].id);
    }
  };

  // Profile and Preset Template Handlers
  const handleApplyProfile = (profile: RoutingProfile) => {
    const updated = applyProfileToDevice(currentDevice, profile);
    handleUpdateCurrentDevice(updated);
    setActiveProfileIdState(profile.id);
    setActiveProfileId(profile.id);
  };

  const handleSaveNewProfile = (newProfile: RoutingProfile) => {
    setSavedProfiles((prev) => {
      const updated = [newProfile, ...prev.filter((p) => p.id !== newProfile.id)];
      saveUserProfiles(updated);
      return updated;
    });
    setActiveProfileIdState(newProfile.id);
    setActiveProfileId(newProfile.id);
  };

  const handleUpdateExistingProfile = (updatedProfile: RoutingProfile) => {
    setSavedProfiles((prev) => {
      const updated = prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p));
      saveUserProfiles(updated);
      return updated;
    });
  };

  const handleDeleteProfile = (id: string) => {
    setSavedProfiles((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      saveUserProfiles(updated);
      return updated;
    });
    if (activeProfileId === id) {
      setActiveProfileIdState(null);
      setActiveProfileId(null);
    }
  };

  const handleImportProfiles = (imported: RoutingProfile[]) => {
    setSavedProfiles((prev) => {
      const combined = [...imported, ...prev];
      saveUserProfiles(combined);
      return combined;
    });
  };

  const handleApplyPresetTemplateById = (templateId: string) => {
    const t = PRESET_ROUTING_TEMPLATES.find((tmpl) => tmpl.id === templateId);
    if (t) {
      handleApplyProfile(t);
    }
  };

  const activeProfile =
    PRESET_ROUTING_TEMPLATES.find((t) => t.id === activeProfileId) ||
    savedProfiles.find((p) => p.id === activeProfileId);
  const activeProfileName = activeProfile ? activeProfile.name : 'Custom Setup';

  // Keyboard shortcut for quick testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleSelectSignalMode(signalMode === 'off' ? 'chords' : 'off');
      } else if (e.key === '1') {
        setActiveTab('patchbay');
      } else if (e.key === '2') {
        setActiveTab('mixer');
      } else if (e.key === '3') {
        setActiveTab('driver');
      } else if (e.key === 'm' || e.key === 'M') {
        handleUpdateCurrentDevice({
          ...currentDevice,
          monitorMuted: !currentDevice.monitorMuted,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [signalMode, currentDevice, handleUpdateCurrentDevice]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      {/* macOS Top Window Chrome & Toolbar */}
      <TitleBar
        devices={devices}
        currentDevice={currentDevice}
        onSelectDevice={(dev) => setCurrentDeviceId(dev.id)}
        onAddNewDevice={handleAddNewDevice}
        onDeleteDevice={handleDeleteDevice}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenDriverConfig={() => setIsDriverConfigOpen(true)}
        isMonitorMuted={currentDevice.monitorMuted}
        onToggleMonitorMute={() =>
          handleUpdateCurrentDevice({
            ...currentDevice,
            monitorMuted: !currentDevice.monitorMuted,
          })
        }
        monitorVolume={currentDevice.monitorVolumeDb}
        onChangeMonitorVolume={(db) =>
          handleUpdateCurrentDevice({ ...currentDevice, monitorVolumeDb: db })
        }
        isDriverActive={isDriverActive}
        onToggleDriverActive={() => setIsDriverActive(!isDriverActive)}
        onChangeBuffer={(buf: BufferSize) =>
          handleUpdateCurrentDevice({ ...currentDevice, bufferSize: buf })
        }
        onChangeSampleRate={(rate: SampleRate) =>
          handleUpdateCurrentDevice({ ...currentDevice, sampleRate: rate })
        }
        activeProfileName={activeProfileName}
        onOpenProfileManager={() => setIsProfileModalOpen(true)}
        onQuickSaveProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Audio Signal Generator & Real-Time Test Bar */}
      <AudioTestBar
        currentMode={signalMode}
        onSelectMode={handleSelectSignalMode}
        latencyMs={((currentDevice.bufferSize / currentDevice.sampleRate) * 1000).toFixed(2)}
        sampleRate={currentDevice.sampleRate}
        bufferSize={currentDevice.bufferSize}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {activeTab === 'patchbay' && (
          <VisualPatchbay
            device={currentDevice}
            onUpdateDevice={handleUpdateCurrentDevice}
            onOpenAddSource={() => setIsAddSourceOpen(true)}
            onOpenAddDestination={() => setIsAddDestinationOpen(true)}
            isSignalActive={signalMode !== 'off'}
            onOpenProfileManager={() => setIsProfileModalOpen(true)}
            onApplyPresetTemplate={handleApplyPresetTemplateById}
            activeProfileId={activeProfileId}
          />
        )}

        {activeTab === 'mixer' && (
          <MixerConsole
            device={currentDevice}
            onUpdateChannels={(channels) =>
              handleUpdateCurrentDevice({ ...currentDevice, channels })
            }
            masterVolumeDb={currentDevice.masterVolumeDb}
            onUpdateMasterVolume={(db) =>
              handleUpdateCurrentDevice({ ...currentDevice, masterVolumeDb: db })
            }
            masterMuted={currentDevice.masterMuted}
            onToggleMasterMute={() =>
              handleUpdateCurrentDevice({
                ...currentDevice,
                masterMuted: !currentDevice.masterMuted,
              })
            }
            masterPeakL={masterPeakL}
            masterPeakR={masterPeakR}
            masterRmsL={masterRmsL}
            masterRmsR={masterRmsR}
            masterClip={masterClip}
            onClearMasterClip={() => setMasterClip(false)}
          />
        )}

        {activeTab === 'driver' && (
          <DriverEngineView
            device={currentDevice}
            onUpdateDevice={handleUpdateCurrentDevice}
            isDriverActive={isDriverActive}
            onToggleDriverActive={() => setIsDriverActive(!isDriverActive)}
          />
        )}
      </main>

      {/* Driver Configuration & Plist Export Modal */}
      <DriverConfigModal
        isOpen={isDriverConfigOpen}
        onClose={() => setIsDriverConfigOpen(false)}
        device={currentDevice}
        onUpdateDevice={handleUpdateCurrentDevice}
      />

      {/* Add Audio Source Modal */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onAddSource={(newSource: AudioSource) => {
          handleUpdateCurrentDevice({
            ...currentDevice,
            sources: [...currentDevice.sources, newSource],
          });
        }}
      />

      {/* Add Destination Modal */}
      <AddDestinationModal
        isOpen={isAddDestinationOpen}
        onClose={() => setIsAddDestinationOpen(false)}
        onAddDestination={(newDest: AudioDestination) => {
          handleUpdateCurrentDevice({
            ...currentDevice,
            destinations: [...currentDevice.destinations, newDest],
          });
        }}
      />

      {/* User Profiles & Preset Routing Templates Modal */}
      <ProfileManagerModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentDevice={currentDevice}
        activeProfileId={activeProfileId}
        savedProfiles={savedProfiles}
        onApplyProfile={handleApplyProfile}
        onSaveNewProfile={handleSaveNewProfile}
        onUpdateExistingProfile={handleUpdateExistingProfile}
        onDeleteProfile={handleDeleteProfile}
        onImportProfiles={handleImportProfiles}
      />
    </div>
  );
}
