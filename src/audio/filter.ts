export function createFilter(audioContext: AudioContext): BiquadFilterNode {
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, audioContext.currentTime);
  filter.Q.setValueAtTime(1, audioContext.currentTime);
  return filter;
}

export function updateFilterType(filter: BiquadFilterNode, type: BiquadFilterType): void {
  filter.type = type;
}

export function updateFilterCutoff(
  filter: BiquadFilterNode, 
  cutoff: number, 
  audioContext: AudioContext
): void {
  filter.frequency.setValueAtTime(cutoff, audioContext.currentTime);
}

export function updateFilterResonance(
  filter: BiquadFilterNode, 
  resonance: number, 
  audioContext: AudioContext
): void {
  filter.Q.setValueAtTime(resonance, audioContext.currentTime);
}

export function connectFilter(
  filter: BiquadFilterNode,
  mixer: GainNode,
  nextNode: AudioNode
): void {
  mixer.connect(filter);
  filter.connect(nextNode);
}
