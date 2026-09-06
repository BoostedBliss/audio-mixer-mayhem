/**
 * LoopCore macOS Audio Loopback Driver & Routing Engine Types
 */

export type SampleRate = 44100 | 48000 | 88200 | 96000 | 192000;
export type BufferSize = 32 | 64 | 128 | 256 | 512 | 1024;

export type SourceType = 'application' | 'hardware_input' | 'system_sound' | 'pass_through';
export type DestinationType = 'virtual_output' | 'hardware_output' | 'application_input' | 'monitor_cue';

export interface AudioSource {
  id: string;
  name: string;
  type: SourceType;
  bundleId?: string;
  icon: string;
  channels: number; // 2 for stereo, 1 for mono, 6 for 5.1
  processId?: number;
  isActive: boolean;
  gainDb: number; // Input trim (-24dB to +12dB)
  isMuted: boolean;
  color: string;
  autoGain?: boolean; // Normalizes incoming levels to target RMS (default -12 dB)
  targetRmsDb?: number; // Target RMS level in dBFS (defaults to -12 dB)
  incomingRmsDb?: number; // Raw measured incoming RMS before normalization
  normalizedOffsetDb?: number; // Gain offset applied by auto-gain to hit target RMS
}

export interface AudioDestination {
  id: string;
  name: string;
  type: DestinationType;
  channels: number;
  isMonitor: boolean;
  hardwareDeviceName?: string;
  color: string;
}

export interface AudioRoute {
  id: string;
  sourceId: string;
  sourceChannel: number; // 1-indexed (e.g. 1 = Left, 2 = Right)
  destinationId: string;
  destinationChannel: number;
  gainDb: number; // Individual route trim (-inf to +6dB)
  pan: number; // -100 to +100
  isMuted: boolean;
  isSolo: boolean;
  isPhaseInverted: boolean;
  highPassFilter: boolean; // 80Hz rumble cut
  activeSignalLevel?: number; // 0.0 to 1.0 for cable glow
}

export interface VirtualChannelStrip {
  channelNumber: number;
  name: string;
  faderDb: number; // -60 to +12, with -Infinity represented as -60 or below
  pan: number; // -100 to +100
  isMuted: boolean;
  isSolo: boolean;
  isPhaseInverted: boolean;
  isHpfActive: boolean; // 80Hz High Pass Filter
  peakDbL: number;
  peakDbR: number;
  rmsDbL: number;
  rmsDbR: number;
  isClipping: boolean;
  peakHoldL: number;
  peakHoldR: number;
  assignedGroup?: 'A' | 'B' | 'None';
}

export interface VirtualDevice {
  id: string;
  name: string;
  icon: string;
  uid: string; // e.g. "com.loopcore.audio.hal.vdevice.01"
  sampleRate: SampleRate;
  bufferSize: BufferSize;
  channelCount: number; // typically 2, 4, 8, 16, or 32
  clockMaster: 'Internal CoreAudio' | 'Host Device Lock' | 'Drift Corrected SPSC';
  isDriverActive: boolean;
  zeroLatencyPassthrough: boolean; // CoreAudio direct memory copy
  ringBufferSizeBytes: number;
  sources: AudioSource[];
  destinations: AudioDestination[];
  routes: AudioRoute[];
  channels: VirtualChannelStrip[];
  masterVolumeDb: number;
  masterMuted: boolean;
  monitorVolumeDb: number;
  monitorMuted: boolean;
}

export interface DriverDiagnostics {
  halDriverVersion: string;
  driverState: 'Active - Zero Latency Ring' | 'Paused' | 'Clock Drift Syncing';
  sampleRate: number;
  bufferSize: number;
  calculatedHardwareLatencyMs: number;
  zeroLatencyDirectCopy: boolean;
  droppedFrames: number;
  cpuOverhead: number; // percentage e.g. 0.22%
  memoryAllocatedKb: number;
  activeStreams: number;
  realtimeWorkgroupThread: string;
}

export type SignalSourceMode = 'off' | 'chords' | 'synth_lead' | 'beat_pulse' | '1khz_tone' | 'pink_noise' | 'microphone';

export type ProfileCategory = 'streaming' | 'podcasting' | 'music_production' | 'broadcast' | 'custom';

export interface RoutingProfile {
  id: string;
  name: string;
  description: string;
  category: ProfileCategory;
  isTemplate?: boolean;
  tag?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
  sampleRate: SampleRate;
  bufferSize: BufferSize;
  channelCount: number;
  sources: AudioSource[];
  destinations: AudioDestination[];
  routes: AudioRoute[];
  channels: VirtualChannelStrip[];
  masterVolumeDb: number;
  masterMuted: boolean;
  monitorVolumeDb: number;
  monitorMuted: boolean;
}
