/**
 * 사람 목소리 허밍 — Klatt식 소스-필터 합성 (AudioWorklet)
 *  - 성대: Rosenberg 글로탈 플로우의 미분. 사이클마다 지터(주기)·쉬머(진폭)·개방률이 무작위로 흔들림
 *  - 음정: 노트 사이 포르타멘토, 시작 스쿱, 늦게 붙는 불규칙 비브라토(속도도 변동), 느린 미세 표류
 *  - 숨소리: 성문 열림 구간에 맞춰 변조되는 고역 노이즈 (+ 노트 시작 시 'h' 같은 숨 소리)
 *  - 성도: 입을 다문 'mm' — 비음 극점(≈270Hz) + 안티포먼트(≈1kHz) + 넓은 대역폭의 F1~F4 캐스케이드.
 *          입을 살짝 벌리는 정도(open)에 따라 F1/F2/영점이 함께 움직여 살아있는 느낌을 준다
 */
import { BasicHum, type VoiceNote } from './voiceBasic';
export type { VoiceNote };

/** 성도 밴드 설정: [종류(0=저역 공명, 1=대역통과), 중심Hz, 대역폭Hz, 게인, open에 따른 중심 이동, open에 따른 대역폭 변화] */
export type Band = [number, number, number, number, number, number];
export interface VoiceCfg { pre: number; src: number; out: number; zero: [number, number, number]; bands: Band[]; }
/** 실제 워크릿을 반복 렌더링해 사람 허밍의 배음 곡선(h1 0dB, h2 ≈-11, h3 ≈-19, h4 ≈-25 …)에 맞춘 값 */
export const DEFAULT_CFG: VoiceCfg = {
  pre: 0.3, src: 24, out: 0.0217, zero: [1000, 3512, 420],
  bands: [[0, 600.6, 1889.5, 135.6, 200, -40], [1, 221.5, 110.7, 4.58, 200, -60], [1, 1892, 572.9, 0.017, 300, -60], [1, 1268.7, 180, 0.219, 0, 0], [1, 2992, 766.9, 0.003, 0, 0]],
};

export const WORKLET = `
class HumProc extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [
    { name: 'f0', defaultValue: 220, minValue: 40, maxValue: 1500, automationRate: 'a-rate' },
    { name: 'amp', defaultValue: 0, minValue: 0, maxValue: 8, automationRate: 'a-rate' },
    { name: 'vib', defaultValue: 0, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
    { name: 'breath', defaultValue: 0.05, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    { name: 'open', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
  ]; }
  constructor(opts) {
    super();
    this.cfg = opts.processorOptions.cfg;
    this.rng = 2463534242; this.p = 0; this.g = 0; this.vp = 0; this.drift = 0; this.slow = 0;
    this.jit = 1; this.shim = 1; this.oq = 0.62; this.lp = 0; this.nzl = 0; this.pre = 0;
    this.zx1 = 0; this.zx2 = 0;
    this.st = new Float64Array(this.cfg.bands.length * 4);
    this.co = this.cfg.bands.map(() => [0, 0, 0, 0]);
  }
  rand() { let x = this.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0; return this.rng / 4294967296; }
  gauss() { return (this.rand() + this.rand() + this.rand() + this.rand() - 2) * 1.732; }
  res(F, BW) { const r = Math.exp(-Math.PI * BW / sampleRate), c = -r * r, b = 2 * r * Math.cos(2 * Math.PI * F / sampleRate); return [1 - b - c, b, c]; }
  bp(F, BW) { const w = 2 * Math.PI * F / sampleRate, al = Math.sin(w) / (2 * (F / BW)), a0 = 1 + al; return [al / a0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0]; }
  process(inputs, outputs, P) {
    const out = outputs[0], L = out[0], n = L.length, sr = sampleRate, cfg = this.cfg;
    const vib = P.vib[0], br = P.breath[0], op = P.open[0];
    const B = cfg.bands, st = this.st, co = this.co;
    for (let k = 0; k < B.length; k++) {
      const F = B[k][1] + B[k][4] * op, BW = Math.max(40, B[k][2] + B[k][5] * op);
      if (B[k][0] === 0) { const r = this.res(F, BW); co[k][0] = r[0]; co[k][1] = r[1]; co[k][2] = r[2]; } else { const r = this.bp(F, BW); co[k][0] = r[0]; co[k][1] = r[1]; co[k][2] = r[2]; co[k][3] = r[3]; }
    }
    const zr = this.res(cfg.zero[0] + cfg.zero[2] * op, cfg.zero[1]), zA = 1 / zr[0], zB = -zr[1] / zr[0], zC = -zr[2] / zr[0];
    const PRE = cfg.pre;
    for (let i = 0; i < n; i++) {
      const f0 = P.f0.length > 1 ? P.f0[i] : P.f0[0], amp = P.amp.length > 1 ? P.amp[i] : P.amp[0];
      this.slow += (this.gauss() - this.slow) * 0.00004;
      this.drift += (this.gauss() - this.drift) * 0.0006;
      this.vp += 2 * Math.PI * (5.2 + this.slow * 110) / sr;
      const cents = vib * Math.sin(this.vp) * (1 + 0.25 * Math.sin(this.vp * 0.13)) + this.drift * 350;
      const f = f0 * Math.pow(2, cents / 1200) * this.jit;
      this.p += f / sr;
      if (this.p >= 1) { this.p -= 1; this.jit = 1 + this.gauss() * 0.0045; this.shim = 1 + this.gauss() * 0.04; this.oq = 0.62 + this.gauss() * 0.025; }
      const OQ = this.oq, Tp = OQ * 0.62, Tn = OQ * 0.38, p = this.p;
      let g = 0;
      if (p < Tp) g = 0.5 * (1 - Math.cos(Math.PI * p / Tp)); else if (p < OQ) g = Math.cos(Math.PI * 0.5 * (p - Tp) / Tn);
      const dg = (g - this.g) * this.shim; this.g = g;
      this.lp += (dg - this.lp) * 0.5;
      const nz = this.gauss(); const hp = nz - this.nzl; this.nzl += (nz - this.nzl) * 0.12;
      let x = this.lp * cfg.src + hp * br * 0.55 * (0.3 + g);
      const t = zA * x + zB * this.zx1 + zC * this.zx2; this.zx2 = this.zx1; this.zx1 = x; x = t;
      const xin = x; x = xin - PRE * this.pre; this.pre = xin;
      let sum = 0;
      for (let k = 0; k < B.length; k++) {
        const c = co[k], o = k * 4; let y;
        if (B[k][0] === 0) { y = c[0] * x + c[1] * st[o] + c[2] * st[o + 1]; st[o + 1] = st[o]; st[o] = y; }
        else { y = c[0] * x + c[1] * st[o + 1] - c[2] * st[o + 2] - c[3] * st[o + 3]; st[o + 1] = st[o]; st[o] = x; st[o + 3] = st[o + 2]; st[o + 2] = y; }
        sum += y * B[k][3];
      }
      L[i] = sum * amp * cfg.out * Math.pow(415.3 / f, 0.78);    // 음정에 따른 음량 차이 보정
    }
    for (let c = 1; c < out.length; c++) out[c].set(L);
    return true;
  }
}
registerProcessor('hum-proc', HumProc);
`;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const loaded = new WeakSet<BaseAudioContext>();

