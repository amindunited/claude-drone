import { clamp } from './utils/dsp';
import { Engine } from './audio/engine';
import { Recorder } from './audio/recorder';
import { AppState } from './state';
import { scheduleAutoSave } from './persistence';
import { globalNoteOff, globalNoteOn } from './voices';

let octaveBase = 48; // MIDI note for "C" of octave label
const activeNoteCounts = new Map<number, number>();
const sustainedNotes = new Set<number>();
let sustainEnabled = false;

export function setOctaveBase(value: number): void {
  octaveBase = value;
}

function noteVisualElement(note: number): Element | null {
  return document.querySelector(`.wkey[data-note="${note}"],.bkey[data-note="${note}"]`);
}

function setNoteVisualActive(note: number, active: boolean): void {
  const el = noteVisualElement(note);
  if (el) el.classList.toggle('active', active);
}

export function paintSustainButton(): void {
  const btn = document.getElementById('sustainToggle');
  if (!btn) return;
  btn.classList.toggle('active', sustainEnabled);
  btn.setAttribute('aria-pressed', String(sustainEnabled));
  btn.textContent = sustainEnabled ? 'Sustain On' : 'Sustain Off';
}

function flushSustainedNotes(): void {
  sustainedNotes.forEach((note) => {
    if ((activeNoteCounts.get(note) || 0) > 0) return;
    globalNoteOff(note);
    setNoteVisualActive(note, false);
    sustainedNotes.delete(note);
  });
}

export function setSustainEnabled(enabled: boolean): void {
  sustainEnabled = !!enabled;
  paintSustainButton();
  if (!sustainEnabled) flushSustainedNotes();
}

export function toggleSustain(): void {
  setSustainEnabled(!sustainEnabled);
}

export function triggerGlobalNoteOn(note: number, velocity: number): void {
  const count = (activeNoteCounts.get(note) || 0) + 1;
  activeNoteCounts.set(note, count);
  sustainedNotes.delete(note);
  globalNoteOn(note, velocity);
  setNoteVisualActive(note, true);
}

export function triggerGlobalNoteOff(note: number): void {
  const count = Math.max(0, (activeNoteCounts.get(note) || 0) - 1);
  if (count === 0) activeNoteCounts.delete(note);
  else activeNoteCounts.set(note, count);

  if (count > 0) {
    setNoteVisualActive(note, true);
    return;
  }
  if (sustainEnabled) {
    sustainedNotes.add(note);
    setNoteVisualActive(note, false);
    return;
  }

  sustainedNotes.delete(note);
  globalNoteOff(note);
  setNoteVisualActive(note, false);
}

export function buildKeyboard(): void {
  const kb = document.getElementById('keyboard')!;
  kb.innerHTML = '';
  const startNote = octaveBase - 12; // start one octave below label for wider playable range
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
  const whiteKeys: { el: HTMLDivElement; note: number }[] = [];
  for (let oct = 0; oct < 2; oct++) {
    whiteOffsets.forEach((off) => {
      const note = startNote + oct * 12 + off;
      const key = document.createElement('div');
      key.className = 'wkey';
      key.dataset.note = String(note);
      kb.appendChild(key);
      whiteKeys.push({ el: key, note });
    });
  }
  const whiteWidth = 100 / whiteKeys.length;
  whiteKeys.forEach((wk) => {
    wk.el.style.width = whiteWidth + '%';
  });
  // black keys positioned relative to white key index
  for (let oct = 0; oct < 2; oct++) {
    [0, 1, 3, 4, 5].forEach((wIdxInOct) => {
      const globalWhiteIndex = oct * 7 + wIdxInOct;
      const note = startNote + oct * 12 + [0, 2, 4, 5, 7, 9, 11][wIdxInOct] + 1;
      const bkey = document.createElement('div');
      bkey.className = 'bkey';
      bkey.dataset.note = String(note);
      bkey.style.left = `calc(${(globalWhiteIndex + 0.72) * whiteWidth}% )`;
      kb.appendChild(bkey);
    });
  }

  kb.querySelectorAll<HTMLElement>('.wkey,.bkey').forEach((el) => {
    const note = parseInt(el.dataset.note!, 10);
    const press = (e: Event) => {
      e.preventDefault();
      Engine.resume();
      triggerGlobalNoteOn(note, 100);
    };
    const release = (e?: Event) => {
      if (e) e.preventDefault();
      triggerGlobalNoteOff(note);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
  });
  document.getElementById('octLabel')!.textContent = 'OCT ' + (octaveBase / 12 - 1);
}

/* computer-keyboard playing */
const KEY_MAP: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
};
const heldKeys = new Set<string>();

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return !!target.closest('input, select, textarea, button, [contenteditable="true"]');
}

function shiftOctave(delta: number): void {
  octaveBase = clamp(octaveBase + delta, 12, 96);
  AppState.global.octaveBase = octaveBase;
  buildKeyboard();
  scheduleAutoSave();
}

export function initKeyboardControls(): void {
  document.getElementById('octUp')!.addEventListener('click', () => shiftOctave(12));
  document.getElementById('octDown')!.addEventListener('click', () => shiftOctave(-12));
  window.addEventListener('resize', buildKeyboard);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' && Recorder.enabled && !isTypingTarget(e.target)) {
      e.preventDefault();
      Engine.resume();
      Recorder.toggle();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'z') {
      shiftOctave(-12);
      return;
    }
    if (k === 'x') {
      shiftOctave(12);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(KEY_MAP, k) && !heldKeys.has(k)) {
      heldKeys.add(k);
      Engine.resume();
      const note = octaveBase + KEY_MAP[k];
      triggerGlobalNoteOn(note, 100);
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (heldKeys.has(k)) {
      heldKeys.delete(k);
      const note = octaveBase + KEY_MAP[k];
      triggerGlobalNoteOff(note);
    }
  });
}
