import { describe, expect, it } from 'vitest';
import { SEQ_MAX_STEPS, nextBoundaryBeat, normalizeSeqLength, normalizeSeqSteps, stepIndexAt } from './steps';

describe('nextBoundaryBeat', () => {
  it('rounds up to the next grid line', () => {
    expect(nextBoundaryBeat(0.1, 0.5)).toBe(0.5);
    expect(nextBoundaryBeat(3.9, 4)).toBe(4);
  });

  it('treats a position on (or a float hair past) a boundary as that boundary', () => {
    expect(nextBoundaryBeat(2, 0.5)).toBe(2);
    expect(nextBoundaryBeat(2 + 1e-9, 0.5)).toBe(2);
    expect(nextBoundaryBeat(0.1 + 0.2, 0.3)).toBeCloseTo(0.3);
  });

  it('handles triplet divisions', () => {
    expect(nextBoundaryBeat(0.7, 2 / 3)).toBeCloseTo(4 / 3);
  });
});

describe('stepIndexAt', () => {
  it('wraps by pattern length', () => {
    const idx = [0, 1, 2, 3, 4, 5].map((n) => stepIndexAt(n * 0.5, 0.5, 4));
    expect(idx).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it('is phase-locked to absolute beat, so different lengths form a polymeter', () => {
    const a = [0, 1, 2, 3, 4, 5, 6].map((n) => stepIndexAt(n, 1, 4));
    const b = [0, 1, 2, 3, 4, 5, 6].map((n) => stepIndexAt(n, 1, 3));
    expect(a).toEqual([0, 1, 2, 3, 0, 1, 2]);
    expect(b).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it('tolerates float drift in the boundary beat', () => {
    expect(stepIndexAt(0.1 + 0.2, 0.1, 16)).toBe(3);
  });
});

describe('normalizeSeqSteps', () => {
  it('fills missing data with full-length defaults', () => {
    const steps = normalizeSeqSteps(undefined);
    expect(steps).toHaveLength(SEQ_MAX_STEPS);
    expect(steps.every((s) => s.on && s.semitones === 0)).toBe(true);
  });

  it('pads short and truncates long arrays', () => {
    expect(normalizeSeqSteps([{ on: false, semitones: 7 }])[0]).toEqual({ on: false, semitones: 7 });
    expect(normalizeSeqSteps([{ on: false, semitones: 7 }])).toHaveLength(SEQ_MAX_STEPS);
    expect(normalizeSeqSteps(Array.from({ length: 40 }, () => ({ on: true, semitones: 1 })))).toHaveLength(SEQ_MAX_STEPS);
  });

  it('coerces garbage and clamps semitones', () => {
    const steps = normalizeSeqSteps([null, 'x', { semitones: 99 }, { semitones: -99 }, { semitones: 'abc' }, { semitones: 2.6 }]);
    expect(steps[0]).toEqual({ on: true, semitones: 0 });
    expect(steps[1]).toEqual({ on: true, semitones: 0 });
    expect(steps[2].semitones).toBe(24);
    expect(steps[3].semitones).toBe(-24);
    expect(steps[4].semitones).toBe(0);
    expect(steps[5].semitones).toBe(3);
  });

  it('returns fresh objects so voices never share step state', () => {
    const src = [{ on: true, semitones: 5 }];
    const a = normalizeSeqSteps(src);
    const b = normalizeSeqSteps(src);
    expect(a[0]).not.toBe(src[0]);
    expect(a[0]).not.toBe(b[0]);
  });
});

describe('normalizeSeqLength', () => {
  it('clamps to 1..16 and defaults invalid input', () => {
    expect(normalizeSeqLength(0)).toBe(1);
    expect(normalizeSeqLength(99)).toBe(16);
    expect(normalizeSeqLength(5.4)).toBe(5);
    expect(normalizeSeqLength('nope')).toBe(8);
  });
});
