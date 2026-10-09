import type { CopyKey, labCopy } from '../lib/labs';
import {
  attackOutcome,
  architectureFindings,
  COMPONENTS,
  packetStop,
  trafficBuckets,
  type ComponentId,
  type Defense,
  type RequestType,
  type TrafficPattern,
} from '../lib/labModels';

type Copy = ReturnType<typeof labCopy>;
type State =
  | 'active'
  | 'exposed'
  | 'blocked'
  | 'waiting'
  | 'safe'
  | 'restored'
  | 'contained'
  | 'connected'
  | 'absent';
interface Node {
  key: CopyKey;
  state: State;
}
interface Edge {
  from: number;
  to: number;
  state: State;
}
const namespace = 'http://www.w3.org/2000/svg';
function svgElement(tag: string, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(namespace, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
function svgText(value: string, x: number, y: number, className?: string) {
  const text = svgElement('text', { x, y, ...(className ? { class: className } : {}) });
  text.textContent = value;
  return text;
}
function paragraphs(root: HTMLElement, copy: string[]) {
  root.querySelector('[data-result]')!.replaceChildren(
    ...copy.map((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    }),
  );
}
const graphStates = new WeakMap<HTMLElement, { c: Copy; nodes: Node[]; edges: Edge[] }>();
function graph(root: HTMLElement, c: Copy, nodes: Node[], edges: Edge[]) {
  graphStates.set(root, { c, nodes, edges });
  const compact = window.matchMedia('(max-width: 719px)').matches;
  const nodeWidth = compact ? 280 : 200;
  const svg = svgElement('svg', {
    viewBox: compact ? `0 0 360 ${nodes.length * 125 + 20}` : '0 0 800 340',
    focusable: 'false',
  });
  const positions = nodes.map((_, i) => ({
    x: compact ? 40 : 35 + (i < 3 ? i : 5 - i) * 265,
    y: compact ? 25 + i * 125 : i < 3 ? 45 : 210,
  }));
  const defs = svgElement('defs');
  const markerId = `arrow-${root.dataset.lab}`;
  const marker = svgElement('marker', {
    id: markerId,
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: 'auto-start-reverse',
  });
  marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }));
  defs.append(marker);
  svg.append(defs);
  if (root.dataset.lab === 'architecture-builder') {
    nodes.forEach((node, i) => {
      const databaseBoundary =
        node.key === 'database' && input(root, '[data-boundary="privateData"]').checked;
      const identityBoundary =
        (node.key === 'cloud' || node.key === 'app') &&
        input(root, '[data-boundary="identityGate"]').checked &&
        input(root, '[data-component="identity"]').checked;
      if (node.state === 'absent' || !(databaseBoundary || identityBoundary)) return;
      const { x, y } = positions[i]!;
      svg.append(
        svgElement('rect', {
          x: x - 10,
          y: y - 12,
          width: nodeWidth + 20,
          height: 104,
          class: 'graph-boundary',
        }),
      );
      svg.append(
        svgText(databaseBoundary ? c.boundaries : c.identity, x + 4, y - 17, 'graph-state'),
      );
    });
  }
  for (const edge of edges) {
    const from = positions[edge.from]!,
      to = positions[edge.to]!;
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const trim = dy === 0 ? 105 : dx === 0 ? 48 : 76;
    svg.append(
      svgElement('line', {
        x1: from.x + nodeWidth / 2 + (dx / length) * trim,
        y1: from.y + 40 + (dy / length) * trim,
        x2: to.x + nodeWidth / 2 - (dx / length) * trim,
        y2: to.y + 40 - (dy / length) * trim,
        class: `graph-edge ${edge.state}`,
        'marker-end': `url(#${markerId})`,
      }),
    );
  }
  nodes.forEach((node, i) => {
    const { x, y } = positions[i]!;
    svg.append(
      svgElement('rect', { x, y, width: nodeWidth, height: 80, class: `graph-node ${node.state}` }),
    );
    svg.append(svgText(`${String(i + 1).padStart(2, '0')} / ${c[node.key]}`, x + 12, y + 32));
    svg.append(svgText(c[node.state], x + 12, y + 58, 'graph-state'));
  });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', c.view);
  const description = svgElement('desc');
  description.textContent = [
    ...nodes.map((node) => `${c[node.key]}: ${c[node.state]}`),
    ...edges.map(
      (edge) => `${c[nodes[edge.from]!.key]} → ${c[nodes[edge.to]!.key]}: ${c[edge.state]}`,
    ),
  ].join('. ');
  svg.setAttribute('aria-describedby', `graph-description-${root.dataset.lab}`);
  description.setAttribute('id', `graph-description-${root.dataset.lab}`);
  svg.prepend(description);
  root.querySelector('[data-graph]')!.replaceChildren(svg);
}
const input = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLInputElement>(selector)!;
const select = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLSelectElement>(selector)!;
const button = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLButtonElement>(selector)!;
function initAttack(root: HTMLElement, c: Copy, signal: AbortSignal) {
  const route = select(root, '[data-route]');
  const boxes = [...root.querySelectorAll<HTMLInputElement>('[data-defense]')];
  const update = () => {
    const defenses = new Set(
      boxes.filter((b) => b.checked).map((b) => b.dataset.defense as Defense),
    );
    const malware = route.value === 'malware';
    const outcome = attackOutcome(malware ? 'malware' : 'credential', defenses);
    const nodes: Node[] = [
      { key: 'internet', state: 'active' },
      {
        key: malware ? 'endpoint' : 'identity',
        state: outcome.entryBlocked ? 'blocked' : 'exposed',
      },
      { key: 'app', state: outcome.entryBlocked ? 'waiting' : 'exposed' },
      {
        key: 'database',
        state: outcome.entryBlocked ? 'waiting' : outcome.dataBlocked ? 'blocked' : 'exposed',
      },
      { key: 'backup', state: outcome.backupSafe ? 'safe' : 'exposed' },
    ];
    graph(root, c, nodes, [
      { from: 0, to: 1, state: outcome.entryBlocked ? 'blocked' : 'exposed' },
      { from: 1, to: 2, state: outcome.entryBlocked ? 'waiting' : 'exposed' },
      { from: 2, to: 3, state: outcome.dataBlocked ? 'blocked' : 'exposed' },
      { from: 3, to: 4, state: outcome.backupSafe ? 'blocked' : 'exposed' },
    ]);
    const notes = [
      c[
        malware
          ? outcome.entryBlocked
            ? 'malwareStop'
            : 'malwareOpen'
          : outcome.entryBlocked
            ? 'passwordStop'
            : 'passwordOpen'
      ],
    ];
    if (!outcome.entryBlocked && defenses.has('segment')) notes.push(c.segmentStop);
    if (defenses.has('backups')) notes.push(c.backupSafe);
    else if (!outcome.backupSafe) notes.push(c.backupOpen);
    paragraphs(root, notes);
  };
  root.addEventListener('change', update, { signal });
  button(root, '[data-reset]').addEventListener(
    'click',
    () => {
      route.value = 'credential';
      boxes.forEach((b) => (b.checked = false));
      update();
    },
    { signal },
  );
  update();
}
function initSoc(root: HTMLElement, c: Copy, signal: AbortSignal) {
  let current = 0;
  const responses = new Map<number, string>();
  const alerts = [...root.querySelectorAll<HTMLButtonElement>('[data-alert]')];
  const actions = [...root.querySelectorAll<HTMLButtonElement>('[data-response]')];
  const titles = [c.suspiciousLogin, c.scriptAlert, c.transferAlert];
  const evidence = [c.loginEvidence, c.scriptEvidence, c.transferEvidence];
  const advice = [c.loginAdvice, c.scriptAdvice, c.transferAdvice];
  const correct = ['revoke', 'isolate', 'blockTransfer'];
  const update = () => {
    const response = responses.get(current);
    const contained = response === correct[current];
    alerts.forEach((b, i) => b.setAttribute('aria-pressed', String(i === current)));
    actions.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.response === response)));
    root.querySelector('[data-alert-title]')!.textContent = titles[current]!;
    root.querySelector('[data-evidence]')!.replaceChildren(
      ...evidence[current]!.split('|').map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      }),
    );
    const keys: CopyKey[] =
      current === 0
        ? ['internet', 'identity', 'app']
        : current === 1
          ? ['endpoint', 'app', 'internet']
          : ['identity', 'database', 'internet'];
    graph(
      root,
      c,
      keys.map((key, i) => ({ key, state: contained && i === 1 ? 'contained' : 'exposed' })),
      [
        { from: 0, to: 1, state: contained ? 'blocked' : 'exposed' },
        { from: 1, to: 2, state: contained ? 'blocked' : 'exposed' },
      ],
    );
    paragraphs(root, [
      advice[current]!,
      ...(response
        ? [
            response === 'monitor'
              ? c.responseMonitor
              : contained
                ? c.responseRight
                : c.responseOther,
          ]
        : []),
    ]);
  };
  alerts.forEach((b, i) =>
    b.addEventListener(
      'click',
      () => {
        current = i;
        update();
      },
      { signal },
    ),
  );
  actions.forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        responses.set(current, b.dataset.response!);
        update();
      },
      { signal },
    ),
  );
  button(root, '[data-reset]').addEventListener(
    'click',
    () => {
      current = 0;
      responses.clear();
      update();
    },
    { signal },
  );
  update();
}
function initArchitecture(root: HTMLElement, c: Copy, signal: AbortSignal) {
  const boxes = [...root.querySelectorAll<HTMLInputElement>('[data-component]')];
  const privateData = input(root, '[data-boundary="privateData"]'),
    identityGate = input(root, '[data-boundary="identityGate"]');
  const update = () => {
    const parts = new Set(
      boxes.filter((b) => b.checked).map((b) => b.dataset.component as ComponentId),
    );
    const nodes: Node[] = COMPONENTS.map((key) => ({
      key,
      state: !parts.has(key)
        ? 'absent'
        : key === 'database'
          ? privateData.checked
            ? 'safe'
            : 'exposed'
          : (key === 'cloud' || key === 'app') && !(parts.has('identity') && identityGate.checked)
            ? 'exposed'
            : 'connected',
    }));
    const edges: Edge[] = [];
    for (const [from, to] of [
      [0, 2],
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 4],
      [4, 5],
    ]) {
      if (parts.has(COMPONENTS[from!]!) && parts.has(COMPONENTS[to!]!))
        edges.push({
          from: from!,
          to: to!,
          state: nodes[to!]!.state === 'exposed' ? 'exposed' : 'connected',
        });
    }
    graph(root, c, nodes, edges);
    paragraphs(
      root,
      architectureFindings(parts, privateData.checked, identityGate.checked).map((key) => c[key]),
    );
  };
  root.addEventListener('change', update, { signal });
  button(root, '[data-reset]').addEventListener(
    'click',
    () => {
      boxes.forEach(
        (b) => (b.checked = ['endpoint', 'app', 'database'].includes(b.dataset.component!)),
      );
      privateData.checked = identityGate.checked = false;
      update();
    },
    { signal },
  );
  update();
}
function playback(
  root: HTMLElement,
  c: Copy,
  signal: AbortSignal,
  getPosition: () => number,
  setPosition: (n: number) => void,
  getEnd: () => number,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const play = button(root, '[data-play]'),
    next = button(root, '[data-next]'),
    previous = button(root, '[data-previous]');
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    play.textContent = c.play;
    root.dataset.playing = 'false';
  };
  const sync = () => {
    previous.disabled = getPosition() === 0;
    next.disabled = getPosition() >= getEnd();
    if (getPosition() >= getEnd()) stop();
  };
  previous.addEventListener(
    'click',
    () => {
      stop();
      setPosition(Math.max(0, getPosition() - 1));
    },
    { signal },
  );
  next.addEventListener(
    'click',
    () => {
      stop();
      setPosition(Math.min(getEnd(), getPosition() + 1));
    },
    { signal },
  );
  play.addEventListener(
    'click',
    () => {
      if (timer !== undefined) {
        stop();
        return;
      }
      if (getPosition() >= getEnd()) setPosition(0);
      play.textContent = c.pause;
      root.dataset.playing = 'true';
      timer = setInterval(() => setPosition(Math.min(getEnd(), getPosition() + 1)), 1600);
    },
    { signal },
  );
  // Stop timers on navigation or when the tab is hidden.
  signal.addEventListener('abort', stop, { once: true });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) stop();
    },
    { signal },
  );
  return { stop, sync };
}
function initTimeline(root: HTMLElement, c: Copy, signal: AbortSignal) {
  const slider = input(root, '[data-position]');
  let position = 0;
  const stages = c.stages.split('|'),
    notes = c.stageNotes.split('|');
  const stagesButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-stage]')];
  const update = () => {
    slider.value = String(position);
    slider.setAttribute('aria-valuetext', stages[position]!);
    root.querySelector('[data-position-label]')!.textContent =
      `${c.step} ${position + 1} ${c.of} 5 · ${stages[position]}`;
    root.querySelector('[data-stage-title]')!.textContent = stages[position]!;
    stagesButtons.forEach((b, i) => {
      if (i === position) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    const states: State[] =
      position < 3
        ? [
            'exposed',
            position >= 1 ? 'exposed' : 'waiting',
            position >= 2 ? 'exposed' : 'waiting',
            'safe',
          ]
        : position === 3
          ? ['contained', 'contained', 'contained', 'safe']
          : ['safe', 'safe', 'restored', 'active'];
    const keys: CopyKey[] = ['identity', 'app', 'database', 'backup'];
    graph(
      root,
      c,
      keys.map((key, i) => ({ key, state: states[i]! })),
      [
        {
          from: 0,
          to: 1,
          state: position >= 3 ? 'blocked' : position >= 1 ? 'exposed' : 'waiting',
        },
        {
          from: 1,
          to: 2,
          state: position >= 3 ? 'blocked' : position >= 2 ? 'exposed' : 'waiting',
        },
        { from: 3, to: 2, state: position === 4 ? 'active' : 'waiting' },
      ],
    );
    paragraphs(root, [notes[position]!]);
    player.sync();
  };
  const player = playback(
    root,
    c,
    signal,
    () => position,
    (n) => {
      position = n;
      update();
    },
    () => 4,
  );
  slider.addEventListener(
    'input',
    () => {
      player.stop();
      position = Number(slider.value);
      update();
    },
    { signal },
  );
  stagesButtons.forEach((b, i) =>
    b.addEventListener(
      'click',
      () => {
        player.stop();
        position = i;
        update();
      },
      { signal },
    ),
  );
  button(root, '[data-reset]').addEventListener(
    'click',
    () => {
      player.stop();
      position = 0;
      update();
    },
    { signal },
  );
  update();
}
function initTraffic(root: HTMLElement, c: Copy, signal: AbortSignal) {
  const sliders = [...root.querySelectorAll<HTMLInputElement>('[data-traffic]')];
  const pattern = select(root, '[data-pattern]');
  const update = () => {
    const [baseline, intensity, threshold] = sliders.map((s) => Number(s.value));
    sliders.forEach(
      (s) => (root.querySelector(`[data-value="${s.dataset.traffic}"]`)!.textContent = s.value),
    );
    const values = trafficBuckets(baseline!, intensity!, pattern.value as TrafficPattern);
    const svg = svgElement('svg', { viewBox: '0 0 800 360', focusable: 'false' });
    const y = (value: number) => 300 - (value / 650) * 260;
    const x = (i: number) => 60 + i * 30;
    for (const tick of [0, 200, 400, 600]) {
      svg.append(
        svgElement('line', { x1: 60, y1: y(tick), x2: 750, y2: y(tick), class: 'chart-grid' }),
        svgText(String(tick), 10, y(tick) + 5),
      );
    }
    for (const tick of [0, 6, 12, 18, 23])
      svg.append(svgText(String(tick).padStart(2, '0'), x(tick) - 7, 328));
    svg.append(svgText(c.minute, 340, 350));
    svg.append(
      svgElement('line', {
        x1: 60,
        y1: y(threshold!),
        x2: 750,
        y2: y(threshold!),
        class: 'threshold-line',
      }),
    );
    svg.append(svgText(`${c.threshold}: ${threshold}`, 65, Math.max(18, y(threshold!) - 12)));
    svg.append(
      svgElement('polyline', {
        points: values.map((value, i) => `${x(i)},${y(value)}`).join(' '),
        class: 'traffic-line',
      }),
    );
    values.forEach((value, i) => {
      if (value > threshold!)
        svg.append(svgElement('circle', { cx: x(i), cy: y(value), r: 5, class: 'crossing' }));
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      `${c.requests}. ${c.pattern}: ${c[pattern.value as TrafficPattern]}. ${c.threshold}: ${threshold}. ${c.crossings}: ${values.filter((value) => value > threshold!).length}.`,
    );
    const description = svgElement('desc');
    description.setAttribute('id', 'traffic-description');
    description.textContent = values
      .map((value, minute) => `${c.minute} ${minute}: ${value}`)
      .join('. ');
    svg.setAttribute('aria-describedby', 'traffic-description');
    svg.prepend(description);
    root.querySelector('[data-chart]')!.replaceChildren(svg);
    paragraphs(root, [
      `${c.crossings}: ${values.filter((value) => value > threshold!).length} / 24. ${c.peak}: ${Math.max(...values)}.`,
      `${c.pattern}: ${c[pattern.value as TrafficPattern]}. ${c.threshold}: ${threshold}.`,
    ]);
  };
  root.addEventListener('input', update, { signal });
  root.addEventListener('change', update, { signal });
  button(root, '[data-reset]').addEventListener(
    'click',
    () => {
      sliders.forEach((s, i) => (s.value = String([80, 100, 180][i])));
      pattern.value = 'spike';
      update();
    },
    { signal },
  );
  update();
}
function initPacket(root: HTMLElement, c: Copy, signal: AbortSignal) {
  let position = 0;
  const request = select(root, '[data-request]');
  const controls = [...root.querySelectorAll<HTMLInputElement>('[data-packet-control]')];
  const enabled = (key: string) =>
    controls.find((box) => box.dataset.packetControl === key)!.checked;
  const stopAt = () =>
    packetStop(
      request.value as RequestType,
      enabled('sourceFilter'),
      enabled('waf'),
      enabled('leastPrivilege'),
    );
  const end = () => stopAt() ?? 3;
  const update = () => {
    const stop = stopAt();
    position = Math.min(position, end());
    const blocked = stop === position;
    const keys: CopyKey[] = ['dns', 'firewall', 'app', 'database'];
    const nodes: Node[] = keys.map((key, i) => ({
      key,
      state:
        i > position ? 'waiting' : i === position ? (blocked ? 'blocked' : 'active') : 'connected',
    }));
    graph(
      root,
      c,
      nodes,
      [0, 1, 2].map((i) => ({
        from: i,
        to: i + 1,
        state: i + 1 > position ? 'waiting' : stop === i + 1 ? 'blocked' : 'active',
      })),
    );
    let note: CopyKey = ['packetDns', 'packetFirewall', 'packetApp', 'packetDb'][
      position
    ] as CopyKey;
    if (blocked)
      note =
        position === 1
          ? 'packetSourceStop'
          : position === 2
            ? 'packetWafStop'
            : 'packetPrivilegeStop';
    else if (position === 3 && request.value === 'injection') note = 'packetWrite';
    paragraphs(root, [c[note], enabled('tls') ? c.encrypted : c.unencrypted]);
    root.querySelector('[data-position-label]')!.textContent =
      `${c.step} ${position + 1} ${c.of} 4 · ${c[keys[position]!]}${position === end() ? ` · ${blocked ? c.blocked : c.complete}` : ''}`;
    player.sync();
  };
  const player = playback(
    root,
    c,
    signal,
    () => position,
    (n) => {
      position = n;
      update();
    },
    end,
  );
  root.addEventListener(
    'change',
    () => {
      player.stop();
      position = 0;
      update();
    },
    { signal },
  );
  button(root, '[data-reset]').addEventListener(
    'click',
    () => {
      player.stop();
      position = 0;
      request.value = 'normal';
      controls.forEach((box) => (box.checked = true));
      update();
    },
    { signal },
  );
  update();
}
let controller: AbortController | undefined;
async function init() {
  controller?.abort();
  controller = new AbortController();
  const root = document.querySelector<HTMLElement>('[data-lab]');
  if (!root) return;
  const c = JSON.parse(root.dataset.copy!) as Copy;
  root
    .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(
      'button, input, select',
    )
    .forEach((el) => (el.disabled = false));
  if (root.querySelector('[data-range]')) {
    const signal = controller.signal;
    const { initCyberRange } = await import('./cyberRange');
    if (!signal.aborted) await initCyberRange(root, signal);
    return;
  }
  const initializers = {
    'attack-defense': initAttack,
    'soc-console': initSoc,
    'architecture-builder': initArchitecture,
    'incident-timeline': initTimeline,
    'traffic-anomalies': initTraffic,
    'packet-journey': initPacket,
  };
  initializers[root.dataset.lab as keyof typeof initializers]?.(root, c, controller.signal);
  window.matchMedia('(max-width: 719px)').addEventListener(
    'change',
    () => {
      const state = graphStates.get(root);
      if (state) graph(root, state.c, state.nodes, state.edges);
    },
    { signal: controller.signal },
  );
  root.dataset.ready = 'true';
}
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => controller?.abort());
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init, { once: true });
