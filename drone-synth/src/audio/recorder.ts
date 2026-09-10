import { clamp } from '../utils/dsp';
import { Engine } from './engine';

class RecorderController {
  enabled = false;
  isRecording = false;
  processor: ScriptProcessorNode | null = null;
  muteTap: GainNode | null = null;
  leftChunks: Float32Array[] = [];
  rightChunks: Float32Array[] = [];
  sampleRate = 44100;

  init(): void {
    if (this.processor || !Engine.ctx || !Engine.limiter) return;
    const ctx = Engine.ctx;
    this.sampleRate = ctx.sampleRate;
    this.processor = ctx.createScriptProcessor(4096, 2, 2);
    this.muteTap = ctx.createGain();
    this.muteTap.gain.value = 0;
    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      const input = event.inputBuffer;
      const left = input.getChannelData(0);
      const right = input.numberOfChannels > 1 ? input.getChannelData(1) : left;
      this.leftChunks.push(new Float32Array(left));
      this.rightChunks.push(new Float32Array(right));
    };
    Engine.limiter.connect(this.processor);
    this.processor.connect(this.muteTap).connect(ctx.destination);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.init();
    if (!enabled && this.isRecording) this.stop();
    this._paint();
  }

  toggle(): void {
    if (!this.enabled) return;
    if (this.isRecording) this.stop();
    else this.start();
  }

  start(): void {
    if (!this.enabled || this.isRecording) return;
    this.init();
    this.sampleRate = Engine.ctx ? Engine.ctx.sampleRate : this.sampleRate;
    this.leftChunks = [];
    this.rightChunks = [];
    this.isRecording = true;
    this._paint();
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    this._paint();
    const blob = this._buildWavBlob();
    if (!blob) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `strata-${stamp}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private _paint(): void {
    const stateEl = document.getElementById('recordState');
    const inputEl = document.getElementById('recordEnable') as HTMLInputElement | null;
    if (!stateEl || !inputEl) return;
    inputEl.checked = this.enabled;
    stateEl.classList.remove('armed', 'live');
    if (this.isRecording) {
      stateEl.textContent = 'Recording';
      stateEl.classList.add('live');
      return;
    }
    if (this.enabled) {
      stateEl.textContent = 'Armed · Space';
      stateEl.classList.add('armed');
      return;
    }
    stateEl.textContent = 'Off';
  }

  private _buildWavBlob(): Blob | null {
    if (!this.leftChunks.length) return null;
    const frameCount = this.leftChunks.reduce((total, chunk) => total + chunk.length, 0);
    const interleaved = new Int16Array(frameCount * 2);
    let offset = 0;
    for (let idx = 0; idx < this.leftChunks.length; idx++) {
      const left = this.leftChunks[idx];
      const right = this.rightChunks[idx] || left;
      for (let sampleIndex = 0; sampleIndex < left.length; sampleIndex++) {
        interleaved[offset++] = this._floatToPcm(left[sampleIndex]);
        interleaved[offset++] = this._floatToPcm(right[sampleIndex]);
      }
    }
    const wavBuffer = new ArrayBuffer(44 + interleaved.byteLength);
    const view = new DataView(wavBuffer);
    this._writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + interleaved.byteLength, true);
    this._writeAscii(view, 8, 'WAVE');
    this._writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    this._writeAscii(view, 36, 'data');
    view.setUint32(40, interleaved.byteLength, true);
    let writeOffset = 44;
    for (let idx = 0; idx < interleaved.length; idx++, writeOffset += 2) {
      view.setInt16(writeOffset, interleaved[idx], true);
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  private _floatToPcm(value: number): number {
    const sample = clamp(value, -1, 1);
    return sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }

  private _writeAscii(view: DataView, offset: number, text: string): void {
    for (let idx = 0; idx < text.length; idx++) view.setUint8(offset + idx, text.charCodeAt(idx));
  }
}

export const Recorder = new RecorderController();
