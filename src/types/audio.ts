export interface AudioNodes {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  osc1Gain: GainNode;
  osc2Gain: GainNode;
  mixer: GainNode;
  filter: BiquadFilterNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayMix: GainNode;
  delayDry: GainNode;
  reverb: ConvolverNode;
  reverbMix: GainNode;
  reverbDry: GainNode;
  distortion: WaveShaperNode;
  masterGain: GainNode;
}

export interface LFONodes {
  lfo: OscillatorNode;
  lfoGain: GainNode;
  lfo2: OscillatorNode;
  lfo2Gain: GainNode;
}

export interface SynthConfig {
  osc1Type: OscillatorType;
  osc1Freq: number;
  osc1Level: number;
  osc2Type: OscillatorType;
  osc2Freq: number;
  osc2Level: number;
  filterType: BiquadFilterType;
  filterCutoff: number;
  filterResonance: number;
  lfoRate: number;
  lfoDepth: number;
  lfoWaveform: OscillatorType;
  lfoTarget: string;
  lfo2Rate: number;
  lfo2Depth: number;
  lfo2Waveform: OscillatorType;
  lfo2Target: string;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  reverbRoom: number;
  reverbDecay: number;
  reverbMix: number;
  masterVolume: number;
  distortion: number;
}

export type LFOTarget = 'filter' | 'osc1' | 'osc2' | 'amplitude' | 'none';
