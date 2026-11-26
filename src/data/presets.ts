import { DrumTrackKey, ModSlot, PresetDef, ScaleKey, StepData, SynthParams } from '../types/synth';

export const DEFAULT_PARAMS: SynthParams = {
  osc1Enabled: true,
  osc1Wave: 'tb_square',
  osc1Oct: -1,
  osc1Detune: 12,
  osc1Unison: 2,
  tbSquareMorph: 0.72,
  osc1Level: 0.88,

  osc2Enabled: true,
  osc2Wave: 'sawtooth',
  osc2Semi: 0,
  osc2Detune: 8,
  osc2Fm: 75,
  noiseLevel: 0.06,
  granularDensity: 0.45,
  osc2Level: 0.60,

  filterModel: 'tbee303',
  filterCutoff: 680,
  filterRes: 13.5,
  filterEnvAmt: 4200,
  filterDrive: 0.55,
  acidAccent: 0.85,
  filterKeyTrack: 0.55,
  pedalModel: 'yellow_acid',

  envAttack: 0.006,
  envDecay: 0.26,
  envSustain: 0.18,
  envRelease: 0.18,

  lfoTarget: 'cutoff',
  lfoRate: 3.5,
  lfoDepth: 0.20,

  delayTime: 0.33,
  delayFeedback: 0.45,
  delayMix: 0.28,

  reverbSize: 2.4,
  reverbDamp: 5500,
  reverbMix: 0.26,

  chorusRate: 1.2,
  chorusDepth: 0.45,
  limiterDrive: 3.0,

  hybridMorph: 0.45,
  resonatorMix: 0.25,
  sidechainDepth: 0.40,

  macroAcid: 0.55,
  macroSpace: 0.40,
  macroGrit: 0.30,

  masterVol: 0.78,
  drumVol: 0.80,
};

export const DEFAULT_MOD_MATRIX: ModSlot[] = [
  { source: 'lfo1', dest: 'cutoff', amount: 0.25 },
  { source: 'accent', dest: 'cutoff', amount: 0.65 },
  { source: 'modwheel', dest: 'fm', amount: 0.45 },
  { source: 'velocity', dest: 'res', amount: 0.30 },
];

