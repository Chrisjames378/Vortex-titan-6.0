import { DEFAULT_MOD_MATRIX, DEFAULT_PARAMS, PRESETS, freqToNoteName } from '../data/presets';
import {
  ChordMode,
  DrumTrackKey,
  ModDest,
  ModSlot,
  SoundsIdResult,
  SynthParams,
} from '../types/synth';

interface VoiceEntry {
  oscNodes: AudioScheduledSourceNode[];
  osc1List: OscillatorNode[];
  osc2Ref: OscillatorNode | null;
  vca: GainNode;
  filter: BiquadFilterNode;
}

export class VortexTitanEngine {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public drumBusGain: GainNode | null = null;
  public synthBusGain: GainNode | null = null;
  public compressor: DynamicsCompressorNode | null = null;
  public analyser: AnalyserNode | null = null;
  public delayNodeL: DelayNode | null = null;
  public delayNodeR: DelayNode | null = null;
  public delayFeedback: GainNode | null = null;
  public delayWet: GainNode | null = null;
  public reverbNode: ConvolverNode | null = null;
  public reverbWet: GainNode | null = null;
  public resonatorDelay: DelayNode | null = null;
  public resonatorFeedback: GainNode | null = null;
  public resonatorWet: GainNode | null = null;
  public distortionNode: WaveShaperNode | null = null;

  private tbSquareWave: PeriodicWave | null = null;
  private spectralWave: PeriodicWave | null = null;
  private hybridWave: PeriodicWave | null = null;
  private granularTimer: ReturnType<typeof setInterval> | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  public activeVoices = new Map<number, VoiceEntry[]>();
  private monoVoice: { midi: number; group: VoiceEntry[] } | null = null;
  public lastFreq = 130.81;
  public pitchBend = 0;
  public modWheelVal = 0.2;
  public monoLegato = true;
  public granularEnabled = false;
  public micActive = false;
  public chordMode: ChordMode = 'off';

  public modMatrix: ModSlot[] = DEFAULT_MOD_MATRIX.map((m) => ({ ...m }));
  public params: SynthParams = { ...DEFAULT_PARAMS };
  private lastReverbSize = DEFAULT_PARAMS.reverbSize;

