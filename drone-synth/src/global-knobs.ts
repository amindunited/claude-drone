import { Knob } from './ui/knob';
import { Engine } from './audio/engine';
import { AppState, SettingsUI } from './state';
import { scheduleAutoSave } from './persistence';

export function mountGlobalKnobs(): void {
  const bpmMount = document.getElementById('bpmKnobMount')!;
  const bpmKnob = new Knob({
    min: 20,
    max: 220,
    value: AppState.global.bpm,
    default: 60,
    step: 1,
    size: 40,
    label: '',
    formatter: (v) => String(Math.round(v)),
    onChange: (v) => {
      AppState.global.bpm = Math.round(v);
      Engine.setBpm(AppState.global.bpm);
      scheduleAutoSave();
    },
  });
  bpmMount.replaceWith(bpmKnob.el);
  SettingsUI.global.bpm = bpmKnob;

  const masterMount = document.getElementById('masterKnobMount')!;
  const masterKnob = new Knob({
    min: 0,
    max: 1.2,
    value: AppState.global.master,
    default: 0.8,
    step: 0.01,
    size: 40,
    label: '',
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      AppState.global.master = v;
      if (Engine.master) Engine.master.gain.setTargetAtTime(v, Engine.ctx!.currentTime, 0.02);
      scheduleAutoSave();
    },
  });
  masterMount.replaceWith(masterKnob.el);
  SettingsUI.global.master = masterKnob;
}
