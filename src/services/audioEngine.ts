/**
 * Web Audio Real-Time Engine & CoreAudio Loopback Simulator
 * Implements real signal synthesis, mic capture, multi-channel gain/pan matrix,
 * and high-speed Peak/RMS metering.
 */

import { SignalSourceMode, VirtualChannelStrip } from '../types';

export interface MeterData {
  peakL: number; // dBFS (-60 to +6)
  peakR: number;
  rmsL: number;
  rmsR: number;
  isClipping: boolean;
}

class LoopCoreAudioEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  // Synthesis nodes
  private synthInterval: number | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private toneOscillator: OscillatorNode | null = null;
  private synthMasterGain: GainNode | null = null;

  // Signal Source
  private currentMode: SignalSourceMode = 'off';

  // Channel audio nodes: channel index -> { gain, panner, filter, analyserL, analyserR, phaseGain }
  private channelNodes: Map<
    number,
    {
      inputGain: GainNode;
      hpfFilter: BiquadFilterNode;
      panner: StereoPannerNode;
      phaseGain: GainNode;
      channelGain: GainNode;
      splitter: ChannelSplitterNode;
      analyserL: AnalyserNode;
      analyserR: AnalyserNode;
      levelMeter: MeterData;
    }
  > = new Map();

  // Master bus
  private masterGain: GainNode | null = null;
  private masterSplitter: ChannelSplitterNode | null = null;
  private masterAnalyserL: AnalyserNode | null = null;
  private masterAnalyserR: AnalyserNode | null = null;
  private masterSpectrumAnalyser: AnalyserNode | null = null;
  private masterMeter: MeterData = { peakL: -60, peakR: -60, rmsL: -60, rmsR: -60, isClipping: false };

  // Monitor bus (to actual hardware speakers/headphones)
  private monitorGain: GainNode | null = null;
  private isMonitorEnabled = true;

  // Data arrays for metering (1024 samples for high resolution)
  private byteDataL = new Float32Array(1024);
  private byteDataR = new Float32Array(1024);

  // Callbacks
  private meterListeners: Set<(channelMeters: Map<number, MeterData>, master: MeterData) => void> = new Set();
  private animFrameId: number | null = null;

  // Ensure AudioContext is created on user interaction
  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass({ latencyHint: 'interactive' });
      this.setupMasterBus();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  private setupMasterBus() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.masterSplitter = this.ctx.createChannelSplitter(2);
    this.masterAnalyserL = this.ctx.createAnalyser();
    this.masterAnalyserR = this.ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 1024;
    this.masterAnalyserR.fftSize = 1024;
    this.masterAnalyserL.smoothingTimeConstant = 0.8;
    this.masterAnalyserR.smoothingTimeConstant = 0.8;

    this.masterSpectrumAnalyser = this.ctx.createAnalyser();
    this.masterSpectrumAnalyser.fftSize = 1024;
    this.masterSpectrumAnalyser.smoothingTimeConstant = 0.8;
    this.masterSpectrumAnalyser.minDecibels = -90;
    this.masterSpectrumAnalyser.maxDecibels = -10;

    this.masterGain.connect(this.masterSplitter);
    this.masterSplitter.connect(this.masterAnalyserL, 0);
    this.masterSplitter.connect(this.masterAnalyserR, 1);
    this.masterGain.connect(this.masterSpectrumAnalyser);

    // Monitor output
    this.monitorGain = this.ctx.createGain();
    this.monitorGain.gain.setValueAtTime(this.isMonitorEnabled ? 0.8 : 0.0, this.ctx.currentTime);

    this.masterGain.connect(this.monitorGain);
    this.monitorGain.connect(this.ctx.destination);

    // Start meter calculation loop
    this.startMeterLoop();
  }

  public initChannels(channelCount: number) {
    if (!this.ctx) return;

    // Disconnect and clear existing
    this.channelNodes.forEach((node) => {
      node.channelGain.disconnect();
    });
    this.channelNodes.clear();

    for (let i = 1; i <= channelCount; i++) {
      const inputGain = this.ctx.createGain();
      const hpfFilter = this.ctx.createBiquadFilter();
      hpfFilter.type = 'highpass';
      hpfFilter.frequency.setValueAtTime(10, this.ctx.currentTime);
      hpfFilter.Q.setValueAtTime(0.707, this.ctx.currentTime);

      const panner = this.ctx.createStereoPanner();
      const phaseGain = this.ctx.createGain();
      const channelGain = this.ctx.createGain();

      const splitter = this.ctx.createChannelSplitter(2);
      const analyserL = this.ctx.createAnalyser();
      const analyserR = this.ctx.createAnalyser();
      analyserL.fftSize = 1024;
      analyserR.fftSize = 1024;
      analyserL.smoothingTimeConstant = 0.8;
      analyserR.smoothingTimeConstant = 0.8;

      // Connect chain:
      // inputGain -> hpfFilter -> phaseGain -> panner -> channelGain -> masterGain
      inputGain.connect(hpfFilter);
      hpfFilter.connect(phaseGain);
      phaseGain.connect(panner);
      panner.connect(channelGain);

      // Metering branch
      channelGain.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      // Connect to master bus
      if (this.masterGain) {
        channelGain.connect(this.masterGain);
      }

      this.channelNodes.set(i, {
        inputGain,
        hpfFilter,
        panner,
        phaseGain,
        channelGain,
        splitter,
        analyserL,
        analyserR,
        levelMeter: { peakL: -60, peakR: -60, rmsL: -60, rmsR: -60, isClipping: false },
      });
    }

    // Re-route current active source if running
    if (this.currentMode !== 'off') {
      this.routeActiveSourceToChannels();
    }
  }

  public async setSignalSource(mode: SignalSourceMode) {
    await this.ensureContext();
    if (!this.ctx) return;

    this.stopCurrentSignal();
    this.currentMode = mode;

    if (mode === 'off') return;

    this.synthMasterGain = this.ctx.createGain();
    this.synthMasterGain.gain.setValueAtTime(0.45, this.ctx.currentTime);

    switch (mode) {
      case 'chords':
        this.startChordsGenerator();
        break;
      case 'synth_lead':
        this.startSynthLeadGenerator();
        break;
      case 'beat_pulse':
        this.startBeatPulseGenerator();
        break;
      case '1khz_tone':
        this.start1kHzTone();
        break;
      case 'pink_noise':
        this.startPinkNoise();
        break;
      case 'microphone':
        await this.startMicrophoneCapture();
        break;
    }

    this.routeActiveSourceToChannels();
  }

  public getSignalMode(): SignalSourceMode {
    return this.currentMode;
  }

  private stopCurrentSignal() {
    if (this.synthInterval) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.toneOscillator) {
      try {
        this.toneOscillator.stop();
        this.toneOscillator.disconnect();
      } catch {
        // ignore already stopped
      }
      this.toneOscillator = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {
        // ignore
      }
      this.noiseNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
      this.micSourceNode = null;
    }
    if (this.synthMasterGain) {
      try {
        this.synthMasterGain.disconnect();
      } catch {
        // ignore
      }
      this.synthMasterGain = null;
    }
  }

  private routeActiveSourceToChannels() {
    if (!this.synthMasterGain) return;

    // Route to channels:
    // Ch 1 & 2 are main stereo
    // Ch 3 & 4 can receive secondary audio
    this.channelNodes.forEach((node, chNum) => {
      try {
        // Feed into first few channels
        if (chNum <= 4 && this.synthMasterGain) {
          const attenuation = chNum > 2 ? 0.7 : 1.0;
          const branchGain = this.ctx!.createGain();
          branchGain.gain.setValueAtTime(attenuation, this.ctx!.currentTime);
          this.synthMasterGain.connect(branchGain);
          branchGain.connect(node.inputGain);
        }
      } catch {
        // ignore already connected
      }
    });
  }

  // 1. Lush Ambient Chords Generator (Warm analog synth)
  private startChordsGenerator() {
    if (!this.ctx || !this.synthMasterGain) return;

    // Chord progressions: Fmaj7 -> Gsus4 -> Em7 -> Am7
    const chords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 261.63, 293.66, 392.0],  // Gsus4
      [164.81, 196.0, 246.94, 329.63], // Em7
      [220.0, 261.63, 329.63, 392.0],  // Am7
    ];

    let chordIndex = 0;

    const playChord = () => {
      if (!this.ctx || !this.synthMasterGain || this.currentMode !== 'chords') return;
      const freqs = chords[chordIndex % chords.length];
      chordIndex++;

      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const oscGain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx!.currentTime);
        filter.frequency.exponentialRampToValueAtTime(1800, this.ctx!.currentTime + 0.4);
        filter.frequency.exponentialRampToValueAtTime(700, this.ctx!.currentTime + 1.8);

        const now = this.ctx!.currentTime;
        oscGain.gain.setValueAtTime(0.001, now);
        oscGain.gain.linearRampToValueAtTime(0.08, now + 0.15);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.95);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(this.synthMasterGain!);

        osc.start(now);
        osc.stop(now + 2.0);
      });
    };

    playChord();
    this.synthInterval = window.setInterval(playChord, 2000);
  }

  // 2. Synth Lead Arpeggio
  private startSynthLeadGenerator() {
    if (!this.ctx || !this.synthMasterGain) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 329.63, 293.66];
    let noteIdx = 0;

    const playArpNote = () => {
      if (!this.ctx || !this.synthMasterGain || this.currentMode !== 'synth_lead') return;
      const freq = notes[noteIdx % notes.length];
      noteIdx++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.synthMasterGain!);
      osc.start(now);
      osc.stop(now + 0.25);
    };

    this.synthInterval = window.setInterval(playArpNote, 180);
  }

  // 3. Lo-Fi Beat & Rhythm Pulse
  private startBeatPulseGenerator() {
    if (!this.ctx || !this.synthMasterGain) return;

    let step = 0;
    const playStep = () => {
      if (!this.ctx || !this.synthMasterGain || this.currentMode !== 'beat_pulse') return;
      const beat = step % 8;
      step++;
      const now = this.ctx.currentTime;

      // Kick on 0, 4
      if (beat === 0 || beat === 4) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(130, now);
        kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
        kickGain.gain.setValueAtTime(0.28, now);
        kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        kickOsc.connect(kickGain);
        kickGain.connect(this.synthMasterGain!);
        kickOsc.start(now);
        kickOsc.stop(now + 0.26);
      }

      // Snare on 2, 6
      if (beat === 2 || beat === 6) {
        const snareOsc = this.ctx.createOscillator();
        const snareGain = this.ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(200, now);
        snareGain.gain.setValueAtTime(0.15, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        snareOsc.connect(snareGain);
        snareGain.connect(this.synthMasterGain!);
        snareOsc.start(now);
        snareOsc.stop(now + 0.13);
      }

      // Hi-hat on every step
      const hatOsc = this.ctx.createOscillator();
      const hatGain = this.ctx.createGain();
      const hatFilter = this.ctx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(7000, now);
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(1000 + Math.random() * 4000, now);
      hatGain.gain.setValueAtTime(beat % 2 === 0 ? 0.05 : 0.02, now);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      hatOsc.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(this.synthMasterGain!);
      hatOsc.start(now);
      hatOsc.stop(now + 0.06);
    };

    this.synthInterval = window.setInterval(playStep, 150);
  }

  // 4. 1kHz Calibration Reference Tone (-18 dBFS standard)
  private start1kHzTone() {
    if (!this.ctx || !this.synthMasterGain) return;
    this.toneOscillator = this.ctx.createOscillator();
    this.toneOscillator.type = 'sine';
    this.toneOscillator.frequency.setValueAtTime(1000, this.ctx.currentTime);

    // -18 dBFS = 0.125 amplitude
    this.synthMasterGain.gain.setValueAtTime(0.125, this.ctx.currentTime);
    this.toneOscillator.connect(this.synthMasterGain);
    this.toneOscillator.start();
  }

  // 5. Pink Noise Acoustic Generator
  private startPinkNoise() {
    if (!this.ctx || !this.synthMasterGain) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;
    this.synthMasterGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    this.noiseNode.connect(this.synthMasterGain);
    this.noiseNode.start();
  }

  // 6. Live Real Microphone Capture
  private async startMicrophoneCapture() {
    if (!this.ctx || !this.synthMasterGain) return;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);
      this.synthMasterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.micSourceNode.connect(this.synthMasterGain);
    } catch (err) {
      console.warn('Microphone permission not granted or unavailable:', err);
      // Fallback to warm chords if mic blocked
      this.startChordsGenerator();
    }
  }

  // Channel parameter updater
  public updateChannelParameters(channelStrips: VirtualChannelStrip[], isSoloActive: boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    channelStrips.forEach((strip) => {
      const nodes = this.channelNodes.get(strip.channelNumber);
      if (!nodes) return;

      // Calculate effective gain
      let effectiveGain = 0;
      if (strip.isMuted) {
        effectiveGain = 0;
      } else if (isSoloActive && !strip.isSolo) {
        effectiveGain = 0;
      } else {
        // Convert fader dB to linear gain
        // -60 dB or less -> 0
        if (strip.faderDb <= -59) {
          effectiveGain = 0;
        } else {
          effectiveGain = Math.pow(10, strip.faderDb / 20);
        }
      }

      nodes.channelGain.gain.setTargetAtTime(effectiveGain, now, 0.02);

      // 80Hz High Pass Filter
      if (strip.isHpfActive) {
        nodes.hpfFilter.frequency.setTargetAtTime(80, now, 0.01);
      } else {
        nodes.hpfFilter.frequency.setTargetAtTime(5, now, 0.01);
      }

      // Pan (-100 to 100 -> -1 to 1)
      const panVal = Math.max(-1, Math.min(1, strip.pan / 100));
      nodes.panner.pan.setTargetAtTime(panVal, now, 0.02);

      // Phase Invert
      nodes.phaseGain.gain.setValueAtTime(strip.isPhaseInverted ? -1 : 1, now);
    });
  }

  public updateMasterVolume(volumeDb: number, isMuted: boolean) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    if (isMuted || volumeDb <= -59) {
      this.masterGain.gain.setTargetAtTime(0, now, 0.02);
    } else {
      const lin = Math.pow(10, volumeDb / 20);
      this.masterGain.gain.setTargetAtTime(lin, now, 0.02);
    }
  }

  public setMonitorOutput(enabled: boolean, volumeDb = 0) {
    this.isMonitorEnabled = enabled;
    if (!this.ctx || !this.monitorGain) return;
    const now = this.ctx.currentTime;
    if (!enabled || volumeDb <= -59) {
      this.monitorGain.gain.setTargetAtTime(0, now, 0.02);
    } else {
      const lin = Math.pow(10, volumeDb / 20);
      this.monitorGain.gain.setTargetAtTime(lin, now, 0.02);
    }
  }

  // Subscribe to 60fps meter updates
  public subscribeMeters(callback: (channelMeters: Map<number, MeterData>, master: MeterData) => void) {
    this.meterListeners.add(callback);
    return () => {
      this.meterListeners.delete(callback);
    };
  }

  private startMeterLoop() {
    if (this.animFrameId) return;

    const update = () => {
      const channelMeters = new Map<number, MeterData>();

      // Update channel meters
      this.channelNodes.forEach((nodes, chNum) => {
        nodes.analyserL.getFloatTimeDomainData(this.byteDataL);
        nodes.analyserR.getFloatTimeDomainData(this.byteDataR);

        const meter = this.calculateMeterLevels(this.byteDataL, this.byteDataR);
        nodes.levelMeter = meter;
        channelMeters.set(chNum, meter);
      });

      // Update master meter
      if (this.masterAnalyserL && this.masterAnalyserR) {
        this.masterAnalyserL.getFloatTimeDomainData(this.byteDataL);
        this.masterAnalyserR.getFloatTimeDomainData(this.byteDataR);
        this.masterMeter = this.calculateMeterLevels(this.byteDataL, this.byteDataR);
      }

      // Notify listeners
      this.meterListeners.forEach((fn) => fn(channelMeters, this.masterMeter));

      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  private calculateMeterLevels(dataL: Float32Array, dataR: Float32Array): MeterData {
    let peakL = 0;
    let peakR = 0;
    let sumSquaresL = 0;
    let sumSquaresR = 0;
    const len = dataL.length;

    for (let i = 0; i < len; i++) {
      const valL = Math.abs(dataL[i]);
      const valR = Math.abs(dataR[i]);
      if (valL > peakL) peakL = valL;
      if (valR > peakR) peakR = valR;
      sumSquaresL += valL * valL;
      sumSquaresR += valR * valR;
    }

    const rmsL = Math.sqrt(sumSquaresL / len);
    const rmsR = Math.sqrt(sumSquaresR / len);

    const toDb = (linear: number) => {
      if (linear <= 0.0001) return -60;
      const db = 20 * Math.log10(linear);
      return Math.max(-60, Math.min(6, db));
    };

    const peakDbL = toDb(peakL);
    const peakDbR = toDb(peakR);
    const rmsDbL = toDb(rmsL);
    const rmsDbR = toDb(rmsR);
    const isClipping = peakDbL >= 0.0 || peakDbR >= 0.0;

    return { peakL: peakDbL, peakR: peakDbR, rmsL: rmsDbL, rmsR: rmsDbR, isClipping };
  }

  // Get analyser node for FFT spectrum analysis (master bus or specific channel)
  public getSpectrumAnalyser(target: 'master' | number = 'master'): AnalyserNode | null {
    if (!this.ctx) return null;
    if (target === 'master') {
      return this.masterSpectrumAnalyser || this.masterAnalyserL;
    }
    const ch = this.channelNodes.get(target);
    return ch ? ch.analyserL : null;
  }

  // Update FFT resolution and smoothing parameter across active analysers
  public setFftResolution(fftSize: number, smoothing = 0.8) {
    if (this.masterSpectrumAnalyser) {
      try {
        this.masterSpectrumAnalyser.fftSize = fftSize;
        this.masterSpectrumAnalyser.smoothingTimeConstant = smoothing;
      } catch {
        // ignore invalid param
      }
    }
    if (this.masterAnalyserL) {
      try {
        this.masterAnalyserL.fftSize = fftSize;
        this.masterAnalyserL.smoothingTimeConstant = smoothing;
      } catch {}
    }
    this.channelNodes.forEach((node) => {
      try {
        node.analyserL.fftSize = fftSize;
        node.analyserL.smoothingTimeConstant = smoothing;
        node.analyserR.fftSize = fftSize;
        node.analyserR.smoothingTimeConstant = smoothing;
      } catch {}
    });
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }
}

export const audioEngine = new LoopCoreAudioEngine();
