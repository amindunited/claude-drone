import { Knob, type KnobOptions } from '../ui/knob';
import { DEFAULT_VOICE_PARAMS, FX_KEYS, FX_LABELS, LFO_DIVISIONS } from '../constants';
import { cloneData, nextId } from '../utils/dsp';
import type { FxKey, VoiceParams } from '../types';
import { scheduleAutoSave } from '../persistence';
import { removeVoice, voices } from '../voices';
import { Engine } from './engine';
import { NoteVoice } from './note-voice';

export class Voice {
  id: string;
  name: string;
  enabled: boolean;
  activeNotes = new Map<number, NoteVoice>();
  pendingNotes = new Map<number, number>();
  params: VoiceParams;

  bus: GainNode;
  levelGain: GainNode;
  sendGains!: Record<FxKey, GainNode>;

  panelEl!: HTMLDivElement;
  ledEl!: HTMLElement;
  enableBtn!: HTMLButtonElement;

  private _lfoRateKnob: Knob | null = null;
  private _lfoRateKnob2: Knob | null = null;
  private _noteOffsetSecondsKnob: Knob | null = null;

  constructor(name: string, preset: Partial<VoiceParams> | undefined, enabled: boolean | undefined) {
    this.id = nextId();
    this.name = name;
    this.enabled = enabled !== undefined ? !!enabled : true;
    this.params = Object.assign({}, DEFAULT_VOICE_PARAMS, preset || {});
    this.params.sends = Object.assign({}, DEFAULT_VOICE_PARAMS.sends, (preset || {}).sends || {});

    const ctx = Engine.ctx!;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.levelGain = ctx.createGain();
    this.levelGain.gain.value = this.params.level;
    this.bus.connect(this.levelGain).connect(Engine.master!);
    this.sendGains = {} as Record<FxKey, GainNode>;
    FX_KEYS.forEach((k) => {
      const g = ctx.createGain();
      g.gain.value = this.params.sends[k];
      this.levelGain.connect(g).connect(Engine.fx[k].input);
      this.sendGains[k] = g;
    });

    this._buildPanel();
  }

  noteOn(note: number, velocity: number): void {
    if (!this.enabled) return;
    this._cancelPending(note);
    if (this.activeNotes.has(note)) {
      this.activeNotes.get(note)!.forceStop();
      this.activeNotes.delete(note);
    }
    const offsetSeconds = this._resolveNoteOffsetSeconds();
    if (offsetSeconds > 0) {
      const timer = window.setTimeout(() => {
        this.pendingNotes.delete(note);
        const nv = new NoteVoice(this, note, velocity);
        this.activeNotes.set(note, nv);
        this._ledUpdate();
      }, offsetSeconds * 1000);
      this.pendingNotes.set(note, timer);
      return;
    }
    const nv = new NoteVoice(this, note, velocity);
    this.activeNotes.set(note, nv);
    this._ledUpdate();
  }

  noteOff(note: number): void {
    if (this._cancelPending(note)) {
      this._ledUpdate();
      return;
    }
    const nv = this.activeNotes.get(note);
    if (nv) {
      nv.release();
      this.activeNotes.delete(note);
    }
    this._ledUpdate();
  }

  allNotesOff(): void {
    this.pendingNotes.forEach((timer) => window.clearTimeout(timer));
    this.pendingNotes.clear();
    this.activeNotes.forEach((nv) => nv.forceStop());
    this.activeNotes.clear();
    this._ledUpdate();
  }

  private _cancelPending(note: number): boolean {
    const timer = this.pendingNotes.get(note);
    if (timer === undefined) return false;
    window.clearTimeout(timer);
    this.pendingNotes.delete(note);
    return true;
  }

  private _resolveNoteOffsetSeconds(): number {
    const p = this.params;
    if (p.noteOffsetMode === 'sync') {
      return 1 / Engine.divisionHz(p.noteOffsetDivision);
    }
    return Math.max(0, p.noteOffsetSeconds);
  }

  private _ledUpdate(): void {
    if (this.ledEl) this.ledEl.classList.toggle('active', this.activeNotes.size > 0);
  }

  private _liveUpdate(): void {
    this.activeNotes.forEach((nv) => nv.updateLive(this.params));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = !!enabled;
    if (!this.enabled) this.allNotesOff();
    this._paintEnabled();
    scheduleAutoSave();
  }

