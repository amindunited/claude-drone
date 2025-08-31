import type { AudioNodes, LFONodes, LFOTarget } from './types/audio.js';
import { createOscillators, configureOscillator, createMixer, connectOscillators } from './audio/oscillators.js';
import { createFilter, updateFilterType, updateFilterCutoff, updateFilterResonance, connectFilter } from './audio/filter.js';
import { createLFO, updateLFORate, updateLFOWaveform, updateLFODepth, connectLFOToTarget, startLFO, stopLFO } from './audio/lfo.js';
import { createDelay, updateDelayTime, updateDelayFeedback, updateDelayMix, connectDelayNodes } from './audio/delay.js';
import { createReverb, updateReverbBuffer, updateReverbMix, connectReverbNodes } from './audio/reverb.js';
import { createDistortion, updateDistortionCurve, createMasterGain, updateMasterVolume } from './audio/effects.js';
import { createVisualizer, createAnalyser, startVisualization, stopVisualization } from './audio/visualizer.js';
import { getElementNumericValue, getElementValue, updateValueDisplay, formatFrequency, formatDecimal, formatTime, enableButton, disableButton, addEventListeners } from './utils/dom.js';

export class DroneSynth {
  private readonly audioContext: AudioContext;
  private isPlaying: boolean = false;
  private nodes!: AudioNodes;
  private lfoNodes!: LFONodes;
  private analyser!: AnalyserNode;
  private canvas!: HTMLCanvasElement;
  private canvasCtx!: CanvasRenderingContext2D;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupEventListeners();
    this.initializeVisualizer();
  }

  public async initialize(): Promise<void> {
    await this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    // Create all nodes
    const oscillators = createOscillators(this.audioContext);
    const mixer = createMixer(this.audioContext);
    const filter = createFilter(this.audioContext);
    const lfo1 = createLFO(this.audioContext);
    const lfo2 = createLFO(this.audioContext);
    const delay = createDelay(this.audioContext);
    const reverb = createReverb(this.audioContext);
    const distortion = createDistortion(this.audioContext);
    const masterGain = createMasterGain(this.audioContext);
    this.analyser = createAnalyser(this.audioContext);

    // Assign to class properties
    this.nodes = {
      ...oscillators,
      mixer,
      filter,
      ...delay,
      ...reverb,
      distortion,
      masterGain
    };

    this.lfoNodes = {
      lfo: lfo1.lfo,
      lfoGain: lfo1.lfoGain,
      lfo2: lfo2.lfo,
      lfo2Gain: lfo2.lfoGain
    };

    // Set initial configuration
    this.setInitialValues();

    // Create reverb impulse
    updateReverbBuffer(this.nodes.reverb, this.audioContext);

    // Connect all nodes
    this.connectNodes();
  }

  private setInitialValues(): void {
    configureOscillator(this.nodes.osc1, this.nodes.osc1Gain, 'sawtooth', 110, 0.3, this.audioContext);
    configureOscillator(this.nodes.osc2, this.nodes.osc2Gain, 'square', 220, 0.2, this.audioContext);
  }

  private connectNodes(): void {
    // Connect oscillators
    connectOscillators(this.nodes);

    // Connect filter
    connectFilter(this.nodes.filter, this.nodes.mixer, this.nodes.delayDry);

    // Connect delay
    connectDelayNodes(
      this.nodes.filter,
      this.nodes.delay,
      this.nodes.delayFeedback,
      this.nodes.delayMix,
      this.nodes.delayDry,
      this.nodes.reverbDry
    );

    // Connect reverb
    connectReverbNodes(
      this.nodes.delayDry,
      this.nodes.reverb,
      this.nodes.reverbMix,
      this.nodes.reverbDry,
      this.nodes.distortion
    );

    // Connect effects chain to master and output
    this.nodes.distortion.connect(this.nodes.masterGain);
    this.nodes.masterGain.connect(this.analyser);
    this.nodes.masterGain.connect(this.audioContext.destination);

    // Connect LFOs
    this.lfoNodes.lfo.connect(this.lfoNodes.lfoGain);
    this.lfoNodes.lfoGain.connect(this.nodes.filter.frequency);
    this.lfoNodes.lfo2.connect(this.lfoNodes.lfo2Gain);
    this.lfoNodes.lfo2Gain.connect(this.nodes.filter.frequency);
  }

  public start(): void {
    if (this.isPlaying) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Create new oscillators
    const oscillators = createOscillators(this.audioContext);
    const lfo1 = createLFO(this.audioContext);
    const lfo2 = createLFO(this.audioContext);

    this.nodes = { ...this.nodes, ...oscillators };
    this.lfoNodes = {
      lfo: lfo1.lfo,
      lfoGain: lfo1.lfoGain,
      lfo2: lfo2.lfo,
      lfo2Gain: lfo2.lfoGain
    };

    // Restore settings
    this.updateOscillator(1);
    this.updateOscillator(2);
    this.updateLFO();
    this.updateLFO2();

    // Reconnect oscillators
    connectOscillators(this.nodes);
    this.lfoNodes.lfo.connect(this.lfoNodes.lfoGain);
    this.lfoNodes.lfo2.connect(this.lfoNodes.lfo2Gain);

    // Start oscillators
    this.nodes.osc1.start();
    this.nodes.osc2.start();
    startLFO(this.lfoNodes.lfo);
    startLFO(this.lfoNodes.lfo2);

    this.isPlaying = true;
    startVisualization(this.analyser, this.canvas, this.canvasCtx, () => this.isPlaying);
  }

  public stop(): void {
    if (!this.isPlaying) return;

    this.nodes.osc1.stop();
    this.nodes.osc2.stop();
    stopLFO(this.lfoNodes.lfo);
    stopLFO(this.lfoNodes.lfo2);

    this.isPlaying = false;
    stopVisualization(this.canvas, this.canvasCtx);
  }

  private updateOscillator(oscNum: 1 | 2): void {
    const type = getElementValue(`osc${oscNum}Type`) as OscillatorType;
    const freq = getElementNumericValue(`osc${oscNum}Freq`);
    const level = getElementNumericValue(`osc${oscNum}Level`);

    configureOscillator(
      this.nodes[`osc${oscNum}`],
      this.nodes[`osc${oscNum}Gain`],
      type,
      freq,
      level,
      this.audioContext
    );
  }

  private updateLFO(): void {
    const rate = getElementNumericValue('lfoRate');
    const depth = getElementNumericValue('lfoDepth');
    const waveform = getElementValue('lfoWaveform') as OscillatorType;
    const target = getElementValue('lfoTarget') as LFOTarget;

    updateLFORate(this.lfoNodes.lfo, rate, this.audioContext);
    updateLFOWaveform(this.lfoNodes.lfo, waveform);
    updateLFODepth(this.lfoNodes.lfoGain, depth, target, this.audioContext);
    connectLFOToTarget(this.lfoNodes.lfoGain, target, this.nodes);
  }

  private updateLFO2(): void {
    const rate = getElementNumericValue('lfo2Rate');
    const depth = getElementNumericValue('lfo2Depth');
    const waveform = getElementValue('lfo2Waveform') as OscillatorType;
    const target = getElementValue('lfo2Target') as LFOTarget;

    updateLFORate(this.lfoNodes.lfo2, rate, this.audioContext);
    updateLFOWaveform(this.lfoNodes.lfo2, waveform);
    updateLFODepth(this.lfoNodes.lfo2Gain, depth, target, this.audioContext);
    connectLFOToTarget(this.lfoNodes.lfo2Gain, target, this.nodes);
  }

  private initializeVisualizer(): void {
    const visualizer = createVisualizer('visualizer');
    this.canvas = visualizer.canvas;
    this.canvasCtx = visualizer.canvasCtx;
  }

  private setupEventListeners(): void {
    // Play/Stop buttons
    document.getElementById('playBtn')?.addEventListener('click', () => {
      this.start();
      disableButton('playBtn');
      enableButton('stopBtn');
    });

    document.getElementById('stopBtn')?.addEventListener('click', () => {
      this.stop();
      enableButton('playBtn');
      disableButton('stopBtn');
    });

    // Oscillator controls
    addEventListeners(['osc1Type', 'osc2Type'], 'change', (id) => {
      const oscNum = id.includes('osc1') ? 1 : 2;
      this.updateOscillator(oscNum);
    });

    addEventListeners(['osc1Freq', 'osc2Freq', 'osc1Level', 'osc2Level'], 'input', (id, value) => {
      const numValue = parseFloat(value);
      const oscNum = id.includes('osc1') ? 1 : 2;
      
      if (id.includes('Freq')) {
        updateValueDisplay(id + 'Value', formatFrequency(numValue));
      } else if (id.includes('Level')) {
        updateValueDisplay(id + 'Value', formatDecimal(numValue));
      }
      
      this.updateOscillator(oscNum);
    });

    // Filter controls
    document.getElementById('filterType')?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      updateFilterType(this.nodes.filter, target.value as BiquadFilterType);
    });

    document.getElementById('filterCutoff')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateFilterCutoff(this.nodes.filter, value, this.audioContext);
      updateValueDisplay('filterCutoffValue', formatFrequency(value));
    });

    document.getElementById('filterResonance')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateFilterResonance(this.nodes.filter, value, this.audioContext);
      updateValueDisplay('filterResonanceValue', formatDecimal(value, 1));
    });

    // LFO controls
    addEventListeners(['lfoTarget', 'lfoWaveform'], 'change', () => {
      this.updateLFO();
    });

    addEventListeners(['lfoRate', 'lfoDepth'], 'input', (id, value) => {
      const numValue = parseFloat(value);
      
      if (id === 'lfoRate') {
        updateValueDisplay(id + 'Value', formatFrequency(numValue));
      } else if (id === 'lfoDepth') {
        updateValueDisplay(id + 'Value', formatDecimal(numValue));
      }
      
      this.updateLFO();
    });

    // LFO2 controls
    addEventListeners(['lfo2Target', 'lfo2Waveform'], 'change', () => {
      this.updateLFO2();
    });

    addEventListeners(['lfo2Rate', 'lfo2Depth'], 'input', (id, value) => {
      const numValue = parseFloat(value);
      
      if (id === 'lfo2Rate') {
        updateValueDisplay(id + 'Value', formatFrequency(numValue));
      } else if (id === 'lfo2Depth') {
        updateValueDisplay(id + 'Value', formatDecimal(numValue));
      }
      
      this.updateLFO2();
    });

    // Delay controls
    document.getElementById('delayTime')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateDelayTime(this.nodes.delay, value, this.audioContext);
      updateValueDisplay('delayTimeValue', formatTime(value));
    });

    document.getElementById('delayFeedback')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateDelayFeedback(this.nodes.delayFeedback, value, this.audioContext);
      updateValueDisplay('delayFeedbackValue', formatDecimal(value));
    });

    document.getElementById('delayMix')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateDelayMix(this.nodes.delayMix, this.nodes.delayDry, value, this.audioContext);
      updateValueDisplay('delayMixValue', formatDecimal(value));
    });

    // Reverb controls
    document.getElementById('reverbRoom')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateReverbBuffer(this.nodes.reverb, this.audioContext, value);
      updateValueDisplay('reverbRoomValue', formatDecimal(value));
    });

    document.getElementById('reverbDecay')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateReverbBuffer(this.nodes.reverb, this.audioContext, undefined, value);
      updateValueDisplay('reverbDecayValue', formatTime(value));
    });

    document.getElementById('reverbMix')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateReverbMix(this.nodes.reverbMix, this.nodes.reverbDry, value, this.audioContext);
      updateValueDisplay('reverbMixValue', formatDecimal(value));
    });

    // Master controls
    document.getElementById('masterVolume')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateMasterVolume(this.nodes.masterGain, value, this.audioContext);
      updateValueDisplay('masterVolumeValue', formatDecimal(value));
    });

    document.getElementById('distortion')?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      updateDistortionCurve(this.nodes.distortion, value);
      updateValueDisplay('distortionValue', value.toString());
    });
  }
}
