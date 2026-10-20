import { Engine } from '../audio/engine';

/** What the scheduler needs from a voice; implemented by `Voice`. */
export interface SequencedVoice {
  /** schedule every step boundary falling in [now, horizon) on the audio clock */
  scheduleSteps(now: number, horizon: number): void;
  /** repaint the playhead for audio-clock time `now` */
  paintPlayhead(now: number): void;
}

/* "Two clocks" scheduling: a coarse JS timer looks ahead and books notes on the precise audio clock. */
const TICK_MS = 25;
const LOOKAHEAD_S = 0.1;

class SequencerScheduler {
  private voices = new Set<SequencedVoice>();
  private timer: number | null = null;
  private raf: number | null = null;

  register(v: SequencedVoice): void {
    if (this.voices.has(v)) return;
    this.voices.add(v);
    if (this.timer === null) this._start();
    else this._tick();
  }

  unregister(v: SequencedVoice): void {
    if (!this.voices.delete(v)) return;
    if (this.voices.size === 0) this._stop();
  }

  private _start(): void {
    this.timer = window.setInterval(() => this._tick(), TICK_MS);
    this._tick();
    const frame = () => {
      const now = Engine.ctx!.currentTime;
      this.voices.forEach((v) => v.paintPlayhead(now));
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private _stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.timer = null;
    this.raf = null;
  }

  private _tick(): void {
    const ctx = Engine.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.voices.forEach((v) => v.scheduleSteps(now, now + LOOKAHEAD_S));
  }
}

export const Sequencer = new SequencerScheduler();
