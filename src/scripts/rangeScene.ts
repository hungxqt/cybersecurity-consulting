import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SystemState } from '../lib/rangeModels';
import type { RangeCopy } from '../lib/rangeCopy';

export interface SceneNode {
  id: string;
  label: string;
  state: SystemState;
  height?: number;
}
export interface SceneEdge {
  from: string;
  to: string;
  blocked?: boolean;
}
export interface SceneFrame {
  nodes: SceneNode[];
  edges: SceneEdge[];
  selected: string;
  motion: boolean;
}
export interface RangeScene {
  update(frame: SceneFrame): void;
  camera(action: string): void;
  dispose(): void;
}

function fallback(
  host: HTMLElement,
  c: RangeCopy,
  onSelect: (id: string) => void,
  signal: AbortSignal,
): RangeScene {
  host.dataset.renderer = 'svg';
  host.closest('[data-range]')!.querySelector<HTMLElement>('[data-fallback]')!.hidden = false;
  host.closest('[data-range]')!.querySelector<HTMLElement>('[data-orbit-hint]')!.hidden = true;
  host
    .closest('[data-range]')!
    .querySelectorAll<HTMLButtonElement>('[data-camera]')
    .forEach((b) => (b.disabled = true));
  const ns = 'http://www.w3.org/2000/svg';
  return {
    update(frame) {
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 760 460');
      svg.setAttribute('role', 'img');
      svg.setAttribute(
        'aria-label',
        `${c.scene}. ${frame.nodes.map((n) => `${n.label}: ${c[n.state]}`).join('. ')}`,
      );
      const positions = new Map(
        frame.nodes.map((node, i) => [
          node.id,
          { x: 25 + (i % 3) * 250, y: 35 + Math.floor(i / 3) * 145 },
        ]),
      );
      frame.edges.forEach((edge) => {
        const a = positions.get(edge.from)!,
          b = positions.get(edge.to)!;
        const line = document.createElementNS(ns, 'line');
        for (const [key, value] of Object.entries({
          x1: a.x + 105,
          y1: a.y + 45,
          x2: b.x + 105,
          y2: b.y + 45,
        }))
          line.setAttribute(key, String(value));
        line.setAttribute('class', 'range-fallback-link');
        if (edge.blocked) line.setAttribute('stroke-dasharray', '4 8');
        svg.append(line);
      });
      frame.nodes.forEach((node) => {
        const { x, y } = positions.get(node.id)!;
        const g = document.createElementNS(ns, 'g');
        const rect = document.createElementNS(ns, 'rect');
        for (const [key, value] of Object.entries({ x, y, width: 210, height: 90 }))
          rect.setAttribute(key, String(value));
        rect.setAttribute('class', 'range-fallback-node');
        rect.dataset.state = node.state;
        g.append(rect);
        for (const [value, offset] of [
          [node.label, 30],
          [c[node.state], 60],
        ] as const) {
          const text = document.createElementNS(ns, 'text');
          text.setAttribute('x', String(x + 12));
          text.setAttribute('y', String(y + offset));
          text.textContent = value;
          g.append(text);
        }
        g.addEventListener('click', () => onSelect(node.id), { signal });
        svg.append(g);
      });
      host.replaceChildren(svg);
    },
    camera() {},
    dispose() {
      host.replaceChildren();
    },
  };
}
export function createRangeScene(
  host: HTMLElement,
  c: RangeCopy,
  onSelect: (id: string) => void,
  signal: AbortSignal,
): RangeScene {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
  } catch {
    return fallback(host, c, onSelect, signal);
  }
  host.dataset.renderer = 'webgl';
  const css = getComputedStyle(host),
    color = (key: string) => css.getPropertyValue(key).trim();
  const accent = color('--accent'),
    threat = color('--threat'),
    wire = color('--rule-ui');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(color('--bg'));
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', c.scene);
  host.replaceChildren(renderer.domElement);
  const labels = document.createElement('div');
  labels.className = 'range-scene-labels';
  labels.setAttribute('aria-hidden', 'true');
  host.append(labels);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(11, 13, 17);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 35;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.update();
  controls.saveState();
  scene.add(new THREE.AmbientLight(accent, 1.5));
  const light = new THREE.DirectionalLight(color('--text'), 2.5);
  light.position.set(3, 10, 5);
  scene.add(light);
  const grid = new THREE.GridHelper(22, 22, wire, color('--rule'));
  scene.add(grid);
  const objects = new THREE.Group();
  scene.add(objects);
  const particleGeometry = new THREE.SphereGeometry(0.055, 5, 4),
    particleMaterial = new THREE.MeshBasicMaterial({ color: accent });
  const particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, 72);
  particles.count = 0;
  scene.add(particles);
  let frame: SceneFrame = { nodes: [], edges: [], selected: '', motion: false },
    meshes: THREE.Mesh[] = [],
    spots = new Map<string, THREE.Vector3>(),
    labelNodes: HTMLElement[] = [];
  let alternative: RangeScene | undefined;
  let disposed = false,
    raf = 0,
    visible = true,
    phase = 0,
    lastTime = 0;
  const releaseObjects = () => {
    objects.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    objects.clear();
  };
  const positionLabels = () => {
    const occupied: { x: number; y: number; width: number; height: number }[] = [];
    frame.nodes.forEach((node, i) => {
      const p = spots.get(node.id)!.clone();
      p.y = (node.height ?? 1.1) + 0.7;
      p.project(camera);
      const el = labelNodes[i]!;
      el.hidden = p.z > 1 || p.z < -1;
      if (el.hidden) return;
      const width = el.offsetWidth,
        height = el.offsetHeight;
      const x = THREE.MathUtils.clamp(
        ((p.x + 1) / 2) * host.clientWidth - width / 2,
        4,
        host.clientWidth - width - 4,
      );
      const initialY = ((-p.y + 1) / 2) * host.clientHeight - height;
      let y = 4;
      for (const offset of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
        y = THREE.MathUtils.clamp(
          initialY + offset * (height + 6),
          4,
          host.clientHeight - height - 4,
        );
        if (
          !occupied.some(
            (r) =>
              x < r.x + r.width + 4 &&
              x + width + 4 > r.x &&
              y < r.y + r.height + 4 &&
              y + height + 4 > r.y,
          )
        )
          break;
      }
      occupied.push({ x, y, width, height });
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
  };
  const draw = () => {
    if (disposed || !visible || document.hidden) return;
    renderer.render(scene, camera);
    positionLabels();
  };
  const animate = (time: number) => {
    raf = 0;
    if (disposed || !visible || document.hidden || !frame.motion) return;
    phase += Math.min(0.05, (time - (lastTime || time)) / 1000) * 0.3;
    lastTime = time;
    const edges = frame.edges.filter((edge) => !edge.blocked);
    particles.count = Math.min(72, edges.length * 10);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < particles.count; i++) {
      const edge = edges[i % edges.length]!,
        a = spots.get(edge.from)!,
        b = spots.get(edge.to)!;
      const p = a.clone().lerp(b, (phase + Math.floor(i / edges.length) / 10) % 1);
      p.y = 0.3;
      matrix.makeTranslation(p.x, p.y, p.z);
      particles.setMatrixAt(i, matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
    draw();
    raf = requestAnimationFrame(animate);
  };
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    if (visible && !document.hidden && frame.motion && !disposed)
      raf = requestAnimationFrame(animate);
    else {
      particles.count = 0;
      draw();
    }
  };
  const resize = () => {
    if (disposed) return;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
    camera.updateProjectionMatrix();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0]!.isIntersecting;
    schedule();
  });
  intersection.observe(host);
  controls.addEventListener('change', draw);
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener(
    'pointerdown',
    (e) => (down = { x: e.clientX, y: e.clientY }),
    { signal },
  );
  renderer.domElement.addEventListener(
    'pointerup',
    (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(e.clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(meshes)[0];
      if (hit) onSelect(hit.object.userData.id as string);
    },
    { signal },
  );
  const api: RangeScene = {
    update(next) {
      if (alternative) {
        alternative.update(next);
        return;
      }
      if (disposed) return;
      frame = next;
      releaseObjects();
      meshes = [];
      spots = new Map();
      labels.replaceChildren();
      labelNodes = [];
      const cloud = next.nodes.some((node) => node.id === 'developer');
      const positions = cloud
        ? [
            [-6, -2.5],
            [-6, 2.5],
            [-2.5, -2.5],
            [-2.5, 2.5],
            [1.5, -2.5],
            [1.5, 2.5],
            [5.5, 2.5],
          ]
        : [
            [-6, 0],
            [-3, -2.5],
            [-3, 2.5],
            [0, 0],
            [3.5, -2],
            [6, 2],
          ];
      next.nodes.forEach((node, i) => {
        const [x, z] = positions[i]!;
        const height = node.height ?? 1.1;
        const stateColor = ['compromised', 'encrypted', 'reachable'].includes(node.state)
          ? threat
          : ['isolated', 'blocked', 'protected', 'restored', 'allowed'].includes(node.state)
            ? accent
            : wire;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, height, 1.5),
          new THREE.MeshStandardMaterial({ color: stateColor, roughness: 0.7, metalness: 0.15 }),
        );
        mesh.position.set(x!, height / 2 + 0.1, z!);
        mesh.userData.id = node.id;
        objects.add(mesh);
        meshes.push(mesh);
        spots.set(node.id, new THREE.Vector3(x!, 0.2, z!));
        const outlineBox = new THREE.BoxGeometry(1.7, 0.15, 1.7);
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(outlineBox),
          new THREE.LineBasicMaterial({ color: node.id === next.selected ? accent : wire }),
        );
        outlineBox.dispose();
        outline.position.set(x!, 0.1, z!);
        objects.add(outline);
        const label = document.createElement('span');
        label.textContent = `${node.label.split(' / ').at(-1)}\n${c[node.state]}`;
        label.dataset.state = node.state;
        labels.append(label);
        labelNodes.push(label);
      });
      next.edges.forEach((edge) => {
        const a = spots.get(edge.from),
          b = spots.get(edge.to);
        if (!a || !b) return;
        const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
        const material = edge.blocked
          ? new THREE.LineDashedMaterial({ color: accent, dashSize: 0.2, gapSize: 0.2 })
          : new THREE.LineBasicMaterial({
              color: next.nodes.some(
                (node) =>
                  node.id === edge.to &&
                  ['compromised', 'encrypted', 'reachable'].includes(node.state),
              )
                ? threat
                : wire,
            });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        objects.add(line);
      });
      renderer.domElement.setAttribute(
        'aria-label',
        `${c.scene}. ${next.nodes.map((node) => `${node.label}: ${c[node.state]}`).join('. ')}`,
      );
      host.dataset.selected = next.selected;
      schedule();
      draw();
    },
    camera(action) {
      if (disposed) return;
      if (action === 'home') controls.reset();
      else if (action === 'left' || action === 'right') {
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), action === 'left' ? -0.3 : 0.3);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      } else {
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(
          offset.length() * (action === 'zoomIn' ? 0.85 : 1.15),
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(offset.setLength(distance));
        controls.update();
      }
      host.dataset.camera = camera.position
        .toArray()
        .map((n) => n.toFixed(2))
        .join(',');
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      controls.dispose();
      releaseObjects();
      grid.geometry.dispose();
      grid.material.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      host.replaceChildren();
    },
  };
  renderer.domElement.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      const current = frame;
      api.dispose();
      alternative = fallback(host, c, onSelect, signal);
      alternative.update(current);
      signal.addEventListener('abort', () => alternative?.dispose(), { once: true });
    },
    { signal },
  );
  document.addEventListener('visibilitychange', schedule, { signal });
  signal.addEventListener('abort', () => api.dispose(), { once: true });
  resize();
  return api;
}
