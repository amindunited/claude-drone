import { DEFAULT_SYNTH_SETTINGS, DEFAULT_VOICE_PARAMS, STORAGE_KEYS } from './constants';
import { cloneData, clamp, toNumber } from './utils/dsp';
import { AppState, PresetState, SettingsUI } from './state';
import { Engine } from './audio/engine';
import * as keyboard from './keyboard';
import { replaceVoices, voices } from './voices';
import type { DelayMode, DelaySettings, FxSettings, GlobalSettings, StoredSettings, SynthSettings, VoiceConfig, VoiceParams, VoiceSends } from './types';

function readStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function updatePresetSelect(): void {
  if (!SettingsUI.presetSelect) return;
  const select = SettingsUI.presetSelect;
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Preset Library';
  select.appendChild(placeholder);
  Object.keys(PresetState.items)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  select.value = PresetState.selectedName && PresetState.items[PresetState.selectedName] ? PresetState.selectedName : '';
}

export function persistPresets(): void {
  writeStorageJson(STORAGE_KEYS.presets, PresetState.items);
  updatePresetSelect();
}

export function clearAutoSave(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.autosave);
  } catch {
    /* storage unavailable */
  }
}

let booted = false;
export function isBooted(): boolean {
  return booted;
}
export function markBooted(): void {
  booted = true;
}

let persistTimer: number | null = null;
let persistSuspended = false;

export function scheduleAutoSave(): void {
  if (persistSuspended || !booted) return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    writeStorageJson(STORAGE_KEYS.autosave, snapshotSettings());
  }, 120);
}

function withPersistenceSuspended<T>(fn: () => T): T {
  persistSuspended = true;
  try {
    return fn();
  } finally {
    persistSuspended = false;
  }
}

export function normalizeVoiceSettings(voice: unknown, index: number): VoiceConfig {
  const source = (voice && typeof voice === 'object' ? voice : {}) as Partial<VoiceConfig> & Record<string, unknown>;
  const sourceParams = (source.params && typeof source.params === 'object' ? source.params : source) as Partial<VoiceParams> & {
    sends?: Partial<VoiceSends>;
  };
  const params = Object.assign({}, DEFAULT_VOICE_PARAMS, sourceParams) as VoiceParams;
  params.sends = Object.assign({}, DEFAULT_VOICE_PARAMS.sends, sourceParams.sends || {});
  return {
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : `Voice ${index + 1}`,
    enabled: source.enabled !== undefined ? !!source.enabled : true,
    params,
  };
}

export function normalizeSettings(raw: unknown): SynthSettings {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid settings file.');
  const record = raw as Record<string, unknown>;
  const globalSource = (record.global && typeof record.global === 'object' ? record.global : {}) as Partial<GlobalSettings>;
  const fxSource = (record.fx && typeof record.fx === 'object' ? record.fx : {}) as Partial<FxSettings>;
  const voicesSource = Array.isArray(record.voices) && record.voices.length ? record.voices : DEFAULT_SYNTH_SETTINGS.voices;
  const rawDelayMode = fxSource.delay ? (fxSource.delay as Partial<DelaySettings>).mode : undefined;
  const delayMode: DelayMode = (['seconds', 'frequency', 'measures'] as DelayMode[]).includes(rawDelayMode as DelayMode)
    ? (rawDelayMode as DelayMode)
    : DEFAULT_SYNTH_SETTINGS.fx.delay.mode;
  return {
    global: {
      bpm: clamp(Math.round(toNumber(globalSource.bpm, DEFAULT_SYNTH_SETTINGS.global.bpm)), 20, 220),
      master: clamp(toNumber(globalSource.master, DEFAULT_SYNTH_SETTINGS.global.master), 0, 1.2),
      octaveBase: clamp(Math.round(toNumber(globalSource.octaveBase, DEFAULT_SYNTH_SETTINGS.global.octaveBase)), 12, 96),
    },
    fx: {
      distortion: Object.assign({}, DEFAULT_SYNTH_SETTINGS.fx.distortion, fxSource.distortion || {}),
      chorus: Object.assign({}, DEFAULT_SYNTH_SETTINGS.fx.chorus, fxSource.chorus || {}),
      delay: Object.assign({}, DEFAULT_SYNTH_SETTINGS.fx.delay, fxSource.delay || {}, { mode: delayMode }),
      reverb: Object.assign({}, DEFAULT_SYNTH_SETTINGS.fx.reverb, fxSource.reverb || {}),
    },
    voices: voicesSource.map((voice, index) => normalizeVoiceSettings(voice, index)),
  };
}

