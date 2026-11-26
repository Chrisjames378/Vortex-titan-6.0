import { StepData } from '../types/synth';

export function exportPatternToMidi(
  steps: StepData[],
  activeSeqLength: number,
  patternSlotIdx: number
): string {
  const tpq = 120;
  const stepTicks = 30;
  const events: Array<{ tick: number; bytes: number[] }> = [];

  let delta = 0;
  steps.slice(0, activeSeqLength).forEach((st) => {
    if (st.active) {
      const vel = st.accent ? 120 : 88;
      const gate = st.slide ? 34 : 20;
      events.push({ tick: delta, bytes: [0x90, st.note, vel] });
      events.push({ tick: delta + gate, bytes: [0x80, st.note, 0x00] });
    }
    delta += stepTicks;
  });

  events.sort((a, b) => a.tick - b.tick);

  const trackBytes: number[] = [];
  let lastTick = 0;
  events.forEach((ev) => {
    const dt = ev.tick - lastTick;
    lastTick = ev.tick;
    if (dt < 128) {
      trackBytes.push(dt);
    } else {
      trackBytes.push(((dt >> 7) & 0x7f) | 0x80, dt & 0x7f);
    }
    trackBytes.push(...ev.bytes);
  });
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (tpq >> 8) & 0xff,
    tpq & 0xff,
  ];

  const trkLen = trackBytes.length;
  const trkHeader = [
    0x4d, 0x54, 0x72, 0x6b,
    (trkLen >> 24) & 0xff,
    (trkLen >> 16) & 0xff,
    (trkLen >> 8) & 0xff,
    trkLen & 0xff,
  ];

  const midiData = new Uint8Array([...header, ...trkHeader, ...trackBytes]);
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const bankName = ['A', 'B', 'C', 'D'][patternSlotIdx] || 'A';
  a.href = url;
  a.download = `VortexTitan_Pattern_${bankName}.mid`;
  a.click();
  URL.revokeObjectURL(url);
  return bankName;
}
