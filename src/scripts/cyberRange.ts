import type { RangeCopy, RangeCopyKey } from '../lib/rangeCopy';
import type { RangeId } from '../lib/rangeCatalog';
import {
  SYSTEMS,
  newEnvironment,
  networkStates,
  newDdos,
  ddosOutcome,
  newRansomware,
  spreadWave,
  restoreSystem,
  PACKETS,
  inspectPacket,
  evaluateAccess,
  PERMISSIONS,
  blastRadius,
  type SystemId,
  type SystemState,
  type DdosConfig,
  type AccessContext,
  type PermissionId,
  type CloudId,
} from '../lib/rangeModels';
import { COMMANDS, executeCommand, completeCommand } from '../lib/rangeTerminal';
import type { RangeScene, SceneFrame, SceneNode } from './rangeScene';

const ns = 'http://www.w3.org/2000/svg';
const NETWORK_EDGES = [
  ['edge', 'identity'],
  ['edge', 'ws17'],
  ['identity', 'app'],
  ['ws17', 'app'],
  ['app', 'db'],
  ['db', 'backup'],
] as const;
function svgEl(tag: string, attrs: Record<string, string | number> = {}, text?: string) {
  const el = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text) el.textContent = text;
  return el;
}
export async function initCyberRange(outer: HTMLElement, signal: AbortSignal) {
  const root = outer.querySelector<HTMLElement>('[data-range]')!;
  const mode = root.dataset.range as RangeId,
    c = JSON.parse(root.dataset.rangeCopy!) as RangeCopy;
  const host = root.querySelector<HTMLElement>('[data-range-scene]')!;
  const getInput = (key: string) =>
    root.querySelector<HTMLInputElement>(
      `[data-range-toggle="${key}"], [data-range-input="${key}"]`,
    )!;
  const getOption = (key: string) =>
    root.querySelector<HTMLSelectElement>(`[data-option="${key}"]`)!.value;
  let env = newEnvironment(),
    ddos = newDdos(),
    ransom = newRansomware();
  let selected = 'ws17',
    packet = 0,
    replay = 0,
    seconds = 0,
    queue = 0,
    message = '',
    timer: ReturnType<typeof setInterval> | undefined,
    scene: RangeScene | undefined;
  const motion = root.querySelector<HTMLInputElement>('input[data-motion]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const format = (value: number) =>
    new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 }).format(
      value,
    );
  if (mode === 'response-terminal') {
    env.started = true;
    env.entry = 'attachment';
  }
  if (mode === 'cloud-blast-radius') selected = 'developer';
  const metrics = (items: [RangeCopyKey, string | number][]) => {
    root.querySelector('[data-range-metrics]')!.replaceChildren(
      ...items.map(([key, value]) => {
        const dl = document.createElement('dl'),
          dt = document.createElement('dt'),
          dd = document.createElement('dd');
        dt.textContent = c[key];
        dd.textContent = String(value);
        dl.append(dt, dd);
        return dl;
      }),
    );
  };
  const findings = (lines: string[]) =>
    root.querySelector('[data-range-findings]')!.replaceChildren(
      ...lines.map((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      }),
    );
  const selectSystem = (id: string) => {
    selected = id;
    message = '';
    update();
  };
  const nodeLabel = (id: string) => c[id as RangeCopyKey] ?? id;
  const frameFromStates = (states: Record<SystemId, SystemState>): SceneFrame => ({
    nodes: SYSTEMS.map((id) => ({
      id,
      label: c[id],
      state: states[id],
      ...(mode === 'ddos-defense' && id === 'app' ? { height: 1 + Math.min(3, queue / 800) } : {}),
    })),
    edges: NETWORK_EDGES.map(([from, to]) => ({
      from,
      to,
      blocked:
        ['blocked', 'isolated', 'protected'].includes(states[to]) || states[from] === 'isolated',
    })),
    selected,
    motion: (motion?.checked ?? false) || (!reduced.matches && timer !== undefined),
  });
  const updateNetwork = () => {
    const states = networkStates(env);
    scene!.update(frameFromStates(states));
    const entry = env.entry === 'password' ? 'identity' : 'ws17';
    const compromised = Object.values(states).filter((state) => state === 'compromised').length;
    metrics([
      ['affected', compromised],
      ['selected', `${nodeLabel(selected)} · ${c[states[selected as SystemId]]}`],
    ]);
    findings([
      !env.started
        ? c.idle
        : ['blocked', 'isolated'].includes(states[entry])
          ? c.attackStopped
          : states.db !== 'compromised'
            ? c.dataStopped
            : c.attackOpen,
      c.defenseNote,
    ]);
  };
  const updateDdos = () => {
    const out = ddosOutcome(ddos, queue);
    const states = networkStates(env);
    states.edge = out.overloaded ? 'compromised' : 'healthy';
    states.app = queue > 0 || out.overloaded ? 'compromised' : 'healthy';
    scene!.update(frameFromStates(states));
    metrics([
      ['queue', format(queue)],
      ['latency', `${format(queue / Math.max(1, ddos.capacity))} s`],
      ['served', format(out.served)],
      ['rejected', format(out.rejected)],
      ['dropped', format(out.filtered)],
      ['elapsed', `${seconds} s`],
    ]);
    findings([out.overloaded ? c.overloaded : c.balanced, c.tradeoff]);
    root
      .querySelectorAll<HTMLInputElement>('[data-range-input]')
      .forEach(
        (input) =>
          (root.querySelector(`[data-range-value="${input.dataset.rangeInput}"]`)!.textContent =
            input.value),
      );
  };
  const updateRansomware = () => {
    const states = Object.fromEntries(
      SYSTEMS.map((id) => [
        id,
        ransom.restored.has(id)
          ? 'restored'
          : ransom.isolated.has(id)
            ? 'isolated'
            : ransom.encrypted.has(id)
              ? 'encrypted'
              : id === 'backup' && ransom.backups
                ? 'protected'
                : 'healthy',
      ]),
    ) as Record<SystemId, SystemState>;
    scene!.update(frameFromStates(states));
    metrics([
      ['wave', ransom.wave],
      ['affected', ransom.encrypted.size],
      [
        'recovery',
        ransom.backups && !ransom.encrypted.has('backup') ? c.cleanBackup : c.lostBackup,
      ],
    ]);
    findings([
      message || c.ransomwareHint,
      ransom.backups && !ransom.encrypted.has('backup') ? c.cleanBackup : c.lostBackup,
    ]);
  };
  const updatePacket = () => {
    const rules = {
      sourceRule: getInput('sourceRule').checked,
      portRule: getInput('portRule').checked,
      inspectRule: getInput('inspectRule').checked,
    };
    const p = PACKETS[packet]!,
      outcome = inspectPacket(packet, rules);
    const svg = svgEl('svg', {
      viewBox: '0 0 760 440',
      role: 'img',
      'aria-label': `${c.packets}. ${PACKETS.map((p, i) => `${p.id}: ${c[inspectPacket(i, rules)]}`).join('. ')}`,
    });
    PACKETS.forEach((p, i) => {
      const y = 70 + i * 125,
        blocked = inspectPacket(i, rules) !== 'packetAllow';
      svg.append(
        svgEl('line', { x1: 30, y1: y + 25, x2: 710, y2: y + 25, class: 'range-fallback-link' }),
      );
      const g = svgEl('g');
      const rect = svgEl('rect', {
        x: 225,
        y: y - 8,
        width: 310,
        height: 70,
        class: 'range-packet',
        'data-blocked': String(blocked),
        'stroke-width': packet === i ? 4 : 2,
      });
      g.append(
        rect,
        svgEl('text', { x: 240, y: y + 18 }, `${p.id} / ${c[p.kind]}`),
        svgEl('text', { x: 240, y: y + 42, class: 'range-subtext' }, `${p.source} → :${p.port}`),
      );
      g.addEventListener(
        'click',
        () => {
          packet = i;
          update();
        },
        { signal },
      );
      svg.append(g);
      const moving = svgEl('circle', { cx: 45, cy: y + 25, r: 8, class: 'range-flow' });
      moving.addEventListener(
        'click',
        () => {
          packet = i;
          update();
        },
        { signal },
      );
      svg.append(moving);
    });
    host.replaceChildren(svg);
    host.dataset.motion = String(motion?.checked ?? false);
    root
      .querySelectorAll<HTMLButtonElement>('[data-range-packet]')
      .forEach((b, i) => b.setAttribute('aria-pressed', String(i === packet)));
    const layers = {
      ethernet: `Ethernet II · 02:00:00:00:00:17 → 02:00:00:00:00:20 · ${p.size} bytes`,
      network: `IPv4 · ${p.source} → ${p.destination} · TTL 64`,
      transport: `TCP · 52170 → ${p.port} · ACK · ${p.port === 443 ? 'TLS 1.3' : 'HTTP'}`,
      application: `${p.method} · ${c[p.kind]}`,
    };
    for (const [key, value] of Object.entries(layers))
      root.querySelector(`[data-layer="${key}"]`)!.textContent = value;
    metrics([
      ['selected', p.id],
      ['status', outcome === 'packetAllow' ? c.allowed : c.blocked],
    ]);
    findings([c[outcome]]);
  };
  const updateZero = () => {
    const context = {
      role: getOption('role'),
      device: getOption('device'),
      location: getOption('location'),
      resource: getOption('resource'),
      verified: getInput('verified').checked,
    } as AccessContext;
    const result = evaluateAccess(context),
      names = c.checkpoints.split('|');
    const compact = window.matchMedia('(max-width: 719px)').matches;
    const svg = svgEl('svg', {
      viewBox: compact ? '0 0 360 450' : '0 0 760 440',
      role: 'img',
      'aria-label': `${c.checkpoints.replaceAll('|', ', ')}. ${c[result.reason]}`,
    });
    result.states.forEach((state, i) => {
      const x = compact ? 40 : 35 + (i % 2) * 380,
        y = compact ? 15 + i * 110 : 60 + Math.floor(i / 2) * 180;
      svg.append(
        svgEl('rect', {
          x,
          y,
          width: 280,
          height: 85,
          class: 'range-fallback-node',
          'data-state': state === 'blocked' ? 'compromised' : state,
        }),
        svgEl('text', { x: x + 15, y: y + 32 }, `0${i + 1} / ${names[i]}`),
        svgEl('text', { x: x + 15, y: y + 60 }, c[state]),
      );
    });
    host.replaceChildren(svg);
    metrics([
      ['status', result.allowed ? c.allowed : c.blocked],
      ['resource', c[context.resource]],
    ]);
    findings([c[result.reason]]);
  };
  const updateReplay = () => {
    const states = Object.fromEntries(SYSTEMS.map((id) => [id, 'healthy'])) as Record<
      SystemId,
      SystemState
    >;
    if (replay < 4) {
      states.identity = 'compromised';
      if (replay >= 2) states.app = 'compromised';
      if (replay >= 3) states.db = 'compromised';
    } else {
      states.identity = 'blocked';
      states.ws17 = 'isolated';
      if (replay === 5) states.db = 'restored';
    }
    scene!.update(frameFromStates(states));
    const slider = root.querySelector<HTMLInputElement>('[data-frame]')!;
    slider.value = String(replay);
    slider.setAttribute('aria-valuetext', c.replayStages.split('|')[replay]!);
    root.querySelector('[data-frame-label]')!.textContent = c.replayStages.split('|')[replay]!;
    root.querySelector('[data-replay-log]')!.textContent = c.replayLogs.split('|')[replay]!;
    root.querySelector('[data-replay-action]')!.textContent = c.analystNotes.split('|')[replay]!;
    const notes =
      getOption('viewpoint') === 'defender'
        ? c.analystNotes
        : getOption('viewpoint') === 'attacker'
          ? c.attackerNotes
          : c.businessNotes;
    metrics([
      ['frame', `${replay + 1} / 6`],
      ['viewpoint', c[getOption('viewpoint') as RangeCopyKey]],
    ]);
    findings([notes.split('|')[replay]!]);
    root.querySelector<HTMLButtonElement>('[data-range-previous]')!.disabled = replay === 0;
    root.querySelector<HTMLButtonElement>('[data-range-next]')!.disabled = replay === 5;
  };
  const updateBlast = () => {
    const permissions = new Set(
      [...root.querySelectorAll<HTMLInputElement>('[data-permission]')]
        .filter((box) => box.checked)
        .map((box) => box.dataset.permission as PermissionId),
    );
    const principal = getOption('principal') as 'developer' | 'service',
      reached = blastRadius(principal, permissions);
    const ids: CloudId[] = ['developer', 'service', 'admin', 'app', 'db', 'storage', 'backup'];
    const nodes: SceneNode[] = ids.map((id) => ({
      id,
      label: c[id],
      state: id === principal ? 'compromised' : reached.has(id) ? 'reachable' : 'healthy',
    }));
    scene!.update({
      nodes,
      edges: PERMISSIONS.filter((edge) => permissions.has(edge.id)).map((edge) => ({
        from: edge.from,
        to: edge.to,
      })),
      selected,
      motion: motion?.checked ?? false,
    });
    metrics([
      ['blastCount', reached.size - 1],
      ['principal', c[principal]],
    ]);
    findings([
      `${c.blastCount}: ${
        [...reached]
          .filter((id) => id !== principal)
          .map((id) => c[id])
          .join(', ') || '0'
      }.`,
      c.blastNote,
    ]);
  };
  const updates: Record<RangeId, () => void> = {
    'network-digital-twin': updateNetwork,
    'response-terminal': updateNetwork,
    'ddos-defense': updateDdos,
    'ransomware-race': updateRansomware,
    'packet-workbench': updatePacket,
    'zero-trust-journey': updateZero,
    'soc-replay': updateReplay,
    'cloud-blast-radius': updateBlast,
  };
  function update() {
    if (signal.aborted) return;
    updates[mode]();
    root
      .querySelectorAll<HTMLButtonElement>('[data-system]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.system === selected)));
    root.querySelector('[data-selected]')!.textContent =
      mode === 'packet-workbench'
        ? PACKETS[packet]!.id
        : mode === 'zero-trust-journey'
          ? c[getOption('resource') as RangeCopyKey]
          : nodeLabel(selected);
  }
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    root.dataset.running = 'false';
    const b = root.querySelector('[data-range-play]');
    if (b) b.textContent = c.play;
  };
  const advance = () => {
    if (mode === 'ddos-defense') {
      queue = ddosOutcome(ddos, queue).nextQueue;
      seconds++;
    } else if (mode === 'ransomware-race') {
      const next = spreadWave(ransom);
      const stopped = next.encrypted.size === ransom.encrypted.size;
      ransom = next;
      if (stopped) {
        stop();
        message = c.raceDone;
      }
    } else if (mode === 'soc-replay') {
      replay = Math.min(5, replay + 1);
      if (replay === 5) stop();
    }
    update();
  };
  const reset = () => {
    stop();
    env = newEnvironment();
    if (mode === 'response-terminal') {
      env.started = true;
      env.entry = 'attachment';
    }
    ddos = newDdos();
    ransom = newRansomware();
    queue = seconds = replay = packet = 0;
    message = '';
    selected = mode === 'cloud-blast-radius' ? 'developer' : 'ws17';
    root
      .querySelectorAll<HTMLInputElement>('[data-range-toggle]')
      .forEach(
        (box) =>
          (box.checked = ['backups', 'verified', 'sourceRule', 'portRule', 'inspectRule'].includes(
            box.dataset.rangeToggle!,
          )),
      );
    root
      .querySelectorAll<HTMLSelectElement>('[data-option]')
      .forEach((select) => (select.selectedIndex = 0));
    root
      .querySelectorAll<HTMLInputElement>('[data-range-input]')
      .forEach(
        (input) => (input.value = String(ddos[input.dataset.rangeInput as keyof DdosConfig])),
      );
    root
      .querySelectorAll<HTMLInputElement>('[data-permission]')
      .forEach((box) => (box.checked = true));
    if (motion) motion.checked = false;
    root.querySelector('[data-terminal-log]')?.replaceChildren();
    scene?.camera('home');
    update();
  };
  if (!['packet-workbench', 'zero-trust-journey'].includes(mode)) {
    const { createRangeScene } = await import('./rangeScene');
    if (signal.aborted) return;
    scene = createRangeScene(host, c, selectSystem, signal);
  }
  root.addEventListener(
    'change',
    (e) => {
      const target = e.target as HTMLInputElement;
      if (target.dataset.rangeToggle) {
        const key = target.dataset.rangeToggle;
        if (key === 'mfa' || key === 'edr' || key === 'segment' || key === 'backups')
          env[key] = target.checked;
        if (key === 'filter') ddos.filter = target.checked;
        if (key === 'backups') ransom.backups = target.checked;
      }
      if (target.dataset.option === 'entry') env.entry = getOption('entry') as EnvironmentEntry;
      message = '';
      update();
    },
    { signal },
  );
  type EnvironmentEntry = 'password' | 'attachment';
  root.querySelectorAll<HTMLInputElement>('[data-range-input]').forEach((input) =>
    input.addEventListener(
      'input',
      () => {
        const key = input.dataset.rangeInput as Exclude<keyof DdosConfig, 'filter'>;
        ddos[key] = Number(input.value);
        update();
      },
      { signal },
    ),
  );
  root
    .querySelectorAll<HTMLButtonElement>('[data-system]')
    .forEach((b) => b.addEventListener('click', () => selectSystem(b.dataset.system!), { signal }));
  root
    .querySelectorAll<HTMLButtonElement>('[data-camera]')
    .forEach((b) =>
      b.addEventListener('click', () => scene?.camera(b.dataset.camera!), { signal }),
    );
  root.querySelectorAll<HTMLButtonElement>('[data-range-packet]').forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        packet = Number(b.dataset.rangePacket);
        update();
      },
      { signal },
    ),
  );
  root.querySelector('[data-launch]')?.addEventListener(
    'click',
    () => {
      env.started = true;
      if (motion) motion.checked = !reduced.matches;
      update();
    },
    { signal },
  );
  root.querySelector('[data-isolate]')?.addEventListener(
    'click',
    () => {
      ransom.isolated.add(selected as SystemId);
      message = `${nodeLabel(selected)}: ${c.isolated}`;
      update();
    },
    { signal },
  );
  root.querySelector('[data-restore]')?.addEventListener(
    'click',
    () => {
      message = restoreSystem(ransom, selected as SystemId) ? c.restoreDone : c.restoreNeed;
      update();
    },
    { signal },
  );
  root.querySelector('[data-range-next]')?.addEventListener(
    'click',
    () => {
      stop();
      advance();
    },
    { signal },
  );
  root.querySelector('[data-range-previous]')?.addEventListener(
    'click',
    () => {
      stop();
      replay = Math.max(0, replay - 1);
      update();
    },
    { signal },
  );
  root.querySelector('[data-range-play]')?.addEventListener(
    'click',
    () => {
      if (timer !== undefined) {
        stop();
        update();
        return;
      }
      if (mode === 'soc-replay' && replay === 5) replay = 0;
      timer = setInterval(advance, mode === 'ddos-defense' ? 1000 : 1600);
      root.dataset.running = 'true';
      root.querySelector('[data-range-play]')!.textContent = c.pause;
      update();
    },
    { signal },
  );
  root.querySelector('[data-range-reset]')!.addEventListener('click', reset, { signal });
  root.querySelector<HTMLInputElement>('[data-frame]')?.addEventListener(
    'input',
    (e) => {
      stop();
      replay = Number((e.target as HTMLInputElement).value);
      update();
    },
    { signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        stop();
        update();
      }
    },
    { signal },
  );
  signal.addEventListener('abort', stop, { once: true });
  reduced.addEventListener(
    'change',
    () => {
      if (reduced.matches && motion) motion.checked = false;
      update();
    },
    { signal },
  );
  window.matchMedia('(max-width: 719px)').addEventListener('change', update, { signal });
  const terminal = root.querySelector<HTMLFormElement>('[data-terminal-form]');
  if (terminal) {
    const field = root.querySelector<HTMLInputElement>('[data-command]')!,
      log = root.querySelector<HTMLElement>('[data-terminal-log]')!;
    const history: string[] = [];
    let cursor = 0;
    const write = (text: string, command = false) => {
      const p = document.createElement('p');
      p.textContent = text;
      if (command) p.className = 'terminal-input';
      log.append(p);
      while (log.children.length > 80) log.firstElementChild!.remove();
      log.scrollTop = log.scrollHeight;
    };
    const run = (raw: string) => {
      if (!raw.trim()) return;
      history.push(raw.slice(0, 120));
      if (history.length > 50) history.shift();
      cursor = history.length;
      write(`range-01 > ${raw.slice(0, 120)}`, true);
      const result = executeCommand(raw, env, ddos);
      if (result.kind === 'reset') {
        reset();
        write(c.changed);
      } else if (result.kind === 'clear') {
        log.replaceChildren();
        write(c.cleared);
      } else if (result.kind === 'help') write(COMMANDS.join('\n'));
      else if (result.kind === 'unknown') write(c.unknown);
      else if (result.kind === 'alerts') write(`${c.alertLogin}\n${c.alertHost}`);
      else if (result.kind === 'inspect') {
        if (result.system) selected = result.system;
        write(`${nodeLabel(selected)}\n${c.terminalEvidence}`);
      } else if (result.kind === 'status') {
        const states = networkStates(env);
        write(SYSTEMS.map((id) => `${c[id]}: ${c[states[id]]}`).join('\n'));
        const d = ddosOutcome(ddos, queue);
        write(
          `${c.rate}: ${ddos.rate} · ${c.cache}: ${ddos.cache}% · ${c.served}: ${format(d.served)}`,
        );
      } else write(c.changed);
      for (const key of ['mfa', 'edr', 'segment', 'backups'] as const) {
        const box = root.querySelector<HTMLInputElement>(`[data-range-toggle="${key}"]`);
        if (box) box.checked = env[key];
      }
      root
        .querySelectorAll<HTMLInputElement>('[data-range-input]')
        .forEach(
          (input) => (input.value = String(ddos[input.dataset.rangeInput as keyof DdosConfig])),
        );
      const filter = root.querySelector<HTMLInputElement>('[data-range-toggle="filter"]');
      if (filter) filter.checked = ddos.filter;
      field.value = '';
      update();
    };
    terminal.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        run(field.value);
      },
      { signal },
    );
    field.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          cursor = Math.max(0, Math.min(history.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
          field.value = history[cursor] ?? '';
        } else if (e.key === 'Tab' && field.value.trim()) {
          const completion = completeCommand(field.value);
          if (completion && completion !== field.value) {
            e.preventDefault();
            field.value = completion;
          }
        }
      },
      { signal },
    );
    root.querySelectorAll<HTMLButtonElement>('[data-command-shortcut]').forEach((b) =>
      b.addEventListener(
        'click',
        () => {
          run(b.dataset.commandShortcut!);
          field.focus();
        },
        { signal },
      ),
    );
    write(c.terminalIntro);
  }
  update();
  root.dataset.ready = 'true';
  outer.dataset.ready = 'true';
}