export interface Voice { noteOn(n: VoiceNote, when: number): void; silence(now: number): void; }

export class HumVoice implements Voice {
  private lastEnd = -1;
  private constructor(private node: AudioWorkletNode, private level: number) {}

  static async create(ctx: BaseAudioContext, dest: AudioNode, level = 0.2): Promise<Voice> {
    try {
      if (!loaded.has(ctx)) {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url); URL.revokeObjectURL(url); loaded.add(ctx);
      }
      const node = new AudioWorkletNode(ctx, 'hum-proc', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { cfg: DEFAULT_CFG } });
      const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 90;
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 4200; lpf.Q.value = 0.6;   // 5kHz 이상 잡음 제거
      node.connect(hpf); hpf.connect(lpf); lpf.connect(dest);
      return new HumVoice(node, level);
    } catch {
      return new BasicHum(ctx, dest, level);                     // AudioWorklet 미지원 환경 대비
    }
  }

  private get P() { return this.node.parameters as unknown as Map<string, AudioParam>; }

  noteOn(n: VoiceNote, when: number) {
    const f0 = this.P.get('f0')!, amp = this.P.get('amp')!, vib = this.P.get('vib')!, br = this.P.get('breath')!, open = this.P.get('open')!;
    const f = mtof(n.midi), end = when + n.dur;
    const lvl = this.level * (0.6 + 0.4 * Math.min(1, n.vel / 127));
    const legato = when - this.lastEnd < 0.14 && this.lastEnd > 0;
    for (const p of [f0, amp, vib, br, open]) p.cancelScheduledValues(when);
    if (legato) {
      f0.setTargetAtTime(f, when, 0.05);                            // 이어 부르기: 포르타멘토
      amp.setTargetAtTime(lvl * 0.55, when - 0.02, 0.025); amp.setTargetAtTime(lvl, when + 0.05, 0.07);
    } else {
      f0.setValueAtTime(f * Math.pow(2, -0.25 / 12), when); f0.setTargetAtTime(f, when, 0.08);   // 아래에서 스쿱
      amp.setValueAtTime(lvl * 0.25, Math.max(0, when - 0.05)); amp.setTargetAtTime(lvl, when, 0.08);
      br.setValueAtTime(0.6, Math.max(0, when - 0.05)); br.setTargetAtTime(0.08, when + 0.02, 0.07);   // 'h' 같은 숨
      vib.setTargetAtTime(0, when, 0.03);
    }
    vib.setTargetAtTime(14, when + 0.28, 0.3);                       // 비브라토는 늦게, 서서히
    open.setTargetAtTime(0.32, when + 0.05, 0.18);                   // 살짝 입을 벌렸다가
    if (n.dur > 0.9) { f0.setTargetAtTime(f * 0.99, when + n.dur * 0.7, 0.4); amp.setTargetAtTime(lvl * 0.85, when + n.dur * 0.55, 0.3); }
    open.setTargetAtTime(0, end - 0.15, 0.1);
    amp.setTargetAtTime(0, end - 0.02, 0.1); br.setTargetAtTime(0.03, end - 0.02, 0.06);
    this.lastEnd = end;
  }

  silence(now: number) {
    for (const k of ['f0', 'amp', 'vib', 'breath', 'open']) this.P.get(k)!.cancelScheduledValues(now);
    this.P.get('amp')!.setTargetAtTime(0, now, 0.03); this.lastEnd = -1;
  }
}
