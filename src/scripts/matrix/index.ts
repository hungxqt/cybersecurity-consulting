import cssUrl from '../../styles/matrix.css?url';
import { createTimeline } from '../../lib/matrix/timeline';
import { createTopology, type MatrixNode } from '../../lib/matrix/topology';
import { BRAND, REVEAL, STAGES } from '../../lib/matrix/copy';
import { HELP, parseCommand } from '../../lib/matrix/terminal';
import { createLoop } from './loop';
import { terminalView } from './terminalView';
import { network } from './network';
import { effects } from './effects';
import { correlation } from './correlation';

let dispose: (() => void) | undefined;
export function close() {
  dispose?.();
}
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};
export async function open(
  trigger: HTMLElement | null = document.activeElement as HTMLElement,
  external?: AbortSignal,
) {
  if (dispose || external?.aborted) return;
  const controller = new AbortController(),
    { signal } = controller;
  const sheet = element('link');
  sheet.rel = 'stylesheet';
  sheet.href = cssUrl;
  sheet.dataset.matrixStyle = '';
  const root = element('section', 'mx');
  root.lang = 'en';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Synthetic defence console');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches;
  const previous: { node: HTMLElement; inert: boolean }[] = [];
  const overflow = document.body.style.overflow;
  let loop: ReturnType<typeof createLoop> | undefined,
    mounted = false;
  const cleanup = () => {
    controller.abort();
    loop?.stop();
    root.remove();
    sheet.remove();
    if (mounted) {
      previous.forEach(({ node, inert }) => {
        node.inert = inert;
      });
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      document.dispatchEvent(new Event('ht:matrix-close'));
    }
    dispose = undefined;
  };
  dispose = cleanup;
  external?.addEventListener('abort', cleanup, { once: true, signal });
  document.addEventListener('astro:before-swap', cleanup, { signal });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') cleanup();
    },
    { signal },
  );
  const loaded = new Promise<boolean>((resolve) => {
    sheet.addEventListener('load', () => resolve(true), { once: true, signal });
    sheet.addEventListener('error', () => resolve(false), { once: true, signal });
    signal.addEventListener('abort', () => resolve(false), { once: true });
  });
  document.head.append(sheet);
  if (!(await loaded) || signal.aborted) {
    cleanup();
    return;
  }
  try {
    const timeline = createTimeline();
    const graph = createTopology(
      731,
      innerWidth < 600 || navigator.hardwareConcurrency < 4 ? 0 : innerWidth < 1100 ? 1 : 2,
    );
    const fx = effects(root, reduced);
    const header = element('header', 'mx-header');
    const identity = element('div', 'mx-identity');
    identity.append(
      element('span', 'mx-wordmark', 'HUNGTRAN / FIELD OPERATIONS'),
      element('span', 'mx-muted', 'SYNTHETIC DATA · NO EXTERNAL UPLINK'),
    );
    header.append(identity);
    const controls = element('div', 'mx-controls');
    const button = (label: string, action: () => void, parent = controls) => {
      const b = element('button', '', label);
      b.type = 'button';
      b.addEventListener('click', action, { signal });
      parent.append(b);
      return b;
    };
    const pause = button('Pause', () => toggle());
    button('Replay', () => replay());
    const exit = button('Close ×', cleanup);
    exit.className = 'mx-close';
    header.append(controls);
    const phases = element('nav', 'mx-phases');
    phases.setAttribute('aria-label', 'Console phases');
    const chips = ['INIT', 'RECON', 'ATTACK', 'REVEAL'].map((name, i) => {
      const chip = element('span', '', `0${i + 1} ${name}`);
      phases.append(chip);
      return chip;
    });
    const grid = element('div', 'mx-grid');
    const terminal = element('section', 'mx-panel mx-terminal');
    terminal.append(element('h2', '', '01 / OPERATOR TERMINAL'));
    const logs = element('div', 'mx-logs');
    logs.tabIndex = 0;
    logs.setAttribute('role', 'region');
    logs.setAttribute('aria-label', 'Operator terminal output');
    logs.setAttribute('aria-live', 'off');
    const view = terminalView(logs, reduced);
    terminal.append(logs);
    const form = element('form', 'mx-command');
    const label = element('label', '', 'Command');
    label.htmlFor = 'mx-command';
    const input = element('input');
    input.id = 'mx-command';
    input.maxLength = 80;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.disabled = true;
    const submit = element('button', '', 'Run');
    submit.type = 'submit';
    form.append(label, input, submit);
    terminal.append(form);
    const map = element('section', 'mx-panel mx-map');
    map.append(element('h2', '', '02 / DOCUMENTATION NETWORK'));
    const canvas = element('canvas', 'mx-network');
    canvas.setAttribute(
      'aria-label',
      'Synthetic topology; use the node index for keyboard inspection',
    );
    map.append(canvas);
    const telemetry = element('p', 'mx-muted', 'DISCOVERY STANDBY / LATENCY 12ms');
    map.append(telemetry);
    const nodes = element('details', 'mx-index');
    nodes.open = innerWidth >= 700;
    nodes.append(element('summary', '', 'Node index'));
    const list = element('div', 'mx-node-list');
    nodes.append(list);
    map.append(nodes);
    const detail = element(
      'div',
      'mx-detail',
      'Select a discovered node to inspect its synthetic telemetry.',
    );
    detail.setAttribute('role', 'status');
    map.append(detail);
    let pinned = false,
      selected: MatrixNode | undefined;
    const inspect = (node: MatrixNode, pin: boolean) => {
      if (pinned && !pin) return;
      pinned = pin;
      selected = node;
      renderer.select(node.id);
      detail.textContent = `${node.id} / ${node.type} / ${node.hostname}\n${node.ip} · ${node.traffic} pps · ${node.status}\n▁▃▂▅▃▆▂▄ · ${node.event}`;
    };
    const renderer = network(canvas, graph, signal, reduced, inspect);
    if (!renderer.supported)
      map.append(element('p', '', 'Text mode active. Explore the network through the node index.'));
    const incident = element('section', 'mx-panel mx-incident');
    incident.append(element('h2', '', '03 / THREAT CORRELATION'));
    const meter = element('progress');
    meter.max = 6;
    meter.value = 0;
    meter.setAttribute('aria-label', 'Containment progress');
    incident.append(meter);
    const stages = element('ol', 'mx-stages');
    const stageItems = STAGES.map((s) => {
      const li = element('li', '', s);
      stages.append(li);
      return li;
    });
    incident.append(stages);
    const correlationCanvas = element('canvas', 'mx-correlation');
    correlationCanvas.setAttribute('role', 'img');
    correlationCanvas.setAttribute('aria-label', 'Awaiting IOC correlation');
    incident.append(correlationCanvas);
    const correlator = correlation(correlationCanvas, signal);
    correlator.draw(false, false);
    const reveal = element('section', 'mx-reveal');
    reveal.hidden = true;
    const heading = element('h2', '', REVEAL);
    heading.tabIndex = -1;
    reveal.append(heading, element('p', '', BRAND));
    const actions = element('div', 'mx-actions');
    button('Replay', () => replay(), actions);
    button('Return to site', cleanup, actions);
    const contact = element('a', '', 'Talk to the team →');
    contact.href = document.documentElement.lang === 'vi' ? '/vi/contact/' : '/en/contact/';
    contact.dataset.noPrefetch = '';
    contact.addEventListener('click', cleanup, { signal });
    actions.append(contact);
    reveal.append(actions);
    const live = element('p', 'mx-sr');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    grid.append(terminal, map, incident);
    root.append(header, phases, grid, reveal, live);
    for (const node of Array.from(document.body.children))
      if (node instanceof HTMLElement) {
        previous.push({ node, inert: node.inert });
        node.inert = true;
      }
    document.body.style.overflow = 'hidden';
    document.body.append(root);
    mounted = true;
    root.dataset.matrixPhase = 'init';
    root.dataset.matrixState = 'running';
    exit.focus();
    let listed = 0,
      stage = -1,
      revealTime = 0;
    const updateState = () => {
      root.dataset.matrixState = timeline.state.paused ? 'paused' : 'running';
      pause.textContent = timeline.state.paused ? 'Resume' : 'Pause';
      pause.setAttribute('aria-pressed', String(timeline.state.paused));
    };
    const syncLoop = () => {
      if (document.hidden || timeline.state.paused) loop?.stop();
      else loop?.start();
    };
    function toggle() {
      if (timeline.state.paused) timeline.resume();
      else timeline.pause();
      updateState();
      syncLoop();
    }
    function replay() {
      timeline.replay();
      view.clear();
      list.replaceChildren();
      listed = 0;
      stage = -1;
      pinned = false;
      selected = undefined;
      detail.textContent = 'Select a discovered node to inspect its synthetic telemetry.';
      graph.nodes.forEach((n) => {
        n.status = 'nominal';
        n.event = 'Baseline established';
      });
      stageItems.forEach((li) => {
        li.removeAttribute('data-done');
      });
      meter.value = 0;
      correlator.draw(false, false);
      reveal.hidden = true;
      input.disabled = true;
      root.dataset.matrixPhase = 'init';
      root.scrollTop = 0;
      renderer.select('');
      renderer.scan();
      updateState();
      syncLoop();
      exit.focus();
    }
    loop = createLoop((dt, cost) => {
      for (const cue of timeline.advance(dt)) {
        if (cue.type === 'phase') {
          root.dataset.matrixPhase = cue.phase;
          chips.forEach((c) => c.removeAttribute('aria-current'));
          chips[['init', 'recon', 'attack', 'reveal'].indexOf(cue.phase)]!.setAttribute(
            'aria-current',
            'step',
          );
          live.textContent = cue.payload;
          view.log(cue.payload);
          if (cue.phase === 'recon') input.disabled = false;
          if (cue.phase === 'reveal') {
            reveal.hidden = false;
            revealTime = 0;
            heading.textContent = reduced() ? REVEAL : '';
            heading.focus({ preventScroll: true });
            reveal.scrollIntoView({ block: 'center', behavior: 'instant' });
          }
        } else {
          view.log(`[${(cue.at / 1000).toFixed(1)}] ${cue.payload}`);
        }
        if (cue.type === 'stage') {
          stage = cue.stage!;
          meter.value = stage + 1;
          stageItems[stage]!.dataset.done = '';
          live.textContent = cue.payload;
          for (const id of graph.attackPath) {
            graph.nodes[id]!.status =
              stage >= 4 ? 'contained' : stage === 0 ? 'suspicious' : 'compromised';
            graph.nodes[id]!.event = cue.payload;
          }
          correlator.draw(stage >= 3, stage >= 4);
          correlationCanvas.setAttribute(
            'aria-label',
            stage >= 3
              ? 'Hash, domain, documentation IP and synthetic user correlated to incident MX-01'
              : 'Awaiting IOC correlation',
          );
          if (stage === 0 || stage === 4) fx.glitch();
          if (selected) inspect(selected, pinned);
        }
      }
      view.tick(dt);
      fx.tick(dt);
      if (timeline.state.phase === 'reveal') {
        revealTime += dt;
        const count = reduced() ? REVEAL.length : Math.floor(revealTime / 30);
        heading.textContent = REVEAL.slice(0, count) + (count < REVEAL.length ? '▓▒░' : '');
      }
      const visible = renderer.draw(dt, timeline.state.elapsed, cost) ?? 0;
      while (listed < visible) {
        const node = graph.nodes[listed++]!;
        const b = button(node.id, () => inspect(node, true), list);
        b.dataset.nodeId = node.id;
        b.addEventListener('focus', () => inspect(node, true), { signal });
      }
      telemetry.textContent = `${visible}/${graph.nodes.length} NODES · ${stage >= 4 ? 'CONTAINED' : stage >= 0 ? 'INVESTIGATING' : 'NOMINAL'} · LATENCY 12ms`;
    });
    document.addEventListener('visibilitychange', syncLoop, { signal });
    motion.addEventListener(
      'change',
      () => {
        root.classList.remove('mx-glitch');
      },
      { signal },
    );
    const history: string[] = [];
    let historyIndex = 0;
    input.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        historyIndex = Math.max(
          0,
          Math.min(history.length, historyIndex + (e.key === 'ArrowUp' ? -1 : 1)),
        );
        input.value = history[historyIndex] ?? '';
      },
      { signal },
    );
    list.addEventListener(
      'keydown',
      (e) => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const all = Array.from(list.querySelectorAll('button'));
        const index = all.indexOf(document.activeElement as HTMLButtonElement);
        all[
          (index + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + all.length) %
            all.length
        ]?.focus();
      },
      { signal },
    );
    root.addEventListener(
      'keydown',
      (e) => {
        if (
          e.key === ' ' &&
          !(e.target instanceof Element && e.target.closest('input,button,a,summary'))
        ) {
          e.preventDefault();
          toggle();
        }
        if (e.key === 'Tab') {
          const focusable = Array.from(
            root.querySelectorAll<HTMLElement>(
              'button,a,input:not(:disabled),summary,[tabindex="0"]',
            ),
          ).filter((n) => n.getClientRects().length);
          const first = focusable[0],
            last = focusable.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      },
      { signal },
    );
    form.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        const raw = input.value.slice(0, 80);
        input.value = '';
        history.push(raw);
        if (history.length > 50) history.shift();
        historyIndex = history.length;
        const command = parseCommand(raw);
        view.log(`> ${raw}`);
        switch (command.type) {
          case 'help':
            view.log(HELP);
            break;
          case 'status':
            view.log(
              `${timeline.state.phase.toUpperCase()} / ${timeline.state.paused ? 'PAUSED' : 'RUNNING'} / SYNTHETIC DATA ONLY`,
            );
            break;
          case 'scan':
            renderer.scan();
            view.log('Documentation network scan wave queued.');
            break;
          case 'inspect': {
            const n = graph.nodes.slice(0, listed).find((n) => n.id === command.argument);
            if (n) inspect(n, true);
            else view.log('Node not discovered. Use the node index.');
            break;
          }
          case 'pause':
            timeline.pause();
            updateState();
            syncLoop();
            break;
          case 'resume':
            timeline.resume();
            updateState();
            syncLoop();
            break;
          case 'replay':
            replay();
            break;
          case 'clear':
            view.clear();
            break;
          case 'exit':
            cleanup();
            break;
          default:
            view.log(`Unknown command: ${command.argument}. Type help.`);
        }
        if (timeline.state.paused) view.tick(10000);
      },
      { signal },
    );
    updateState();
    syncLoop();
  } catch (error) {
    cleanup();
    throw error;
  }
}
