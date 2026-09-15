import { clamp, noiseBuffer, noteToFreq, pulseWave } from '../utils/dsp';
import type { LfoRateMode, LfoTarget, OscType, VoiceParams } from '../types';
import { Engine, type SyncedLfoEntry } from './engine';
import type { Voice } from './voice';

type LfoSlot = 'lfo' | 'lfo2';

interface LfoSettings {
  target: LfoTarget;
  rateMode: LfoRateMode;
  rateHz: number;
  rateDivision: number;
  depth: number;
}

function readLfoSettings(p: VoiceParams, slot: LfoSlot): LfoSettings {
  if (slot === 'lfo') {
    return { target: p.lfoTarget, rateMode: p.lfoRateMode, rateHz: p.lfoRateHz, rateDivision: p.lfoRateDivision, depth: p.lfoDepth };
  }
  return { target: p.lfo2Target, rateMode: p.lfo2RateMode, rateHz: p.lfo2RateHz, rateDivision: p.lfo2RateDivision, depth: p.lfo2Depth };
}

interface LfoState {
  lfo: OscillatorNode;
  depth: GainNode;
  target: LfoTarget | null;
  syncEntry: SyncedLfoEntry;
}

export class NoteVoice {
  voice: Voice;
  note: number;
  releasing = false;
  pitchSemitones: number;
  src: OscillatorNode | AudioBufferSourceNode;
  osc2Src?: OscillatorNode | AudioBufferSourceNode;
  osc2Gain?: GainNode;
  filter: BiquadFilterNode;
  filter2: BiquadFilterNode;
  filter2Enabled: boolean;
  fenv: ConstantSourceNode;
  fenvGain: GainNode;
  fenv2Gain: GainNode;
  amp: GainNode;
  lfo1: LfoState;
  lfo2: LfoState | null;

  constructor(voice: Voice, note: number, velocity: number) {
    const ctx = Engine.ctx!,
      now = ctx.currentTime,
      p = voice.params;
    this.voice = voice;
    this.note = note;
    this.pitchSemitones = p.pitch || 0;

    /* source */
    const freq1 = noteToFreq(note) * Math.pow(2, (p.pitch || 0) / 12);
    const src = this._createOscSource(p.osc, p.pulseWidth, freq1);
    this.src = src;

    /* filter */
    const filter = ctx.createBiquadFilter();
    filter.type = p.filterType;
    filter.frequency.value = p.cutoff;
    filter.Q.value = p.resonance;
    this.filter = filter;

    /* filter 2 (always instantiated, series after filter 1; bypassed unless filter2Enabled) */
    const filter2 = ctx.createBiquadFilter();
    filter2.type = p.filter2Type;
    filter2.frequency.value = p.filter2Cutoff;
    filter2.Q.value = p.filter2Resonance;
    this.filter2 = filter2;
    this.filter2Enabled = !!p.filter2Enabled;

    /* filter envelope (constant source * depth -> filter freq), shared shape, independent depth per filter */
    const fenv = ctx.createConstantSource();
    const fenvGain = ctx.createGain();
    fenvGain.gain.value = p.envDepth;
    fenv.connect(fenvGain).connect(filter.frequency);
    const fenv2Gain = ctx.createGain();
    fenv2Gain.gain.value = p.filter2EnvDepth;
    fenv.connect(fenv2Gain).connect(filter2.frequency);
    fenv.start();
    this.fenv = fenv;
    this.fenvGain = fenvGain;
    this.fenv2Gain = fenv2Gain;

    /* amp envelope */
    const amp = ctx.createGain();
    amp.gain.value = 0;
    this.amp = amp;

    src.connect(filter);
    this._connectFilterChain(this.filter2Enabled);
    amp.connect(voice.bus);
    src.start();

    /* Dual LFOs (LFO2 only allocated when explicitly enabled) */
    this.lfo1 = this._createLfo('lfo', p);
    this.lfo2 = p.lfo2Enabled ? this._createLfo('lfo2', p) : null;

    /* optional second oscillator (VCO2), mixed into the same filter/LFO chain as VCO1 */
    if (p.osc2Enabled) {
      this._addOsc2(p);
    }

    /* schedule ADSR */
    const vel = clamp(velocity / 127, 0.05, 1);
    const peak = vel;
    const sus = p.sustain * vel;
    amp.gain.cancelScheduledValues(now);
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(peak, now + Math.max(0.002, p.attack));
    amp.gain.linearRampToValueAtTime(sus, now + p.attack + Math.max(0.002, p.decay));

    fenv.offset.cancelScheduledValues(now);
    fenv.offset.setValueAtTime(0, now);
    fenv.offset.linearRampToValueAtTime(1, now + Math.max(0.002, p.attack));
    fenv.offset.linearRampToValueAtTime(p.sustain, now + p.attack + Math.max(0.002, p.decay));
  }

