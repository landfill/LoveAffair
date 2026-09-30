export interface Note { time: number; dur: number; midi: number; vel: number; hand: 'L' | 'R'; }
export interface Song { notes: Note[]; duration: number; lo: number; hi: number; }

/** 표준 MIDI 파일(SMF) 파서 — 템포 맵을 적용해 초 단위 노트 리스트로 변환 */
export function parseMidi(buf: ArrayBuffer): Song {
  const d = new DataView(buf);
  let p = 0;
  const str = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p++)); return s; };
  if (str(4) !== 'MThd') throw new Error('not a MIDI file');
  p += 4;
  p += 2;
  const ntr = d.getUint16(p); p += 2;
  const div = d.getUint16(p); p += 2;

  type Ev = { tick: number; type: 'on' | 'off' | 'tempo'; ch: number; a: number; b: number; trk: number };
  const evs: Ev[] = [];
  const trackNames: string[] = [];
  for (let t = 0; t < ntr; t++) {
    if (str(4) !== 'MTrk') throw new Error('bad track');
    const len = d.getUint32(p); p += 4;
    const end = p + len;
    let tick = 0, run = 0, name = '';
    const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    while (p < end) {
      tick += vlq();
      let st = d.getUint8(p);
      if (st < 0x80) st = run; else { p++; if (st < 0xf0) run = st; }
      if (st === 0xff) {
        const type = d.getUint8(p++); const l = vlq();
        if (type === 0x51) evs.push({ tick, type: 'tempo', ch: 0, a: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2), b: 0, trk: t });
        else if (type === 0x03 || type === 0x04) { name = ''; for (let i = 0; i < l; i++) name += String.fromCharCode(d.getUint8(p + i)); }
        p += l;
      } else if (st === 0xf0 || st === 0xf7) { p += vlq(); }
      else {
        const hi = st & 0xf0, ch = st & 15;
        const a = d.getUint8(p++);
        const b = (hi === 0xc0 || hi === 0xd0) ? 0 : d.getUint8(p++);
        if (hi === 0x90 && b > 0) evs.push({ tick, type: 'on', ch, a, b, trk: t });
        else if (hi === 0x80 || hi === 0x90) evs.push({ tick, type: 'off', ch, a, b, trk: t });
      }
    }
    trackNames[t] = name;
    p = end;
  }
  evs.sort((x, y) => x.tick - y.tick);

  // tick → seconds (템포 맵)
  const tempos = evs.filter(e => e.type === 'tempo');
  const toSec = (tick: number) => {
    let sec = 0, last = 0, us = 500000;
    for (const t of tempos) { if (t.tick >= tick) break; sec += (t.tick - last) * us / 1e6 / div; last = t.tick; us = t.a; }
    return sec + (tick - last) * us / 1e6 / div;
  };

  const open = new Map<string, Ev>();
  const notes: Note[] = [];
  for (const e of evs) {
    const k = `${e.trk}:${e.ch}:${e.a}`;
    if (e.type === 'on') { if (!open.has(k)) open.set(k, e); }
    else if (e.type === 'off') {
      const o = open.get(k); if (!o) continue; open.delete(k);
      const t0 = toSec(o.tick);
      const nm = (trackNames[o.trk] || '').toLowerCase();
      notes.push({ time: t0, dur: Math.max(0.05, toSec(e.tick) - t0), midi: o.a, vel: o.b, hand: nm.includes('left') ? 'L' : nm.includes('right') ? 'R' : o.a < 60 ? 'L' : 'R' });
    }
  }
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
  const duration = notes.reduce((m, n) => Math.max(m, n.time + n.dur), 0);
  return { notes, duration, lo: Math.min(...notes.map(n => n.midi)), hi: Math.max(...notes.map(n => n.midi)) };
}

export async function loadMidi(url: string): Promise<Song> {
  const r = await fetch(url);
  return parseMidi(await r.arrayBuffer());
}
