import type { Note, Song } from './midi';
import { HumVoice } from './voice';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface HumNote { time: number; dur: number; midi: number; vel: number; }
/** 허밍이 나오는 구간(초): 0:50 ~ 1:15 */
export const HUM_START = 50, HUM_END = 75;

/** MIDI 오른손 성부의 최상성(멜로디)을 뽑아 테리가 부르기 편한 음역(G3~G5)으로 옮긴다 */
export function extractHum(song: Song): HumNote[] {
  const rh = song.notes.filter(n => n.hand === 'R');
  const byOnset = new Map<number, Note>();
  for (const n of rh) {
    const k = Math.round(n.time * 200);
    const c = byOnset.get(k);
    if (!c || n.midi > c.midi) byOnset.set(k, n);
  }
  const top = [...byOnset.values()].sort((a, b) => a.time - b.time).filter(n => n.dur >= 0.18);
  const out: HumNote[] = [];
  for (let i = 0; i < top.length; i++) {
    const n = top[i];
    let m = n.midi;
    while (m > 79) m -= 12;
    while (m < 55) m += 12;
    const next = top[i + 1];
    const end = Math.min(n.time + n.dur, next ? next.time - 0.03 : Infinity);
    if (end - n.time > 0.1) out.push({ time: n.time, dur: end - n.time, midi: m, vel: n.vel });
  }
  return out
    .filter(h => h.time >= HUM_START && h.time < HUM_END)
    .map(h => ({ ...h, dur: Math.min(h.dur, HUM_END - h.time) }));
}

export const HUM_LEVEL = 0.04;

export class Player {
  ctx: AudioContext;
  private master: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private humBus: GainNode;
  private voice!: HumVoice;
  private voices: { g: GainNode; end: number }[] = [];
  private idx = 0;
  private hidx = 0;
  private startCtx = 0;
  private offset = 0;
  playing = false;
  humOn = true;
  onEnd: () => void = () => {};
  private timer = 0;
  private noise: AudioBuffer;
  hum: HumNote[];

  constructor(private song: Song) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    const warm = c.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 7500;
    this.dry = c.createGain(); this.dry.gain.value = 0.85;
    this.wet = c.createGain(); this.wet.gain.value = 0.32;
    const conv = c.createConvolver(); conv.buffer = this.impulse(2.6, 2.2);
    this.dry.connect(warm); this.dry.connect(conv); conv.connect(this.wet); this.wet.connect(warm);
    warm.connect(comp); comp.connect(this.master); this.master.connect(c.destination);
    this.humBus = c.createGain(); this.humBus.gain.value = 1;
    const humWet = c.createGain(); humWet.gain.value = 0.35;             // 허밍은 리버브를 적게
    this.humBus.connect(warm); this.humBus.connect(humWet); humWet.connect(conv);
    this.noise = this.makeNoise();
    this.hum = extractHum(song);
    this.buildHum();
  }

  private impulse(sec: number, decay: number) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1);
    }
    return b;
  }
  private makeNoise() {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private buildHum() { this.voice = new HumVoice(this.ctx, this.humBus, HUM_LEVEL); }

  private piano(n: Note, when: number) {
    const c = this.ctx, f = mtof(n.midi);
    const v = Math.pow(n.vel / 127, 1.35);
    const peak = 0.20 * (0.25 + v) * (n.midi < 48 ? 1.15 : n.midi > 84 ? 0.75 : 1);
    const decay = Math.max(1.4, 7.5 - (n.midi - 21) * 0.065);
    const off = when + n.dur;
    const out = c.createGain(); out.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
    lp.frequency.value = Math.min(9000, 1400 + v * 4200 + f * 1.5);
    lp.connect(out); out.connect(this.dry);
    const parts = n.midi > 90 ? 3 : n.midi > 72 ? 4 : 6;
    const B = 0.00018 * Math.pow(1.05, (n.midi - 40) / 4);
    for (let k = 1; k <= parts; k++) {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.value = f * k * Math.sqrt(1 + B * k * k) * (1 + (Math.random() - 0.5) * 0.0006);
      const g = c.createGain();
      const amp = peak / Math.pow(k, 1.15) * (k > 2 ? 0.6 + v * 0.8 : 1);
      const dk = decay / (1 + (k - 1) * 0.55);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(amp, when + 0.004);
      g.gain.setTargetAtTime(amp * 0.0001, when + 0.004, dk / 4.2);
      o.connect(g); g.connect(lp);
      o.start(when); o.stop(off + 1.4);
    }
    // 해머 노이즈
    const ns = c.createBufferSource(); ns.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 3); bp.Q.value = 0.9;
    const ng = c.createGain(); ng.gain.setValueAtTime(peak * 0.55 * v, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(when); ns.stop(when + 0.05);
    // 댐퍼(부드러운 릴리스)
    out.gain.setValueAtTime(1, off);
    out.gain.setTargetAtTime(0, off, 0.16);
    this.voices.push({ g: out, end: off + 1.4 });
  }

  private schedule() {
    const c = this.ctx, t = c.currentTime - this.startCtx;
    const ahead = t + 0.6;
    const N = this.song.notes;
    while (this.idx < N.length && N[this.idx].time < ahead) {
      const n = N[this.idx++];
      const when = this.startCtx + n.time;
      if (when >= c.currentTime - 0.02) this.piano(n, Math.max(when, c.currentTime));
    }
    const H = this.hum;
    while (this.hidx < H.length && H[this.hidx].time < ahead) {
      const h = H[this.hidx++];
      const when = this.startCtx + h.time;
      if (when < c.currentTime - 0.02) continue;
      const fade = Math.min(1, Math.max(0.3, (h.time - HUM_START) / 3), Math.max(0.3, (HUM_END - h.time) / 3));
      this.voice.noteOn({ ...h, vel: h.vel * fade }, Math.max(when, c.currentTime));
    }
    this.voices = this.voices.filter(v => v.end > c.currentTime);
    if (t > this.song.duration + 2.5) { this.pause(true); this.onEnd(); }
  }

  time() { return this.playing ? Math.max(0, this.ctx.currentTime - this.startCtx) : this.offset; }

  async play() {
    await this.ctx.resume();
    if (this.playing) return;
    if (this.offset >= this.song.duration + 1) this.offset = 0;
    this.startCtx = this.ctx.currentTime + 0.12 - this.offset;
    this.reindex(this.offset);
    this.playing = true;
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.setHum(this.humOn);
  }
  pause(ended = false) {
    if (!this.playing) return;
    this.offset = ended ? 0 : this.time();
    this.playing = false;
    clearInterval(this.timer);
    this.silence();
  }
  seek(t: number) {
    const was = this.playing;
    if (was) this.pause();
    this.offset = Math.max(0, Math.min(t, this.song.duration));
    if (was) void this.play();
  }
  private reindex(t: number) {
    this.idx = this.song.notes.findIndex(n => n.time >= t); if (this.idx < 0) this.idx = this.song.notes.length;
    this.hidx = this.hum.findIndex(n => n.time >= t); if (this.hidx < 0) this.hidx = this.hum.length;
  }
  private silence() {
    const now = this.ctx.currentTime;
    for (const v of this.voices) { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.03); }
    this.voices = [];
    this.voice.silence(now);
  }
  setHum(on: boolean) { this.humOn = on; this.humBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  setVolume(v: number) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
}
