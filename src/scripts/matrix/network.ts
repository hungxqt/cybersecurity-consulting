import type { createTopology, MatrixNode } from '../../lib/matrix/topology';
type Graph = ReturnType<typeof createTopology>;
export function network(
  canvas: HTMLCanvasElement,
  graph: Graph,
  signal: AbortSignal,
  reduced: () => boolean,
  inspect: (node: MatrixNode, pinned: boolean) => void,
) {
  const ctx = canvas.getContext('2d');
  let width = 1,
    height = 1,
    dpr = 1,
    clock = 0,
    visible = 0,
    selected = '',
    pointerX = 0,
    pointerY = 0,
    quality = 2,
    average = 16,
    scan = 0,
    extraScan = false,
    calm = 0;
  const colors = getComputedStyle(document.documentElement);
  const cyan = colors.getPropertyValue('--c-cyan-300').trim() || '#44d9e6';
  const flare = colors.getPropertyValue('--c-flare-400').trim() || '#ff6b4a';
  const green = '#86efac';
  const sprites = [cyan, flare, green].map((color) => {
    const image = document.createElement('canvas');
    image.width = image.height = 40;
    const c = image.getContext('2d');
    if (c) {
      const gradient = c.createRadialGradient(20, 20, 0, 20, 20, 20);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      c.fillStyle = gradient;
      c.fillRect(0, 0, 40, 40);
    }
    return image;
  });
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, quality ? 2 : 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  const position = (node: MatrixNode) => ({
    x:
      node.x * width +
      (reduced() ? 0 : pointerX * (node.depth + 1) * 4 + Math.sin(clock / 8000) * 2),
    y: node.y * height + (reduced() ? 0 : pointerY * (node.depth + 1) * 4),
  });
  const hit = (event: PointerEvent, pinned: boolean) => {
    const r = canvas.getBoundingClientRect();
    const x = event.clientX - r.left,
      y = event.clientY - r.top;
    pointerX = x / width - 0.5;
    pointerY = y / height - 0.5;
    const node = graph.nodes.slice(0, visible).find((n) => {
      const p = position(n);
      return Math.hypot(p.x - x, p.y - y) < 22;
    });
    if (node) inspect(node, pinned);
  };
  canvas.addEventListener('pointermove', (e) => hit(e, false), { signal });
  canvas.addEventListener('pointerdown', (e) => hit(e, true), { signal });
  return {
    supported: !!ctx,
    select(id: string) {
      selected = id;
    },
    scan() {
      scan = 0;
      extraScan = true;
    },
    draw(dt: number, elapsed: number, cost: number) {
      average = average * 0.98 + cost * 0.02;
      if (average > 22 && quality) {
        quality--;
        average = 16;
        resize();
      }
      if (dpr !== Math.min(window.devicePixelRatio || 1, quality ? 2 : 1)) resize();
      clock += dt;
      scan += dt;
      calm += dt;
      const next = Math.min(
        graph.nodes.length,
        Math.max(0, Math.floor((elapsed - 7000) / 240) + 1),
      );
      const changed = next !== visible;
      visible = next;
      if (!ctx || (reduced() && calm < 1500 && !changed)) return visible;
      calm = 0;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (const [a, b] of graph.links) {
        if (a >= visible || b >= visible) continue;
        const from = position(graph.nodes[a]!),
          to = position(graph.nodes[b]!);
        const danger =
          graph.attackPath.includes(a) &&
          graph.attackPath.includes(b) &&
          graph.nodes[a]!.status !== 'nominal';
        ctx.strokeStyle = danger ? (graph.nodes[a]!.status === 'contained' ? green : flare) : cyan;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const t = reduced() ? 0.5 : (clock / 2000 + b * 0.13) % 1;
        const cap = quality ? 40 : 12;
        if (b < cap) {
          ctx.fillStyle = ctx.strokeStyle;
          for (let trail = 0; trail < (reduced() || !quality ? 1 : 4); trail++) {
            const v = (t - trail * 0.012 + 1) % 1;
            ctx.globalAlpha = 1 - trail / 4;
            ctx.fillRect(
              from.x + (to.x - from.x) * v,
              from.y + (to.y - from.y) * v,
              reduced() ? 6 : 3,
              2,
            );
          }
          ctx.globalAlpha = 1;
        }
      }
      if (!reduced() && visible && (elapsed < 20000 || (extraScan && scan < 4000))) {
        ctx.strokeStyle = cyan;
        ctx.globalAlpha = Math.max(0, 0.3 - (scan % 4000) / 14000);
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, ((scan % 4000) / 4000) * width, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      graph.nodes.slice(0, visible).forEach((n) => {
        const p = position(n);
        const color = n.status === 'contained' ? 2 : n.status === 'nominal' ? 0 : 1;
        ctx.drawImage(sprites[color]!, p.x - 15, p.y - 15, 30, 30);
        ctx.fillStyle = [cyan, flare, green][color]!;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        if (selected === n.id) {
          ctx.strokeStyle = '#ecf3f5';
          ctx.strokeRect(p.x - 9, p.y - 9, 18, 18);
        }
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.id, p.x, p.y - 13);
      });
      canvas.dataset.nodeCoordinates = JSON.stringify(
        graph.nodes.slice(0, visible).map((n) => ({ id: n.id, ...position(n) })),
      );
      return visible;
    },
  };
}
