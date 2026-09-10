import type { Knob } from './ui/knob';
import { DEFAULT_SYNTH_SETTINGS } from './constants';
import { cloneData } from './utils/dsp';
import type { DelayMode, FxSettings, GlobalSettings, StoredSettings } from './types';

export const AppState: { global: GlobalSettings; fx: FxSettings } = {
  global: cloneData(DEFAULT_SYNTH_SETTINGS.global),
  fx: cloneData(DEFAULT_SYNTH_SETTINGS.fx),
};

export const PresetState: { items: Record<string, StoredSettings>; selectedName: string } = {
  items: {},
  selectedName: '',
};

interface DistortionUi {
  drive?: Knob;
  amount?: Knob;
  tone?: Knob;
  return?: Knob;
}

interface ChorusUi {
  rate?: Knob;
  depth?: Knob;
  mix?: Knob;
  return?: Knob;
}

interface DelayUi {
  time?: Knob;
  feedback?: Knob;
  damp?: Knob;
  mix?: Knob;
  return?: Knob;
  setMode?: (mode: DelayMode, value: number) => void;
}

interface ReverbUi {
  size?: Knob;
  damping?: Knob;
  mix?: Knob;
  return?: Knob;
}

export const SettingsUI: {
  global: { bpm: Knob | null; master: Knob | null };
  fx: { distortion: DistortionUi; chorus: ChorusUi; delay: DelayUi; reverb: ReverbUi };
  presetSelect: HTMLSelectElement | null;
} = {
  global: { bpm: null, master: null },
  fx: { distortion: {}, chorus: {}, delay: {}, reverb: {} },
  presetSelect: null,
};
