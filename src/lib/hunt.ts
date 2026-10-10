/**
 * Site-wide "Threat Hunt": five hidden vulnerabilities to find. Progress is kept in storage
 * (localStorage in the browser). Storage is injected so the logic is testable and survives
 * browsers where storage is blocked.
 */
export const HUNT_ITEMS = [
  'debug-flag',
  'open-port',
  'stale-dependency',
  'default-creds',
  'exposed-backup',
] as const;
export type HuntItem = (typeof HUNT_ITEMS)[number];
export const STORAGE_KEY = 'ht-hunt-v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isHuntItem(x: unknown): x is HuntItem {
  return typeof x === 'string' && (HUNT_ITEMS as readonly string[]).includes(x);
}

/** Parse stored progress defensively: bad JSON, wrong types, unknown ids and duplicates are dropped. */
export function parseFound(raw: string | null): HuntItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return HUNT_ITEMS.filter((id) => data.includes(id));
  } catch {
    return [];
  }
}

export interface FindResult {
  /** False for duplicate or unknown ids. */
  isNew: boolean;
  count: number;
  complete: boolean;
}

export function createHunt(storage: StorageLike | null) {
  let memory: HuntItem[] | null = null;
  let storageAvailable = storage !== null;

  const read = (): HuntItem[] => {
    try {
      if (storageAvailable && storage) {
        memory = parseFound(storage.getItem(STORAGE_KEY));
        return memory;
      }
    } catch {
      storageAvailable = false;
    }
    return memory ?? [];
  };
  const write = (items: HuntItem[]) => {
    memory = items;
    try {
      if (storageAvailable) storage?.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Reads can still succeed after a write fails. Stop reading stale saved progress.
      storageAvailable = false;
    }
  };

  return {
    found: (): HuntItem[] => read(),
    count: (): number => read().length,
    isComplete: (): boolean => read().length === HUNT_ITEMS.length,
    find(id: string): FindResult {
      const current = read();
      if (!isHuntItem(id) || current.includes(id)) {
        return {
          isNew: false,
          count: current.length,
          complete: current.length === HUNT_ITEMS.length,
        };
      }
      const next = HUNT_ITEMS.filter((x) => x === id || current.includes(x));
      write(next);
      return { isNew: true, count: next.length, complete: next.length === HUNT_ITEMS.length };
    },
    reset(): void {
      memory = [];
      try {
        if (storageAvailable) storage?.removeItem(STORAGE_KEY);
      } catch {
        storageAvailable = false;
      }
    },
  };
}

export type Hunt = ReturnType<typeof createHunt>;
