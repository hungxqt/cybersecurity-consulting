export function createLoop(tick: (dt: number, cost: number) => void) {
  let frame = 0,
    last = 0,
    stopped = true;
  const run = (time: number) => {
    frame = 0;
    if (stopped || document.hidden) return;
    const raw = last ? time - last : 16;
    last = time;
    tick(Math.min(100, raw), raw);
    if (!stopped) frame = requestAnimationFrame(run);
  };
  return {
    start() {
      if (!stopped) return;
      stopped = false;
      last = 0;
      frame = requestAnimationFrame(run);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    },
  };
}
