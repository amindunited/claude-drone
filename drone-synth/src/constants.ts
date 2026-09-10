import type { DelayMode, FxKey, SynthSettings, VoiceParams } from './types';

export const FX_KEYS: FxKey[] = ['distortion', 'chorus', 'delay', 'reverb'];
export const FX_LABELS: Record<FxKey, string> = { distortion: 'Dist', chorus: 'Chor', delay: 'Dly', reverb: 'Verb' };

export interface LfoDivision {
  label: string;
  beats: number;
}

export const LFO_DIVISIONS: LfoDivision[] = [
  { label: '1/16', beats: 0.25 },
  { label: '1/8', beats: 0.5 },
  { label: '1/4', beats: 1 },
  { label: '1/2', beats: 2 },
  { label: '1 bar', beats: 4 },
  { label: '2 bars', beats: 8 },
  { label: '4 bars', beats: 16 },
  { label: '8 bars', beats: 32 },
  { label: '16 bars', beats: 64 },
  { label: '32 bars', beats: 128 },
];

export const DEFAULT_VOICE_PARAMS: VoiceParams = {
  osc: 'sine',
  pulseWidth: 0.5,
  pitch: 0,
  osc2Enabled: false,
  osc2: 'sine',
  osc2PulseWidth: 0.5,
  osc2Pitch: 0,
  osc2Level: 0,
  attack: 0.6,
  decay: 0.4,
  sustain: 0.75,
  release: 1.2,
  filterType: 'lowpass',
  cutoff: 2200,
  resonance: 1.0,
  envDepth: 0,
  filter2Enabled: false,
  filter2Type: 'lowpass',
  filter2Cutoff: 2200,
  filter2Resonance: 1.0,
  filter2EnvDepth: 0,
  lfoTarget: 'none',
  lfoRateMode: 'hz',
  lfoRateHz: 2,
  lfoRateDivision: 4,
  lfoDepth: 0.3,
  lfo2Target: 'none',
  lfo2RateMode: 'hz',
  lfo2RateHz: 0.5,
  lfo2RateDivision: 4,
  lfo2Depth: 0,
  level: 0.7,
  sends: { distortion: 0, chorus: 0, delay: 0, reverb: 0 },
};

export const DEFAULT_SYNTH_SETTINGS: SynthSettings = {
  global: { bpm: 60, master: 0.8, octaveBase: 48 },
  fx: {
    distortion: { drive: 1, amount: 0.3, tone: 6000, return: 0.5 },
    chorus: { rate: 0.6, depth: 4, mix: 0.5, return: 0.5 },
    delay: { mode: 'frequency' as DelayMode, timeValue: 0.35, feedback: 0.35, damp: 4000, mix: 0.6, return: 0.4 },
    reverb: { size: 2.5, damping: 2.2, mix: 0.5, return: 0.45 },
  },
  voices: [
    {
      name: 'Sub Drone',
      enabled: true,
      params: {
        ...DEFAULT_VOICE_PARAMS,
        osc: 'sine',
        attack: 1.2,
        decay: 0.8,
        sustain: 0.85,
        release: 2.5,
        filterType: 'lowpass',
        cutoff: 900,
        resonance: 0.7,
        envDepth: 0,
        lfoTarget: 'none',
        level: 0.75,
        sends: { distortion: 0, chorus: 0.1, delay: 0, reverb: 0.35 },
      },
    },
    {
      name: 'Shimmer',
      enabled: true,
      params: {
        ...DEFAULT_VOICE_PARAMS,
        osc: 'sawtooth',
        attack: 2.0,
        decay: 1.0,
        sustain: 0.6,
        release: 3.5,
        filterType: 'lowpass',
        cutoff: 3200,
        resonance: 2.0,
        envDepth: 800,
        lfoTarget: 'filter',
        lfoRateMode: 'sync',
        lfoRateDivision: 8,
        lfoDepth: 0.35,
        level: 0.4,
        sends: { distortion: 0, chorus: 0.4, delay: 0.25, reverb: 0.5 },
      },
    },
  ],
};

export const STORAGE_KEYS = {
  autosave: 'strata.autosave.v1',
  presets: 'strata.presets.v1',
};