export const PRESETS: Record<string, PresetDef> = {
  cyber_acid: {
    name: '01. ACID REBIRTH 303 (Legato)',
    osc1Wave: 'tb_square',
    osc1Oct: -1,
    osc1Detune: 12,
    osc1Unison: 2,
    osc1Level: 0.88,
    osc2Wave: 'sawtooth',
    osc2Semi: 0,
    osc2Detune: 8,
    osc2Fm: 75,
    osc2Level: 0.60,
    filterModel: 'tbee303',
    filterCutoff: 680,
    filterRes: 13.5,
    filterEnvAmt: 4200,
    filterDrive: 0.55,
    acidAccent: 0.85,
    pedalModel: 'yellow_acid',
    envAttack: 0.006,
    envDecay: 0.26,
    envSustain: 0.18,
    envRelease: 0.18,
    delayMix: 0.28,
    reverbMix: 0.26,
    macroAcid: 0.55,
  },
  quantum_supersaw: {
    name: '02. HYPERION SUPERSAW LEAD',
    osc1Wave: 'sawtooth',
    osc1Oct: 0,
    osc1Detune: 34,
    osc1Unison: 5,
    osc1Level: 0.90,
    osc2Wave: 'sawtooth',
    osc2Semi: 12,
    osc2Detune: 26,
    osc2Fm: 20,
    osc2Level: 0.70,
    filterModel: 'lowpass',
    filterCutoff: 3400,
    filterRes: 3.2,
    filterEnvAmt: 2600,
    filterDrive: 0.25,
    acidAccent: 0.40,
    pedalModel: 'square_tube',
    envAttack: 0.015,
    envDecay: 0.45,
    envSustain: 0.65,
    envRelease: 0.45,
    delayMix: 0.38,
    reverbMix: 0.42,
    macroAcid: 0.30,
  },
  spectral_pad: {
    name: '03. NEBULA GRANULAR CLOUD',
    osc1Wave: 'spectral_harm',
    osc1Oct: 0,
    osc1Detune: 28,
    osc1Unison: 4,
    osc1Level: 0.80,
    osc2Wave: 'triangle',
    osc2Semi: 7,
    osc2Detune: 19,
    osc2Fm: 180,
    osc2Level: 0.65,
    filterModel: 'bandpass',
    filterCutoff: 1450,
    filterRes: 5.5,
    filterEnvAmt: 1800,
    filterDrive: 0.20,
    acidAccent: 0.30,
    pedalModel: 'bypass',
    envAttack: 0.45,
    envDecay: 1.2,
    envSustain: 0.78,
    envRelease: 1.4,
    delayMix: 0.48,
    reverbMix: 0.62,
    macroAcid: 0.20,
  },
  sub_reese: {
    name: '04. DARK MATTER FM REESE',
    osc1Wave: 'sawtooth',
    osc1Oct: -1,
    osc1Detune: 42,
    osc1Unison: 4,
    osc1Level: 0.92,
    osc2Wave: 'sine',
    osc2Semi: -12,
    osc2Detune: 15,
    osc2Fm: 340,
    osc2Level: 0.80,
    filterModel: 'lowpass',
    filterCutoff: 310,
    filterRes: 6.8,
    filterEnvAmt: 1100,
    filterDrive: 0.75,
    acidAccent: 0.55,
    pedalModel: 'fuzzy03',
    envAttack: 0.03,
    envDecay: 0.6,
    envSustain: 0.80,
    envRelease: 0.35,
    delayMix: 0.12,
    reverbMix: 0.18,
    macroAcid: 0.40,
  },
  psy_arp: {
    name: '05. GOA QUANTUM ARP 142',
    osc1Wave: 'sawtooth',
    osc1Oct: 0,
    osc1Detune: 14,
    osc1Unison: 2,
    osc1Level: 0.85,
    osc2Wave: 'tb_square',
    osc2Semi: 7,
    osc2Detune: 10,
    osc2Fm: 260,
    osc2Level: 0.60,
    filterModel: 'tbee303',
    filterCutoff: 680,
    filterRes: 13.0,
    filterEnvAmt: 5200,
    filterDrive: 0.55,
    acidAccent: 0.85,
    pedalModel: 'metallicon',
    envAttack: 0.004,
    envDecay: 0.16,
    envSustain: 0.08,
    envRelease: 0.12,
    delayMix: 0.44,
    reverbMix: 0.30,
    macroAcid: 0.75,
  },
  blade_brass: {
    name: '06. CYBERPUNK ANALOG BRASS',
    osc1Wave: 'sawtooth',
    osc1Oct: -1,
    osc1Detune: 24,
    osc1Unison: 4,
    osc1Level: 0.88,
    osc2Wave: 'sawtooth',
    osc2Semi: 0,
    osc2Detune: 20,
    osc2Fm: 50,
    osc2Level: 0.78,
    filterModel: 'lowpass',
    filterCutoff: 780,
    filterRes: 4.5,
    filterEnvAmt: 3900,
    filterDrive: 0.40,
    acidAccent: 0.50,
    pedalModel: 'square_tube',
    envAttack: 0.09,
    envDecay: 0.55,
    envSustain: 0.60,
    envRelease: 0.65,
    delayMix: 0.35,
    reverbMix: 0.52,
    macroAcid: 0.35,
  },
};

export const SCALES: Record<ScaleKey, number[]> = {
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function freqToNoteName(freq: number): string {
  if (!freq || freq < 20 || freq > 4500) return '--';
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${note}${oct}`;
}

export const MAX_SEQ_STEPS = 128;

export function createDefaultPattern(offset = 0): StepData[] {
  const baseNotes = [36, 36, 48, 37, 36, 43, 40, 36, 36, 48, 41, 37, 36, 48, 43, 40];
  const barShifts = [0, 0, 3, 5, 0, 2, 7, 5];
  const activeSteps = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15];
  const accentSteps = [0, 3, 6, 10, 14];
  const slideSteps = [2, 6, 10, 15];

  return Array.from({ length: MAX_SEQ_STEPS }, (_, i) => {
    const barIdx = Math.floor(i / 16);
    const localStep = i % 16;
    const barShift = barShifts[barIdx % 8] + offset;
    return {
      active: activeSteps.includes(localStep),
      note: baseNotes[localStep] + barShift,
      accent: accentSteps.includes(localStep),
      slide: slideSteps.includes(localStep),
    };
  });
}

export function createDrumLane(type: DrumTrackKey): number[] {
  return Array.from({ length: MAX_SEQ_STEPS }, (_, i) => {
    const s = i % 16;
    if (type === 'kick') return s % 4 === 0 || (i >= 112 && s === 14) ? 1 : 0;
    if (type === 'snare') return s % 8 === 4 ? 1 : 0;
    return s % 2 === 1 || (i >= 64 && s === 10) ? 1 : 0;
  });
}