  setLevel(v: number): void {
    this.params.level = v;
    this.levelGain.gain.setTargetAtTime(v, Engine.ctx!.currentTime, 0.02);
  }

  setSend(k: FxKey, v: number): void {
    this.params.sends[k] = v;
    this.sendGains[k].gain.setTargetAtTime(v, Engine.ctx!.currentTime, 0.02);
  }

  serialize(): { name: string; enabled: boolean; params: VoiceParams } {
    return { name: this.name, enabled: this.enabled, params: cloneData(this.params) };
  }

  dispose(): void {
    this.allNotesOff();
    ([this.bus, this.levelGain, ...Object.values(this.sendGains)] as AudioNode[]).forEach((n) => {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    });
    if (this.panelEl) this.panelEl.remove();
  }

  private _paintEnabled(): void {
    if (!this.enableBtn) return;
    this._paintToggle(this.enableBtn, this.enabled);
  }

  private _paintToggle(btn: HTMLButtonElement, on: boolean): void {
    btn.classList.toggle('on', on);
    btn.classList.toggle('off', !on);
  }

  /** Populates a tempo-division <select> (from LFO_DIVISIONS) and wires its change handler. */
  private _wireDivisionSelect(selector: string, get: () => number, set: (v: number) => void, onChange?: () => void): void {
    const sel = this.panelEl.querySelector<HTMLSelectElement>(selector)!;
    LFO_DIVISIONS.forEach((d) => {
      const o = document.createElement('option');
      o.value = String(d.beats);
      o.textContent = d.label;
      sel.appendChild(o);
    });
    sel.value = String(get());
    sel.addEventListener('change', (e) => {
      set(parseFloat((e.target as HTMLSelectElement).value));
      if (onChange) onChange();
      scheduleAutoSave();
    });
  }

  /** Wires a seconds/hz-vs-sync `.toggle-pill` group: paints active state, shows/hides the division select and rate knob. */
  private _wireRateModeToggle(opts: {
    toggleGroup: string;
    syncSelectGroup: string;
    knob: () => Knob | null;
    get: () => string;
    set: (mode: string) => void;
    onChange?: () => void;
  }): () => void {
    const toggleWrap = this.panelEl.querySelector<HTMLElement>(`[data-group="${opts.toggleGroup}"]`)!;
    const syncSelectWrap = this.panelEl.querySelector<HTMLElement>(`[data-group="${opts.syncSelectGroup}"]`)!;
    const paint = () => {
      const mode = opts.get();
      toggleWrap.querySelectorAll<HTMLButtonElement>('.toggle-pill').forEach((b) => b.classList.toggle('active', b.dataset.rate === mode));
      syncSelectWrap.style.display = mode === 'sync' ? 'flex' : 'none';
      const knob = opts.knob();
      if (knob) knob.el.style.display = mode === 'sync' ? 'none' : 'flex';
    };
    toggleWrap.querySelectorAll<HTMLButtonElement>('.toggle-pill').forEach((b) => {
      b.addEventListener('click', () => {
        opts.set(b.dataset.rate!);
        paint();
        if (opts.onChange) opts.onChange();
        scheduleAutoSave();
      });
    });
    return paint;
  }

