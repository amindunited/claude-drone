import type { SeqStep } from '../types';

export const SEQ_MAX_STEPS = 16;
export const SEQ_SEMITONE_RANGE = 24;

/** tolerance for float drift when a beat position lands (almost) exactly on a step boundary */
const EPSILON = 1e-6;

export function defaultSeqSteps(): SeqStep[] {
  return Array.from({ length: SEQ_MAX_STEPS }, () => ({ on: true, semitones: 0 }));
}

/** Coerces arbitrary (persisted / imported) data into a fresh SEQ_MAX_STEPS-long step array. */
export function normalizeSeqSteps(raw: unknown): SeqStep[] {
  const source = Array.isArray(raw) ? raw : [];
  return Array.from({ length: SEQ_MAX_STEPS }, (_, i) => {
    const s = (source[i] && typeof source[i] === 'object' ? source[i] : {}) as Partial<SeqStep>;
    const semis = Number(s.semitones);
    return {
      on: s.on !== undefined ? !!s.on : true,
      semitones: Number.isFinite(semis) ? Math.max(-SEQ_SEMITONE_RANGE, Math.min(SEQ_SEMITONE_RANGE, Math.round(semis))) : 0,
    };
  });
}

export function normalizeSeqLength(raw: unknown): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.max(1, Math.min(SEQ_MAX_STEPS, n)) : 8;
}

/** First step boundary at or after `beat` for a grid of `division` beats. */
export function nextBoundaryBeat(beat: number, division: number): number {
  return Math.ceil(beat / division - EPSILON) * division;
}

/** Step index played at a boundary; derived from absolute beat so all voices stay phase-locked. */
export function stepIndexAt(boundaryBeat: number, division: number, length: number): number {
  const n = Math.round(boundaryBeat / division);
  return ((n % length) + length) % length;
}
