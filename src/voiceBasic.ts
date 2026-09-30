/**
 * 사람 목소리 같은 허밍 합성 (소스-필터 모델)
 *  - 성대: 고조파가 -1.7 기울기로 줄어드는 글로탈 파형(PeriodicWave)
 *  - 음정: 노트 사이 포르타멘토, 시작 시 살짝 아래에서 올라오는 스쿱, 늦게 붙는 비브라토, 느린 미세 흔들림(지터)
 *  - 성도: 입을 다문 'mm' — 낮은 비음 공명 + 1kHz 부근 안티포먼트(노치) + 약한 상위 포먼트
 *  - 숨소리: 대역통과 노이즈를 목소리 세기에 맞춰 섞음
 */
export interface VoiceNote { time: number; dur: number; midi: number; vel: number; }

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class BasicHum {
  private osc: OscillatorNode;
  private amp: GainNode;
  private vibDepth: GainNode;
  private f1: BiquadFilterNode;
  private breath: GainNode;
  private lastEnd = -1;
  private lastMidi = 0;

  constructor(private ctx: BaseAudioContext, dest: AudioNode, private level = 0.2) {
    const c = ctx;
    // 글로탈 파형
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let k = 1; k < N; k++) im[k] = Math.pow(k, -1.7) * (k === 1 ? 0.9 : 1);
    this.osc = c.createOscillator(); this.osc.setPeriodicWave(c.createPeriodicWave(re, im));
    this.osc.frequency.value = 330;

    // 비브라토(5.4Hz) + 진폭 트레몰로, 느린 지터
    const lfo = c.createOscillator(); lfo.frequency.value = 5.4;
    this.vibDepth = c.createGain(); this.vibDepth.gain.value = 0;
    lfo.connect(this.vibDepth); this.vibDepth.connect(this.osc.detune);
    const trem = c.createGain(); trem.gain.value = 0.03; lfo.connect(trem);
    const jitBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    { const d = jitBuf.getChannelData(0); let v = 0; for (let i = 0; i < d.length; i++) { v += (Math.random() * 2 - 1 - v) * 0.0009; d[i] = v; } let mx = 0; for (const x of d) mx = Math.max(mx, Math.abs(x)); for (let i = 0; i < d.length; i++) d[i] = d[i] / (mx || 1); }
    const jit = c.createBufferSource(); jit.buffer = jitBuf; jit.loop = true;
    const jitG = c.createGain(); jitG.gain.value = 4;                       // ±4센트
    jit.connect(jitG); jitG.connect(this.osc.detune);

    // 성도 (mm)
    const src = c.createGain(); src.gain.value = 1;
    this.osc.connect(src);
    const lp0 = c.createBiquadFilter(); lp0.type = 'lowpass'; lp0.frequency.value = 2400; lp0.Q.value = 0.5;
    this.f1 = c.createBiquadFilter(); this.f1.type = 'peaking'; this.f1.frequency.value = 300; this.f1.Q.value = 4.5; this.f1.gain.value = 16;
    const nn = c.createBiquadFilter(); nn.type = 'notch'; nn.frequency.value = 1050; nn.Q.value = 1.6;
    const f2 = c.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 1600; f2.Q.value = 3; f2.gain.value = 5;
    const f3 = c.createBiquadFilter(); f3.type = 'peaking'; f3.frequency.value = 2700; f3.Q.value = 4; f3.gain.value = 4;
    const lp1 = c.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 3400; lp1.Q.value = 0.6;
    src.connect(lp0); lp0.connect(this.f1); this.f1.connect(nn); nn.connect(f2); f2.connect(f3); f3.connect(lp1);

    this.amp = c.createGain(); this.amp.gain.value = 0;
    lp1.connect(this.amp);
    const tg = c.createGain(); tg.gain.value = 1;                    // 트레몰로는 곱셈(무음일 때 새지 않게)
    trem.connect(tg.gain); this.amp.connect(tg);

    // 숨소리
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nbp = c.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 2200; nbp.Q.value = 0.7;
    this.breath = c.createGain(); this.breath.gain.value = 0;
    ns.connect(nbp); nbp.connect(this.breath);

    const out = c.createGain(); out.gain.value = 1;
    tg.connect(out); this.breath.connect(out); out.connect(dest);
    this.osc.start(); lfo.start(); jit.start(); ns.start();
  }

  noteOn(n: VoiceNote, when: number) {
    const p = this.osc.frequency, a = this.amp.gain, vd = this.vibDepth.gain, br = this.breath.gain;
    const f = mtof(n.midi), end = when + n.dur;
    const lvl = this.level * (0.6 + 0.4 * Math.min(1, n.vel / 127));
    const legato = when - this.lastEnd < 0.14 && this.lastEnd > 0;
    p.cancelScheduledValues(when); a.cancelScheduledValues(when); vd.cancelScheduledValues(when); br.cancelScheduledValues(when);
    this.f1.frequency.setTargetAtTime(Math.min(520, Math.max(270, f * 0.92)), when, 0.05);   // 소프라노처럼 F1을 음정에 맞춤
    if (legato) {
      p.setTargetAtTime(f, when, 0.045);                                                    // 이어 부르기: 포르타멘토
      a.setTargetAtTime(lvl * 0.6, when - 0.02, 0.025);                                     // 같은 음 반복 시 살짝 끊김
      a.setTargetAtTime(lvl, when + 0.05, 0.06);
    } else {
      p.setValueAtTime(f * Math.pow(2, -0.18 / 12), when); p.setTargetAtTime(f, when, 0.07);    // 아래에서 스쿱
      a.setTargetAtTime(lvl, when, 0.07);                                                   // 부드러운 어택
      vd.setTargetAtTime(0, when, 0.03);
    }
    vd.setTargetAtTime(10, when + 0.25, 0.3);                                              // 비브라토는 늦게 붙는다
    br.setTargetAtTime(lvl * 0.07, when, 0.05);
    if (n.dur > 1.0) p.setTargetAtTime(f * 0.992, when + n.dur * 0.72, 0.35);                // 긴 음 끝에서 살짝 내려앉음
    a.setTargetAtTime(0, end - 0.02, 0.09); br.setTargetAtTime(0, end - 0.02, 0.06);
    this.lastEnd = end; this.lastMidi = n.midi;
  }

  silence(now: number) {
    for (const p of [this.amp.gain, this.breath.gain, this.vibDepth.gain, this.osc.frequency]) p.cancelScheduledValues(now);
    this.amp.gain.setTargetAtTime(0, now, 0.03); this.breath.gain.setTargetAtTime(0, now, 0.03); this.lastEnd = -1;
  }
}
