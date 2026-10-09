export type NodeStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';
export type MatrixNode = {
  id: string;
  type: string;
  hostname: string;
  ip: string;
  x: number;
  y: number;
  depth: number;
  traffic: number;
  status: NodeStatus;
  event: string;
};
export function createTopology(seed = 731, tier = 2) {
  const random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const count = [8, 10, 12][Math.max(0, Math.min(2, tier))]!;
  const positions = [
    [0.5, 0.1],
    [0.5, 0.33],
    [0.18, 0.33],
    [0.5, 0.56],
    [0.5, 0.84],
    [0.18, 0.56],
    [0.82, 0.14],
    [0.82, 0.37],
    [0.82, 0.6],
    [0.82, 0.84],
    [0.18, 0.14],
    [0.18, 0.84],
  ];
  const types = ['gateway', 'firewall', 'IDS', 'server', 'DB', 'endpoint'];
  const labels = ['GW', 'FW', 'IDS', 'SRV', 'DB', 'EP'];
  const counters = Array(6).fill(0) as number[];
  const nodes: MatrixNode[] = Array.from({ length: count }, (_, i) => {
    const kind = i < 6 ? i : 3 + (i % 3);
    const id = `${labels[kind]}-${String(++counters[kind]!).padStart(2, '0')}`;
    return {
      id,
      type: types[kind]!,
      hostname: `${id.toLowerCase()}.synthetic.invalid`,
      ip: `${['192.0.2', '198.51.100', '203.0.113'][i % 3]}.${i + 10}`,
      x: positions[i]![0]! + (random() - 0.5) * 0.015,
      y: positions[i]![1]! + (random() - 0.5) * 0.015,
      depth: i % 3,
      traffic: Math.floor(40 + random() * 900),
      status: 'nominal',
      event: 'Baseline established',
    };
  });
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [3, 4],
    [1, 5],
  ];
  for (let i = 6; i < count; i++) links.push([i % 3 === 1 ? 4 : 3, i]);
  // BFS between each story waypoint keeps every hop on an actual edge.
  const route = (start: number, end: number) => {
    const queue = [[start]],
      seen = new Set([start]);
    while (queue.length) {
      const path = queue.shift()!;
      const last = path.at(-1)!;
      if (last === end) return path;
      for (const [a, b] of links) {
        const next = a === last ? b : b === last ? a : -1;
        if (next >= 0 && !seen.has(next)) {
          seen.add(next);
          queue.push([...path, next]);
        }
      }
    }
    return [];
  };
  return {
    nodes,
    links,
    discovery: nodes.map((_, i) => i),
    attackPath: [...route(5, 3), ...route(3, 4).slice(1)],
  };
}
