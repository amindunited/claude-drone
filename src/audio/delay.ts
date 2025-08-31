export function createDelay(audioContext: AudioContext): {
  delay: DelayNode;
  delayFeedback: GainNode;
  delayMix: GainNode;
  delayDry: GainNode;
} {
  const delay = audioContext.createDelay(1.0);
  const delayFeedback = audioContext.createGain();
  const delayMix = audioContext.createGain();
  const delayDry = audioContext.createGain();
  
  // Set initial values
  delay.delayTime.setValueAtTime(0.3, audioContext.currentTime);
  delayFeedback.gain.setValueAtTime(0.4, audioContext.currentTime);
  delayMix.gain.setValueAtTime(0.2, audioContext.currentTime);
  delayDry.gain.setValueAtTime(0.8, audioContext.currentTime);
  
  return { delay, delayFeedback, delayMix, delayDry };
}

export function updateDelayTime(
  delay: DelayNode, 
  time: number, 
  audioContext: AudioContext
): void {
  delay.delayTime.setValueAtTime(time, audioContext.currentTime);
}

export function updateDelayFeedback(
  delayFeedback: GainNode, 
  feedback: number, 
  audioContext: AudioContext
): void {
  delayFeedback.gain.setValueAtTime(feedback, audioContext.currentTime);
}

export function updateDelayMix(
  delayMix: GainNode,
  delayDry: GainNode,
  mix: number,
  audioContext: AudioContext
): void {
  delayMix.gain.setValueAtTime(mix, audioContext.currentTime);
  delayDry.gain.setValueAtTime(1 - mix, audioContext.currentTime);
}

export function connectDelayNodes(
  input: AudioNode,
  delay: DelayNode,
  delayFeedback: GainNode,
  delayMix: GainNode,
  delayDry: GainNode,
  output: AudioNode
): void {
  // Connect input to both dry and delay paths
  input.connect(delayDry);
  input.connect(delay);
  
  // Create feedback loop
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  
  // Connect delay output to mix
  delay.connect(delayMix);
  
  // Connect both paths to output
  delayDry.connect(output);
  delayMix.connect(output);
}
