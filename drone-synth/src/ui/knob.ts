import { arcPath, clamp, lerp } from '../utils/dsp';

export interface KnobOptions {
  min: number;
  max: number;
  step?: number;
  value?: number;
  default?: number;
  log?: boolean;
  label?: string;
  unit?: string;
  formatter?: (value: number) => string;
  parser?: (text: string, current: number) => number | null;
  onChange?: (value: number) => void;
  size?: number;
}

export class Knob {
  min: number;
  max: number;
  step: number;
  value: number;
  default: number;
  log: boolean;
  label: string;
  unit: string;
  formatter: ((value: number) => string) | null;
  parser: ((text: string, current: number) => number | null) | null;
  onChange: (value: number) => void;
  size: number;
  editing: boolean;

  el!: HTMLDivElement;
  arcEl!: SVGPathElement;
  ptrEl!: SVGGElement;
  valEl!: HTMLDivElement;
  inputEl!: HTMLInputElement;

  private _cx!: number;
  private _cy!: number;
  private _r!: number;

  constructor(opts: KnobOptions) {
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step || 0.001;
    this.value = opts.value !== undefined ? opts.value : opts.min;
    this.default = opts.default !== undefined ? opts.default : this.value;
    this.log = !!opts.log;
    this.label = opts.label || '';
    this.unit = opts.unit || '';
    this.formatter = opts.formatter || null;
    this.parser = opts.parser || null;
    this.onChange = opts.onChange || function () {};
    this.size = opts.size || 46;
    this.editing = false;
    this._build();
    this._render();
  }

  private _toFrac(v: number): number {
    if (this.log) {
      const lo = Math.log(Math.max(this.min, 1e-6)),
        hi = Math.log(this.max);
      return clamp((Math.log(Math.max(v, 1e-6)) - lo) / (hi - lo), 0, 1);
    }
    return clamp((v - this.min) / (this.max - this.min), 0, 1);
  }

  private _fromFrac(f: number): number {
    f = clamp(f, 0, 1);
    let v: number;
    if (this.log) {
      const lo = Math.log(Math.max(this.min, 1e-6)),
        hi = Math.log(this.max);
      v = Math.exp(lerp(lo, hi, f));
    } else {
      v = lerp(this.min, this.max, f);
    }
    const s = this.step;
    return Math.round(v / s) * s;
  }

  private _build(): void {
    const s = this.size,
      cx = s / 2,
      cy = s / 2,
      r = s / 2 - 5;
    const wrap = document.createElement('div');
    wrap.className = 'knob-wrap';
    wrap.innerHTML = `
      <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
        <path d="${arcPath(cx, cy, r, -135, 135)}" fill="none" stroke="#3a332a" stroke-width="3.5" stroke-linecap="round"/>
        <path class="k-arc" d="" fill="none" stroke="#e2a03f" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="#181510" stroke="#3c342a" stroke-width="1"/>
        <g class="k-ptr"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - (r - 9)}" stroke="#f4c374" stroke-width="2" stroke-linecap="round"/></g>
      </svg>
      <div class="k-label">${this.label}</div>
      <div class="k-val" tabindex="0" title="Click to type a value"></div>
      <input class="k-val-input" type="text" inputmode="decimal" aria-label="Edit ${this.label || 'knob'} value" style="display:none;" />
    `;
    this.el = wrap;
    this.arcEl = wrap.querySelector('.k-arc')!;
    this.ptrEl = wrap.querySelector('.k-ptr')!;
    this.valEl = wrap.querySelector('.k-val')!;
    this.inputEl = wrap.querySelector('.k-val-input')!;
    this._cx = cx;
    this._cy = cy;
    this._r = r;

    let dragging = false,
      startY = 0,
      startFrac = 0;
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const y = e.clientY;
      const dy = startY - y;
      const f = clamp(startFrac + dy / 140, 0, 1);
      this.value = this._fromFrac(f);
      this._render();
      this.onChange(this.value);
      e.preventDefault();
    };
    const onUp = () => {
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    wrap.querySelector('svg')!.addEventListener('pointerdown', (e) => {
      dragging = true;
      startY = e.clientY;
      startFrac = this._toFrac(this.value);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });
    wrap.querySelector('svg')!.addEventListener('dblclick', () => {
      this.value = this.default;
      this._render();
      this.onChange(this.value);
    });
    wrap.querySelector('svg')!.addEventListener(
      'wheel',
      (e) => {
        const f = this._toFrac(this.value) + (e.deltaY < 0 ? 1 : -1) * 0.02;
        this.value = this._fromFrac(f);
        this._render();
        this.onChange(this.value);
        e.preventDefault();
      },
      { passive: false },
    );

    const beginEdit = () => {
      if (this.editing) return;
      this.editing = true;
      this.inputEl.value = this.valEl.textContent || String(this.value);
      this.valEl.style.display = 'none';
      this.inputEl.style.display = 'block';
      this.inputEl.focus();
      this.inputEl.select();
    };
    const finishEdit = (apply: boolean) => {
      if (!this.editing) return;
      if (apply) {
        const next = this._parseTypedValue(this.inputEl.value);
        if (next !== null) {
          this.value = clamp(next, this.min, this.max);
          this.onChange(this.value);
        }
      }
      this.editing = false;
      this.inputEl.style.display = 'none';
      this.valEl.style.display = 'block';
      this._render();
      this.valEl.focus();
    };

    this.valEl.addEventListener('click', beginEdit);
    this.valEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        beginEdit();
      }
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      }
    });
    this.inputEl.addEventListener('blur', () => finishEdit(true));
  }

  private _parseTypedValue(text: string): number | null {
    if (this.parser) {
      const parsed = this.parser(text, this.value);
      if (Number.isFinite(parsed)) return parsed;
    }
    const t = (text || '').trim();
    if (!t) return null;
    const match = t.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    if (!match) return null;
    let num = Number(match[0]);
    if (!Number.isFinite(num)) return null;
    if (t.includes('%')) num /= 100;
    return num;
  }

  private _render(): void {
    const f = this._toFrac(this.value);
    const ang = -135 + 270 * f;
    this.arcEl.setAttribute('d', f > 0.001 ? arcPath(this._cx, this._cy, this._r, -135, ang) : '');
    this.ptrEl.setAttribute('transform', `rotate(${ang} ${this._cx} ${this._cy})`);
    const displayText = this.formatter
      ? this.formatter(this.value)
      : (Math.abs(this.value) < 10 ? this.value.toFixed(2) : Math.round(this.value)) + this.unit;
    this.valEl.textContent = displayText;
    if (!this.editing) this.inputEl.value = displayText;
  }

  set(v: number, silent?: boolean): void {
    this.value = clamp(v, this.min, this.max);
    this._render();
    if (!silent) this.onChange(this.value);
  }

  setEnabled(en: boolean): void {
    this.el.classList.toggle('disabled', !en);
  }
}
