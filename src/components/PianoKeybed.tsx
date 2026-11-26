import React from 'react';
import { midiName } from '../data/presets';

interface PianoKeybedProps {
  baseOctave: number;
  heldKeys: Set<number>;
  pitchBend: number;
  modWheel: number;
  onOctaveDown: () => void;
  onOctaveUp: () => void;
  onPitchBendChange: (val: number) => void;
  onModWheelChange: (val: number) => void;
  onKeyDown: (midi: number) => void;
  onKeyUp: (midi: number) => void;
}

const isBlackKey = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);

export const PianoKeybed: React.FC<PianoKeybedProps> = ({
  baseOctave,
  heldKeys,
  pitchBend,
  modWheel,
  onOctaveDown,
  onOctaveUp,
  onPitchBendChange,
  onModWheelChange,
  onKeyDown,
  onKeyUp,
}) => {
  const startMidi = (baseOctave + 1) * 12;
  const totalKeys = 29;

  const whiteNotes: number[] = [];
  const blackNotes: Array<{ midi: number; whiteIdx: number }> = [];
  let wCount = 0;

  for (let i = 0; i < totalKeys; i++) {
    const midi = startMidi + i;
    if (!isBlackKey(midi)) {
      whiteNotes.push(midi);
      wCount++;
    } else {
      blackNotes.push({ midi, whiteIdx: wCount });
    }
  }

  const whiteWidthPct = 100 / whiteNotes.length;
  const blackWidthPct = whiteWidthPct * 0.62;

  return (
    <div className="module-panel rounded-xl p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
            Performance Keybed
          </span>
          <span className="text-[11px] font-mono-tech text-slate-400 hidden sm:inline">
            · Keys: A W S E D F T G Y H U J K O L P · Space = Play/Stop
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOctaveDown}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 transition whitespace-nowrap"
          >
            OCT -
          </button>
          <span className="font-mono-tech text-xs font-bold text-amber-400 px-1.5">
            C{baseOctave}
          </span>
          <button
            type="button"
            onClick={onOctaveUp}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 transition whitespace-nowrap"
          >
            OCT +
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-3">
        <div className="hidden sm:flex items-center gap-2.5 bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
          <div className="flex flex-col items-center justify-between h-28">
            <span className="text-[9px] font-bold text-cyan-400">BEND</span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={pitchBend}
              onChange={(e) => onPitchBendChange(parseFloat(e.target.value))}
              onMouseUp={() => onPitchBendChange(0)}
              onTouchEnd={() => onPitchBendChange(0)}
              className="synth-slider w-20 -rotate-90 my-auto"
              aria-label="Pitch Bend"
            />
            <span className="text-[9px] font-mono-tech text-slate-500">±2st</span>
          </div>
          <div className="flex flex-col items-center justify-between h-28">
            <span className="text-[9px] font-bold text-amber-400">MOD</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={modWheel}
              onChange={(e) => onModWheelChange(parseFloat(e.target.value))}
              className="synth-slider w-20 -rotate-90 my-auto"
              aria-label="Modulation Wheel"
            />
            <span className="text-[9px] font-mono-tech text-slate-500">CC1</span>
          </div>
        </div>

        <div className="relative flex-1 h-32 sm:h-36 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden select-none touch-none">
          {whiteNotes.map((midi, idx) => {
            const active = heldKeys.has(midi);
            return (
              <div
                key={midi}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onKeyDown(midi);
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  onKeyUp(midi);
                }}
                onMouseLeave={() => {
                  if (heldKeys.has(midi)) onKeyUp(midi);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  onKeyDown(midi);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onKeyUp(midi);
                }}
                style={{
                  left: `calc(${idx * whiteWidthPct}% + 2px)`,
                  width: `calc(${whiteWidthPct}% - 4px)`,
                }}
                className={`piano-white ${active ? 'active' : ''} absolute top-1.5 bottom-1.5 cursor-pointer flex flex-col justify-end items-center pb-1.5`}
              >
                {midi % 12 === 0 && (
                  <span className="text-[9px] font-mono-tech font-bold text-slate-500 pointer-events-none">
                    {midiName(midi)}
                  </span>
                )}
              </div>
            );
          })}

          {blackNotes.map(({ midi, whiteIdx }) => {
            const active = heldKeys.has(midi);
            return (
              <div
                key={midi}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onKeyDown(midi);
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onKeyUp(midi);
                }}
                onMouseLeave={() => {
                  if (heldKeys.has(midi)) onKeyUp(midi);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onKeyDown(midi);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onKeyUp(midi);
                }}
                style={{
                  left: `calc(${whiteIdx * whiteWidthPct - blackWidthPct / 2}%)`,
                  width: `${blackWidthPct}%`,
                }}
                className={`piano-black ${active ? 'active' : ''} absolute top-1.5 h-[58%] cursor-pointer`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
