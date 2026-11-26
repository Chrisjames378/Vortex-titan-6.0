import React, { useRef } from 'react';
import { SynthParams } from '../types/synth';

export type KnobAccent = 'cyan' | 'acid' | 'amber' | 'magenta';

interface RotaryKnobProps {
  label: string;
  param: keyof SynthParams;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  accent?: KnobAccent;
  compact?: boolean;
  labelClassName?: string;
  valueClassName?: string;
  containerClassName?: string;
  onChange: (param: keyof SynthParams, value: number) => void;
}

export function formatKnobValue(param: keyof SynthParams, val: number): string {
  if (param === 'filterCutoff' || param === 'reverbDamp') return `${Math.round(val)}Hz`;
  if (
    param === 'envAttack' ||
    param === 'envDecay' ||
    param === 'envRelease' ||
    param === 'delayTime'
  ) {
    return val < 1 ? `${Math.round(val * 1000)}ms` : `${val.toFixed(2)}s`;
  }
  if (param === 'reverbSize') return `${val.toFixed(1)}s`;
  if (param === 'lfoRate' || param === 'chorusRate') return `${val.toFixed(1)}Hz`;
  if (param === 'osc1Detune' || param === 'osc2Detune') return `${Math.round(val)}ct`;
  if (param === 'osc1Unison') return `${Math.round(val)}`;
  if (param === 'osc2Fm') return `${Math.round(val)}Hz`;
  if (param === 'filterRes') return `${val.toFixed(1)}`;
  if (param === 'filterEnvAmt') return `+${Math.round(val)}`;
  if (param === 'limiterDrive') return `+${val.toFixed(1)}dB`;
  if (param === 'noiseLevel') return `${Math.round(val * 200)}%`;
  return `${Math.round(val * 100)}%`;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  param,
  value,
  min,
  max,
  step,
  defaultValue,
  accent = 'cyan',
  compact = false,
  labelClassName,
  valueClassName,
  containerClassName = '',
  onChange,
}) => {
  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const deg = -135 + norm * 270;

  const commitNorm = (nextNorm: number) => {
    const clamped = Math.max(0, Math.min(1, nextNorm));
    let nextVal = min + clamped * (max - min);
    if (step) nextVal = Math.round(nextVal / step) * step;
    onChange(param, nextVal);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startNorm: norm };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaY = dragRef.current.startY - ev.clientY;
      commitNorm(dragRef.current.startNorm + deltaY / 130);
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = { startY: touch.clientY, startNorm: norm };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const deltaY = dragRef.current.startY - touch.clientY;
    commitNorm(dragRef.current.startNorm + deltaY / 130);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    commitNorm(norm + delta);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      commitNorm(norm + (step ? step / (max - min) : 0.04));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      commitNorm(norm - (step ? step / (max - min) : 0.04));
    }
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(param, defaultValue);
    }
  };

  const accentClass =
    accent === 'acid'
      ? 'knob-acid'
      : accent === 'amber'
        ? 'knob-amber'
        : accent === 'magenta'
          ? 'knob-magenta'
          : '';

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(3))}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title={`${label} (drag vertically, scroll, or double-click to reset)`}
      className={`knob-container ${accentClass} flex flex-col items-center gap-1 cursor-ns-resize select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded-lg ${containerClassName}`}
    >
      <div className="knob-dial">
        <div
          className="knob-indicator"
          style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
        />
      </div>
      <span
        className={
          labelClassName ??
          `${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold tracking-wide text-slate-400 whitespace-nowrap`
        }
      >
        {label}
      </span>
      <span
        className={
          valueClassName ??
          `${compact ? 'text-[9px]' : 'text-[10px]'} font-mono-tech text-cyan-300`
        }
      >
        {formatKnobValue(param, value)}
      </span>
    </div>
  );
};
