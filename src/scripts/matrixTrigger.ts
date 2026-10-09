import { createKonami, createTapCounter } from '../lib/matrix/sequence';
const w = window as unknown as { __htMatrix?: boolean };
if (!w.__htMatrix) {
  w.__htMatrix = true;
  const sequence = createKonami(),
    taps = createTapCounter();
  let pending: AbortController | undefined;
  // Hidden entry points: Konami code or five logo clicks within three seconds.
  const activate = async (trigger: HTMLElement | null) => {
    if (pending || document.querySelector('.mx')) return;
    const controller = (pending = new AbortController());
    try {
      const matrix = await import('./matrix/index');
      if (!controller.signal.aborted) await matrix.open(trigger, controller.signal);
    } catch {
      /* Failed assets leave the normal page usable. */
    } finally {
      if (pending === controller) pending = undefined;
    }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') pending?.abort();
    if (
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      (e.target instanceof Element &&
        e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))
    ) {
      sequence.reset();
      return;
    }
    if (sequence.push(e.key, e.code)) void activate(document.activeElement as HTMLElement);
  });
  document.addEventListener(
    'click',
    (e) => {
      const logo = e.target instanceof Element ? e.target.closest<HTMLElement>('.logo') : null;
      if (!logo || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.button) return;
      const result = taps.push();
      if (result.prevent) e.preventDefault();
      if (result.activate) void activate(logo);
    },
    true,
  );
  document.addEventListener('astro:before-swap', () => {
    pending?.abort();
    sequence.reset();
  });
}
