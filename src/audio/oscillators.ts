import type { AudioNodes } from '../types/audio.js';

export function createOscillators(audioContext: AudioContext): Pick<AudioNodes, 'osc1' | 'osc2' | 'osc1Gain' | 'osc2Gain'> {
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const osc1Gain = audioContext.createGain();
  const osc2Gain = audioContext.createGain();

  return { osc1, osc2, osc1Gain, osc2Gain };
}

export function configureOscillator(
  oscillator: OscillatorNode,
  gain: GainNode,
  type: OscillatorType,
  frequency: number,
  level: number,
  audioContext: AudioContext
): void {
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(level, audioContext.currentTime);
}

export function createMixer(audioContext: AudioContext): GainNode {
  return audioContext.createGain();
}

export function connectOscillators(
  nodes: Pick<AudioNodes, 'osc1' | 'osc2' | 'osc1Gain' | 'osc2Gain' | 'mixer'>
): void {
  nodes.osc1.connect(nodes.osc1Gain);
  nodes.osc2.connect(nodes.osc2Gain);
  nodes.osc1Gain.connect(nodes.mixer);
  nodes.osc2Gain.connect(nodes.mixer);
}
