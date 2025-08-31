import type { LFOTarget, AudioNodes } from '../types/audio.js';

export function createLFO(audioContext: AudioContext): { lfo: OscillatorNode; lfoGain: GainNode } {
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.5, audioContext.currentTime);
  lfoGain.gain.setValueAtTime(300, audioContext.currentTime);
  
  return { lfo, lfoGain };
}

export function updateLFORate(
  lfo: OscillatorNode, 
  rate: number, 
  audioContext: AudioContext
): void {
  lfo.frequency.setValueAtTime(rate, audioContext.currentTime);
}

export function updateLFOWaveform(lfo: OscillatorNode, waveform: OscillatorType): void {
  lfo.type = waveform;
}

export function calculateLFODepth(depth: number, target: LFOTarget): number {
  switch (target) {
    case 'filter':
      return depth * 500; // Filter cutoff range
    case 'osc1':
    case 'osc2':
      return depth * 50; // Frequency modulation range
    case 'amplitude':
      return depth * 0.5; // Amplitude modulation range
    case 'none':
    default:
      return 0;
  }
}

export function updateLFODepth(
  lfoGain: GainNode,
  depth: number,
  target: LFOTarget,
  audioContext: AudioContext
): void {
  const depthValue = calculateLFODepth(depth, target);
  lfoGain.gain.setValueAtTime(depthValue, audioContext.currentTime);
}

export function connectLFOToTarget(
  lfoGain: GainNode, 
  target: LFOTarget, 
  nodes: AudioNodes
): void {
  // Disconnect current connection
  lfoGain.disconnect();
  
  switch (target) {
    case 'filter':
      lfoGain.connect(nodes.filter.frequency);
      break;
    case 'osc1':
      lfoGain.connect(nodes.osc1.frequency);
      break;
    case 'osc2':
      lfoGain.connect(nodes.osc2.frequency);
      break;
    case 'amplitude':
      lfoGain.connect(nodes.mixer.gain);
      break;
    case 'none':
    default:
      // Don't connect to anything
      break;
  }
}

export function startLFO(lfo: OscillatorNode): void {
  lfo.start();
}

export function stopLFO(lfo: OscillatorNode): void {
  lfo.stop();
}