  private _buildPanel(): void {
    const p = this.params;
    const panel = document.createElement('div');
    panel.className = 'voice-panel';
    panel.innerHTML = `
      <div class="vp-head">
        <span class="vp-led"></span>
        <input class="vp-name" value="${this.name}" spellcheck="false"/>
        <button class="icon-btn toggle on" title="Enable/disable voice" data-act="enable">●</button>
        <button class="icon-btn danger" title="Remove voice" data-act="remove">✕</button>
      </div>
      <div class="vp-body">
        <div class="section">
          <p class="section-label">Oscillator</p>
          <div class="row-select">
            <select class="control" data-p="osc">
              <option value="sine">Sine</option>
              <option value="sawtooth">Saw</option>
              <option value="triangle">Triangle</option>
              <option value="pulse">Pulse</option>
              <option value="noise">Noise</option>
            </select>
          </div>
          <div class="knob-grid n2" data-group="osc-knobs"></div>
        </div>

        <div class="section" data-section="osc2">
          <p class="section-label">
            <button class="icon-btn toggle off" title="Enable/disable oscillator 2" data-act="toggle-osc2">●</button>
            Oscillator 2
          </p>
          <div class="row-select">
            <select class="control" data-p="osc2">
              <option value="sine">Sine</option>
              <option value="sawtooth">Saw</option>
              <option value="triangle">Triangle</option>
              <option value="pulse">Pulse</option>
              <option value="noise">Noise</option>
            </select>
          </div>
          <div class="knob-grid n2" data-group="osc2-knobs"></div>
        </div>

        <div class="section" data-section="noteOffset">
          <p class="section-label">Note Offset</p>
          <div class="toggle-row" data-group="noteoffset-toggle">
            <button class="toggle-pill" data-rate="seconds">Sec</button>
            <button class="toggle-pill" data-rate="sync">Sync</button>
          </div>
          <div class="row-select" data-group="noteoffset-sync-select" style="display:none;">
            <select class="control" data-p="noteOffsetDivision"></select>
          </div>
          <div class="knob-grid" data-group="noteoffset-knobs"></div>
        </div>

        <div class="section">
          <p class="section-label">Envelope</p>
          <div class="knob-grid" data-group="adsr"></div>
        </div>

        <div class="section">
          <p class="section-label">Filter</p>
          <div class="row-select">
            <select class="control" data-p="filterType">
              <option value="lowpass">Low‑pass</option>
              <option value="highpass">High‑pass</option>
              <option value="bandpass">Band‑pass</option>
            </select>
          </div>
          <div class="knob-grid n3" data-group="filter"></div>
        </div>

        <div class="section collapsible collapsed" data-section="filter2">
          <div class="section-label-row">
            <button class="icon-btn toggle off" title="Enable/disable filter 2" data-act="toggle-filter2">●</button>
            <button type="button" class="section-label section-toggle" data-act="toggle-filter2-panel" aria-expanded="false">
              Filter 2 <span class="chev">▾</span>
            </button>
          </div>
          <div class="section-content">
            <div class="row-select">
              <select class="control" data-p="filter2Type">
                <option value="lowpass">Low‑pass</option>
                <option value="highpass">High‑pass</option>
                <option value="bandpass">Band‑pass</option>
              </select>
            </div>
            <div class="knob-grid n3" data-group="filter2"></div>
          </div>
        </div>

        <div class="section collapsible expanded" data-section="lfo">
          <button type="button" class="section-label section-toggle" data-act="toggle-lfo" aria-expanded="true">
            LFO 1 / Modulation <span class="chev">▾</span>
          </button>
          <div class="section-content">
            <div class="row-select">
              <select class="control" data-p="lfoTarget">
                <option value="none">Target: Off</option>
                <option value="pitch">Target: Pitch</option>
                <option value="filter">Target: Filter 1</option>
                <option value="filter2">Target: Filter 2</option>
                <option value="amplitude">Target: Amplitude</option>
              </select>
            </div>
            <div class="toggle-row" data-group="lforate-toggle">
              <button class="toggle-pill" data-rate="hz">Hz</button>
              <button class="toggle-pill" data-rate="sync">Sync</button>
            </div>
            <div class="row-select" data-group="lfo-sync-select" style="display:none;">
              <select class="control" data-p="lfoRateDivision"></select>
            </div>
            <div class="knob-grid n2" data-group="lfo-knobs"></div>
          </div>
        </div>

        <div class="section collapsible collapsed" data-section="lfo2">
          <div class="section-label-row">
            <button class="icon-btn toggle off" title="Enable/disable LFO 2" data-act="toggle-lfo2-enable">●</button>
            <button type="button" class="section-label section-toggle" data-act="toggle-lfo2" aria-expanded="false">
              LFO 2 / Modulation <span class="chev">▾</span>
            </button>
          </div>
          <div class="section-content">
            <div class="row-select">
              <select class="control" data-p="lfo2Target">
                <option value="none">Target: Off</option>
                <option value="pitch">Target: Pitch</option>
                <option value="filter">Target: Filter 1</option>
                <option value="filter2">Target: Filter 2</option>
                <option value="amplitude">Target: Amplitude</option>
              </select>
            </div>
            <div class="toggle-row" data-group="lfo2rate-toggle">
              <button class="toggle-pill" data-rate="hz">Hz</button>
              <button class="toggle-pill" data-rate="sync">Sync</button>
            </div>
            <div class="row-select" data-group="lfo2-sync-select" style="display:none;">
              <select class="control" data-p="lfo2RateDivision"></select>
            </div>
            <div class="knob-grid n2" data-group="lfo2-knobs"></div>
          </div>
        </div>

        <div class="section">
          <p class="section-label">Mix &amp; Sends</p>
          <div class="knob-grid n2" data-group="level"></div>
          <div class="send-row" data-group="sends"></div>
        </div>
      </div>
    `;
    document.getElementById('voicesRow')!.insertBefore(panel, document.getElementById('addVoiceWrap'));
    this.panelEl = panel;
    this.ledEl = panel.querySelector('.vp-led')!;

    /* wire selects */
    const oscSel = panel.querySelector<HTMLSelectElement>('[data-p="osc"]')!;
    oscSel.value = p.osc;
    oscSel.addEventListener('change', (e) => {
      p.osc = (e.target as HTMLSelectElement).value as VoiceParams['osc'];
      this._renderOscKnobs();
      this._liveUpdate();
      scheduleAutoSave();
    });
    const osc2ToggleBtn = panel.querySelector<HTMLButtonElement>('[data-act="toggle-osc2"]')!;
    const paintOsc2Enabled = () => this._paintToggle(osc2ToggleBtn, p.osc2Enabled);
    osc2ToggleBtn.addEventListener('click', () => {
      p.osc2Enabled = !p.osc2Enabled;
      paintOsc2Enabled();
      this._liveUpdate();
      scheduleAutoSave();
    });
    paintOsc2Enabled();
    const osc2Sel = panel.querySelector<HTMLSelectElement>('[data-p="osc2"]')!;
    osc2Sel.value = p.osc2;
    osc2Sel.addEventListener('change', (e) => {
      p.osc2 = (e.target as HTMLSelectElement).value as VoiceParams['osc2'];
      this._renderOsc2Knobs();
      this._liveUpdate();
      scheduleAutoSave();
    });
    const filterSel = panel.querySelector<HTMLSelectElement>('[data-p="filterType"]')!;
    filterSel.value = p.filterType;
    filterSel.addEventListener('change', (e) => {
      p.filterType = (e.target as HTMLSelectElement).value as VoiceParams['filterType'];
      this._liveUpdate();
      scheduleAutoSave();
    });

    const filter2ToggleBtn = panel.querySelector<HTMLButtonElement>('[data-act="toggle-filter2"]')!;
    const paintFilter2Enabled = () => this._paintToggle(filter2ToggleBtn, p.filter2Enabled);
    filter2ToggleBtn.addEventListener('click', () => {
      p.filter2Enabled = !p.filter2Enabled;
      paintFilter2Enabled();
      this._liveUpdate();
      scheduleAutoSave();
    });
    paintFilter2Enabled();
    const filter2Section = panel.querySelector<HTMLElement>('[data-section="filter2"]')!;
    const filter2PanelBtn = panel.querySelector<HTMLButtonElement>('[data-act="toggle-filter2-panel"]')!;
    filter2PanelBtn.addEventListener('click', () => {
      const collapsed = filter2Section.classList.toggle('collapsed');
      filter2Section.classList.toggle('expanded', !collapsed);
      filter2PanelBtn.setAttribute('aria-expanded', String(!collapsed));
    });
    const filter2Sel = panel.querySelector<HTMLSelectElement>('[data-p="filter2Type"]')!;
    filter2Sel.value = p.filter2Type;
    filter2Sel.addEventListener('change', (e) => {
      p.filter2Type = (e.target as HTMLSelectElement).value as VoiceParams['filter2Type'];
      this._liveUpdate();
      scheduleAutoSave();
    });
    this._wireDivisionSelect(
      '[data-p="noteOffsetDivision"]',
      () => p.noteOffsetDivision,
      (v) => (p.noteOffsetDivision = v),
    );

    const paintNoteOffsetToggle = this._wireRateModeToggle({
      toggleGroup: 'noteoffset-toggle',
      syncSelectGroup: 'noteoffset-sync-select',
      knob: () => this._noteOffsetSecondsKnob,
      get: () => p.noteOffsetMode,
      set: (mode) => (p.noteOffsetMode = mode as VoiceParams['noteOffsetMode']),
    });

    const targetSel = panel.querySelector<HTMLSelectElement>('[data-p="lfoTarget"]')!;
    targetSel.value = p.lfoTarget;
    targetSel.addEventListener('change', (e) => {
      p.lfoTarget = (e.target as HTMLSelectElement).value as VoiceParams['lfoTarget'];
      this._liveUpdate();
      scheduleAutoSave();
    });
    const targetSel2 = panel.querySelector<HTMLSelectElement>('[data-p="lfo2Target"]')!;
    targetSel2.value = p.lfo2Target;
    targetSel2.addEventListener('change', (e) => {
      p.lfo2Target = (e.target as HTMLSelectElement).value as VoiceParams['lfo2Target'];
      this._liveUpdate();
      scheduleAutoSave();
    });

    this._wireDivisionSelect(
      '[data-p="lfoRateDivision"]',
      () => p.lfoRateDivision,
      (v) => (p.lfoRateDivision = v),
      () => this._liveUpdate(),
    );

    this._wireDivisionSelect(
      '[data-p="lfo2RateDivision"]',
      () => p.lfo2RateDivision,
      (v) => (p.lfo2RateDivision = v),
      () => this._liveUpdate(),
    );

    const lfoSection = panel.querySelector<HTMLElement>('[data-section="lfo"]')!;
    const lfoToggleBtn = panel.querySelector<HTMLButtonElement>('[data-act="toggle-lfo"]')!;
    lfoToggleBtn.addEventListener('click', () => {
      const collapsed = lfoSection.classList.toggle('collapsed');
      lfoSection.classList.toggle('expanded', !collapsed);
      lfoToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    });
    const paintRateToggle = this._wireRateModeToggle({
      toggleGroup: 'lforate-toggle',
      syncSelectGroup: 'lfo-sync-select',
      knob: () => this._lfoRateKnob,
      get: () => p.lfoRateMode,
      set: (mode) => (p.lfoRateMode = mode as VoiceParams['lfoRateMode']),
      onChange: () => this._liveUpdate(),
    });

    const lfo2ToggleBtn = panel.querySelector<HTMLButtonElement>('[data-act="toggle-lfo2-enable"]')!;
    const paintLfo2Enabled = () => this._paintToggle(lfo2ToggleBtn, p.lfo2Enabled);
    lfo2ToggleBtn.addEventListener('click', () => {
      p.lfo2Enabled = !p.lfo2Enabled;
      paintLfo2Enabled();
      this._liveUpdate();
      scheduleAutoSave();
    });
    paintLfo2Enabled();

    const lfoSection2 = panel.querySelector<HTMLElement>('[data-section="lfo2"]')!;
    const lfoToggleBtn2 = panel.querySelector<HTMLButtonElement>('[data-act="toggle-lfo2"]')!;
    lfoToggleBtn2.addEventListener('click', () => {
      const collapsed = lfoSection2.classList.toggle('collapsed');
      lfoSection2.classList.toggle('expanded', !collapsed);
      lfoToggleBtn2.setAttribute('aria-expanded', String(!collapsed));
    });
    const paintRateToggle2 = this._wireRateModeToggle({
      toggleGroup: 'lfo2rate-toggle',
      syncSelectGroup: 'lfo2-sync-select',
      knob: () => this._lfoRateKnob2,
      get: () => p.lfo2RateMode,
      set: (mode) => (p.lfo2RateMode = mode as VoiceParams['lfo2RateMode']),
      onChange: () => this._liveUpdate(),
    });

    /* header buttons */
    panel.querySelector('[data-act="remove"]')!.addEventListener('click', () => {
      if (voices.length <= 1) {
        alert('At least one voice is required.');
        return;
      }
      removeVoice(this.id);
    });
    const enableBtn = panel.querySelector<HTMLButtonElement>('[data-act="enable"]')!;
    this.enableBtn = enableBtn;
    enableBtn.addEventListener('click', () => {
      this.setEnabled(!this.enabled);
    });
    panel.querySelector('.vp-name')!.addEventListener('input', (e) => {
      this.name = (e.target as HTMLInputElement).value;
      scheduleAutoSave();
    });

    /* knobs */
    this._renderOscKnobs();
    this._renderOsc2Knobs();

    const noteOffsetK = panel.querySelector<HTMLElement>('[data-group="noteoffset-knobs"]')!;
    this._noteOffsetSecondsKnob = this._mk(noteOffsetK, {
      label: 'OFFSET',
      min: 0,
      max: 2,
      value: p.noteOffsetSeconds,
      default: 0,
      step: 0.01,
      formatter: (v) => v.toFixed(2) + 's',
      onChange: (v) => {
        p.noteOffsetSeconds = v;
      },
    });
    paintNoteOffsetToggle();

    const adsr = panel.querySelector<HTMLElement>('[data-group="adsr"]')!;
    this._mk(adsr, {
      label: 'ATK',
      min: 0.001,
      max: 6,
      value: p.attack,
      default: 0.6,
      log: true,
      formatter: (v) => v.toFixed(2) + 's',
      onChange: (v) => {
        p.attack = v;
      },
    });
    this._mk(adsr, {
      label: 'DEC',
      min: 0.001,
      max: 6,
      value: p.decay,
      default: 0.4,
      log: true,
      formatter: (v) => v.toFixed(2) + 's',
      onChange: (v) => {
        p.decay = v;
      },
    });
    this._mk(adsr, {
      label: 'SUS',
      min: 0,
      max: 1,
      value: p.sustain,
      default: 0.75,
      step: 0.01,
      formatter: (v) => Math.round(v * 100) + '%',
      onChange: (v) => {
        p.sustain = v;
      },
    });
    this._mk(adsr, {
      label: 'REL',
      min: 0.02,
      max: 30,
      value: p.release,
      default: 1.2,
      log: true,
      formatter: (v) => v.toFixed(2) + 's',
      onChange: (v) => {
        p.release = v;
      },
    });

    const filt = panel.querySelector<HTMLElement>('[data-group="filter"]')!;
    this._mk(filt, {
      label: 'CUTOFF',
      min: 40,
      max: 16000,
      value: p.cutoff,
      default: 2200,
      log: true,
      formatter: (v) => Math.round(v) + 'Hz',
      onChange: (v) => {
        p.cutoff = v;
        this._liveUpdate();
      },
    });
    this._mk(filt, {
      label: 'RESO/Q',
      min: 0.05,
      max: 24,
      value: p.resonance,
      default: 1,
      log: true,
      formatter: (v) => v.toFixed(2),
      onChange: (v) => {
        p.resonance = v;
        this._liveUpdate();
      },
    });
    this._mk(filt, {
      label: 'ENV DEPTH',
      min: -6000,
      max: 6000,
      value: p.envDepth,
      default: 0,
      step: 10,
      formatter: (v) => Math.round(v) + 'Hz',
      onChange: (v) => {
        p.envDepth = v;
        this._liveUpdate();
      },
    });

    const filt2 = panel.querySelector<HTMLElement>('[data-group="filter2"]')!;
    this._mk(filt2, {
      label: 'CUTOFF',
      min: 40,
      max: 16000,
      value: p.filter2Cutoff,
      default: 2200,
      log: true,
      formatter: (v) => Math.round(v) + 'Hz',
      onChange: (v) => {
        p.filter2Cutoff = v;
        this._liveUpdate();
      },
    });
    this._mk(filt2, {
      label: 'RESO/Q',
      min: 0.05,
      max: 24,
      value: p.filter2Resonance,
      default: 1,
      log: true,
      formatter: (v) => v.toFixed(2),
      onChange: (v) => {
        p.filter2Resonance = v;
        this._liveUpdate();
      },
    });
    this._mk(filt2, {
      label: 'ENV DEPTH',
      min: -6000,
      max: 6000,
      value: p.filter2EnvDepth,
      default: 0,
      step: 10,
      formatter: (v) => Math.round(v) + 'Hz',
      onChange: (v) => {
        p.filter2EnvDepth = v;
        this._liveUpdate();
      },
    });

    const lfoK = panel.querySelector<HTMLElement>('[data-group="lfo-knobs"]')!;
    this._lfoRateKnob = this._mk(lfoK, {
      label: 'RATE',
      min: 0.02,
      max: 20,
      value: p.lfoRateHz,
      default: 2,
      log: true,
      formatter: (v) => v.toFixed(2) + 'Hz',
      onChange: (v) => {
        p.lfoRateHz = v;
        this._liveUpdate();
      },
    });
    this._mk(lfoK, {
      label: 'DEPTH',
      min: 0,
      max: 1,
      value: p.lfoDepth,
      default: 0.3,
      step: 0.01,
      formatter: (v) => Math.round(v * 100) + '%',
      onChange: (v) => {
        p.lfoDepth = v;
        this._liveUpdate();
      },
    });

    const lfoK2 = panel.querySelector<HTMLElement>('[data-group="lfo2-knobs"]')!;
    this._lfoRateKnob2 = this._mk(lfoK2, {
      label: 'RATE',
      min: 0.02,
      max: 20,
      value: p.lfo2RateHz,
      default: 0.5,
      log: true,
      formatter: (v) => v.toFixed(2) + 'Hz',
      onChange: (v) => {
        p.lfo2RateHz = v;
        this._liveUpdate();
      },
    });
    this._mk(lfoK2, {
      label: 'DEPTH',
      min: 0,
      max: 1,
      value: p.lfo2Depth,
      default: 0,
      step: 0.01,
      formatter: (v) => Math.round(v * 100) + '%',
      onChange: (v) => {
        p.lfo2Depth = v;
        this._liveUpdate();
      },
    });

    paintRateToggle();
    paintRateToggle2();

    const lvl = panel.querySelector<HTMLElement>('[data-group="level"]')!;
    this._mk(lvl, {
      label: 'LEVEL',
      min: 0,
      max: 1,
      value: p.level,
      default: 0.7,
      step: 0.01,
      formatter: (v) => Math.round(v * 100) + '%',
      onChange: (v) => this.setLevel(v),
    });

    const sends = panel.querySelector<HTMLElement>('[data-group="sends"]')!;
    FX_KEYS.forEach((k) => {
      this._mk(sends, {
        label: FX_LABELS[k],
        min: 0,
        max: 1,
        value: p.sends[k],
        default: 0,
        step: 0.01,
        size: 40,
        formatter: (v) => Math.round(v * 100) + '%',
        onChange: (v) => this.setSend(k, v),
      });
    });

    this._paintEnabled();
  }

