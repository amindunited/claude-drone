export function createReverb(audioContext: AudioContext): {
  reverb: ConvolverNode;
  reverbMix: GainNode;
  reverbDry: GainNode;
} {
  const reverb = audioContext.createConvolver();
  const reverbMix = audioContext.createGain();
  const reverbDry = audioContext.createGain();
  
  // Set initial values
  reverbMix.gain.setValueAtTime(0.1, audioContext.currentTime);
  reverbDry.gain.setValueAtTime(0.9, audioContext.currentTime);
  
  return { reverb, reverbMix, reverbDry };
}

export function createReverbImpulse(
  audioContext: AudioContext,
  roomSize: number = 0.5,
  decayTime: number = 2
): AudioBuffer {
  const length = audioContext.sampleRate * decayTime;
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const envelope = Math.pow(1 - t, 1 + roomSize * 2);
      const noise = (Math.random() * 2 - 1) * envelope;
      
      // Add some early reflections for room character
      let earlyReflections = 0;
      const reflectionTimes = [0.02, 0.04, 0.07, 0.1, 0.15];
      reflectionTimes.forEach(reflectionTime => {
        const reflectionSample = Math.floor(reflectionTime * audioContext.sampleRate);
        if (i === reflectionSample) {
          earlyReflections += 0.3 * roomSize * (Math.random() * 2 - 1);
        }
      });
      
      channelData[i] = noise + earlyReflections;
    }
  }
  
  return impulse;
}

export function updateReverbBuffer(
  reverb: ConvolverNode,
  audioContext: AudioContext,
  roomSize?: number,
  decayTime?: number
): void {
  reverb.buffer = createReverbImpulse(audioContext, roomSize, decayTime);
}

export function updateReverbMix(
  reverbMix: GainNode,
  reverbDry: GainNode,
  mix: number,
  audioContext: AudioContext
): void {
  reverbMix.gain.setValueAtTime(mix, audioContext.currentTime);
  reverbDry.gain.setValueAtTime(1 - mix, audioContext.currentTime);
}

export function connectReverbNodes(
  input: AudioNode,
  reverb: ConvolverNode,
  reverbMix: GainNode,
  reverbDry: GainNode,
  output: AudioNode
): void {
  // Connect input to both dry and reverb paths
  input.connect(reverbDry);
  input.connect(reverb);
  
  // Connect reverb output to mix
  reverb.connect(reverbMix);
  
  // Connect both paths to output
  reverbDry.connect(output);
  reverbMix.connect(output);
}
