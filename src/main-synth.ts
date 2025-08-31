import { DroneSynth } from './ts-synth.js';

// Initialize the synth when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const synth = new DroneSynth();
    await synth.initialize();
    
    // Export for global access if needed
    (window as any).synth = synth;
});
