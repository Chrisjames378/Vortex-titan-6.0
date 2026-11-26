import React, { useEffect, useRef } from 'react';
import { SCALES, midiName } from '../data/presets';
import {
  ArpMode,
  ChordMode,
  DrumPatterns,
  DrumTrackKey,
  ModDest,
  ModSlot,
  ModSource,
  ScaleKey,
  SoundsIdResult,
  StepData,
  SynthParams,
  WorkstationTabId,
} from '../types/synth';
import { RotaryKnob } from './RotaryKnob';

interface WorkstationTabsProps {
  activeTab: WorkstationTabId;
  onTabChange: (tab: WorkstationTabId) => void;
  currentPatternIdx: number;
  onPatternSlotChange: (idx: number) => void;
  chainMode: boolean;
  onToggleChainMode: () => void;
  onReversePattern: () => void;
  activeSeqLength: number;
  onSeqLengthChange: (len: number) => void;
  scaleKey: ScaleKey;
  onScaleChange: (scale: ScaleKey) => void;
  onGenerateAcidRiff: () => void;
  onExportMidi: () => void;
  onClearPattern: () => void;

  steps: StepData[];
  currentStep: number;
  onUpdateStep: (idx: number, patch: Partial<StepData>) => void;
  swing: number;
  onSwingChange: (val: number) => void;

  drumsEnabled: boolean;
  onToggleDrums: () => void;
  drumVol: number;
  onDrumVolChange: (val: number) => void;
  onGenerateDrumGroove: () => void;
  drumPatterns: DrumPatterns;
  onToggleDrumPad: (track: DrumTrackKey, idx: number) => void;
  onAuditionDrum: (track: DrumTrackKey) => void;

  modMatrix: ModSlot[];
  onUpdateModSlot: (idx: number, patch: Partial<ModSlot>) => void;

  params: SynthParams;
  onParamChange: (param: keyof SynthParams, value: number) => void;

  chordMode: ChordMode;
  onChordModeChange: (mode: ChordMode) => void;
  arpMode: ArpMode;
  onArpModeChange: (mode: ArpMode) => void;

  latestSoundsId: SoundsIdResult | null;
  sidHistory: SoundsIdResult[];
  autoTrackSid: boolean;
  onToggleAutoTrackSid: (enabled: boolean) => void;
  onScanSoundsId: () => void;
  onApplyMatchedPatch: () => void;
}

const TABS: Array<{ id: WorkstationTabId; label: string }> = [
  { id: 'seqTab', label: '303 Acid & Arrangement' },
  { id: 'drumTab', label: '909/808 Drumkit' },
  { id: 'modTab', label: 'Modulation Matrix' },
  { id: 'fxTab', label: 'Q4ntum Delay & Rutaverb' },
  { id: 'arpTab', label: 'Quantizer & Chord Stack' },
  { id: 'soundsIdTab', label: 'Sounds ID Engine' },
];

const MOD_SOURCES: Array<{ val: ModSource; label: string }> = [
  { val: 'lfo1', label: 'LFO 1 (Sine)' },
  { val: 'accent', label: '303 Step Accent' },
  { val: 'modwheel', label: 'Mod Wheel / MPE' },
  { val: 'velocity', label: 'Note Velocity' },
  { val: 'env', label: 'Filter Env' },
];

const MOD_DESTS: Array<{ val: ModDest; label: string }> = [
  { val: 'cutoff', label: 'Filter Cutoff' },
  { val: 'res', label: '303 Resonance' },
  { val: 'fm', label: 'OSC 2 FM Index' },
  { val: 'detune', label: 'Unison Detune' },
];

const DRUM_TRACKS: Array<{ key: DrumTrackKey; label: string; color: string }> = [
  { key: 'kick', label: '909 PUNCH KICK', color: 'bg-rose-500' },
  { key: 'snare', label: 'ANALOG SNARE', color: 'bg-amber-400' },
  { key: 'hat', label: 'CLOSED HI-HAT', color: 'bg-cyan-400' },
];

