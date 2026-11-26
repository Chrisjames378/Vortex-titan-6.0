import React, { useEffect, useRef } from 'react';
import { VortexTitanEngine } from '../audio/VortexTitanEngine';
import { ScopeMode, SoundsIdResult } from '../types/synth';

interface VisualizerHeaderProps {
  engine: VortexTitanEngine;
  audioIgnited: boolean;
  scopeMode: ScopeMode;
  onScopeModeChange: (mode: ScopeMode) => void;
  onIgniteAudio: () => void;
  latestSoundsId: SoundsIdResult | null;
  autoTrackSid: boolean;
  onSoundsIdSample: (res: SoundsIdResult) => void;
}

export const VisualizerHeader: React.FC<VisualizerHeaderProps> = ({
  engine,
  audioIgnited,
  scopeMode,
  onScopeModeChange,
  onIgniteAudio,
  latestSoundsId,
  autoTrackSid,
  onSoundsIdSample,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeModeRef = useRef<ScopeMode>(scopeMode);
  const autoTrackRef = useRef<boolean>(autoTrackSid);
  const onSampleRef = useRef(onSoundsIdSample);

  scopeModeRef.current = scopeMode;
  autoTrackRef.current = autoTrackSid;
  onSampleRef.current = onSoundsIdSample;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const freqData = new Uint8Array(1024);
    const timeData = new Uint8Array(1024);
    let lastSidSample = 0;
    let rafId = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = (nowMs: number) => {
      rafId = requestAnimationFrame(render);

      if (autoTrackRef.current && engine.ctx && nowMs - lastSidSample > 320) {
        lastSidSample = nowMs;
        const result = engine.analyzeSoundsId(freqData);
        onSampleRef.current(result);
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      ctx2d.strokeStyle = 'rgba(0, 240, 255, 0.07)';
      ctx2d.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 40) {
        ctx2d.beginPath();
        ctx2d.moveTo(gx, 0);
        ctx2d.lineTo(gx, h);
        ctx2d.stroke();
      }
      for (let gy = 0; gy < h; gy += 28) {
        ctx2d.beginPath();
        ctx2d.moveTo(0, gy);
        ctx2d.lineTo(w, gy);
        ctx2d.stroke();
      }

      if (!engine.analyser) {
        ctx2d.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx2d.lineWidth = 2;
        ctx2d.beginPath();
        for (let x = 0; x < w; x += 4) {
          const y = h / 2 + Math.sin(x * 0.04 + nowMs * 0.005) * (h * 0.16);
          if (x === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
        return;
      }

      engine.analyser.getByteFrequencyData(freqData);
      engine.analyser.getByteTimeDomainData(timeData);

      const mode = scopeModeRef.current;
      if (mode === 'fft' || mode === 'hybrid') {
        const barCount = 96;
        const barW = w / barCount;
        for (let i = 0; i < barCount; i++) {
          const v = freqData[i * 2] / 255;
          const barH = v * h * 0.85;
          const grad = ctx2d.createLinearGradient(0, h, 0, h - barH);
          grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
          grad.addColorStop(0.7, 'rgba(0, 240, 255, 0.55)');
          grad.addColorStop(1, 'rgba(255, 42, 133, 0.85)');
          ctx2d.fillStyle = grad;
          ctx2d.fillRect(i * barW + 1, h - barH, Math.max(1, barW - 2), barH);
        }
      }

      if (mode === 'wave' || mode === 'hybrid') {
        ctx2d.strokeStyle = '#00f0ff';
        ctx2d.lineWidth = 2.2;
        ctx2d.shadowColor = '#00f0ff';
        ctx2d.shadowBlur = 8;
        ctx2d.beginPath();
        const sliceWidth = w / timeData.length;
        let x = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          const y = h / 2 + v * (h * 0.42);
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
          x += sliceWidth;
        }
        ctx2d.stroke();
        ctx2d.shadowBlur = 0;
      }
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [engine]);

  return (
    <div className="lg:col-span-5 module-panel rounded-xl p-3.5 flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Quantum Oscilloscope &amp; FFT
          </span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          {(['wave', 'fft', 'hybrid'] as ScopeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onScopeModeChange(mode)}
              className={`px-2 py-0.5 text-[10px] font-mono-tech font-bold rounded transition whitespace-nowrap ${
                scopeMode === mode
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full h-32 bg-slate-950 rounded-lg border border-slate-800/90 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {latestSoundsId && (
          <div className="absolute top-2 right-2 bg-slate-950/90 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-[10px] font-mono-tech text-indigo-200 max-w-[235px]">
            <div className="flex items-center justify-between gap-2 font-bold text-indigo-300">
              <span>SOUNDS ID</span>
              <span className="text-emerald-400">{latestSoundsId.confidence}%</span>
            </div>
            <div className="text-white font-bold truncate mt-0.5">{latestSoundsId.presetName}</div>
            <div className="text-slate-400 text-[9px] truncate">
              {latestSoundsId.freq} Hz ({latestSoundsId.note}) · {latestSoundsId.timbre}
            </div>
          </div>
        )}
        {!audioIgnited && (
          <button
            type="button"
            onClick={onIgniteAudio}
            className="absolute inset-0 w-full h-full bg-slate-950/85 backdrop-blur-sm flex items-center justify-center cursor-pointer focus:outline-none"
          >
            <span className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-cyan-500/30 transition">
              Click Here or Press Any Key to Start Audio Engine
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
