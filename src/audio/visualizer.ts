export function createVisualizer(canvasId: string): {
  canvas: HTMLCanvasElement;
  canvasCtx: CanvasRenderingContext2D;
  analyser: AnalyserNode | null;
} {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const canvasCtx = canvas.getContext('2d')!;
  
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  });
  
  return { canvas, canvasCtx, analyser: null };
}

export function createAnalyser(audioContext: AudioContext): AnalyserNode {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  return analyser;
}

export function startVisualization(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  canvasCtx: CanvasRenderingContext2D,
  isPlaying: () => boolean
): void {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  const draw = () => {
    if (!isPlaying()) return;
    
    requestAnimationFrame(draw);
    
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.fillStyle = 'rgba(10, 10, 10, 0.1)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;
      
      const hue = (i / bufferLength) * 360;
      canvasCtx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  };
  
  draw();
}

export function stopVisualization(
  canvas: HTMLCanvasElement,
  canvasCtx: CanvasRenderingContext2D
): void {
  canvasCtx.fillStyle = 'rgba(10, 10, 10, 1)';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}
