import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE_PARAMS } from './constants';
import { normalizeVoiceSettings } from './persistence';

describe('normalizeVoiceSettings — sequencer fields', () => {
  it('loads presets saved before the sequencer existed with it switched off', () => {
    const { params } = normalizeVoiceSettings({ name: 'Old', params: { osc: 'sawtooth' } }, 0);
    expect(params.seqEnabled).toBe(false);
    expect(params.seqLength).toBe(DEFAULT_VOICE_PARAMS.seqLength);
    expect(params.seqDivision).toBe(DEFAULT_VOICE_PARAMS.seqDivision);
    expect(params.seqSteps).toHaveLength(16);
  });

  it('never shares the step array between voices or with the defaults', () => {
    const a = normalizeVoiceSettings({}, 0).params;
    const b = normalizeVoiceSettings({}, 1).params;
    expect(a.seqSteps).not.toBe(b.seqSteps);
    expect(a.seqSteps).not.toBe(DEFAULT_VOICE_PARAMS.seqSteps);
    a.seqSteps[0].semitones = 12;
    expect(b.seqSteps[0].semitones).toBe(0);
    expect(DEFAULT_VOICE_PARAMS.seqSteps[0].semitones).toBe(0);
  });

  it('round-trips a saved pattern and sanitises bad values', () => {
    const { params } = normalizeVoiceSettings(
      { params: { seqEnabled: true, seqLength: 40, seqDivision: -1, seqSteps: [{ on: false, semitones: 7 }] } },
      0,
    );
    expect(params.seqEnabled).toBe(true);
    expect(params.seqLength).toBe(16);
    expect(params.seqDivision).toBe(DEFAULT_VOICE_PARAMS.seqDivision);
    expect(params.seqSteps[0]).toEqual({ on: false, semitones: 7 });
  });
});