export const WorkstationTabs: React.FC<WorkstationTabsProps> = ({
  activeTab,
  onTabChange,
  currentPatternIdx,
  onPatternSlotChange,
  chainMode,
  onToggleChainMode,
  onReversePattern,
  activeSeqLength,
  onSeqLengthChange,
  scaleKey,
  onScaleChange,
  onGenerateAcidRiff,
  onExportMidi,
  onClearPattern,
  steps,
  currentStep,
  onUpdateStep,
  swing,
  onSwingChange,
  drumsEnabled,
  onToggleDrums,
  drumVol,
  onDrumVolChange,
  onGenerateDrumGroove,
  drumPatterns,
  onToggleDrumPad,
  onAuditionDrum,
  modMatrix,
  onUpdateModSlot,
  params,
  onParamChange,
  chordMode,
  onChordModeChange,
  arpMode,
  onArpModeChange,
  latestSoundsId,
  sidHistory,
  autoTrackSid,
  onToggleAutoTrackSid,
  onScanSoundsId,
  onApplyMatchedPatch,
}) => {
  const scrollWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentStep < 0 || activeTab !== 'seqTab') return;
    const wrap = scrollWrapRef.current;
    const col = document.getElementById(`step-col-${currentStep}`);
    if (wrap && col) {
      const targetScroll = col.offsetLeft - wrap.clientWidth / 2 + col.clientWidth / 2;
      wrap.scrollTo({ left: Math.max(0, targetScroll), behavior: 'auto' });
    }
  }, [currentStep, activeTab]);

  const cycleNote = (idx: number, currentNote: number) => {
    const scale = SCALES[scaleKey];
    const root = 36;
    const curOffset = (currentNote - root + 24) % 12;
    const nextInScale = scale.find((s) => s > curOffset) ?? scale[0];
    const octShift = nextInScale <= curOffset ? 12 : 0;
    let nextMidi = currentNote - curOffset + nextInScale + octShift;
    if (nextMidi > 60) nextMidi = 36 + scale[0];
    onUpdateStep(idx, { note: nextMidi });
  };

  return (
    <div className="module-panel rounded-xl p-3.5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs tracking-wide transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-extrabold'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 font-bold'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="flex items-center bg-slate-950 rounded-lg border border-slate-700 p-0.5"
            title="4-Pattern Song Arrangement Banks"
          >
            {['A', 'B', 'C', 'D'].map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                onClick={() => onPatternSlotChange(idx)}
                className={`px-2 py-1 rounded font-mono-tech text-xs transition ${
                  currentPatternIdx === idx
                    ? 'bg-cyan-500 text-slate-950 font-extrabold'
                    : 'text-slate-400 hover:text-white font-bold'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleChainMode}
            className={`px-2 py-1 rounded-lg text-[11px] font-mono-tech font-bold border whitespace-nowrap ${
              chainMode
                ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Auto-Chain Patterns A-B-C-D"
          >
            {chainMode ? 'CHAIN: A→D' : 'CHAIN: OFF'}
          </button>

          <button
            type="button"
            onClick={onReversePattern}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-mono-tech font-bold border border-slate-700 whitespace-nowrap"
            title="Reverse Sequence"
          >
            ⇄ REV
          </button>

          <select
            value={activeSeqLength}
            onChange={(e) => onSeqLengthChange(parseInt(e.target.value, 10))}
            className="bg-slate-900 text-cyan-300 font-mono-tech text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700"
            title="Sequencer Step Length (Up to 128 Steps)"
          >
            <option value={16}>16 STEPS (1 BAR)</option>
            <option value={32}>32 STEPS (2 BARS)</option>
            <option value={64}>64 STEPS (4 BARS)</option>
            <option value={128}>128 STEPS (8 BARS)</option>
          </select>

          <select
            value={scaleKey}
            onChange={(e) => onScaleChange(e.target.value as ScaleKey)}
            className="bg-slate-900 text-emerald-300 font-mono-tech text-xs px-2 py-1 rounded-lg border border-slate-700"
          >
            <option value="phrygian">Scale: Phrygian Acid</option>
            <option value="minor">Scale: Natural Minor</option>
            <option value="dorian">Scale: Dorian Groove</option>
            <option value="hirajoshi">Scale: Hirajoshi Koto</option>
            <option value="chromatic">Scale: Chromatic 303</option>
          </select>

          <button
            type="button"
            onClick={onGenerateAcidRiff}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold whitespace-nowrap"
          >
            GEN 303 RIFF
          </button>

          <button
            type="button"
            onClick={onExportMidi}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold whitespace-nowrap"
            title="Export Pattern to Standard MIDI File (.mid)"
          >
            EXPORT .MID
          </button>

          <button
            type="button"
            onClick={onClearPattern}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold whitespace-nowrap"
          >
            CLEAR
          </button>
        </div>
      </div>

      {activeTab === 'seqTab' && (
        <div>
          <div ref={scrollWrapRef} className="overflow-x-auto pb-1">
            <div className="flex gap-1.5 w-max">
              {steps.slice(0, activeSeqLength).map((step, idx) => {
                const isPlayhead = idx === currentStep;
                return (
                  <div
                    key={idx}
                    id={`step-col-${idx}`}
                    className={`w-14 shrink-0 flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition ${
                      idx % 16 === 0
                        ? 'bg-slate-900 border-cyan-500/40'
                        : idx % 4 === 0
                          ? 'bg-slate-900/95 border-slate-700'
                          : 'bg-slate-950/80 border-slate-800/90'
                    }`}
                  >
                    <div
                      className={`w-full h-1.5 rounded-full transition-colors ${
                        isPlayhead
                          ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'
                          : 'bg-slate-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateStep(idx, { active: !step.active })}
                      className={`w-full py-1.5 rounded-lg text-[10px] font-mono-tech font-extrabold transition ${
                        step.active
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                          : 'bg-slate-800/80 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {step.active ? `● ${idx + 1}` : `${idx + 1}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => cycleNote(idx, step.note)}
                      className="w-full py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono-tech text-[10px] font-bold"
                    >
                      {midiName(step.note)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStep(idx, { accent: !step.accent })}
                      className={`w-full py-0.5 rounded text-[9px] font-bold tracking-wider border ${
                        step.accent
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400'
                          : 'bg-slate-900/60 text-slate-500 border-slate-800'
                      }`}
                    >
                      ACC
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStep(idx, { slide: !step.slide })}
                      className={`w-full py-0.5 rounded text-[9px] font-bold tracking-wider border ${
                        step.slide
                          ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                          : 'bg-slate-900/60 text-slate-500 border-slate-800'
                      }`}
                    >
                      SLD
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong className="text-cyan-400">NOTE:</strong> Click pitch pill to cycle scale notes
              </span>
              <span>
                <strong className="text-emerald-400">ACC:</strong> 303 Cutoff, Res &amp; Punch Boost
              </span>
              <span>
                <strong className="text-amber-400">SLD:</strong> True Legato Portamento Glide
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>SHUFFLE:</span>
              <input
                type="range"
                min={0}
                max={0.45}
                step={0.01}
                value={swing}
                onChange={(e) => onSwingChange(parseFloat(e.target.value))}
                className="synth-slider w-24"
              />
              <span className="font-mono-tech text-cyan-300">{Math.round(swing * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'drumTab' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggleDrums}
                className={`px-3 py-1 rounded-lg font-extrabold text-xs whitespace-nowrap ${
                  drumsEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                DRUM ENGINE: {drumsEnabled ? 'ON' : 'OFF'}
              </button>
              <span className="text-xs text-slate-400">
                Synthesized 909 Punch Kick (with Sidechain Trigger), Analog Snare &amp; Closed Hat
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">DRUM VOL:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={drumVol}
                onChange={(e) => onDrumVolChange(parseFloat(e.target.value))}
                className="synth-slider w-24"
              />
              <button
                type="button"
                onClick={onGenerateDrumGroove}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold whitespace-nowrap"
              >
                TECHNO GROOVE
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 overflow-x-auto pb-1">
            {DRUM_TRACKS.map((tr) => (
              <div
                key={tr.key}
                className="flex items-center gap-2 min-w-[820px] bg-slate-950/75 p-1.5 rounded-xl border border-slate-800"
              >
                <button
                  type="button"
                  onClick={() => onAuditionDrum(tr.key)}
                  className="w-32 shrink-0 text-left px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono-tech font-bold text-slate-200"
                >
                  {tr.label}
                </button>
                <div className="flex gap-1 w-max">
                  {drumPatterns[tr.key].slice(0, activeSeqLength).map((val, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onToggleDrumPad(tr.key, idx)}
                      title={`Step ${idx + 1} (Bar ${Math.floor(idx / 16) + 1})`}
                      className={`w-5 h-6 shrink-0 rounded transition relative ${
                        val
                          ? `${tr.color} shadow-sm`
                          : idx % 16 === 0
                            ? 'bg-slate-700 hover:bg-slate-600'
                            : idx % 4 === 0
                              ? 'bg-slate-800 hover:bg-slate-700'
                              : 'bg-slate-900 hover:bg-slate-800'
                      } ${idx === currentStep ? 'ring-2 ring-white' : ''}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'modTab' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {modMatrix.map((slot, idx) => (
            <div
              key={idx}
              className="bg-slate-950/85 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-[10px] font-mono-tech font-bold text-cyan-400">
                <span>MOD SLOT {idx + 1}</span>
                <span>{Math.round(slot.amount * 100)}%</span>
              </div>
              <select
                value={slot.source}
                onChange={(e) => onUpdateModSlot(idx, { source: e.target.value as ModSource })}
                className="bg-slate-900 text-slate-200 text-xs font-mono-tech px-2 py-1 rounded border border-slate-700"
              >
                {MOD_SOURCES.map((s) => (
                  <option key={s.val} value={s.val}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={slot.dest}
                onChange={(e) => onUpdateModSlot(idx, { dest: e.target.value as ModDest })}
                className="bg-slate-900 text-emerald-300 text-xs font-mono-tech px-2 py-1 rounded border border-slate-700"
              >
                {MOD_DESTS.map((d) => (
                  <option key={d.val} value={d.val}>
                    → {d.label}
                  </option>
                ))}
              </select>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={slot.amount}
                onChange={(e) => onUpdateModSlot(idx, { amount: parseFloat(e.target.value) })}
                className="synth-slider w-full"
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'fxTab' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-cyan-400">Q4NTUM MULTI-TAP DELAY</span>
              <span className="text-[10px] font-mono-tech text-slate-400">STEREO PING-PONG</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <RotaryKnob
                label="TIME"
                param="delayTime"
                value={params.delayTime}
                min={0.06}
                max={0.85}
                defaultValue={0.33}
                onChange={onParamChange}
              />
              <RotaryKnob
                label="FEEDBACK"
                param="delayFeedback"
                value={params.delayFeedback}
                min={0}
                max={0.85}
                defaultValue={0.45}
                onChange={onParamChange}
              />
              <RotaryKnob
                label="MIX"
                param="delayMix"
                value={params.delayMix}
                min={0}
                max={0.8}
                defaultValue={0.28}
                onChange={onParamChange}
              />
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-fuchsia-400">RUTAVERB QUANTUM HALL</span>
              <span className="text-[10px] font-mono-tech text-slate-400">ALGORITHMIC IR</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <RotaryKnob
                label="DECAY"
                param="reverbSize"
                value={params.reverbSize}
                min={0.5}
                max={4.5}
                defaultValue={2.4}
                accent="magenta"
                valueClassName="text-[10px] font-mono-tech text-fuchsia-300"
                onChange={onParamChange}
              />
              <RotaryKnob
                label="DAMPING"
                param="reverbDamp"
                value={params.reverbDamp}
                min={800}
                max={12000}
                defaultValue={5500}
                accent="magenta"
                valueClassName="text-[10px] font-mono-tech text-fuchsia-300"
                onChange={onParamChange}
              />
              <RotaryKnob
                label="WET MIX"
                param="reverbMix"
                value={params.reverbMix}
                min={0}
                max={0.85}
                defaultValue={0.26}
                accent="magenta"
                valueClassName="text-[10px] font-mono-tech text-fuchsia-300"
                onChange={onParamChange}
              />
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-400">PHASE PUNCHER &amp; CHORUS</span>
              <span className="text-[10px] font-mono-tech text-slate-400">64-STAGE</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <RotaryKnob
                label="RATE"
                param="chorusRate"
                value={params.chorusRate}
                min={0.1}
                max={6.0}
                defaultValue={1.2}
                accent="amber"
                valueClassName="text-[10px] font-mono-tech text-amber-300"
                onChange={onParamChange}
              />
              <RotaryKnob
                label="SPREAD"
                param="chorusDepth"
                value={params.chorusDepth}
                min={0}
                max={1}
                defaultValue={0.45}
                accent="amber"
                valueClassName="text-[10px] font-mono-tech text-amber-300"
                onChange={onParamChange}
              />
              <RotaryKnob
                label="MAXIMIZER"
                param="limiterDrive"
                value={params.limiterDrive}
                min={0}
                max={12}
                defaultValue={3.0}
                accent="amber"
                valueClassName="text-[10px] font-mono-tech text-amber-300"
                onChange={onParamChange}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'arpTab' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-extrabold text-emerald-400 uppercase">
                Chord Harmonizer Voicing
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Stacks harmonic intervals when in Poly 16 mode.
              </p>
            </div>
            <select
              value={chordMode}
              onChange={(e) => onChordModeChange(e.target.value as ChordMode)}
              className="bg-slate-900 text-emerald-300 font-mono-tech text-xs px-3 py-2 rounded-lg border border-emerald-500/40"
            >
              <option value="off">Single Voice</option>
              <option value="octave">Sub Octave Stack (-12)</option>
              <option value="fifth">Power Fifth (0, +7)</option>
              <option value="minor7">Deep House Minor 7th (0, +3, +7, +10)</option>
              <option value="supersaw">Trance Anthem Stack (-12, 0, +7, +12)</option>
            </select>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-extrabold text-cyan-400 uppercase">
                Real-Time Performance Arpeggiator
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hold notes on the keyboard or computer keys (A–P) to arpeggiate.
              </p>
            </div>
            <select
              value={arpMode}
              onChange={(e) => onArpModeChange(e.target.value as ArpMode)}
              className="bg-slate-900 text-cyan-300 font-mono-tech text-xs px-3 py-2 rounded-lg border border-cyan-500/40"
            >
              <option value="off">Arpeggiator Off</option>
              <option value="up">Upward Escalation</option>
              <option value="down">Downward Cascade</option>
              <option value="updown">Up / Down Pendulum</option>
              <option value="random">Quantum Dice Random</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === 'soundsIdTab' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 bg-slate-950/85 p-3 rounded-xl border border-indigo-500/30 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-indigo-300 uppercase">
                Sounds ID Fingerprint Scanner
              </span>
              <button
                type="button"
                onClick={onScanSoundsId}
                className="px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-extrabold text-[11px] whitespace-nowrap"
              >
                IDENTIFY SOUND
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-tech">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">DETECTED NOTE &amp; HZ</div>
                <div className="text-cyan-300 font-bold mt-0.5">
                  {latestSoundsId ? `${latestSoundsId.freq} Hz (${latestSoundsId.note})` : '-- Hz (--)'}
                </div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">SPECTRAL CENTROID</div>
                <div className="text-amber-300 font-bold mt-0.5">
                  {latestSoundsId ? `${latestSoundsId.centroid} Hz` : '-- Hz'}
                </div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">TIMBRE / CHARACTER</div>
                <div className="text-emerald-300 font-bold mt-0.5">
                  {latestSoundsId ? latestSoundsId.timbre : 'AWAITING SIGNAL'}
                </div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <div className="text-[9px] text-slate-400">BEST PATCH MATCH</div>
                <div className="text-fuchsia-300 font-bold truncate mt-0.5">
                  {latestSoundsId
                    ? `${latestSoundsId.presetName} (${latestSoundsId.confidence}%)`
                    : '--'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTrackSid}
                  onChange={(e) => onToggleAutoTrackSid(e.target.checked)}
                  className="accent-indigo-400"
                />
                <span>LIVE AUTO-IDENTIFY</span>
              </label>
              <button
                type="button"
                onClick={onApplyMatchedPatch}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold"
              >
                LOAD MATCHED PATCH
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-950/85 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-cyan-300 uppercase">
                Identified Sound Log &amp; Preset Similarity
              </span>
              <span className="text-[10px] font-mono-tech text-slate-400">
                {sidHistory.length} SCANS
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 text-[11px] font-mono-tech">
              {sidHistory.length === 0 ? (
                <div className="text-slate-500 text-xs py-4 text-center">
                  Play a note, toggle Mic ID, or start the sequencer to fingerprint active audio.
                </div>
              ) : (
                sidHistory.map((item, idx) => (
                  <div
                    key={`${item.time}-${idx}`}
                    className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800"
                  >
                    <div className="truncate pr-2">
                      <span className="text-indigo-300 font-bold">{item.presetName}</span>
                      <span className="text-slate-400 ml-1.5">
                        {item.freq}Hz ({item.note}) · {item.timbre}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold shrink-0">{item.confidence}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
