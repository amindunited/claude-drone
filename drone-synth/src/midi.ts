import { Engine } from './audio/engine';
import { triggerGlobalNoteOff, triggerGlobalNoteOn } from './keyboard';

export function setupMidi(): void {
  const dot = document.getElementById('midiDot')!;
  const text = document.getElementById('midiText')!;
  const sel = document.getElementById('midiSelect') as HTMLSelectElement;
  if (!navigator.requestMIDIAccess) {
    text.textContent = 'MIDI: unsupported in this browser';
    return;
  }
  navigator
    .requestMIDIAccess()
    .then((access) => {
      const inputs = [...access.inputs.values()];
      if (inputs.length === 0) {
        text.textContent = 'MIDI: no devices found';
        return;
      }
      dot.classList.add('on');
      text.textContent = `MIDI: ${inputs.length} device${inputs.length > 1 ? 's' : ''}`;
      inputs.forEach((inp) => {
        const opt = document.createElement('option');
        opt.value = inp.id;
        opt.textContent = inp.name;
        sel.appendChild(opt);
      });
      function handle(msg: MIDIMessageEvent) {
        const data = msg.data;
        if (!data) return;
        const [status, d1, d2] = data;
        const cmd = status & 0xf0;
        Engine.resume();
        if (cmd === 0x90 && d2 > 0) triggerGlobalNoteOn(d1, d2);
        else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) triggerGlobalNoteOff(d1);
      }
      function bindAll() {
        inputs.forEach((i) => {
          i.onmidimessage = sel.value === 'all' || sel.value === i.id ? handle : null;
        });
      }
      sel.addEventListener('change', bindAll);
      bindAll();
      access.onstatechange = () => {
        /* device hot-plug: minimal handling */
      };
    })
    .catch(() => {
      text.textContent = 'MIDI: unavailable (blocked in this context)';
    });
}
