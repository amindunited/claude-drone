export type OscType = 'sine' | 'sawtooth' | 'triangle' | 'pulse' | 'noise';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';
export type LfoTarget = 'none' | 'pitch' | 'filter' | 'filter2' | 'amplitude';
export type LfoRateMode = 'hz' | 'sync';
export type DelayMode = 'seconds' | 'frequency' | 'measures';
export type FxKey = 'distortion' | 'chorus' | 'delay' | 'reverb';

export interface VoiceSends {
  distortion: number;
  chorus: number;
  delay: number;
  reverb: number;
}

export interface VoiceParams {
  noteOffsetMode: 'seconds' | 'sync';
  noteOffsetSeconds: number;
  noteOffsetDivision: number;
  osc: OscType;
  pulseWidth: number;
  pitch: number;
  osc2Enabled: boolean;
  osc2: OscType;
  osc2PulseWidth: number;
  osc2Pitch: number;
  osc2Level: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterType: FilterType;
  cutoff: number;
  resonance: number;
  envDepth: number;
  filter2Enabled: boolean;
  filter2Type: FilterType;
  filter2Cutoff: number;
  filter2Resonance: number;
  filter2EnvDepth: number;
  lfoTarget: LfoTarget;
  lfoRateMode: LfoRateMode;
  lfoRateHz: number;
  lfoRateDivision: number;
  lfoDepth: number;
  lfo2Enabled: boolean;
  lfo2Target: LfoTarget;
  lfo2RateMode: LfoRateMode;
  lfo2RateHz: number;
  lfo2RateDivision: number;
  lfo2Depth: number;
  level: number;
  sends: VoiceSends;
}

export interface VoiceConfig {
  name: string;
  enabled: boolean;
  params: VoiceParams;
}

export interface DistortionSettings {
  drive: number;
  amount: number;
  tone: number;
  return: number;
}

export interface ChorusSettings {
  rate: number;
  depth: number;
  mix: number;
  return: number;
}

export interface DelaySettings {
  mode: DelayMode;
  timeValue: number;
  feedback: number;
  damp: number;
  mix: number;
  return: number;
}

export interface ReverbSettings {
  size: number;
  damping: number;
  mix: number;
  return: number;
}

export interface FxSettings {
  distortion: DistortionSettings;
  chorus: ChorusSettings;
  delay: DelaySettings;
  reverb: ReverbSettings;
}

export interface GlobalSettings {
  bpm: number;
  master: number;
  octaveBase: number;
}

export interface SynthSettings {
  global: GlobalSettings;
  fx: FxSettings;
  voices: VoiceConfig[];
}

export interface StoredSettings extends SynthSettings {
  version?: number;
  meta?: { name?: string };
}
