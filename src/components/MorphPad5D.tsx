import React, { useRef, useState } from 'react';
import { DimMode } from '../types/synth';

interface MorphPad5DProps {
  x: number;
  y: number;
  z: number;
  hyper: number;
  dimMode: DimMode;
  springMode: boolean;
  onUpdate: (next: { x: number; y: number; z: number; hyper: number }) => void;
  onCycleDim: () => void;
  onToggleSpring: () => void;
  onIgniteAudio: () => void;
}

export const MorphPad5D: React.FC<MorphPad5DProps> = ({
  x,
  y,
  z,
  hyper,
  dimMode,
  springMode,
  onUpdate,
  onCycleDim,
  onToggleSpring,
  onIgniteAudio,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const updateFromClient = (clientX: number, clientY: number, zOverride?: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    onUpdate({ x: nx, y: ny, z: zOverride !== undefined ? clamp01(zOverride) : z, hyper });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    onIgniteAudio();
    setDragging(true);
    updateFromClient(e.clientX, e.clientY);

    const handleMove = (ev: MouseEvent) => {
      updateFromClient(ev.clientX, ev.clientY);
    };

    const handleUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (springMode) {
        onUpdate({ x: 0.5, y: 0.5, z: 0.5, hyper });
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    onIgniteAudio();
    setDragging(true);
    const t = e.touches[0];
    updateFromClient(t.clientX, t.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    updateFromClient(t.clientX, t.clientY);
  };

  const handleTouchEnd = () => {
    setDragging(false);
    if (springMode) {
      onUpdate({ x: 0.5, y: 0.5, z: 0.5, hyper });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onIgniteAudio();
    const delta = e.deltaY < 0 ? 0.06 : -0.06;
    onUpdate({ x, y, z: clamp01(z + delta), hyper });
  };

  const invY = 1 - y;
  const scale = 0.7 + z * 0.85;

  return (
    <div className="mt-2.5 bg-slate-950/85 p-2.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
      <div
        ref={padRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        title="Drag X/Y for Cutoff & Resonance/Space; scroll wheel for Z-Axis"
        className="relative w-full sm:w-52 h-20 rounded-lg bg-gradient-to-tr from-slate-900 via-slate-900 to-cyan-950/50 border border-cyan-500/30 cursor-crosshair overflow-hidden shrink-0 touch-none"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0,240,255,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,240,255,0.25) 1px, transparent 1px)',
            backgroundSize: '26px 20px',
          }}
        />
        <div
          className="w-4 h-4 -ml-2 -mt-2 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_#00f0ff] absolute pointer-events-none transition-transform duration-75"
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            transform: `scale(${scale.toFixed(2)})`,
          }}
        />
      </div>

      <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-stretch gap-1 w-full sm:w-28 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 shrink-0">
        <div className="flex items-center justify-between text-[9px] font-mono-tech font-bold text-amber-300">
          <span>Z-AXIS</span>
          <span>{Math.round(z * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={z}
          onChange={(e) => onUpdate({ x, y, z: parseFloat(e.target.value), hyper })}
          className="synth-slider w-20 sm:w-full"
          title="Z-Axis Depth: Hybrid Morph & Resonator"
        />
        <div className="flex items-center justify-between text-[9px] font-mono-tech font-bold text-fuchsia-300">
          <span>4D/5D</span>
          <span>{Math.round(hyper * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={hyper}
          onChange={(e) => onUpdate({ x, y, z, hyper: parseFloat(e.target.value) })}
          className="synth-slider w-20 sm:w-full"
          title="4D/5D Hyper-Dimension: Sidechain & FM/Grit"
        />
      </div>

      <div className="flex-1 flex flex-col justify-between gap-1 text-[10px] font-mono-tech w-full min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-extrabold text-cyan-300 uppercase truncate">
            3D–5D XY&amp;Z Morph Pad
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onCycleDim}
              className="px-2 py-0.5 rounded bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/40 font-bold whitespace-nowrap"
              title="Cycle 3D / 4D / 5D Dimension Coupling"
            >
              DIM: {dimMode}
            </button>
            <button
              type="button"
              onClick={onToggleSpring}
              className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold whitespace-nowrap"
            >
              MODE: {springMode ? 'SPRING' : 'HOLD'}
            </button>
          </div>
        </div>
        <span className="text-slate-400">
          X: <strong className="text-emerald-300">Cutoff</strong> · Y:{' '}
          <strong className="text-fuchsia-300">Res/Space</strong> · Z:{' '}
          <strong className="text-amber-300">Morph/Reso</strong> · 4D/5D:{' '}
          <strong className="text-cyan-300">SC/FM</strong>
        </span>
        <span className="text-cyan-400">
          [{dimMode}] X:{Math.round(x * 100)}% Y:{Math.round(invY * 100)}% Z:{Math.round(z * 100)}%
          {' '}4D/5D:{Math.round(hyper * 100)}%
        </span>
      </div>
    </div>
  );
};
