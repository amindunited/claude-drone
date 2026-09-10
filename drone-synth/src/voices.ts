import { Voice } from './audio/voice';
import { normalizeVoiceSettings, scheduleAutoSave } from './persistence';
import type { VoiceConfig, VoiceParams } from './types';

export const voices: Voice[] = [];

export function addVoice(nameOrConfig?: string | VoiceConfig, preset?: Partial<VoiceParams>): Voice {
  let name: string | undefined = typeof nameOrConfig === 'string' ? nameOrConfig : undefined;
  let params: Partial<VoiceParams> | undefined = preset;
  let enabled = true;
  if (nameOrConfig && typeof nameOrConfig === 'object') {
    name = nameOrConfig.name || 'Voice ' + (voices.length + 1);
    params = nameOrConfig.params && typeof nameOrConfig.params === 'object' ? nameOrConfig.params : (nameOrConfig as unknown as Partial<VoiceParams>);
    enabled = nameOrConfig.enabled !== undefined ? !!nameOrConfig.enabled : true;
  }
  const v = new Voice(name || 'Voice ' + (voices.length + 1), params, enabled);
  voices.push(v);
  scheduleAutoSave();
  return v;
}

export function clearVoices(): void {
  while (voices.length) {
    const voice = voices.pop()!;
    voice.dispose();
  }
}

export function removeVoice(id: string): void {
  const idx = voices.findIndex((v) => v.id === id);
  if (idx < 0) return;
  voices[idx].dispose();
  voices.splice(idx, 1);
  scheduleAutoSave();
}

export function replaceVoices(nextVoices: VoiceConfig[]): void {
  clearVoices();
  nextVoices.forEach((voice, index) => addVoice(normalizeVoiceSettings(voice, index)));
}

export function globalNoteOn(note: number, vel: number): void {
  voices.forEach((v) => v.noteOn(note, vel));
}

export function globalNoteOff(note: number): void {
  voices.forEach((v) => v.noteOff(note));
}
