import { Knob, type KnobOptions } from './ui/knob';
import { clamp } from './utils/dsp';
import { Engine } from './audio/engine';
import { AppState, SettingsUI } from './state';
import { DEFAULT_SYNTH_SETTINGS } from './constants';
import { delayModeDefaultValue } from './persistence';
import type { DelayMode } from './types';

export function buildFxPage(): void {
  const grid = document.getElementById('fxGrid')!;
  grid.innerHTML = '';

  function panel(title: string, tag: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'fx-panel';
    el.innerHTML = `<div class="fx-head"><h3>${title}</h3><span class="tag">${tag}</span></div><div class="fx-body"><div class="fx-knob-grid"></div></div>`;
    grid.appendChild(el);
    return el.querySelector('.fx-knob-grid')!;
  }
  function mk(container: HTMLElement, opts: KnobOptions): Knob {
    const k = new Knob(opts);
    container.appendChild(k.el);
    return k;
  }

  const d = Engine.fx.distortion;
  const distState = AppState.fx.distortion;
  const dGrid = panel('Distortion', 'SEND 1');
  SettingsUI.fx.distortion.drive = mk(dGrid, {
    label: 'DRIVE',
    min: 0,
    max: 4,
    value: distState.drive,
    default: 1,
    step: 0.01,
    formatter: (v) => v.toFixed(2) + 'x',
    onChange: (v) => {
      distState.drive = v;
      d.setDrive(v);
    },
  });
  SettingsUI.fx.distortion.amount = mk(dGrid, {
    label: 'AMOUNT',
    min: 0,
    max: 1,
    value: distState.amount,
    default: 0.3,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      distState.amount = v;
      d.setAmount(v);
    },
  });
  SettingsUI.fx.distortion.tone = mk(dGrid, {
    label: 'TONE',
    min: 400,
    max: 12000,
    value: distState.tone,
    default: 6000,
    log: true,
    formatter: (v) => Math.round(v) + 'Hz',
    onChange: (v) => {
      distState.tone = v;
      d.setTone(v);
    },
  });
  SettingsUI.fx.distortion.return = mk(dGrid, {
    label: 'RETURN',
    min: 0,
    max: 1.5,
    value: distState.return,
    default: 0.5,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      distState.return = v;
      d.setReturn(v);
    },
  });

  const c = Engine.fx.chorus;
  const chorusState = AppState.fx.chorus;
  const cGrid = panel('Chorus', 'SEND 2');
  SettingsUI.fx.chorus.rate = mk(cGrid, {
    label: 'RATE',
    min: 0.05,
    max: 5,
    value: chorusState.rate,
    default: 0.6,
    log: true,
    formatter: (v) => v.toFixed(2) + 'Hz',
    onChange: (v) => {
      chorusState.rate = v;
      c.setRate(v);
    },
  });
  SettingsUI.fx.chorus.depth = mk(cGrid, {
    label: 'DEPTH',
    min: 0.5,
    max: 12,
    value: chorusState.depth,
    default: 4,
    formatter: (v) => v.toFixed(1) + 'ms',
    onChange: (v) => {
      chorusState.depth = v;
      c.setDepth(v);
    },
  });
  SettingsUI.fx.chorus.mix = mk(cGrid, {
    label: 'MIX',
    min: 0,
    max: 1,
    value: chorusState.mix,
    default: 0.5,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      chorusState.mix = v;
      c.setMix(v);
    },
  });
  SettingsUI.fx.chorus.return = mk(cGrid, {
    label: 'RETURN',
    min: 0,
    max: 1.5,
    value: chorusState.return,
    default: 0.5,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      chorusState.return = v;
      c.setReturn(v);
    },
  });

  const dl = Engine.fx.delay;
  const dlGrid = panel('Delay', 'SEND 3');
  const delayState = AppState.fx.delay;
  const setDelayFromMode = () => {
    const v = delayState.timeValue;
    let sec = 0.35;
    if (delayState.mode === 'frequency') {
      sec = 1 / Math.max(v, 0.001);
    } else if (delayState.mode === 'measures') {
      sec = (v * 60) / Math.max(Engine.bpm, 1);
    } else {
      sec = v;
    }
    dl.setTime(sec);
  };
  const delayTimeKnob = mk(dlGrid, {
    label: 'TIME',
    min: 0.02,
    max: 8,
    value: delayState.timeValue,
    default: 0.35,
    log: true,
    formatter: (v) =>
      delayState.mode === 'frequency' ? `${v.toFixed(2)}Hz` : delayState.mode === 'measures' ? `${v.toFixed(2)} bars` : `${(v * 1000).toFixed(0)}ms`,
    parser: (text) => {
      const t = (text || '').trim();
      const match = t.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
      if (!match) return null;
      const n = Number(match[0]);
      if (!Number.isFinite(n)) return null;
      if (delayState.mode === 'seconds' && /ms/i.test(t)) return n / 1000;
      return n;
    },
    onChange: (v) => {
      delayState.timeValue = v;
      setDelayFromMode();
    },
  });
  const delayModeWrap = document.createElement('div');
  delayModeWrap.className = 'toggle-row';
  const paintDelayMode = () => {
    delayModeWrap.querySelectorAll<HTMLButtonElement>('.toggle-pill').forEach((b) => b.classList.toggle('active', b.dataset.delayMode === delayState.mode));
  };
  const setDelayMode = (mode: DelayMode, nextValue: number) => {
    const resolvedMode: DelayMode = (['seconds', 'frequency', 'measures'] as DelayMode[]).includes(mode) ? mode : DEFAULT_SYNTH_SETTINGS.fx.delay.mode;
    delayState.mode = resolvedMode;
    delayTimeKnob.min = resolvedMode === 'seconds' ? 0.02 : resolvedMode === 'frequency' ? 0.05 : 0.25;
    delayTimeKnob.max = resolvedMode === 'seconds' ? 2 : resolvedMode === 'frequency' ? 8 : 16;
    const fallbackValue = delayModeDefaultValue(resolvedMode);
    const resolvedValue = Number.isFinite(Number(nextValue)) ? Number(nextValue) : fallbackValue;
    delayTimeKnob.set(clamp(resolvedValue, delayTimeKnob.min, delayTimeKnob.max), true);
    delayState.timeValue = delayTimeKnob.value;
    setDelayFromMode();
    paintDelayMode();
  };
  (['seconds', 'frequency', 'measures'] as DelayMode[]).forEach((mode) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-pill';
    btn.textContent = mode === 'seconds' ? 'Sec' : mode === 'frequency' ? 'Hz' : 'Bars';
    btn.dataset.delayMode = mode;
    btn.addEventListener('click', () => {
      const nextValue = mode === delayState.mode ? delayState.timeValue : delayModeDefaultValue(mode);
      setDelayMode(mode, nextValue);
    });
    delayModeWrap.appendChild(btn);
  });
  dlGrid.insertBefore(delayModeWrap, dlGrid.firstChild);
  SettingsUI.fx.delay.time = delayTimeKnob;
  SettingsUI.fx.delay.setMode = setDelayMode;
  SettingsUI.fx.delay.feedback = mk(dlGrid, {
    label: 'FEEDBACK',
    min: 0,
    max: 0.95,
    value: delayState.feedback,
    default: 0.35,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      delayState.feedback = v;
      dl.setFeedback(v);
    },
  });
  SettingsUI.fx.delay.damp = mk(dlGrid, {
    label: 'DAMP',
    min: 400,
    max: 12000,
    value: delayState.damp,
    default: 4000,
    log: true,
    formatter: (v) => Math.round(v) + 'Hz',
    onChange: (v) => {
      delayState.damp = v;
      dl.setDamp(v);
    },
  });
  SettingsUI.fx.delay.mix = mk(dlGrid, {
    label: 'MIX',
    min: 0,
    max: 1,
    value: delayState.mix,
    default: 0.6,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      delayState.mix = v;
      dl.setMix(v);
    },
  });
  SettingsUI.fx.delay.return = mk(dlGrid, {
    label: 'RETURN',
    min: 0,
    max: 1.5,
    value: delayState.return,
    default: 0.4,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      delayState.return = v;
      dl.setReturn(v);
    },
  });
  setDelayMode(delayState.mode, delayState.timeValue);

  const rv = Engine.fx.reverb;
  const reverbState = AppState.fx.reverb;
  const rvGrid = panel('Reverb', 'SEND 4');
  SettingsUI.fx.reverb.size = mk(rvGrid, {
    label: 'SIZE',
    min: 0.2,
    max: 8,
    value: reverbState.size,
    default: 2.5,
    log: true,
    formatter: (v) => v.toFixed(1) + 's',
    onChange: (v) => {
      reverbState.size = v;
      rv.setSize(v);
    },
  });
  SettingsUI.fx.reverb.damping = mk(rvGrid, {
    label: 'DAMPING',
    min: 0.5,
    max: 6,
    value: reverbState.damping,
    default: 2.2,
    step: 0.05,
    formatter: (v) => v.toFixed(2),
    onChange: (v) => {
      reverbState.damping = v;
      rv.setDamp(v);
    },
  });
  SettingsUI.fx.reverb.mix = mk(rvGrid, {
    label: 'MIX',
    min: 0,
    max: 1,
    value: reverbState.mix,
    default: 0.5,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      reverbState.mix = v;
      rv.setMix(v);
    },
  });
  SettingsUI.fx.reverb.return = mk(rvGrid, {
    label: 'RETURN',
    min: 0,
    max: 1.5,
    value: reverbState.return,
    default: 0.45,
    step: 0.01,
    formatter: (v) => Math.round(v * 100) + '%',
    onChange: (v) => {
      reverbState.return = v;
      rv.setReturn(v);
    },
  });
}
