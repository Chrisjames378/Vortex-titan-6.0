import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VortexTitanEngine } from './audio/VortexTitanEngine';
import { MorphPad5D } from './components/MorphPad5D';
import { PianoKeybed } from './components/PianoKeybed';
import { RotaryKnob } from './components/RotaryKnob';
import { VisualizerHeader } from './components/VisualizerHeader';
import { WorkstationTabs } from './components/WorkstationTabs';
import {
  DEFAULT_MOD_MATRIX,
  DEFAULT_PARAMS,
  MAX_SEQ_STEPS,
  PRESETS,
  SCALES,
  createDefaultPattern,
  createDrumLane,
} from './data/presets';
import {
  ArpMode,
  ChordMode,
  DimMode,
  DrumPatterns,
  DrumTrackKey,
  FilterModel,
  LfoTarget,
  ModSlot,
  Osc1Wave,
  Osc2Wave,
  PedalModel,
  ScaleKey,
  ScopeMode,
  SkinId,
  SoundsIdResult,
  StepData,
  SynthParams,
  WorkstationTabId,
} from './types/synth';
import { exportPatternToMidi } from './utils/midiExport';

const KEYBOARD_MAP: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
};

const DIM_MODES: DimMode[] = ['3D', '4D', '5D'];

export default function App() {
  const engineRef = useRef<VortexTitanEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new VortexTitanEngine();
  }
  const synth = engineRef.current;

  const [audioIgnited, setAudioIgnited] = useState(false);
  const [params, setParams] = useState<SynthParams>(() => ({ ...DEFAULT_PARAMS }));
  const [modMatrix, setModMatrix] = useState<ModSlot[]>(() =>
    DEFAULT_MOD_MATRIX.map((m) => ({ ...m }))
  );

  const [presetKey, setPresetKey] = useState<string>('cyber_acid');
  const [skin, setSkin] = useState<SkinId>('default');
  const [statusToast, setStatusToast] = useState<string>('Ready');

  const [bpm, setBpm] = useState<number>(136);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecordingWav, setIsRecordingWav] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [midiStatus, setMidiStatus] = useState<string>('MIDI: Scanning');
  const [midiConnected, setMidiConnected] = useState<boolean>(false);

  const [scopeMode, setScopeMode] = useState<ScopeMode>('hybrid');
  const [monoLegato, setMonoLegato] = useState<boolean>(true);
  const [granularEnabled, setGranularEnabled] = useState<boolean>(false);

  const [xyState, setXyState] = useState({ x: 0.5, y: 0.5, z: 0.5, hyper: 0.5 });
  const [dimIdx, setDimIdx] = useState<number>(2);
  const [springMode, setSpringMode] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<WorkstationTabId>('seqTab');
  const [patternBanks, setPatternBanks] = useState<StepData[][]>(() => [
    createDefaultPattern(0),
    createDefaultPattern(2),
    createDefaultPattern(5),
    createDefaultPattern(-2),
  ]);
  const [currentPatternIdx, setCurrentPatternIdx] = useState<number>(0);
  const [chainMode, setChainMode] = useState<boolean>(false);
  const [activeSeqLength, setActiveSeqLength] = useState<number>(128);
  const [scaleKey, setScaleKey] = useState<ScaleKey>('phrygian');
  const [swing, setSwing] = useState<number>(0.12);
  const [currentStep, setCurrentStep] = useState<number>(-1);

  const [drumsEnabled, setDrumsEnabled] = useState<boolean>(true);
  const [drumPatterns, setDrumPatterns] = useState<DrumPatterns>(() => ({
    kick: createDrumLane('kick'),
    snare: createDrumLane('snare'),
    hat: createDrumLane('hat'),
  }));

  const [chordMode, setChordMode] = useState<ChordMode>('off');
  const [arpMode, setArpMode] = useState<ArpMode>('off');

  const [baseOctave, setBaseOctave] = useState<number>(3);
  const [pitchBend, setPitchBend] = useState<number>(0);
  const [modWheel, setModWheel] = useState<number>(0.2);
  const [heldKeys, setHeldKeys] = useState<Set<number>>(() => new Set());

  const [latestSoundsId, setLatestSoundsId] = useState<SoundsIdResult | null>(null);
  const [sidHistory, setSidHistory] = useState<SoundsIdResult[]>([]);
  const [autoTrackSid, setAutoTrackSid] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Live refs for sequencer, arpeggiator, and MIDI callbacks
  const seqStateRef = useRef({
    isPlaying: false,
    bpm: 136,
    swing: 0.12,
    activeSeqLength: 128,
    chainMode: false,
    currentPatternIdx: 0,
    drumsEnabled: true,
    patternBanks,
    drumPatterns,
    currentStep: -1,
  });
  seqStateRef.current = {
    isPlaying,
    bpm,
    swing,
    activeSeqLength,
    chainMode,
    currentPatternIdx,
    drumsEnabled,
    patternBanks,
    drumPatterns,
    currentStep,
  };

  const seqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arpIndexRef = useRef<number>(0);
  const heldKeysRef = useRef<Set<number>>(heldKeys);
  heldKeysRef.current = heldKeys;
  const arpModeRef = useRef<ArpMode>(arpMode);
  arpModeRef.current = arpMode;
  const baseOctaveRef = useRef<number>(baseOctave);
  baseOctaveRef.current = baseOctave;

  const igniteAudio = useCallback(() => {
    synth.initAudio(() => setAudioIgnited(true));
  }, [synth]);

  // Apply skin class to document.body
  useEffect(() => {
    document.body.classList.remove('skin-acid', 'skin-crimson', 'skin-titanium');
    if (skin !== 'default') {
      document.body.classList.add(`skin-${skin}`);
    }
  }, [skin]);

  // Sync synth params helper
  const handleParamChange = useCallback(
    (param: keyof SynthParams, value: number) => {
      synth.params[param] = value as never;
      setParams((prev) => ({ ...prev, [param]: value }));
      synth.updateLiveEffects();
    },
    [synth]
  );

  const handleSelectChange = useCallback(
    <K extends keyof SynthParams>(param: K, value: SynthParams[K]) => {
      synth.params[param] = value;
      setParams((prev) => ({ ...prev, [param]: value }));
      synth.updateLiveEffects();
    },
    [synth]
  );

  const applyPreset = useCallback(
    (key: string) => {
      const p = PRESETS[key];
      if (!p) return;
      Object.assign(synth.params, p);
      setParams({ ...synth.params });
      setPresetKey(key);
      synth.updateLiveEffects();
      setStatusToast(`Loaded: ${p.name}`);
    },
    [synth]
  );

  const handleRandomizePatch = () => {
    igniteAudio();
    const waves1: Osc1Wave[] = [
      'sawtooth',
      'tb_square',
      'hybrid_morph',
      'square',
      'triangle',
      'spectral_harm',
    ];
    const waves2: Osc2Wave[] = [
      'sawtooth',
      'tb_square',
      'hybrid_morph',
      'square',
      'triangle',
      'sine',
    ];
    const filters: FilterModel[] = ['tbee303', 'lowpass', 'bandpass', 'highpass'];
    const pedals: PedalModel[] = ['yellow_acid', 'fuzzy03', 'square_tube', 'metallicon'];

    const patch: Partial<SynthParams> = {
      osc1Wave: waves1[Math.floor(Math.random() * waves1.length)],
      osc2Wave: waves2[Math.floor(Math.random() * waves2.length)],
      osc1Detune: Math.round(Math.random() * 42),
      osc2Fm: Math.round(Math.random() * 350),
      filterModel: filters[Math.floor(Math.random() * filters.length)],
      filterCutoff: Math.round(180 + Math.random() * 4800),
      filterRes: +(1 + Math.random() * 17).toFixed(1),
      filterEnvAmt: Math.round(500 + Math.random() * 5500),
      pedalModel: pedals[Math.floor(Math.random() * pedals.length)],
      envDecay: +(0.08 + Math.random() * 0.9).toFixed(2),
      delayMix: +(Math.random() * 0.5).toFixed(2),
      reverbMix: +(Math.random() * 0.55).toFixed(2),
    };

    Object.assign(synth.params, patch);
    setParams({ ...synth.params });
    synth.updateLiveEffects();
    setStatusToast('Dice generated new patch');
  };

  const handleXYUpdate = useCallback(
    (next: { x: number; y: number; z: number; hyper: number }) => {
      setXyState(next);
      const activeDim = DIM_MODES[dimIdx];
      const invY = 1 - next.y;

      const updates: Partial<SynthParams> = {
        filterCutoff: Math.round(120 + next.x * 8380),
        filterRes: +(1.5 + invY * 18.5).toFixed(1),
        macroSpace: +invY.toFixed(2),
        hybridMorph: +next.z.toFixed(2),
        resonatorMix: +(next.z * 0.85).toFixed(2),
      };

      if (activeDim === '4D' || activeDim === '5D') {
        updates.sidechainDepth = +next.hyper.toFixed(2);
      }
      if (activeDim === '5D') {
        updates.osc2Fm = Math.round(next.hyper * 420);
        updates.macroGrit = +(next.hyper * 0.75).toFixed(2);
      }

      Object.assign(synth.params, updates);
      setParams({ ...synth.params });
      synth.updateLiveEffects();
    },
    [dimIdx, synth]
  );

  // Arpeggiator
  const startArpeggiator = useCallback(() => {
    if (arpTimerRef.current) return;
    const stepArp = () => {
      const activeHeld = heldKeysRef.current;
      if (activeHeld.size === 0 || arpModeRef.current === 'off') {
        if (arpTimerRef.current) {
          clearInterval(arpTimerRef.current);
          arpTimerRef.current = null;
        }
        return;
      }
      const notes = Array.from(activeHeld).sort((a, b) => a - b);
      const mode = arpModeRef.current;
      let noteToPlay = notes[0];
      const idx = arpIndexRef.current;

      if (mode === 'up') {
        noteToPlay = notes[idx % notes.length];
      } else if (mode === 'down') {
        noteToPlay = notes[notes.length - 1 - (idx % notes.length)];
      } else if (mode === 'updown') {
        const seq = notes.length > 1 ? [...notes, ...notes.slice(1, -1).reverse()] : notes;
        noteToPlay = seq[idx % seq.length];
      } else {
        noteToPlay = notes[Math.floor(Math.random() * notes.length)];
      }

      arpIndexRef.current += 1;
      synth.noteOn(noteToPlay, 0.85, arpIndexRef.current % 4 === 1, false, () =>
        setAudioIgnited(true)
      );
      setTimeout(() => synth.noteOff(noteToPlay), 110);
    };

    stepArp();
    arpTimerRef.current = setInterval(stepArp, 135);
  }, [synth]);

  const triggerKeyDown = useCallback(
    (midi: number) => {
      if (heldKeysRef.current.has(midi)) return;
      const next = new Set(heldKeysRef.current);
      next.add(midi);
      heldKeysRef.current = next;
      setHeldKeys(next);

      if (arpModeRef.current === 'off') {
        synth.noteOn(midi, 0.88, false, next.size > 1, () => setAudioIgnited(true));
      } else {
        startArpeggiator();
      }
    },
    [startArpeggiator, synth]
  );

  const triggerKeyUp = useCallback(
    (midi: number) => {
      if (!heldKeysRef.current.has(midi)) return;
      const next = new Set(heldKeysRef.current);
      next.delete(midi);
      heldKeysRef.current = next;
      setHeldKeys(next);

      if (arpModeRef.current === 'off') {
        synth.noteOff(midi);
      }
    },
    [synth]
  );

  // Sequencer loop
  const tickSequencer = useCallback(() => {
    const st = seqStateRef.current;
    if (!st.isPlaying) return;

    const clampedBpm = Math.max(60, Math.min(220, st.bpm || 136));
    const baseStepMs = (60 / clampedBpm / 4) * 1000;

    let nextStep = (st.currentStep + 1) % st.activeSeqLength;
    let activeBankIdx = st.currentPatternIdx;

    if (nextStep === 0 && st.currentStep !== -1 && st.chainMode) {
      activeBankIdx = (activeBankIdx + 1) % 4;
      seqStateRef.current.currentPatternIdx = activeBankIdx;
      setCurrentPatternIdx(activeBankIdx);
    }

    seqStateRef.current.currentStep = nextStep;
    setCurrentStep(nextStep);

    const stepData = st.patternBanks[activeBankIdx]?.[nextStep];
    if (stepData && stepData.active) {
      synth.noteOn(
        stepData.note,
        stepData.accent ? 1.0 : 0.78,
        stepData.accent,
        stepData.slide,
        () => setAudioIgnited(true)
      );
      const gateLength = stepData.slide ? baseStepMs * 1.18 : baseStepMs * 0.62;
      setTimeout(() => {
        synth.noteOff(stepData.note);
      }, gateLength);
    }

    if (st.drumsEnabled) {
      if (st.drumPatterns.kick[nextStep]) synth.triggerDrum('kick', nextStep % 4 === 0);
      if (st.drumPatterns.snare[nextStep]) synth.triggerDrum('snare', true);
      if (st.drumPatterns.hat[nextStep]) synth.triggerDrum('hat', nextStep % 4 === 2);
    }

    const swingOffset =
      nextStep % 2 === 1 ? baseStepMs * st.swing : -baseStepMs * st.swing * 0.5;
    seqTimerRef.current = setTimeout(tickSequencer, Math.max(40, baseStepMs + swingOffset));
  }, [synth]);

  const toggleSequencer = useCallback(() => {
    igniteAudio();
    if (!seqStateRef.current.isPlaying) {
      seqStateRef.current.isPlaying = true;
      seqStateRef.current.currentStep = -1;
      setIsPlaying(true);
      setCurrentStep(-1);
      tickSequencer();
    } else {
      seqStateRef.current.isPlaying = false;
      setIsPlaying(false);
      setCurrentStep(-1);
      if (seqTimerRef.current) {
        clearTimeout(seqTimerRef.current);
        seqTimerRef.current = null;
      }
      synth.panic();
    }
  }, [igniteAudio, synth, tickSequencer]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (seqTimerRef.current) clearTimeout(seqTimerRef.current);
      if (arpTimerRef.current) clearInterval(arpTimerRef.current);
      synth.panic();
    };
  }, [synth]);

  // Computer keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.repeat ||
        (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT'))
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        toggleSequencer();
        return;
      }
      if (KEYBOARD_MAP[key] !== undefined) {
        const midi = (baseOctaveRef.current + 1) * 12 + KEYBOARD_MAP[key];
        triggerKeyDown(midi);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEYBOARD_MAP[key] !== undefined) {
        const midi = (baseOctaveRef.current + 1) * 12 + KEYBOARD_MAP[key];
        triggerKeyUp(midi);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [toggleSequencer, triggerKeyDown, triggerKeyUp]);

  // Web MIDI scan
  const scanWebMidi = useCallback(() => {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<MIDIAccess>;
    };
    if (!nav.requestMIDIAccess) {
      setMidiStatus('MIDI: Unavailable');
      setMidiConnected(false);
      return;
    }

    nav
      .requestMIDIAccess()
      .then((midiAccess) => {
        const updateDevices = () => {
          const inputs = Array.from(midiAccess.inputs.values());
          if (inputs.length > 0) {
            setMidiStatus(`MIDI/MPE: ${(inputs[0].name || 'Device').slice(0, 14).toUpperCase()}`);
            setMidiConnected(true);
            inputs.forEach((input) => {
              input.onmidimessage = (msg) => {
                if (!msg.data) return;
                const [status, data1, data2] = msg.data;
                const cmd = status & 0xf0;
                if (cmd === 0x90 && data2 > 0) {
                  synth.noteOn(data1, data2 / 127, data2 > 112, false, () =>
                    setAudioIgnited(true)
                  );
                  const next = new Set(heldKeysRef.current);
                  next.add(data1);
                  setHeldKeys(next);
                } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
                  synth.noteOff(data1);
                  const next = new Set(heldKeysRef.current);
                  next.delete(data1);
                  setHeldKeys(next);
                } else if (cmd === 0xe0) {
                  const bend = ((data2 << 7) | data1) - 8192;
                  const bVal = (bend / 8192) * 2;
                  synth.pitchBend = bVal;
                  setPitchBend(bVal);
                } else if (cmd === 0xb0 && data1 === 1) {
                  const mVal = data2 / 127;
                  synth.modWheelVal = mVal;
                  setModWheel(mVal);
                }
              };
            });
          } else {
            setMidiStatus('MIDI: No Hardware');
            setMidiConnected(false);
          }
        };
        updateDevices();
        midiAccess.onstatechange = updateDevices;
      })
      .catch(() => {
        setMidiStatus('MIDI: Blocked');
        setMidiConnected(false);
      });
  }, [synth]);

  useEffect(() => {
    scanWebMidi();
  }, [scanWebMidi]);

  const handleToggleMic = async () => {
    const res = await synth.toggleMicInput();
    setAudioIgnited(true);
    setMicActive(res.active);
    setStatusToast(res.message);
  };

  const handleToggleWavRecording = () => {
    igniteAudio();
    if (!isRecordingWav) {
      if (typeof MediaRecorder === 'undefined' || !synth.ctx || !synth.compressor) {
        setStatusToast('Audio recorder unsupported in this browser');
        return;
      }
      const dest = synth.ctx.createMediaStreamDestination();
      synth.compressor.connect(dest);
      const recorder = new MediaRecorder(dest.stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VortexTitan_Session_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setStatusToast('Audio capture downloaded');
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingWav(true);
      setStatusToast('Recording stereo audio stream...');
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecordingWav(false);
    }
  };

  const handleExportPatch = () => {
    const patchData = {
      version: '6.0',
      params,
      modMatrix,
      pattern: patternBanks[currentPatternIdx],
    };
    const blob = new Blob([JSON.stringify(patchData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VortexTitan6_Patch_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusToast('Patch saved as JSON');
  };

  const handleImportPatchFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result || '{}'));
        if (data.params) {
          Object.assign(synth.params, data.params);
          setParams({ ...synth.params });
        }
        if (Array.isArray(data.modMatrix)) {
          synth.modMatrix = data.modMatrix;
          setModMatrix(data.modMatrix);
        }
        if (Array.isArray(data.pattern)) {
          setPatternBanks((prev) => {
            const copy = [...prev];
            copy[currentPatternIdx] = data.pattern;
            return copy;
          });
        }
        synth.updateLiveEffects();
        setStatusToast('Custom JSON patch loaded');
      } catch {
        setStatusToast('Invalid patch JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleScanSoundsId = () => {
    igniteAudio();
    const buf = new Uint8Array(1024);
    const result = synth.analyzeSoundsId(buf);
    const stamped = { ...result, time: new Date().toLocaleTimeString() };
    setLatestSoundsId(stamped);
    setSidHistory((prev) => [stamped, ...prev].slice(0, 15));
    setStatusToast(`Sounds ID: ${result.presetName} (${result.confidence}%)`);
  };

  const presetKeys = Object.keys(PRESETS);

  return (
    <div className="min-h-screen p-2 sm:p-4 lg:p-5 flex flex-col items-center justify-center">
      <div className="synth-chassis w-full max-w-[1480px] rounded-2xl p-3 sm:p-5 flex flex-col gap-4">
        {/* TOP MASTER HEADER & PRESET / TRANSPORT BAR */}
        <header className="module-panel rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <span className="font-display-tech font-bold text-slate-950 text-base">VT6</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display-tech text-base sm:text-lg font-bold tracking-wider text-white whitespace-nowrap">
                  VORTEX TITAN <span className="text-cyan-400">6.0</span>
                </h1>
                <button
                  type="button"
                  onClick={scanWebMidi}
                  className={`px-2.5 py-0.5 text-[10px] font-mono-tech font-bold rounded-md border cursor-pointer transition whitespace-nowrap ${
                    midiConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title="Scan Web MIDI / MPE devices"
                >
                  {midiStatus}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('soundsIdTab');
                    handleScanSoundsId();
                  }}
                  className="px-2.5 py-0.5 text-[10px] font-mono-tech font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-md cursor-pointer transition whitespace-nowrap"
                  title="Open Sounds ID Acoustic & Patch Identifier"
                >
                  Sounds ID
                </button>
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`px-2.5 py-0.5 text-[10px] font-mono-tech font-bold rounded-md border cursor-pointer transition whitespace-nowrap ${
                    micActive
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  }`}
                  title="Toggle Live Mic / External Audio Analysis for Sounds ID"
                >
                  {micActive ? 'MIC ID: LIVE' : 'MIC ID: OFF'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hybrid Morph · String Resonator · Kick Sidechain · 3D–5D XY&amp;Z Pad · 128-Step 303 &amp; 909 · Sounds ID
              </p>
            </div>
          </div>

          {/* Preset Selector, Skin Theme & Patch JSON I/O */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                const idx =
                  (presetKeys.indexOf(presetKey) - 1 + presetKeys.length) % presetKeys.length;
                applyPreset(presetKeys[idx]);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              title="Previous Preset"
            >
              ◀
            </button>
            <select
              value={presetKey}
              onChange={(e) => applyPreset(e.target.value)}
              className="bg-slate-900 text-cyan-300 font-mono-tech text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400 min-w-[190px]"
            >
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const idx = (presetKeys.indexOf(presetKey) + 1) % presetKeys.length;
                applyPreset(presetKeys[idx]);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              title="Next Preset"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={handleRandomizePatch}
              className="px-2.5 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold transition whitespace-nowrap"
              title="Auto-Dice Patch Generator"
            >
              DICE
            </button>
            <button
              type="button"
              onClick={handleExportPatch}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-mono-tech font-bold whitespace-nowrap"
              title="Save Patch as JSON"
            >
              SAVE
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono-tech font-bold whitespace-nowrap"
              title="Load Patch JSON"
            >
              LOAD
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportPatchFile}
              className="hidden"
            />
            <select
              value={skin}
              onChange={(e) => {
                const nextSkin = e.target.value as SkinId;
                setSkin(nextSkin);
                setStatusToast(`Theme applied: ${nextSkin.toUpperCase()}`);
              }}
              className="bg-slate-900 text-amber-300 font-mono-tech text-[11px] px-2 py-1.5 rounded-lg border border-slate-700"
              title="Custom Hardware Skin"
            >
              <option value="default">SKIN: CYBER CYAN</option>
              <option value="acid">SKIN: ACID VOLT</option>
              <option value="crimson">SKIN: CRIMSON ANALOG</option>
              <option value="titanium">SKIN: TITANIUM</option>
            </select>
          </div>

          {/* Master Transport, Audio Recorder, BPM & Master Volume */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase">BPM</span>
              <input
                type="number"
                min={60}
                max={220}
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10) || 136)}
                className="w-12 bg-transparent text-amber-400 font-mono-tech font-bold text-sm text-center focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={toggleSequencer}
              className={`px-3.5 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap ${
                isPlaying
                  ? 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
              }`}
            >
              <span>{isPlaying ? '■' : '▶'}</span>
              <span>{isPlaying ? 'STOP' : 'PLAY'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleWavRecording}
              className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap ${
                isRecordingWav
                  ? 'bg-rose-500/25 text-rose-300 border-rose-500/50'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
              }`}
              title="Record Stereo Audio"
            >
              <span>{isRecordingWav ? '● STOP REC' : 'REC AUDIO'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                synth.panic();
                setHeldKeys(new Set());
                setStatusToast('All notes off (Panic)');
              }}
              className="px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs transition whitespace-nowrap"
              title="All Notes Off"
            >
              PANIC
            </button>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-cyan-400">VOL</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={params.masterVol}
                onChange={(e) => handleParamChange('masterVol', parseFloat(e.target.value))}
                className="synth-slider w-16"
                aria-label="Master Volume"
              />
            </div>
          </div>
        </header>

        {/* ROW 2: OSCILLOSCOPE / FFT + MACROS & 3D–5D XY&Z MORPH PAD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <VisualizerHeader
            engine={synth}
            audioIgnited={audioIgnited}
            scopeMode={scopeMode}
            onScopeModeChange={setScopeMode}
            onIgniteAudio={() => {
              igniteAudio();
              synth.noteOn(48, 0.7, false, false, () => setAudioIgnited(true));
              setTimeout(() => synth.noteOff(48), 240);
            }}
            latestSoundsId={latestSoundsId}
            autoTrackSid={autoTrackSid}
            onSoundsIdSample={(res) => setLatestSoundsId(res)}
          />

          <div className="lg:col-span-7 module-panel rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-200">
                Performance Macros &amp; Superintendent Hybrid
              </span>
              <span className="text-[11px] font-mono-tech text-cyan-300 truncate max-w-[260px]">
                {statusToast}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              <RotaryKnob
                label="ACID SCREAM"
                param="macroAcid"
                value={params.macroAcid}
                min={0}
                max={1}
                defaultValue={0.55}
                accent="amber"
                labelClassName="text-[10px] font-bold text-amber-300 mt-1"
                valueClassName="text-[10px] font-mono-tech text-slate-400"
                containerClassName="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="Q4NTUM SPACE"
                param="macroSpace"
                value={params.macroSpace}
                min={0}
                max={1}
                defaultValue={0.4}
                labelClassName="text-[10px] font-bold text-cyan-300 mt-1"
                valueClassName="text-[10px] font-mono-tech text-slate-400"
                containerClassName="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="PEDAL CRUSH"
                param="macroGrit"
                value={params.macroGrit}
                min={0}
                max={1}
                defaultValue={0.3}
                accent="magenta"
                labelClassName="text-[10px] font-bold text-fuchsia-300 mt-1"
                valueClassName="text-[10px] font-mono-tech text-slate-400"
                containerClassName="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="HYBRID MORPH"
                param="hybridMorph"
                value={params.hybridMorph}
                min={0}
                max={1}
                defaultValue={0.45}
                accent="acid"
                labelClassName="text-[10px] font-bold text-emerald-300 mt-1"
                valueClassName="text-[10px] font-mono-tech text-slate-400"
                containerClassName="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="RESONATOR"
                param="resonatorMix"
                value={params.resonatorMix}
                min={0}
                max={1}
                defaultValue={0.25}
                labelClassName="text-[10px] font-bold text-sky-300 mt-1"
                valueClassName="text-[10px] font-mono-tech text-slate-400"
                containerClassName="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="SIDECHAIN DUCK"
                param="sidechainDepth"
                value={params.sidechainDepth}
                min={0}
                max={1}
                defaultValue={0.4}
                accent="amber"
                labelClassName="text-[10px] font-bold text-amber-300 mt-1"
                valueClassName="text-[10px] font-mono-tech text-slate-400"
                containerClassName="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80"
                onChange={handleParamChange}
              />
            </div>

            <MorphPad5D
              x={xyState.x}
              y={xyState.y}
              z={xyState.z}
              hyper={xyState.hyper}
              dimMode={DIM_MODES[dimIdx]}
              springMode={springMode}
              onUpdate={handleXYUpdate}
              onCycleDim={() => {
                const next = (dimIdx + 1) % DIM_MODES.length;
                setDimIdx(next);
                setStatusToast(`Pad dimensionality set to ${DIM_MODES[next]}`);
              }}
              onToggleSpring={() => setSpringMode((prev) => !prev)}
              onIgniteAudio={igniteAudio}
            />
          </div>
        </div>

        {/* ROW 3: OSCILLATORS + T-BEE 303 FILTER + ENVELOPES & LFO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Multi-Engine Oscillator Bank */}
          <div className="lg:col-span-5 module-panel rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Multi-Engine Oscillator Bank
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !monoLegato;
                    synth.monoLegato = next;
                    synth.panic();
                    setMonoLegato(next);
                  }}
                  className={`px-2 py-0.5 rounded font-mono-tech text-[10px] font-bold border whitespace-nowrap ${
                    monoLegato
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}
                >
                  {monoLegato ? 'MODE: MONO LEGATO' : 'MODE: POLY 16'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    igniteAudio();
                    const next = !granularEnabled;
                    synth.granularEnabled = next;
                    setGranularEnabled(next);
                  }}
                  className={`px-2 py-0.5 rounded font-mono-tech text-[10px] font-bold border whitespace-nowrap ${
                    granularEnabled
                      ? 'bg-fuchsia-500 text-slate-950 border-fuchsia-400'
                      : 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40'
                  }`}
                >
                  {granularEnabled ? 'GRANULAR: ON' : 'GRANULAR: OFF'}
                </button>
              </div>
            </div>

            {/* OSC 1 */}
            <div className="bg-slate-950/75 rounded-xl p-2.5 border border-slate-800/90 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectChange('osc1Enabled', !params.osc1Enabled)
                    }
                    className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                      params.osc1Enabled
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    OSC 1
                  </button>
                  <select
                    value={params.osc1Wave}
                    onChange={(e) =>
                      handleSelectChange('osc1Wave', e.target.value as Osc1Wave)
                    }
                    className="bg-slate-900 text-slate-200 text-xs font-mono-tech px-2 py-1 rounded border border-slate-700"
                  >
                    <option value="tb_square">TB-303 Diode Square</option>
                    <option value="hybrid_morph">Superintendent Hybrid Morph</option>
                    <option value="sawtooth">Super Sawtooth</option>
                    <option value="square">Hollow Square</option>
                    <option value="triangle">Pure Triangle</option>
                    <option value="spectral_harm">Spectral Harmonic</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono-tech">
                  <span className="text-slate-400">OCT</span>
                  <select
                    value={params.osc1Oct}
                    onChange={(e) =>
                      handleSelectChange('osc1Oct', parseInt(e.target.value, 10))
                    }
                    className="bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700"
                  >
                    <option value={-2}>-2</option>
                    <option value={-1}>-1</option>
                    <option value={0}>0</option>
                    <option value={1}>+1</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1">
                <RotaryKnob
                  label="DETUNE"
                  param="osc1Detune"
                  value={params.osc1Detune}
                  min={0}
                  max={50}
                  defaultValue={12}
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="VOICES"
                  param="osc1Unison"
                  value={params.osc1Unison}
                  min={1}
                  max={5}
                  step={1}
                  defaultValue={2}
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="TB-MORPH"
                  param="tbSquareMorph"
                  value={params.tbSquareMorph}
                  min={0}
                  max={1}
                  defaultValue={0.72}
                  accent="acid"
                  labelClassName="text-[10px] text-emerald-400"
                  valueClassName="text-[10px] font-mono-tech text-emerald-300"
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="LEVEL"
                  param="osc1Level"
                  value={params.osc1Level}
                  min={0}
                  max={1}
                  defaultValue={0.88}
                  onChange={handleParamChange}
                />
              </div>
            </div>

            {/* OSC 2 */}
            <div className="bg-slate-950/75 rounded-xl p-2.5 border border-slate-800/90 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectChange('osc2Enabled', !params.osc2Enabled)
                    }
                    className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                      params.osc2Enabled
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    OSC 2
                  </button>
                  <select
                    value={params.osc2Wave}
                    onChange={(e) =>
                      handleSelectChange('osc2Wave', e.target.value as Osc2Wave)
                    }
                    className="bg-slate-900 text-slate-200 text-xs font-mono-tech px-2 py-1 rounded border border-slate-700"
                  >
                    <option value="sawtooth">Analog Sawtooth</option>
                    <option value="hybrid_morph">Superintendent Hybrid Morph</option>
                    <option value="tb_square">TB-303 Diode Square</option>
                    <option value="square">Pulse Width 25%</option>
                    <option value="triangle">Sub Triangle</option>
                    <option value="sine">FM Sine Carrier</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono-tech">
                  <span className="text-slate-400">SEMI</span>
                  <select
                    value={params.osc2Semi}
                    onChange={(e) =>
                      handleSelectChange('osc2Semi', parseInt(e.target.value, 10))
                    }
                    className="bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700"
                  >
                    <option value={-12}>-12</option>
                    <option value={-5}>-5</option>
                    <option value={0}>0</option>
                    <option value={7}>+7 (5th)</option>
                    <option value={12}>+12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5 pt-1">
                <RotaryKnob
                  label="FINE"
                  param="osc2Detune"
                  value={params.osc2Detune}
                  min={0}
                  max={50}
                  defaultValue={8}
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="FM AMT"
                  param="osc2Fm"
                  value={params.osc2Fm}
                  min={0}
                  max={600}
                  defaultValue={75}
                  accent="magenta"
                  labelClassName="text-[10px] text-fuchsia-400"
                  valueClassName="text-[10px] font-mono-tech text-fuchsia-300"
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="X-NOISE"
                  param="noiseLevel"
                  value={params.noiseLevel}
                  min={0}
                  max={0.5}
                  defaultValue={0.06}
                  accent="amber"
                  labelClassName="text-[10px] text-amber-400"
                  valueClassName="text-[10px] font-mono-tech text-amber-300"
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="GRAINS"
                  param="granularDensity"
                  value={params.granularDensity}
                  min={0}
                  max={1}
                  defaultValue={0.45}
                  accent="magenta"
                  labelClassName="text-[10px] text-fuchsia-400"
                  valueClassName="text-[10px] font-mono-tech text-fuchsia-300"
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="LEVEL"
                  param="osc2Level"
                  value={params.osc2Level}
                  min={0}
                  max={1}
                  defaultValue={0.60}
                  onChange={handleParamChange}
                />
              </div>
            </div>
          </div>

          {/* T-Bee Vint 303 & Spectral Filter */}
          <div className="lg:col-span-4 module-panel rounded-xl p-3.5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
                T-Bee Vint 303 &amp; Spectral Filter
              </h2>
              <select
                value={params.filterModel}
                onChange={(e) =>
                  handleSelectChange('filterModel', e.target.value as FilterModel)
                }
                className="bg-slate-900 text-emerald-300 font-mono-tech text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-500/40"
              >
                <option value="tbee303">T-BEE VINT 303 (24dB Acid)</option>
                <option value="lowpass">LADDER LP 24dB</option>
                <option value="bandpass">COMPUTER COMB BP</option>
                <option value="highpass">DIFFUSE CLOUD HP</option>
                <option value="notch">VOWEL FORMANT NOTCH</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2.5 bg-slate-950/75 p-3 rounded-xl border border-slate-800/90">
              <RotaryKnob
                label="CUTOFF"
                param="filterCutoff"
                value={params.filterCutoff}
                min={40}
                max={16000}
                defaultValue={680}
                accent="acid"
                labelClassName="text-[10px] font-bold text-emerald-300"
                valueClassName="text-[10px] font-mono-tech text-slate-300"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="RESONANCE"
                param="filterRes"
                value={params.filterRes}
                min={0.5}
                max={24}
                defaultValue={13.5}
                accent="acid"
                labelClassName="text-[10px] font-bold text-emerald-300"
                valueClassName="text-[10px] font-mono-tech text-slate-300"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="ENV MOD"
                param="filterEnvAmt"
                value={params.filterEnvAmt}
                min={0}
                max={8000}
                defaultValue={4200}
                accent="amber"
                labelClassName="text-[10px] font-bold text-amber-300"
                valueClassName="text-[10px] font-mono-tech text-slate-300"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="303 DRIVE"
                param="filterDrive"
                value={params.filterDrive}
                min={0}
                max={1}
                defaultValue={0.55}
                accent="magenta"
                labelClassName="text-[10px] font-bold text-fuchsia-300"
                valueClassName="text-[10px] font-mono-tech text-slate-300"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="ACCENT"
                param="acidAccent"
                value={params.acidAccent}
                min={0}
                max={1}
                defaultValue={0.85}
                accent="acid"
                labelClassName="text-[10px] font-bold text-emerald-300"
                valueClassName="text-[10px] font-mono-tech text-slate-300"
                onChange={handleParamChange}
              />
              <RotaryKnob
                label="KEYTRACK"
                param="filterKeyTrack"
                value={params.filterKeyTrack}
                min={0}
                max={1}
                defaultValue={0.55}
                labelClassName="text-[10px] font-bold text-cyan-300"
                valueClassName="text-[10px] font-mono-tech text-slate-300"
                onChange={handleParamChange}
              />
            </div>

            <div className="flex items-center justify-between bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-fuchsia-400 uppercase">
                  POST PEDAL:
                </span>
                <select
                  value={params.pedalModel}
                  onChange={(e) =>
                    handleSelectChange('pedalModel', e.target.value as PedalModel)
                  }
                  className="bg-slate-900 text-fuchsia-300 font-mono-tech text-xs px-2 py-0.5 rounded border border-slate-700"
                >
                  <option value="yellow_acid">Yellow Acid Overdrive</option>
                  <option value="fuzzy03">Fuzzy03 Diode</option>
                  <option value="square_tube">Square Tube Warmth</option>
                  <option value="metallicon">Metallicon Brutal</option>
                  <option value="bypass">Bypass Clean</option>
                </select>
              </div>
              <span className="text-[10px] font-mono-tech text-slate-400">4X OVERSAMPLED</span>
            </div>
          </div>

          {/* Envelopes & LFO */}
          <div className="lg:col-span-3 module-panel rounded-xl p-3.5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Envelopes &amp; LFO
              </h2>
              <span className="text-[10px] font-mono-tech text-fuchsia-300">ADSR + SYNC LFO</span>
            </div>

            <div className="bg-slate-950/75 p-2.5 rounded-xl border border-slate-800/90">
              <div className="text-[10px] font-bold text-cyan-400 uppercase mb-1.5">
                AMP &amp; FILTER ENVELOPE
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <RotaryKnob
                  label="ATK"
                  param="envAttack"
                  value={params.envAttack}
                  min={0.002}
                  max={1.5}
                  defaultValue={0.006}
                  compact
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="DEC"
                  param="envDecay"
                  value={params.envDecay}
                  min={0.03}
                  max={2.5}
                  defaultValue={0.26}
                  compact
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="SUS"
                  param="envSustain"
                  value={params.envSustain}
                  min={0.0}
                  max={1.0}
                  defaultValue={0.18}
                  compact
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="REL"
                  param="envRelease"
                  value={params.envRelease}
                  min={0.02}
                  max={3.0}
                  defaultValue={0.18}
                  compact
                  onChange={handleParamChange}
                />
              </div>
            </div>

            <div className="bg-slate-950/75 p-2.5 rounded-xl border border-slate-800/90">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-amber-400 uppercase">
                  QUANTUM LFO 1
                </span>
                <select
                  value={params.lfoTarget}
                  onChange={(e) =>
                    handleSelectChange('lfoTarget', e.target.value as LfoTarget)
                  }
                  className="bg-slate-900 text-amber-300 font-mono-tech text-[10px] px-1.5 py-0.5 rounded border border-slate-700"
                >
                  <option value="cutoff">→ Filter Cutoff</option>
                  <option value="pitch">→ Vibrato Pitch</option>
                  <option value="fm">→ FM Index</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RotaryKnob
                  label="RATE"
                  param="lfoRate"
                  value={params.lfoRate}
                  min={0.1}
                  max={25}
                  defaultValue={3.5}
                  accent="amber"
                  compact
                  valueClassName="text-[9px] font-mono-tech text-amber-300"
                  onChange={handleParamChange}
                />
                <RotaryKnob
                  label="DEPTH"
                  param="lfoDepth"
                  value={params.lfoDepth}
                  min={0}
                  max={1}
                  defaultValue={0.2}
                  accent="amber"
                  compact
                  valueClassName="text-[9px] font-mono-tech text-amber-300"
                  onChange={handleParamChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 4: WORKSTATION TABS */}
        <WorkstationTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentPatternIdx={currentPatternIdx}
          onPatternSlotChange={(idx) => {
            setCurrentPatternIdx(idx);
            setStatusToast(`Pattern bank ${['A', 'B', 'C', 'D'][idx]} active`);
          }}
          chainMode={chainMode}
          onToggleChainMode={() => setChainMode((prev) => !prev)}
          onReversePattern={() => {
            setPatternBanks((prev) => {
              const copy = [...prev];
              const cur = [...copy[currentPatternIdx]];
              const sliced = cur.slice(0, activeSeqLength).reverse();
              for (let i = 0; i < activeSeqLength; i++) cur[i] = sliced[i];
              copy[currentPatternIdx] = cur;
              return copy;
            });
            setStatusToast(`Reversed ${activeSeqLength} steps`);
          }}
          activeSeqLength={activeSeqLength}
          onSeqLengthChange={(len) => {
            setActiveSeqLength(len);
            setCurrentStep(-1);
            setStatusToast(`Sequencer set to ${len} steps (${len / 16} bars)`);
          }}
          scaleKey={scaleKey}
          onScaleChange={setScaleKey}
          onGenerateAcidRiff={() => {
            const scale = SCALES[scaleKey];
            const root = 36;
            setPatternBanks((prev) => {
              const copy = [...prev];
              copy[currentPatternIdx] = copy[currentPatternIdx].map((existing, idx) => {
                if (idx >= activeSeqLength) return existing;
                const active = idx % 4 === 0 ? true : Math.random() > 0.25;
                const deg = scale[Math.floor(Math.random() * scale.length)];
                const oct = Math.random() > 0.65 ? 12 : 0;
                return {
                  active,
                  note: root + deg + oct,
                  accent: Math.random() > 0.65,
                  slide: Math.random() > 0.72,
                };
              });
              return copy;
            });
            setStatusToast(
              `Generated ${activeSeqLength}-step 303 riff in bank ${['A', 'B', 'C', 'D'][currentPatternIdx]}`
            );
          }}
          onExportMidi={() => {
            const bankName = exportPatternToMidi(
              patternBanks[currentPatternIdx],
              activeSeqLength,
              currentPatternIdx
            );
            setStatusToast(`Exported pattern ${bankName} as .MID`);
          }}
          onClearPattern={() => {
            setPatternBanks((prev) => {
              const copy = [...prev];
              copy[currentPatternIdx] = copy[currentPatternIdx].map((st, idx) =>
                idx < activeSeqLength
                  ? { ...st, active: false, accent: false, slide: false }
                  : st
              );
              return copy;
            });
          }}
          steps={patternBanks[currentPatternIdx]}
          currentStep={currentStep}
          onUpdateStep={(idx, patch) => {
            setPatternBanks((prev) => {
              const copy = [...prev];
              const bank = [...copy[currentPatternIdx]];
              bank[idx] = { ...bank[idx], ...patch };
              copy[currentPatternIdx] = bank;
              return copy;
            });
          }}
          swing={swing}
          onSwingChange={setSwing}
          drumsEnabled={drumsEnabled}
          onToggleDrums={() => setDrumsEnabled((prev) => !prev)}
          drumVol={params.drumVol}
          onDrumVolChange={(val) => handleParamChange('drumVol', val)}
          onGenerateDrumGroove={() => {
            setDrumPatterns({
              kick: Array.from({ length: MAX_SEQ_STEPS }, (_, i) =>
                i % 4 === 0 || (i % 16 === 14 && Math.random() > 0.45) ? 1 : 0
              ),
              snare: Array.from({ length: MAX_SEQ_STEPS }, (_, i) =>
                i % 8 === 4 || (i % 16 === 15 && Math.random() > 0.55) ? 1 : 0
              ),
              hat: Array.from({ length: MAX_SEQ_STEPS }, (_, i) =>
                i % 2 === 1 || Math.random() > 0.65 ? 1 : 0
              ),
            });
            setStatusToast(`Generated ${activeSeqLength}-step techno drum groove`);
          }}
          drumPatterns={drumPatterns}
          onToggleDrumPad={(track, idx) => {
            igniteAudio();
            const nextVal = drumPatterns[track][idx] ? 0 : 1;
            if (nextVal) synth.triggerDrum(track, true);
            setDrumPatterns((prev) => {
              const lane = [...prev[track]];
              lane[idx] = nextVal;
              return { ...prev, [track]: lane };
            });
          }}
          onAuditionDrum={(track: DrumTrackKey) => {
            igniteAudio();
            synth.triggerDrum(track, true);
          }}
          modMatrix={modMatrix}
          onUpdateModSlot={(idx, patch) => {
            setModMatrix((prev) => {
              const next = prev.map((s, i) => (i === idx ? { ...s, ...patch } : s));
              synth.modMatrix = next;
              return next;
            });
          }}
          params={params}
          onParamChange={handleParamChange}
          chordMode={chordMode}
          onChordModeChange={(mode) => {
            synth.chordMode = mode;
            setChordMode(mode);
          }}
          arpMode={arpMode}
          onArpModeChange={(mode) => {
            setArpMode(mode);
            arpModeRef.current = mode;
            if (mode === 'off' && arpTimerRef.current) {
              clearInterval(arpTimerRef.current);
              arpTimerRef.current = null;
            } else if (mode !== 'off' && heldKeysRef.current.size > 0) {
              startArpeggiator();
            }
          }}
          latestSoundsId={latestSoundsId}
          sidHistory={sidHistory}
          autoTrackSid={autoTrackSid}
          onToggleAutoTrackSid={setAutoTrackSid}
          onScanSoundsId={handleScanSoundsId}
          onApplyMatchedPatch={() => {
            if (latestSoundsId && PRESETS[latestSoundsId.presetKey]) {
              applyPreset(latestSoundsId.presetKey);
            }
          }}
        />

        {/* ROW 5: PITCH BEND, MOD WHEEL & PERFORMANCE KEYBOARD */}
        <PianoKeybed
          baseOctave={baseOctave}
          heldKeys={heldKeys}
          pitchBend={pitchBend}
          modWheel={modWheel}
          onOctaveDown={() => setBaseOctave((o) => Math.max(1, o - 1))}
          onOctaveUp={() => setBaseOctave((o) => Math.min(5, o + 1))}
          onPitchBendChange={(val) => {
            synth.pitchBend = val;
            setPitchBend(val);
          }}
          onModWheelChange={(val) => {
            synth.modWheelVal = val;
            setModWheel(val);
            handleParamChange('macroAcid', val);
          }}
          onKeyDown={triggerKeyDown}
          onKeyUp={triggerKeyUp}
        />
      </div>
    </div>
  );
}
