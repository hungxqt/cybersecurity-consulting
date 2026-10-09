import { NEXUS } from '../../lib/palette';
export function correlation(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const context = canvas.getContext('2d');
  const labels = [
    'HASH: DEMO-7F2C',
    'DOMAIN: IOC.INVALID',
    'IP: 203.0.113.14',
    'USER: SYNTHETIC-01',
  ];
  let active = false,
    contained = false;
  const render = () => {
    if (!context) return;
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const height = 190,
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.strokeStyle = contained ? '#86efac' : NEXUS['c-flare-400'];
    context.fillStyle = '#ecf3f5';
    context.font = '12px monospace';
    context.textAlign = 'center';
    context.fillText(active ? 'INCIDENT MX-01' : 'AWAITING CORRELATION', width / 2, 99);
    if (active)
      labels.forEach((label, i) => {
        const right = i % 2 === 1;
        const x = right ? width - 8 : 8,
          y = i < 2 ? 24 : 174;
        context.beginPath();
        context.moveTo(width / 2, i < 2 ? 80 : 112);
        context.lineTo(width * (right ? 0.75 : 0.25), i < 2 ? 36 : 154);
        context.stroke();
        context.textAlign = right ? 'right' : 'left';
        context.fillText(label, x, y);
      });
  };
  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  return {
    draw(nextActive: boolean, nextContained: boolean) {
      active = nextActive;
      contained = nextContained;
      render();
    },
  };
}