export function getStartupSettings(): SynthSettings {
  const autosave = readStorageJson<unknown>(STORAGE_KEYS.autosave, null);
  if (!autosave) return cloneData(DEFAULT_SYNTH_SETTINGS);
  try {
    return normalizeSettings(autosave);
  } catch {
    return cloneData(DEFAULT_SYNTH_SETTINGS);
  }
}

export function delayModeDefaultValue(mode: DelayMode): number {
  if (mode === 'seconds') return 0.35;
  if (mode === 'measures') return 1;
  return 0.35;
}

export function snapshotSettings(): StoredSettings {
  return {
    version: 1,
    global: cloneData(AppState.global),
    fx: cloneData(AppState.fx),
    voices: voices.map((voice) => voice.serialize()),
  };
}

export function applyGlobalSettings(): void {
  const state = AppState.global;
  if (SettingsUI.global.bpm) SettingsUI.global.bpm.set(state.bpm, true);
  if (SettingsUI.global.master) SettingsUI.global.master.set(state.master, true);
  if (Engine.ctx) Engine.setBpm(state.bpm);
  if (Engine.master) Engine.master.gain.setTargetAtTime(state.master, Engine.ctx!.currentTime, 0.02);
  keyboard.setOctaveBase(state.octaveBase);
  keyboard.buildKeyboard();
}

export function applyFxSettings(): void {
  if (!Engine.ctx) return;

  const distState = AppState.fx.distortion;
  if (SettingsUI.fx.distortion.drive) SettingsUI.fx.distortion.drive.set(distState.drive, true);
  if (SettingsUI.fx.distortion.amount) SettingsUI.fx.distortion.amount.set(distState.amount, true);
  if (SettingsUI.fx.distortion.tone) SettingsUI.fx.distortion.tone.set(distState.tone, true);
  if (SettingsUI.fx.distortion.return) SettingsUI.fx.distortion.return.set(distState.return, true);
  Engine.fx.distortion.setDrive(distState.drive);
  Engine.fx.distortion.setAmount(distState.amount);
  Engine.fx.distortion.setTone(distState.tone);
  Engine.fx.distortion.setReturn(distState.return);

  const chorusState = AppState.fx.chorus;
  if (SettingsUI.fx.chorus.rate) SettingsUI.fx.chorus.rate.set(chorusState.rate, true);
  if (SettingsUI.fx.chorus.depth) SettingsUI.fx.chorus.depth.set(chorusState.depth, true);
  if (SettingsUI.fx.chorus.mix) SettingsUI.fx.chorus.mix.set(chorusState.mix, true);
  if (SettingsUI.fx.chorus.return) SettingsUI.fx.chorus.return.set(chorusState.return, true);
  Engine.fx.chorus.setRate(chorusState.rate);
  Engine.fx.chorus.setDepth(chorusState.depth);
  Engine.fx.chorus.setMix(chorusState.mix);
  Engine.fx.chorus.setReturn(chorusState.return);

  const delayState = AppState.fx.delay;
  if (SettingsUI.fx.delay.setMode) SettingsUI.fx.delay.setMode(delayState.mode, delayState.timeValue);
  if (SettingsUI.fx.delay.feedback) SettingsUI.fx.delay.feedback.set(delayState.feedback, true);
  if (SettingsUI.fx.delay.damp) SettingsUI.fx.delay.damp.set(delayState.damp, true);
  if (SettingsUI.fx.delay.mix) SettingsUI.fx.delay.mix.set(delayState.mix, true);
  if (SettingsUI.fx.delay.return) SettingsUI.fx.delay.return.set(delayState.return, true);
  Engine.fx.delay.setFeedback(delayState.feedback);
  Engine.fx.delay.setDamp(delayState.damp);
  Engine.fx.delay.setMix(delayState.mix);
  Engine.fx.delay.setReturn(delayState.return);

  const reverbState = AppState.fx.reverb;
  if (SettingsUI.fx.reverb.size) SettingsUI.fx.reverb.size.set(reverbState.size, true);
  if (SettingsUI.fx.reverb.damping) SettingsUI.fx.reverb.damping.set(reverbState.damping, true);
  if (SettingsUI.fx.reverb.mix) SettingsUI.fx.reverb.mix.set(reverbState.mix, true);
  if (SettingsUI.fx.reverb.return) SettingsUI.fx.reverb.return.set(reverbState.return, true);
  Engine.fx.reverb.setSize(reverbState.size);
  Engine.fx.reverb.setDamp(reverbState.damping);
  Engine.fx.reverb.setMix(reverbState.mix);
  Engine.fx.reverb.setReturn(reverbState.return);
}

