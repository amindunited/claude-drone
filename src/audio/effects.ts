export function createDistortion(audioContext: AudioContext): WaveShaperNode {
  const distortion = audioContext.createWaveShaper();
  distortion.oversample = '4x';
  updateDistortionCurve(distortion, 0); // Start with no distortion
  return distortion;
}

export function updateDistortionCurve(distortion: WaveShaperNode, amount: number): void {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    if (amount === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
  }
  
  distortion.curve = curve;
}

export function createMasterGain(audioContext: AudioContext): GainNode {
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.7, audioContext.currentTime);
  return masterGain;
}

export function updateMasterVolume(
  masterGain: GainNode, 
  volume: number, 
  audioContext: AudioContext
): void {
  masterGain.gain.setValueAtTime(volume, audioContext.currentTime);
}
