import { Engine } from './audio/engine';
import { Recorder } from './audio/recorder';
import { addVoice } from './voices';
import { AppState, PresetState, SettingsUI } from './state';
import {
  applyPreset,
  deletePreset,
  duplicatePreset,
  factoryReset,
  getStartupSettings,
  isBooted,
  loadPresetLibrary,
  loadSettings,
  markBooted,
  renamePreset,
  savePreset,
} from './persistence';
import { buildFxPage } from './fx-page';
import { mountGlobalKnobs } from './global-knobs';
import { downloadSettings, handleSettingsFile } from './export-settings';
import { initKeyboardControls, paintSustainButton, setOctaveBase, toggleSustain } from './keyboard';
import { setupMidi } from './midi';
import { cloneData } from './utils/dsp';

initKeyboardControls();

document.getElementById('tabSynth')!.addEventListener('click', () => {
  document.getElementById('tabSynth')!.classList.add('active');
  document.getElementById('tabFx')!.classList.remove('active');
  document.getElementById('synthView')!.classList.add('active');
  document.getElementById('fxView')!.classList.remove('active');
});
document.getElementById('tabFx')!.addEventListener('click', () => {
  document.getElementById('tabFx')!.classList.add('active');
  document.getElementById('tabSynth')!.classList.remove('active');
  document.getElementById('fxView')!.classList.add('active');
  document.getElementById('synthView')!.classList.remove('active');
});
document.getElementById('sustainToggle')!.addEventListener('click', () => {
  toggleSustain();
});
document.getElementById('addVoiceBtn')!.addEventListener('click', () => {
  addVoice();
});
document.getElementById('recordEnable')!.addEventListener('change', (e) => {
  Recorder.setEnabled((e.target as HTMLInputElement).checked);
});
SettingsUI.presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
SettingsUI.presetSelect.addEventListener('change', (e) => {
  const name = (e.target as HTMLSelectElement).value;
  if (!name) {
    PresetState.selectedName = '';
    return;
  }
  applyPreset(name);
});
document.getElementById('savePresetBtn')!.addEventListener('click', savePreset);
document.getElementById('renamePresetBtn')!.addEventListener('click', renamePreset);
document.getElementById('duplicatePresetBtn')!.addEventListener('click', duplicatePreset);
document.getElementById('deletePresetBtn')!.addEventListener('click', deletePreset);
document.getElementById('factoryResetBtn')!.addEventListener('click', factoryReset);
document.getElementById('saveSettingsBtn')!.addEventListener('click', downloadSettings);
document.getElementById('loadSettingsBtn')!.addEventListener('click', () => {
  document.getElementById('loadSettingsInput')!.click();
});
document.getElementById('loadSettingsInput')!.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const [file] = input.files || [];
  await handleSettingsFile(file);
  input.value = '';
});

function boot(): void {
  if (isBooted()) return;
  const startupSettings = getStartupSettings();
  AppState.global = cloneData(startupSettings.global);
  AppState.fx = cloneData(startupSettings.fx);
  setOctaveBase(AppState.global.octaveBase);
  markBooted();
  Engine.init();
  Recorder.init();
  loadPresetLibrary();
  buildFxPage();
  mountGlobalKnobs();
  loadSettings(startupSettings);
  setupMidi();
  paintSustainButton();
}

document.getElementById('startBtn')!.addEventListener('click', () => {
  boot();
  Engine.resume();
  document.getElementById('audioGate')!.style.display = 'none';
});