  private _createOscSource(type: OscType, pulseWidth: number, freq: number): OscillatorNode | AudioBufferSourceNode {
    const ctx = Engine.ctx!;
    if (type === 'noise') {
      const bufferSrc = ctx.createBufferSource();
      bufferSrc.buffer = noiseBuffer(ctx);
      bufferSrc.loop = true;
      return bufferSrc;
    }
    const oscSrc = ctx.createOscillator();
    if (type === 'pulse') {
      oscSrc.setPeriodicWave(pulseWave(ctx, pulseWidth));
    } else {
      oscSrc.type = type;
    }
    oscSrc.frequency.value = freq;
    return oscSrc;
  }

  private _addOsc2(p: VoiceParams): void {
    const freq2 = noteToFreq(this.note) * Math.pow(2, (p.osc2Pitch || 0) / 12);
    const osc2Src = this._createOscSource(p.osc2, p.osc2PulseWidth, freq2);
    const osc2Gain = Engine.ctx!.createGain();
    osc2Gain.gain.value = p.osc2Level;
    osc2Src.connect(osc2Gain).connect(this.filter);
    osc2Src.start();
    this.osc2Src = osc2Src;
    this.osc2Gain = osc2Gain;
    this._reconnectLfoTargets();
  }

  private _removeOsc2(): void {
    if (this.osc2Src) {
      try {
        this.osc2Src.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.osc2Src.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    if (this.osc2Gain) {
      try {
        this.osc2Gain.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.osc2Src = undefined;
    this.osc2Gain = undefined;
    this._reconnectLfoTargets();
  }

  private _connectFilterChain(filter2Enabled: boolean): void {
    try {
      this.filter.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.filter2.disconnect();
    } catch {
      /* already disconnected */
    }
    if (filter2Enabled) {
      this.filter.connect(this.filter2);
      this.filter2.connect(this.amp);
    } else {
      this.filter.connect(this.amp);
    }
  }

  private _reconnectLfoTargets(): void {
    this._connectLfoTarget(this.lfo1, this.lfo1.target ?? 'none');
    if (this.lfo2) this._connectLfoTarget(this.lfo2, this.lfo2.target ?? 'none');
  }

  private _createLfo(slot: LfoSlot, p: VoiceParams): LfoState {
    const lfo = Engine.ctx!.createOscillator();
    lfo.type = 'sine';
    const depth = Engine.ctx!.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    lfo.start();
    const settings = readLfoSettings(p, slot);
    const state: LfoState = { lfo, depth, target: null, syncEntry: { osc: lfo, beats: 1, mode: settings.rateMode } };
    this._applyLfoSettings(state, settings);
    this._connectLfoTarget(state, settings.target);
    Engine.syncedLfos.add(state.syncEntry);
    this._setLfoRate(state, settings);
    return state;
  }

  private _connectLfoTarget(state: LfoState, target: LfoTarget): void {
    if (state.target) {
      try {
        state.depth.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    state.target = target;
    if (target === 'pitch') {
      state.depth.connect(this.src.detune);
      if (this.osc2Src) state.depth.connect(this.osc2Src.detune);
    } else if (target === 'filter') {
      state.depth.connect(this.filter.frequency);
    } else if (target === 'filter2') {
      state.depth.connect(this.filter2.frequency);
    } else if (target === 'amplitude') {
      state.depth.connect(this.amp.gain);
    }
    /* 'none' -> stays disconnected */
  }

  private _applyLfoSettings(state: LfoState, settings: LfoSettings): void {
    let depthVal = 0;
    if (settings.target === 'pitch') depthVal = settings.depth * 1200; // cents (0-1 -> 0-1200)
    else if (settings.target === 'filter' || settings.target === 'filter2') depthVal = settings.depth * 4000; // Hz
    else if (settings.target === 'amplitude') depthVal = settings.depth * 0.5; // gain
    state.depth.gain.setTargetAtTime(depthVal, Engine.ctx!.currentTime, 0.03);
  }

  private _teardownLfo2(): void {
    if (!this.lfo2) return;
    Engine.syncedLfos.delete(this.lfo2.syncEntry);
    try {
      this.lfo2.lfo.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.lfo2.lfo.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.lfo2.depth.disconnect();
    } catch {
      /* already disconnected */
    }
    this.lfo2 = null;
  }

  private _setLfoRate(state: LfoState, settings: LfoSettings): void {
    let hz: number;
    if (settings.rateMode === 'sync') {
      hz = Engine.divisionHz(settings.rateDivision);
    } else {
      hz = settings.rateHz;
    }
    state.lfo.frequency.setTargetAtTime(hz, Engine.ctx!.currentTime, 0.03);
    if (state.syncEntry) {
      state.syncEntry.beats = settings.rateDivision;
      state.syncEntry.mode = settings.rateMode;
    }
  }

  updateLive(p: VoiceParams): void {
    const ctx = Engine.ctx!,
      now = ctx.currentTime;
    if ('frequency' in this.src && this.note != null) {
      const baseFreq = noteToFreq(this.note) * Math.pow(2, (p.pitch || 0) / 12);
      this.src.frequency.setTargetAtTime(baseFreq, now, 0.03);
    }
    if (!!p.osc2Enabled !== !!this.osc2Src) {
      if (p.osc2Enabled) {
        this._addOsc2(p);
      } else {
        this._removeOsc2();
      }
    }
    if (this.osc2Src && 'frequency' in this.osc2Src) {
      const base2Freq = noteToFreq(this.note) * Math.pow(2, (p.osc2Pitch || 0) / 12);
      this.osc2Src.frequency.setTargetAtTime(base2Freq, now, 0.03);
    }
    if (this.osc2Gain) {
      this.osc2Gain.gain.setTargetAtTime(p.osc2Level, now, 0.03);
    }
    this.filter.type = p.filterType;
    this.filter.frequency.setTargetAtTime(p.cutoff, now, 0.03);
    this.filter.Q.setTargetAtTime(p.resonance, now, 0.03);
    this.fenvGain.gain.setTargetAtTime(p.envDepth, now, 0.03);
    this.filter2.type = p.filter2Type;
    this.filter2.frequency.setTargetAtTime(p.filter2Cutoff, now, 0.03);
    this.filter2.Q.setTargetAtTime(p.filter2Resonance, now, 0.03);
    this.fenv2Gain.gain.setTargetAtTime(p.filter2EnvDepth, now, 0.03);
    if (!!p.filter2Enabled !== this.filter2Enabled) {
      this.filter2Enabled = !!p.filter2Enabled;
      this._connectFilterChain(this.filter2Enabled);
    }
    if (this.lfo1.target !== p.lfoTarget) this._connectLfoTarget(this.lfo1, p.lfoTarget);
    this._applyLfoSettings(this.lfo1, readLfoSettings(p, 'lfo'));
    this._setLfoRate(this.lfo1, readLfoSettings(p, 'lfo'));
    if (!!p.lfo2Enabled !== !!this.lfo2) {
      if (p.lfo2Enabled) {
        this.lfo2 = this._createLfo('lfo2', p);
      } else {
        this._teardownLfo2();
      }
    }
    if (this.lfo2) {
      if (this.lfo2.target !== p.lfo2Target) this._connectLfoTarget(this.lfo2, p.lfo2Target);
      this._applyLfoSettings(this.lfo2, readLfoSettings(p, 'lfo2'));
      this._setLfoRate(this.lfo2, readLfoSettings(p, 'lfo2'));
    }
  }

  release(): void {
    if (this.releasing) return;
    this.releasing = true;
    const ctx = Engine.ctx!,
      now = ctx.currentTime,
      p = this.voice.params;
    const rel = Math.max(0.02, p.release);
    this.amp.gain.cancelScheduledValues(now);
    this.amp.gain.setValueAtTime(this.amp.gain.value, now);
    this.amp.gain.linearRampToValueAtTime(0, now + rel);
    this.fenv.offset.cancelScheduledValues(now);
    this.fenv.offset.setValueAtTime(this.fenv.offset.value, now);
    this.fenv.offset.linearRampToValueAtTime(0, now + rel);
    const stopAt = now + rel + 0.05;
    try {
      this.src.stop(stopAt);
    } catch {
      /* already stopped */
    }
    if (this.osc2Src) {
      try {
        this.osc2Src.stop(stopAt);
      } catch {
        /* already stopped */
      }
    }
    try {
      this.lfo1.lfo.stop(stopAt);
    } catch {
      /* already stopped */
    }
    if (this.lfo2) {
      try {
        this.lfo2.lfo.stop(stopAt);
      } catch {
        /* already stopped */
      }
    }
    try {
      this.fenv.stop(stopAt);
    } catch {
      /* already stopped */
    }
    setTimeout(() => this._cleanup(), (rel + 0.15) * 1000);
  }

  forceStop(): void {
    try {
      this.src.stop();
    } catch {
      /* already stopped */
    }
    if (this.osc2Src) {
      try {
        this.osc2Src.stop();
      } catch {
        /* already stopped */
      }
    }
    try {
      this.lfo1.lfo.stop();
    } catch {
      /* already stopped */
    }
    if (this.lfo2) {
      try {
        this.lfo2.lfo.stop();
      } catch {
        /* already stopped */
      }
    }
    try {
      this.fenv.stop();
    } catch {
      /* already stopped */
    }
    this._cleanup();
  }

  private _cleanup(): void {
    Engine.syncedLfos.delete(this.lfo1.syncEntry);
    if (this.lfo2) Engine.syncedLfos.delete(this.lfo2.syncEntry);
    const nodes: AudioNode[] = [
      this.src,
      this.filter,
      this.filter2,
      this.amp,
      this.fenv,
      this.fenvGain,
      this.fenv2Gain,
      this.lfo1.lfo,
      this.lfo1.depth,
    ];
    if (this.lfo2) nodes.push(this.lfo2.lfo, this.lfo2.depth);
    if (this.osc2Src) nodes.push(this.osc2Src);
    if (this.osc2Gain) nodes.push(this.osc2Gain);
    nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    });
  }
}