export function loadSettings(raw: unknown): SynthSettings {
  return withPersistenceSuspended(() => {
    const next = normalizeSettings(raw);
    AppState.global = cloneData(next.global);
    AppState.fx = cloneData(next.fx);
    applyGlobalSettings();
    applyFxSettings();
    replaceVoices(next.voices);
    scheduleAutoSave();
    return next;
  });
}

export function loadPresetLibrary(): void {
  const stored = readStorageJson<unknown>(STORAGE_KEYS.presets, {});
  PresetState.items = stored && typeof stored === 'object' ? (stored as Record<string, StoredSettings>) : {};
  updatePresetSelect();
}

export function savePreset(): void {
  const suggestedName = PresetState.selectedName || 'New Preset';
  const name = (window.prompt('Preset name', suggestedName) || '').trim();
  if (!name) return;
  const preset = snapshotSettings();
  preset.meta = Object.assign({}, preset.meta, { name });
  PresetState.items[name] = preset;
  PresetState.selectedName = name;
  persistPresets();
}

export function renamePreset(): void {
  const currentName = PresetState.selectedName || (SettingsUI.presetSelect ? SettingsUI.presetSelect.value : '');
  if (!currentName || !PresetState.items[currentName]) return;
  const nextName = (window.prompt('Rename preset', currentName) || '').trim();
  if (!nextName || nextName === currentName) return;
  const preset = PresetState.items[currentName];
  delete PresetState.items[currentName];
  preset.meta = Object.assign({}, preset.meta, { name: nextName });
  PresetState.items[nextName] = preset;
  PresetState.selectedName = nextName;
  persistPresets();
}

export function duplicatePreset(): void {
  const currentName = PresetState.selectedName || (SettingsUI.presetSelect ? SettingsUI.presetSelect.value : '');
  const baseSettings = currentName && PresetState.items[currentName] ? PresetState.items[currentName] : snapshotSettings();
  const suggestedName = currentName ? `${currentName} Copy` : 'Preset Copy';
  const nextName = (window.prompt('Duplicate preset as', suggestedName) || '').trim();
  if (!nextName) return;
  const copy = cloneData(baseSettings);
  copy.meta = Object.assign({}, copy.meta, { name: nextName });
  PresetState.items[nextName] = copy;
  PresetState.selectedName = nextName;
  persistPresets();
}

export function applyPreset(name: string): void {
  const preset = PresetState.items[name];
  if (!preset) return;
  PresetState.selectedName = name;
  updatePresetSelect();
  loadSettings(preset);
}

export function deletePreset(): void {
  const name = PresetState.selectedName || (SettingsUI.presetSelect ? SettingsUI.presetSelect.value : '');
  if (!name || !PresetState.items[name]) return;
  if (!window.confirm(`Delete preset "${name}"?`)) return;
  delete PresetState.items[name];
  PresetState.selectedName = '';
  persistPresets();
}

export function factoryReset(): void {
  if (!window.confirm('Reset the current patch to factory defaults and clear autosave?')) return;
  clearAutoSave();
  PresetState.selectedName = '';
  updatePresetSelect();
  loadSettings(cloneData(DEFAULT_SYNTH_SETTINGS));
}