  public initAudio(onIgnited?: () => void): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (onIgnited) onIgnited();
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      imag[i] = (i % 2 === 1 ? 1.0 : 0.38) * (1 / Math.pow(i, 0.88));
      real[i] = (i % 3 === 0 ? 0.18 : -0.08) * (1 / i);
    }
    this.tbSquareWave = this.ctx.createPeriodicWave(real, imag);

    const sReal = new Float32Array(32);
    const sImag = new Float32Array(32);
    [1, 2, 3, 5, 8, 13, 21].forEach((h, idx) => {
      sImag[h] = 1 / (idx + 1);
    });
    this.spectralWave = this.ctx.createPeriodicWave(sReal, sImag);

    this.rebuildHybridWave();

    this.synthBusGain = this.ctx.createGain();
    this.synthBusGain.gain.value = 1.0;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.params.masterVol;

    this.drumBusGain = this.ctx.createGain();
    this.drumBusGain.gain.value = this.params.drumVol;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.oversample = '4x';
    this.updateDistortionCurve();

    this.delayNodeL = this.ctx.createDelay(2.0);
    this.delayNodeR = this.ctx.createDelay(2.0);
    this.delayNodeL.delayTime.value = this.params.delayTime;
    this.delayNodeR.delayTime.value = this.params.delayTime * 1.5;

    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = this.params.delayFeedback;

    this.delayWet = this.ctx.createGain();
    this.delayWet.gain.value = this.params.delayMix;

    const merger = this.ctx.createChannelMerger(2);
    this.delayNodeL.connect(this.delayNodeR);
    this.delayNodeR.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNodeL);

    this.delayNodeL.connect(merger, 0, 0);
    this.delayNodeR.connect(merger, 0, 1);
    merger.connect(this.delayWet);

    this.reverbNode = this.ctx.createConvolver();
    this.reverbWet = this.ctx.createGain();
    this.reverbWet.gain.value = this.params.reverbMix;
    this.generateImpulseResponse();
    this.reverbNode.connect(this.reverbWet);

    this.resonatorDelay = this.ctx.createDelay(0.25);
    this.resonatorDelay.delayTime.value = 1 / 130.81;
    this.resonatorFeedback = this.ctx.createGain();
    this.resonatorFeedback.gain.value = 0.72;
    const resFilter = this.ctx.createBiquadFilter();
    resFilter.type = 'lowpass';
    resFilter.frequency.value = 3600;
    this.resonatorWet = this.ctx.createGain();
    this.resonatorWet.gain.value = this.params.resonatorMix * 0.45;

    this.resonatorDelay.connect(resFilter);
    resFilter.connect(this.resonatorFeedback);
    this.resonatorFeedback.connect(this.resonatorDelay);
    resFilter.connect(this.resonatorWet);

    this.distortionNode.connect(this.synthBusGain);
    this.distortionNode.connect(this.delayNodeL);
    this.distortionNode.connect(this.reverbNode);
    this.distortionNode.connect(this.resonatorDelay);

    this.delayWet.connect(this.synthBusGain);
    this.reverbWet.connect(this.synthBusGain);
    this.resonatorWet.connect(this.synthBusGain);
    this.synthBusGain.connect(this.masterGain);
    this.drumBusGain.connect(this.masterGain);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.startGranularEngine();
    if (onIgnited) onIgnited();
  }

  public async toggleMicInput(): Promise<{ active: boolean; message: string }> {
    this.initAudio();
    if (!this.micActive && this.ctx && this.analyser) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { active: false, message: 'Mic input not supported in this browser' };
        }
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micSource = this.ctx.createMediaStreamSource(this.micStream);
        const micGain = this.ctx.createGain();
        micGain.gain.value = 0.35;
        this.micSource.connect(micGain);
        micGain.connect(this.analyser);
        this.micActive = true;
        return { active: true, message: 'Live acoustic mic routed to Sounds ID & Analyzer' };
      } catch {
        return { active: false, message: 'Mic permission denied or unavailable' };
      }
    } else {
      if (this.micSource) {
        try {
          this.micSource.disconnect();
        } catch {
          // ignore
        }
      }
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
      }
      this.micActive = false;
      return { active: false, message: 'Mic ID stopped' };
    }
  }

  public rebuildHybridWave(): void {
    if (!this.ctx) return;
    const size = 64;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);
    const m = this.params.hybridMorph;
    for (let h = 1; h < size; h++) {
      const sawPart = (1 - m) * (1 / h) * (h % 2 === 0 ? -0.6 : 1.0);
      const formPart = m * Math.exp(-Math.pow((h - (3 + m * 12)) / 3.5, 2));
      imag[h] = sawPart + formPart;
      real[h] = (h % 4 === 0 ? 0.15 * m : 0) / Math.sqrt(h);
    }
    this.hybridWave = this.ctx.createPeriodicWave(real, imag);
  }

  private startGranularEngine(): void {
    if (this.granularTimer) clearInterval(this.granularTimer);
    this.granularTimer = setInterval(() => {
      if (!this.ctx || !this.reverbNode || !this.granularEnabled || this.activeVoices.size === 0) return;
      const now = this.ctx.currentTime;
      const grainOsc = this.ctx.createOscillator();
      const grainGain = this.ctx.createGain();
      const octShift = [0.5, 1, 1.5, 2][Math.floor(Math.random() * 4)];
      grainOsc.type = 'sine';
      grainOsc.frequency.setValueAtTime(Math.max(55, this.lastFreq * octShift), now);

      const dur = 0.04 + (1 - this.params.granularDensity) * 0.08;
      const peak = 0.035 * this.params.granularDensity;
      grainGain.gain.setValueAtTime(0.0001, now);
      grainGain.gain.linearRampToValueAtTime(peak, now + dur * 0.35);
      grainGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      grainOsc.connect(grainGain);
      grainGain.connect(this.reverbNode);
      grainOsc.start(now);
      grainOsc.stop(now + dur + 0.01);
    }, 75);
  }

  public triggerDrum(type: DrumTrackKey, accent = false): void {
    if (!this.ctx || !this.drumBusGain) return;
    const now = this.ctx.currentTime;

    if (type === 'kick') {
      if (this.synthBusGain && this.params.sidechainDepth > 0.01) {
        const duckTarget = Math.max(0.12, 1 - this.params.sidechainDepth * 0.82);
        this.synthBusGain.gain.cancelScheduledValues(now);
        this.synthBusGain.gain.setValueAtTime(this.synthBusGain.gain.value, now);
        this.synthBusGain.gain.linearRampToValueAtTime(duckTarget, now + 0.008);
        this.synthBusGain.gain.exponentialRampToValueAtTime(1.0, now + 0.24);
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const startFreq = accent ? 165 : 140;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);

      const amp = accent ? 0.95 : 0.75;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

      osc.connect(gain);
      gain.connect(this.drumBusGain);
      osc.start(now);
      osc.stop(now + 0.31);
    } else if (type === 'snare') {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1850;
      filter.Q.value = 1.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.drumBusGain);
      noise.start(now);
    } else {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7200;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(accent ? 0.24 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.drumBusGain);
      noise.start(now);
    }
  }

  private getModulationOffset(dest: ModDest, velocity = 0.8, accent = false): number {
    let sum = 0;
    this.modMatrix.forEach((slot) => {
      if (slot.dest !== dest) return;
      let srcVal = 0;
      if (slot.source === 'accent') srcVal = accent ? 1 : 0;
      else if (slot.source === 'modwheel') srcVal = this.modWheelVal;
      else if (slot.source === 'velocity') srcVal = velocity;
      else if (slot.source === 'env') srcVal = Math.min(1, this.params.filterEnvAmt / 6000);
      else if (slot.source === 'lfo1') srcVal = this.params.lfoDepth * 0.5;
      sum += srcVal * slot.amount;
    });
    return sum;
  }

  private applyWaveform(osc: OscillatorNode, waveType: string): void {
    if (waveType === 'tb_square' && this.tbSquareWave) {
      osc.setPeriodicWave(this.tbSquareWave);
    } else if (waveType === 'spectral_harm' && this.spectralWave) {
      osc.setPeriodicWave(this.spectralWave);
    } else if (waveType === 'hybrid_morph' && this.hybridWave) {
      osc.setPeriodicWave(this.hybridWave);
    } else if (['sine', 'square', 'sawtooth', 'triangle'].includes(waveType)) {
      osc.type = waveType as OscillatorType;
    } else {
      osc.type = 'sawtooth';
    }
  }

  public generateImpulseResponse(): void {
    if (!this.ctx || !this.reverbNode) return;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(Math.max(0.3, this.params.reverbSize) * rate);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const decay = 2.2;

    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        channelData[i] = (Math.random() * 2 - 1) * env;
      }
    }
    this.reverbNode.buffer = impulse;
  }

  public updateDistortionCurve(): void {
    if (!this.distortionNode) return;
    const model = this.params.pedalModel;
    const drive = this.params.filterDrive + this.params.macroGrit * 0.6;
    const n = 44100;
    const curve = new Float32Array(n);
    const k = model === 'bypass' ? 0 : drive * 45;

    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      if (model === 'bypass' || k === 0) {
        curve[i] = x;
      } else if (model === 'yellow_acid') {
        curve[i] = Math.tanh(x * (1 + k * 0.35));
      } else if (model === 'fuzzy03') {
        curve[i] = Math.sign(x) * (1 - Math.exp(-Math.abs(x) * (1 + k * 0.5)));
      } else if (model === 'square_tube') {
        curve[i] = Math.max(-0.85, Math.min(0.85, x * (1 + k * 0.4)));
      } else {
        curve[i] = Math.tanh(Math.sin(x * Math.PI * 0.5) * (1 + k * 0.7));
      }
    }
    this.distortionNode.curve = curve;
  }

  public midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69 + this.pitchBend) / 12);
  }

  private getChordOffsets(): number[] {
    switch (this.chordMode) {
      case 'octave':
        return [-12, 0];
      case 'fifth':
        return [0, 7];
      case 'minor7':
        return [0, 3, 7, 10];
      case 'supersaw':
        return [-12, 0, 7, 12];
      default:
        return [0];
    }
  }

  public noteOn(midi: number, velocity = 0.85, accent = false, slide = false, onIgnited?: () => void): void {
    this.initAudio(onIgnited);
    if (!this.ctx || !this.distortionNode) return;
    const now = this.ctx.currentTime;

    if (this.monoLegato && this.monoVoice && (slide || this.activeVoices.size > 0)) {
      const targetFreq = this.midiToFreq(midi);
      const glideTime = slide ? 0.085 : 0.018;
      this.monoVoice.group.forEach(({ osc1List, osc2Ref, filter, vca }) => {
        osc1List.forEach((osc) => {
          osc.frequency.cancelScheduledValues(now);
          osc.frequency.setValueAtTime(Math.max(20, osc.frequency.value), now);
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, targetFreq * Math.pow(2, this.params.osc1Oct)),
            now + glideTime
          );
        });
        if (osc2Ref) {
          osc2Ref.frequency.cancelScheduledValues(now);
          osc2Ref.frequency.setValueAtTime(Math.max(20, osc2Ref.frequency.value), now);
          osc2Ref.frequency.exponentialRampToValueAtTime(
            Math.max(20, targetFreq * Math.pow(2, this.params.osc2Semi / 12)),
            now + glideTime
          );
        }
        if (accent) {
          const curCut = filter.frequency.value;
          filter.frequency.cancelScheduledValues(now);
          filter.frequency.setValueAtTime(curCut, now);
          filter.frequency.linearRampToValueAtTime(
            Math.min(18500, curCut + 2400 * this.params.acidAccent),
            now + 0.015
          );
          filter.frequency.exponentialRampToValueAtTime(Math.max(60, curCut), now + 0.22);
          vca.gain.setTargetAtTime(0.44 * velocity, now, 0.01);
        }
      });
      this.monoVoice.midi = midi;
      this.lastFreq = targetFreq;
      this.activeVoices.clear();
      this.activeVoices.set(midi, this.monoVoice.group);
      return;
    }

    if (this.monoLegato && this.monoVoice) {
      this.panic();
    }

    if (this.activeVoices.has(midi)) {
      this.noteOff(midi, true);
    }

    const voiceGroup: VoiceEntry[] = [];
    const offsets = this.monoLegato ? [0] : this.getChordOffsets();

    offsets.forEach((semiOffset) => {
      if (!this.ctx || !this.distortionNode) return;
      const freq = this.midiToFreq(midi + semiOffset);
      const glideTime = slide ? 0.085 : 0.004;

      const filter = this.ctx.createBiquadFilter();
      const model = this.params.filterModel;
      if (model === 'tbee303' || model === 'lowpass') filter.type = 'lowpass';
      else if (model === 'bandpass') filter.type = 'bandpass';
      else if (model === 'highpass') filter.type = 'highpass';
      else filter.type = 'notch';

      const modCutoff = this.getModulationOffset('cutoff', velocity, accent) * 3200;
      const modRes = this.getModulationOffset('res', velocity, accent) * 8;
      const macroBoost = this.params.macroAcid * 2200;
      const keyTrackBoost = (freq - 130) * this.params.filterKeyTrack * 1.4;
      const accentBoost = accent ? 2200 * this.params.acidAccent : 0;
      const baseCutoff = Math.min(
        18000,
        Math.max(40, this.params.filterCutoff + macroBoost + keyTrackBoost + modCutoff)
      );
      const peakCutoff = Math.min(19000, baseCutoff + this.params.filterEnvAmt + accentBoost);

      const effDecay = accent ? Math.max(0.08, this.params.envDecay * 0.72) : this.params.envDecay;
      const resBoost = (accent ? this.params.filterRes * 1.28 : this.params.filterRes) + modRes;
      filter.Q.setValueAtTime(Math.max(0.5, Math.min(26, resBoost)), now);

      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(baseCutoff, now);
      filter.frequency.linearRampToValueAtTime(peakCutoff, now + this.params.envAttack);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(45, baseCutoff + (peakCutoff - baseCutoff) * this.params.envSustain),
        now + this.params.envAttack + effDecay
      );

      const vca = this.ctx.createGain();
      const peakGain = ((accent ? 0.44 : 0.30) * velocity) / Math.sqrt(offsets.length);
      vca.gain.setValueAtTime(0.0001, now);
      vca.gain.linearRampToValueAtTime(peakGain, now + this.params.envAttack);
      vca.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, peakGain * Math.max(0.05, this.params.envSustain)),
        now + this.params.envAttack + effDecay
      );

      filter.connect(vca);
      vca.connect(this.distortionNode);

      const oscNodes: AudioScheduledSourceNode[] = [];
      const osc1List: OscillatorNode[] = [];

      if (this.params.osc1Enabled && this.params.osc1Level > 0.01) {
        const voices = Math.max(1, Math.round(this.params.osc1Unison));
        const osc1Freq = Math.max(20, freq * Math.pow(2, this.params.osc1Oct));
        const startFreq1 = slide ? Math.max(20, this.lastFreq * Math.pow(2, this.params.osc1Oct)) : osc1Freq;

        const osc1Gain = this.ctx.createGain();
        osc1Gain.gain.value = (this.params.osc1Level * 0.6) / Math.sqrt(voices);
        osc1Gain.connect(filter);

        const modDetune = this.getModulationOffset('detune', velocity, accent) * 25;

        for (let v = 0; v < voices; v++) {
          const osc = this.ctx.createOscillator();
          this.applyWaveform(osc, this.params.osc1Wave);

          const spread = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2;
          const detuneCents = spread * (this.params.osc1Detune + modDetune);

          osc.detune.setValueAtTime(detuneCents, now);
          osc.frequency.setValueAtTime(startFreq1, now);
          osc.frequency.exponentialRampToValueAtTime(osc1Freq, now + glideTime);

          osc.connect(osc1Gain);
          osc.start(now);
          oscNodes.push(osc);
          osc1List.push(osc);
        }
      }

      let osc2Ref: OscillatorNode | null = null;
      if (this.params.osc2Enabled && this.params.osc2Level > 0.01) {
        const osc2 = this.ctx.createOscillator();
        this.applyWaveform(osc2, this.params.osc2Wave);
        const osc2Freq = Math.max(20, freq * Math.pow(2, this.params.osc2Semi / 12));
        const startFreq2 = slide
          ? Math.max(20, this.lastFreq * Math.pow(2, this.params.osc2Semi / 12))
          : osc2Freq;

        osc2.detune.setValueAtTime(this.params.osc2Detune, now);
        osc2.frequency.setValueAtTime(startFreq2, now);
        osc2.frequency.exponentialRampToValueAtTime(osc2Freq, now + glideTime);

        const osc2Gain = this.ctx.createGain();
        osc2Gain.gain.value = this.params.osc2Level * 0.55;
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);

        const modFm = this.getModulationOffset('fm', velocity, accent) * 350;
        const fmAmt = Math.max(0, this.params.osc2Fm + modFm);
        if (fmAmt > 1 && osc1List.length > 0) {
          const fmGain = this.ctx.createGain();
          fmGain.gain.value = fmAmt;
          osc2.connect(fmGain);
          osc1List.forEach((targetOsc) => fmGain.connect(targetOsc.frequency));
        }

        osc2.start(now);
        oscNodes.push(osc2);
        osc2Ref = osc2;
      }

      if (this.params.noiseLevel > 0.005) {
        const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = this.params.noiseLevel * 0.35;

        whiteNoise.connect(noiseGain);
        noiseGain.connect(filter);
        whiteNoise.start(now);
        oscNodes.push(whiteNoise);
      }

      const matrixLfoSlot = this.modMatrix.find((s) => s.source === 'lfo1' && Math.abs(s.amount) > 0.01);
      if (this.params.lfoDepth > 0.01 || matrixLfoSlot) {
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = this.params.lfoRate;

        if (this.params.lfoDepth > 0.01) {
          const lfoGain = this.ctx.createGain();
          if (this.params.lfoTarget === 'cutoff') {
            lfoGain.gain.value = this.params.lfoDepth * 2400;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
          } else if (this.params.lfoTarget === 'pitch') {
            lfoGain.gain.value = this.params.lfoDepth * 45;
            lfo.connect(lfoGain);
            oscNodes.forEach((o) => {
              if ('detune' in o) lfoGain.connect((o as OscillatorNode).detune);
            });
          } else if (this.params.lfoTarget === 'fm' && osc2Ref) {
            lfoGain.gain.value = this.params.lfoDepth * 40;
            lfo.connect(lfoGain);
            lfoGain.connect(osc2Ref.frequency);
          }
        }

        if (matrixLfoSlot) {
          const mGain = this.ctx.createGain();
          if (matrixLfoSlot.dest === 'cutoff') {
            mGain.gain.value = matrixLfoSlot.amount * 2600;
            lfo.connect(mGain);
            mGain.connect(filter.frequency);
          } else if (matrixLfoSlot.dest === 'res') {
            mGain.gain.value = matrixLfoSlot.amount * 10;
            lfo.connect(mGain);
            mGain.connect(filter.Q);
          } else if (matrixLfoSlot.dest === 'detune') {
            mGain.gain.value = matrixLfoSlot.amount * 40;
            lfo.connect(mGain);
            osc1List.forEach((o) => mGain.connect(o.detune));
          }
        }

        lfo.start(now);
        oscNodes.push(lfo);
      }

      voiceGroup.push({ oscNodes, osc1List, osc2Ref, vca, filter });
    });

    this.lastFreq = this.midiToFreq(midi);
    this.activeVoices.set(midi, voiceGroup);
    if (this.monoLegato) {
      this.monoVoice = { midi, group: voiceGroup };
    }
  }

  public noteOff(midi: number, immediate = false): void {
    if (!this.ctx || !this.activeVoices.has(midi)) return;
    const now = this.ctx.currentTime;
    const rel = immediate ? 0.015 : this.params.envRelease;
    const voiceGroup = this.activeVoices.get(midi);
    if (!voiceGroup) return;

    voiceGroup.forEach(({ oscNodes, vca }) => {
      vca.gain.cancelScheduledValues(now);
      vca.gain.setValueAtTime(Math.max(0.0001, vca.gain.value), now);
      vca.gain.exponentialRampToValueAtTime(0.0001, now + rel);

      oscNodes.forEach((node) => {
        try {
          node.stop(now + rel + 0.03);
        } catch {
          // already stopped
        }
      });
    });

    this.activeVoices.delete(midi);
    if (this.monoVoice && this.monoVoice.midi === midi) {
      this.monoVoice = null;
    }
  }

  public panic(): void {
    for (const midi of Array.from(this.activeVoices.keys())) {
      this.noteOff(midi, true);
    }
    this.monoVoice = null;
  }

  public updateLiveEffects(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.params.masterVol, now, 0.02);
    if (this.drumBusGain) this.drumBusGain.gain.setTargetAtTime(this.params.drumVol, now, 0.02);
    if (this.delayNodeL && this.delayNodeR) {
      this.delayNodeL.delayTime.setTargetAtTime(this.params.delayTime, now, 0.03);
      this.delayNodeR.delayTime.setTargetAtTime(this.params.delayTime * 1.5, now, 0.03);
    }
    if (this.delayFeedback) this.delayFeedback.gain.setTargetAtTime(this.params.delayFeedback, now, 0.03);
    if (this.delayWet) {
      const wet = Math.min(0.85, this.params.delayMix + this.params.macroSpace * 0.25);
      this.delayWet.gain.setTargetAtTime(wet, now, 0.03);
    }
    if (this.reverbWet) {
      const revWet = Math.min(0.85, this.params.reverbMix + this.params.macroSpace * 0.30);
      this.reverbWet.gain.setTargetAtTime(revWet, now, 0.03);
    }
    if (this.resonatorWet) {
      this.resonatorWet.gain.setTargetAtTime(this.params.resonatorMix * 0.48, now, 0.03);
    }
    if (this.resonatorDelay) {
      const pitchFreq = Math.max(45, Math.min(880, this.lastFreq || 130.81));
      this.resonatorDelay.delayTime.setTargetAtTime(1 / pitchFreq, now, 0.015);
    }
    if (this.compressor) {
      this.compressor.threshold.setTargetAtTime(-10 - this.params.limiterDrive, now, 0.03);
    }
    this.rebuildHybridWave();
    this.updateDistortionCurve();
  }

  public analyzeSoundsId(freqData: Uint8Array<ArrayBuffer>): SoundsIdResult {
    if (!this.analyser || !this.ctx) {
      return {
        freq: +(this.lastFreq || 130.81).toFixed(1),
        note: freqToNoteName(this.lastFreq || 130.81),
        centroid: 1420,
        timbre: '303 Acid Resonant',
        presetKey: 'cyber_acid',
        presetName: PRESETS.cyber_acid.name,
        confidence: 88,
      };
    }

    this.analyser.getByteFrequencyData(freqData);
    const nyquist = this.ctx.sampleRate / 2;
    const binHz = nyquist / freqData.length;

    let maxMag = 0;
    let peakBin = 1;
    let weightedSum = 0;
    let magSum = 0;

    for (let i = 1; i < freqData.length; i++) {
      const mag = freqData[i];
      const hz = i * binHz;
      if (mag > maxMag && hz >= 32 && hz <= 2200) {
        maxMag = mag;
        peakBin = i;
      }
      weightedSum += hz * mag;
      magSum += mag;
    }

    const detectedFreq =
      maxMag > 8 ? +(peakBin * binHz).toFixed(1) : +(this.lastFreq || 130.81).toFixed(1);
    const centroid = magSum > 0 ? Math.round(weightedSum / magSum) : 950;

    let timbre = this.micActive ? 'Live Acoustic / Mic' : 'Hybrid Harmonic';
    if (!this.micActive) {
      if (this.params.filterModel === 'tbee303' || this.params.filterRes > 10) {
        timbre = '303 Acid Resonant';
      } else if (this.params.osc1Unison >= 4 && this.params.osc1Wave === 'sawtooth') {
        timbre = 'Hyper Unison Saw';
      } else if (this.granularEnabled || this.params.envAttack > 0.25) {
        timbre = 'Spectral Granular Pad';
      } else if (this.params.osc2Fm > 180) {
        timbre = 'FM Metallic / Reese';
      }
    }

    let bestKey = 'cyber_acid';
    let bestScore = -Infinity;
    Object.entries(PRESETS).forEach(([key, preset]) => {
      const cutDiff = Math.abs((preset.filterCutoff || 800) - this.params.filterCutoff) / 4000;
      const resDiff = Math.abs((preset.filterRes || 8) - this.params.filterRes) / 20;
      const decDiff = Math.abs((preset.envDecay || 0.25) - this.params.envDecay) / 2;
      const uniDiff = Math.abs((preset.osc1Unison || 2) - this.params.osc1Unison) / 5;
      const score = 100 - (cutDiff * 35 + resDiff * 30 + decDiff * 20 + uniDiff * 15);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    });

    const confidence = Math.max(62, Math.min(99, Math.round(bestScore)));
    const note = freqToNoteName(detectedFreq);

    return {
      freq: detectedFreq,
      note,
      centroid,
      timbre,
      presetKey: bestKey,
      presetName: PRESETS[bestKey]?.name || bestKey,
      confidence,
    };
  }
}
