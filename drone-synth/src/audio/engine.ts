import { clamp, lerp, makeImpulseResponse } from '../utils/dsp';

export interface DistortionFx {
  input: GainNode;
  out: GainNode;
  setAmount(amt: number): void;
  setTone(hz: number): void;
  setDrive(g: number): void;
  setReturn(g: number): void;
}

export interface ChorusFx {
  input: GainNode;
  out: GainNode;
  lfo: OscillatorNode;
  setRate(hz: number): void;
  setDepth(ms: number): void;
  setMix(m: number): void;
  setReturn(g: number): void;
}

export interface DelayFx {
  input: GainNode;
  out: GainNode;
  setTime(sec: number): void;
  setFeedback(f: number): void;
  setDamp(hz: number): void;
  setMix(m: number): void;
  setReturn(g: number): void;
}

export interface ReverbFx {
  input: GainNode;
  out: GainNode;
  setSize(sec: number): void;
  setDamp(d: number): void;
  setMix(m: number): void;
  setReturn(g: number): void;
}

export interface EngineFx {
  distortion: DistortionFx;
  chorus: ChorusFx;
  delay: DelayFx;
  reverb: ReverbFx;
}

export interface SyncedLfoEntry {
  osc: OscillatorNode;
  beats: number;
  mode: 'hz' | 'sync';
}

class EngineController {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  bpm = 60;
  fx!: EngineFx;
  syncedLfos = new Set<SyncedLfoEntry>();

  init(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;
    this.master.connect(this.limiter).connect(this.ctx.destination);
    this._buildFx();
  }

  resume(): void {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    this.syncedLfos.forEach((entry) => {
      if (entry.mode !== 'sync') return;
      const hz = this.bpm / 60 / entry.beats;
      entry.osc.frequency.setTargetAtTime(hz, this.ctx!.currentTime, 0.05);
    });
  }

  divisionHz(beats: number): number {
    return this.bpm / 60 / beats;
  }

  private _buildFx(): void {
    const ctx = this.ctx!;
    const master = this.master!;

    const distortion = (() => {
      const input = ctx.createGain();
      input.gain.value = 1;
      const drive = ctx.createGain();
      drive.gain.value = 1;
      const shaper = ctx.createWaveShaper();
      shaper.oversample = '4x';
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 6000;
      const out = ctx.createGain();
      out.gain.value = 0.5;
      input.connect(drive).connect(shaper).connect(tone).connect(out).connect(master);
      const setAmount = (amt: number) => {
        const k = lerp(1, 60, amt);
        const n = 1024,
          curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const x = (i * 2) / n - 1;
          curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
        }
        shaper.curve = curve;
      };
      setAmount(0.3);
      const fx: DistortionFx = {
        input,
        out,
        setAmount,
        setTone: (hz) => tone.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02),
        setDrive: (g) => drive.gain.setTargetAtTime(g, ctx.currentTime, 0.02),
        setReturn: (g) => out.gain.setTargetAtTime(g, ctx.currentTime, 0.02),
      };
      return fx;
    })();

    const chorus = (() => {
      const input = ctx.createGain();
      const dry = ctx.createGain();
      dry.gain.value = 0.5;
      const wetIn = ctx.createGain();
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.012;
      const modGain = ctx.createGain();
      modGain.gain.value = 0.004;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.6;
      lfo.start();
      lfo.connect(modGain).connect(delay.delayTime);
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      const out = ctx.createGain();
      out.gain.value = 0.5;
      input.connect(dry).connect(out);
      input.connect(wetIn).connect(delay).connect(wet).connect(out);
      out.connect(master);
      const fx: ChorusFx = {
        input,
        out,
        lfo,
        setRate: (hz) => lfo.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02),
        setDepth: (ms) => modGain.gain.setTargetAtTime(ms / 1000, ctx.currentTime, 0.02),
        setMix: (m) => {
          wet.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
          dry.gain.setTargetAtTime(1 - m, ctx.currentTime, 0.02);
        },
        setReturn: (g) => out.gain.setTargetAtTime(g, ctx.currentTime, 0.02),
      };
      return fx;
    })();

    const delayFx = (() => {
      const input = ctx.createGain();
      const delay = ctx.createDelay(4);
      delay.delayTime.value = 0.35;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 4000;
      const wet = ctx.createGain();
      wet.gain.value = 0.6;
      const out = ctx.createGain();
      out.gain.value = 0.4;
      input.connect(delay);
      delay.connect(damp).connect(fb).connect(delay);
      delay.connect(wet).connect(out);
      out.connect(master);
      const fx: DelayFx = {
        input,
        out,
        setTime: (sec) => delay.delayTime.setTargetAtTime(clamp(sec, 0.001, 4), ctx.currentTime, 0.02),
        setFeedback: (f) => fb.gain.setTargetAtTime(clamp(f, 0, 0.95), ctx.currentTime, 0.02),
        setDamp: (hz) => damp.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02),
        setMix: (m) => wet.gain.setTargetAtTime(m, ctx.currentTime, 0.02),
        setReturn: (g) => out.gain.setTargetAtTime(g, ctx.currentTime, 0.02),
      };
      return fx;
    })();

    const reverb = (() => {
      const input = ctx.createGain();
      const convolver = ctx.createConvolver();
      convolver.buffer = makeImpulseResponse(ctx, 2.5, 2.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      const out = ctx.createGain();
      out.gain.value = 0.45;
      input.connect(convolver).connect(wet).connect(out);
      out.connect(master);
      let curSize = 2.5,
        curDamp = 2.2;
      const fx: ReverbFx = {
        input,
        out,
        setSize: (sec) => {
          curSize = sec;
          convolver.buffer = makeImpulseResponse(ctx, curSize, curDamp);
        },
        setDamp: (d) => {
          curDamp = d;
          convolver.buffer = makeImpulseResponse(ctx, curSize, curDamp);
        },
        setMix: (m) => wet.gain.setTargetAtTime(m, ctx.currentTime, 0.02),
        setReturn: (g) => out.gain.setTargetAtTime(g, ctx.currentTime, 0.02),
      };
      return fx;
    })();

    this.fx = { distortion, chorus, delay: delayFx, reverb };
  }
}

export const Engine = new EngineController();
