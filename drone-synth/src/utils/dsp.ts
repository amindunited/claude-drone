export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function noteToFreq(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

let uid = 0;
export function nextId(): string {
  return 'id' + ++uid;
}

export interface Point {
  x: number;
  y: number;
}

export function polar(cx: number, cy: number, r: number, angDeg: number): Point {
  const a = ((angDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function arcPath(cx: number, cy: number, r: number, startA: number, endA: number): string {
  const s = polar(cx, cy, r, endA),
    e = polar(cx, cy, r, startA);
  const large = endA - startA <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  duty = clamp(duty, 0.02, 0.98);
  const terms = 32;
  const real = new Float32Array(terms),
    imag = new Float32Array(terms);
  for (let n = 1; n < terms; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * Derives a second noise buffer from an already-generated one without calling
 * Math.random() again: same samples, read starting from the opposite half of
 * the buffer, so two loop points playing `source` and this derived buffer at
 * the same instant never hit the same sample. Lets a dual-oscillator voice
 * get two independent-sounding noise sources for the cost of one RNG fill.
 */
export function deriveNoiseBuffer(ctx: BaseAudioContext, source: AudioBuffer): AudioBuffer {
  const src = source.getChannelData(0);
  const len = src.length;
  const half = len >> 1;
  const buf = ctx.createBuffer(1, len, source.sampleRate);
  const d = buf.getChannelData(0);
  d.set(src.subarray(half));
  d.set(src.subarray(0, half), len - half);
  return buf;
}

export function makeImpulseResponse(ctx: BaseAudioContext, seconds: number, damp: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, damp);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return ir;
}

export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
