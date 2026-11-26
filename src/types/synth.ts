export type Osc1Wave =
  | 'tb_square'
  | 'hybrid_morph'
  | 'sawtooth'
  | 'square'
  | 'triangle'
  | 'spectral_harm';

export type Osc2Wave =
  | 'sawtooth'
  | 'hybrid_morph'
  | 'tb_square'
  | 'square'
  | 'triangle'
  | 'sine';

export type FilterModel =
  | 'tbee303'
  | 'lowpass'
  | 'bandpass'
  | 'highpass'
  | 'notch';

export type PedalModel =
  | 'yellow_acid'
  | 'fuzzy03'
  | 'square_tube'
  | 'metallicon'
  | 'bypass';

export type LfoTarget = 'cutoff' | 'pitch' | 'fm';

export type ModSource = 'lfo1' | 'accent' | 'modwheel' | 'velocity' | 'env';
export type ModDest = 'cutoff' | 'res' | 'fm' | 'detune';

export interface ModSlot {
  source: ModSource;
  dest: ModDest;
  amount: number;
}

export interface SynthParams {
  osc1Enabled: boolean;
  osc1Wave: Osc1Wave;
  osc1Oct: number;
  osc1Detune: number;
  osc1Unison: number;
  tbSquareMorph: number;
  osc1Level: number;

  osc2Enabled: boolean;
  osc2Wave: Osc2Wave;
  osc2Semi: number;
  osc2Detune: number;
  osc2Fm: number;
  noiseLevel: number;
  granularDensity: number;
  osc2Level: number;

  filterModel: FilterModel;
  filterCutoff: number;
  filterRes: number;
  filterEnvAmt: number;
  filterDrive: number;
  acidAccent: number;
  filterKeyTrack: number;
  pedalModel: PedalModel;

  envAttack: number;
  envDecay: number;
  envSustain: number;
  envRelease: number;

  lfoTarget: LfoTarget;
  lfoRate: number;
  lfoDepth: number;

  delayTime: number;
  delayFeedback: number;
  delayMix: number;

  reverbSize: number;
  reverbDamp: number;
  reverbMix: number;

  chorusRate: number;
  chorusDepth: number;
  limiterDrive: number;

  hybridMorph: number;
  resonatorMix: number;
  sidechainDepth: number;

  macroAcid: number;
  macroSpace: number;
  macroGrit: number;

  masterVol: number;
  drumVol: number;
}

export interface PresetDef extends Partial<SynthParams> {
  name: string;
}

export interface StepData {
  active: boolean;
  note: number;
  accent: boolean;
  slide: boolean;
}

export interface DrumPatterns {
  kick: number[];
  snare: number[];
  hat: number[];
}

export type DrumTrackKey = keyof DrumPatterns;

export type ScaleKey = 'phrygian' | 'minor' | 'dorian' | 'hirajoshi' | 'chromatic';
export type ChordMode = 'off' | 'octave' | 'fifth' | 'minor7' | 'supersaw';
export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random';
export type SkinId = 'default' | 'acid' | 'crimson' | 'titanium';
export type ScopeMode = 'wave' | 'fft' | 'hybrid';
export type DimMode = '3D' | '4D' | '5D';
export type WorkstationTabId =
  | 'seqTab'
  | 'drumTab'
  | 'modTab'
  | 'fxTab'
  | 'arpTab'
  | 'soundsIdTab';

export interface SoundsIdResult {
  freq: number;
  note: string;
  centroid: number;
  timbre: string;
  presetKey: string;
  presetName: string;
  confidence: number;
  time?: string;
}