  private _mk(container: Element, opts: KnobOptions): Knob {
    const onChange = opts.onChange || function () {};
    const k = new Knob(
      Object.assign({}, opts, {
        onChange: (value: number) => {
          onChange(value);
          scheduleAutoSave();
        },
      }),
    );
    container.appendChild(k.el);
    return k;
  }

  private _renderOscKnobs(): void {
    const p = this.params;
    const container = this.panelEl.querySelector<HTMLElement>('[data-group="osc-knobs"]')!;
    container.innerHTML = '';
    this.panelEl.querySelector<HTMLSelectElement>('[data-p="osc"]')!.value = p.osc;
    this._mk(container, {
      label: 'PITCH',
      min: -24,
      max: 24,
      value: p.pitch,
      default: 0,
      step: 0.5,
      size: 52,
      formatter: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}st`,
      onChange: (v) => {
        p.pitch = v;
        this._liveUpdate();
      },
    });
    if (p.osc === 'pulse') {
      this._mk(container, {
        label: 'WIDTH',
        min: 0.02,
        max: 0.98,
        value: p.pulseWidth,
        default: 0.5,
        step: 0.01,
        size: 52,
        formatter: (v) => Math.round(v * 100) + '%',
        onChange: (v) => {
          p.pulseWidth = v;
        },
      });
    }
  }

  private _renderOsc2Knobs(): void {
    const p = this.params;
    const container = this.panelEl.querySelector<HTMLElement>('[data-group="osc2-knobs"]')!;
    container.innerHTML = '';
    this.panelEl.querySelector<HTMLSelectElement>('[data-p="osc2"]')!.value = p.osc2;
    this._mk(container, {
      label: 'PITCH',
      min: -24,
      max: 24,
      value: p.osc2Pitch,
      default: 0,
      step: 0.5,
      size: 52,
      formatter: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}st`,
      onChange: (v) => {
        p.osc2Pitch = v;
        this._liveUpdate();
      },
    });
    this._mk(container, {
      label: 'LEVEL',
      min: 0,
      max: 1,
      value: p.osc2Level,
      default: 0,
      step: 0.01,
      size: 52,
      formatter: (v) => Math.round(v * 100) + '%',
      onChange: (v) => {
        p.osc2Level = v;
        this._liveUpdate();
      },
    });
    if (p.osc2 === 'pulse') {
      this._mk(container, {
        label: 'WIDTH',
        min: 0.02,
        max: 0.98,
        value: p.osc2PulseWidth,
        default: 0.5,
        step: 0.01,
        size: 52,
        formatter: (v) => Math.round(v * 100) + '%',
        onChange: (v) => {
          p.osc2PulseWidth = v;
        },
      });
    }
  }
}
