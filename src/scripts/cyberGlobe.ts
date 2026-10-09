import {
  arcPoint,
  cities,
  landPoints,
  routes,
  spherePoint,
  taxonomy,
  type Vec3,
} from '../lib/cyberGlobe';

export function initCyberGlobe(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  const selection = root.querySelector<HTMLElement>('[data-selection]')!;
  const vi = root.dataset.lang === 'vi';
  if (!ctx) {
    selection.textContent = vi
      ? 'Không thể vẽ địa cầu. Bạn vẫn có thể đọc danh sách tuyến.'
      : 'Globe rendering is unavailable. You can still read the route list.';
    return () => {};
  }
  const ac = new AbortController();
  const opts = { signal: ac.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pause]')!;
  const filter = root.querySelector<HTMLSelectElement>('select')!;
  const groupFilter = root.querySelector<HTMLSelectElement>('[data-group-filter]')!;
  const priorityFilter = root.querySelector<HTMLSelectElement>('[data-priority-filter]')!;
  const detail = root.querySelector<HTMLElement>('[data-detail]')!;
  const matches = (r: (typeof routes)[number]) =>
    (filter.value === 'all' || filter.value === r.type) &&
    (groupFilter.value === 'all' || groupFilter.value === taxonomy[r.type].group) &&
    (priorityFilter.value === 'all' || priorityFilter.value === taxonomy[r.type].priority);
  const routeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-route]')];
  let paused = motion.matches;
  let visible = false;
  let yaw = (-105 * Math.PI) / 180;
  let pitch = 0.16;
  let zoom = 1;
  let width = 0;
  let height = 0;
  let phase = 0;
  let selected = -1;
  let frame = 0;
  let lastTime = 0;
  let pointer: { id: number; x: number; y: number } | undefined;
  const css = getComputedStyle(root.querySelector('.cyber__console')!);
  const colors = {
    land: css.getPropertyValue('--accent').trim(),
    grid: css.getPropertyValue('--rule-ui').trim(),
    sea: css.getPropertyValue('--bg').trim(),
    ddos: css.getPropertyValue('--threat').trim(),
    malware: css.getPropertyValue('--accent').trim(),
    phishing: css.getPropertyValue('--text').trim(),
  };
  const cityPoints = cities.map((c) => spherePoint(c.lat, c.lon));
  const paths = routes.map((r) =>
    Array.from({ length: 65 }, (_, i) => arcPoint(cityPoints[r.from]!, cityPoints[r.to]!, i / 64)),
  );
  const grid: Vec3[][] = [];
  for (let lat = -60; lat <= 60; lat += 30)
    grid.push(Array.from({ length: 181 }, (_, i) => spherePoint(lat, i * 2 - 180)));
  for (let lon = -180; lon < 180; lon += 30)
    grid.push(Array.from({ length: 91 }, (_, i) => spherePoint(i * 2 - 90, lon)));

  function project(p: Vec3) {
    const x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
    const z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
    const y = p[1] * Math.cos(pitch) - z * Math.sin(pitch);
    const depth = p[1] * Math.sin(pitch) + z * Math.cos(pitch);
    const radius = Math.min(width, height) * 0.36 * zoom;
    return {
      x: width / 2 + x * radius,
      y: height / 2 - y * radius,
      z: depth,
      front: depth >= 0 || x * x + y * y > 1.015,
    };
  }

  function stroke(points: Vec3[], color: string, alpha: number, lineWidth: number) {
    if (!ctx) return;
    ctx.beginPath();
    let connected = false;
    for (const point of points) {
      const p = project(point);
      if (!p.front) {
        connected = false;
        continue;
      }
      if (connected) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
      connected = true;
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function draw() {
    if (!ctx || !width) return;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    const radius = Math.min(width, height) * 0.36 * zoom;
    const glow = ctx.createRadialGradient(
      width / 2,
      height / 2,
      radius * 0.95,
      width / 2,
      height / 2,
      radius * 1.15,
    );
    glow.addColorStop(0, colors.land);
    glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors.sea;
    ctx.fill();
    ctx.strokeStyle = colors.land;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    for (const points of grid) stroke(points, colors.grid, 0.26, 0.7);
    ctx.fillStyle = colors.land;
    for (const point of landPoints) {
      const p = project(point);
      if (p.z < 0) continue;
      ctx.globalAlpha = 0.25 + p.z * 0.45;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.85, radius / 145), 0, Math.PI * 2);
      ctx.fill();
    }
    routes.forEach((r, i) => {
      if (!matches(r)) return;
      const category = taxonomy[r.type];
      const color =
        category.priority === 'critical'
          ? colors.ddos
          : category.priority === 'high'
            ? colors.malware
            : colors.phishing;
      ctx.setLineDash(category.group === 'incident' ? [4, 5] : []);
      stroke(
        paths[i]!,
        color,
        selected === i ? 1 : selected < 0 ? 0.55 : 0.2,
        selected === i ? 2.2 : 1.15,
      );
      ctx.setLineDash([]);
      const t = (phase * 0.2 + i * 0.137) % 1;
      const p = project(arcPoint(cityPoints[r.from]!, cityPoints[r.to]!, t));
      if (p.front) {
        ctx.globalAlpha = selected < 0 || selected === i ? 1 : 0.3;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      for (const cityId of [r.from, r.to]) {
        const city = project(cityPoints[cityId]!);
        if (city.z < 0) continue;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(city.x, city.y, selected === i ? 4 : 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (selected === i) {
          ctx.font = '12px sans-serif';
          ctx.fillStyle = colors.phishing;
          ctx.fillText(cities[cityId]!.name, city.x + 9, city.y - 8);
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  function animate(time: number) {
    frame = 0;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    phase += delta;
    if (!pointer && selected < 0) yaw += delta * 0.035;
    draw();
    if (visible && !paused && !document.hidden) frame = requestAnimationFrame(animate);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    draw();
    if (visible && !paused && !document.hidden) frame = requestAnimationFrame(animate);
  }
  function syncPause() {
    pauseButton.textContent = paused
      ? pauseButton.dataset.resumeLabel!
      : pauseButton.dataset.pauseLabel!;
    pauseButton.setAttribute('aria-pressed', String(paused));
    schedule();
  }
  function changeView(control: string) {
    if (control === 'left') yaw -= 0.2;
    if (control === 'right') yaw += 0.2;
    if (control === 'up') pitch += 0.15;
    if (control === 'down') pitch -= 0.15;
    if (control === 'in') zoom += 0.12;
    if (control === 'out') zoom -= 0.12;
    if (control === 'reset') {
      yaw = (-105 * Math.PI) / 180;
      pitch = 0.16;
      zoom = 1;
      selected = -1;
      detail.hidden = true;
      routeButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      selection.textContent = vi
        ? 'Chọn tuyến để xem điểm đến.'
        : 'Select a route to focus its destination.';
    }
    pitch = Math.max(-1.1, Math.min(1.1, pitch));
    zoom = Math.max(0.7, Math.min(1.3, zoom));
    draw();
  }

  root
    .querySelectorAll<HTMLButtonElement>('[data-control]')
    .forEach((b) => b.addEventListener('click', () => changeView(b.dataset.control!), opts));
  pauseButton.addEventListener(
    'click',
    () => {
      paused = !paused;
      syncPause();
    },
    opts,
  );
  motion.addEventListener(
    'change',
    () => {
      paused = motion.matches;
      syncPause();
    },
    opts,
  );
  function updateFilters() {
    selected = -1;
    detail.hidden = true;
    let count = 0;
    root.querySelectorAll<HTMLElement>('[data-route-item]').forEach((item) => {
      const index = Number(item.querySelector<HTMLElement>('[data-route]')!.dataset.route);
      item.hidden = !matches(routes[index]!);
      if (!item.hidden) count++;
    });
    routeButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    root.querySelector('[data-count]')!.textContent = String(count);
    root.querySelector<HTMLElement>('[data-empty]')!.hidden = count > 0;
    selection.textContent = vi
      ? 'Chọn tuyến để xem điểm đến.'
      : 'Select a route to focus its destination.';
    draw();
  }
  for (const select of [filter, groupFilter, priorityFilter])
    select.addEventListener('change', updateFilters, opts);
  routeButtons.forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        selected = Number(b.dataset.route);
        const r = routes[selected]!;
        const destination = cities[r.to]!;
        yaw = (-destination.lon * Math.PI) / 180;
        pitch = (destination.lat * Math.PI) / 180;
        routeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button === b)));
        const category = taxonomy[r.type];
        selection.textContent = `${cities[r.from]!.name} → ${destination.name} · ${vi ? 'Tuyến phạm vi' : 'Coverage path'}`;
        root.querySelector('[data-detail-title]')!.textContent = category[vi ? 'vi' : 'en'];
        root.querySelector('[data-detail-description]')!.textContent =
          category[vi ? 'viDetail' : 'enDetail'];
        root.querySelector('[data-detail-action]')!.textContent =
          category[vi ? 'viAction' : 'enAction'];
        detail.hidden = false;
        draw();
      },
      opts,
    ),
  );
  canvas.addEventListener(
    'keydown',
    (e) => {
      const controls: Record<string, string> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
        '+': 'in',
        '=': 'in',
        '-': 'out',
        Home: 'reset',
      };
      if (controls[e.key]) {
        e.preventDefault();
        changeView(controls[e.key]!);
      }
    },
    opts,
  );
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || pointer) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    },
    opts,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      yaw += (e.clientX - pointer.x) * 0.006;
      pitch = Math.max(-1.1, Math.min(1.1, pitch + (e.clientY - pointer.y) * 0.006));
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      draw();
    },
    opts,
  );
  const release = () => {
    pointer = undefined;
  };
  canvas.addEventListener('pointerup', release, opts);
  canvas.addEventListener('pointercancel', release, opts);
  canvas.addEventListener('lostpointercapture', release, opts);
  document.addEventListener('visibilitychange', schedule, opts);
  const resize = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  });
  resize.observe(canvas);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0]!.isIntersecting;
    schedule();
  });
  observer.observe(canvas);
  syncPause();
  return () => {
    ac.abort();
    resize.disconnect();
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
