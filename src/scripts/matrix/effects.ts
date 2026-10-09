export function effects(root: HTMLElement, reduced: () => boolean) {
  let remaining = 0;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    for (let i = 0; i < 128; i++) {
      context.fillStyle = `rgba(255,255,255,${(i % 4) / 50})`;
      context.fillRect((i * 17) % 32, (i * 7) % 32, 1, 1);
    }
    root.style.setProperty('--mx-noise', `url(${canvas.toDataURL()})`);
  }
  return {
    glitch() {
      if (!reduced()) {
        remaining = 180;
        root.classList.add('mx-glitch');
      }
    },
    tick(dt: number) {
      remaining -= dt;
      if (remaining <= 0 || reduced()) root.classList.remove('mx-glitch');
    },
  };
}
