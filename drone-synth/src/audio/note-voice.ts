import { clamp, noiseBuffer, noteToFreq, pulseWave } from '../utils/dsp';
import type { LfoRateMode, LfoTarget, VoiceParams } from '../types';
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
  filter: BiquadFilterNode;
  fenv: ConstantSourceNode;
  fenvGain: GainNode;
  amp: GainNode;
  lfo1: LfoState;
  lfo2: LfoState;

  constructor(voice: Voice, note: number, velocity: number) {
    const ctx = Engine.ctx!,
      now = ctx.currentTime,
      p = voice.params;
    this.voice = voice;
    this.note = note;
    this.pitchSemitones = p.pitch || 0;

    /* source */
    let src: OscillatorNode | AudioBufferSourceNode;
    if (p.osc === 'noise') {
      const bufferSrc = ctx.createBufferSource();
      bufferSrc.buffer = noiseBuffer(ctx);
      bufferSrc.loop = true;
      src = bufferSrc;
    } else {
      const oscSrc = ctx.createOscillator();
      if (p.osc === 'pulse') {
        oscSrc.setPeriodicWave(pulseWave(ctx, p.pulseWidth));
      } else {
        oscSrc.type = p.osc;
      }
      oscSrc.frequency.value = noteToFreq(note) * Math.pow(2, (p.pitch || 0) / 12);
      src = oscSrc;
    }
    this.src = src;

    /* filter */
    const filter = ctx.createBiquadFilter();
    filter.type = p.filterType;
    filter.frequency.value = p.cutoff;
    filter.Q.value = p.resonance;
    this.filter = filter;

    /* filter envelope (constant source * depth -> filter freq) */
    const fenv = ctx.createConstantSource();
    const fenvGain = ctx.createGain();
    fenvGain.gain.value = p.envDepth;
    fenv.connect(fenvGain).connect(filter.frequency);
    fenv.start();
    this.fenv = fenv;
    this.fenvGain = fenvGain;

    /* amp envelope */
    const amp = ctx.createGain();
    amp.gain.value = 0;
    this.amp = amp;

    src.connect(filter).connect(amp).connect(voice.bus);
    src.start();

    /* Dual LFOs */
    this.lfo1 = this._createLfo('lfo', p);
    this.lfo2 = this._createLfo('lfo2', p);

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
    } else if (target === 'filter') {
      state.depth.connect(this.filter.frequency);
    } else if (target === 'amplitude') {
      state.depth.connect(this.amp.gain);
    }
    /* 'none' -> stays disconnected */
  }

  private _applyLfoSettings(state: LfoState, settings: LfoSettings): void {
    let depthVal = 0;
    if (settings.target === 'pitch') depthVal = settings.depth * 1200; // cents (0-1 -> 0-1200)
    else if (settings.target === 'filter') depthVal = settings.depth * 4000; // Hz
    else if (settings.target === 'amplitude') depthVal = settings.depth * 0.5; // gain
    state.depth.gain.setTargetAtTime(depthVal, Engine.ctx!.currentTime, 0.03);
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
    this.filter.type = p.filterType;
    this.filter.frequency.setTargetAtTime(p.cutoff, now, 0.03);
    this.filter.Q.setTargetAtTime(p.resonance, now, 0.03);
    this.fenvGain.gain.setTargetAtTime(p.envDepth, now, 0.03);
    if (this.lfo1.target !== p.lfoTarget) this._connectLfoTarget(this.lfo1, p.lfoTarget);
    this._applyLfoSettings(this.lfo1, readLfoSettings(p, 'lfo'));
    this._setLfoRate(this.lfo1, readLfoSettings(p, 'lfo'));
    if (this.lfo2.target !== p.lfo2Target) this._connectLfoTarget(this.lfo2, p.lfo2Target);
    this._applyLfoSettings(this.lfo2, readLfoSettings(p, 'lfo2'));
    this._setLfoRate(this.lfo2, readLfoSettings(p, 'lfo2'));
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
    try {
      this.lfo1.lfo.stop(stopAt);
    } catch {
      /* already stopped */
    }
    try {
      this.lfo2.lfo.stop(stopAt);
    } catch {
      /* already stopped */
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
    try {
      this.lfo1.lfo.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.lfo2.lfo.stop();
    } catch {
      /* already stopped */
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
    Engine.syncedLfos.delete(this.lfo2.syncEntry);
    ([this.src, this.filter, this.amp, this.fenv, this.fenvGain, this.lfo1.lfo, this.lfo1.depth, this.lfo2.lfo, this.lfo2.depth] as AudioNode[]).forEach(
      (n) => {
        try {
          n.disconnect();
        } catch {
          /* already disconnected */
        }
      },
    );
  }
}
