import { describe, expect, it } from 'vitest';
import { HUNT_ITEMS, STORAGE_KEY, createHunt, parseFound, type StorageLike } from '@/lib/hunt';
import { nextSteps } from '@/lib/nextStep';

function memoryStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

describe('hunt state', () => {
  it('starts empty', () => {
    const h = createHunt(memoryStorage());
    expect(h.count()).toBe(0);
    expect(h.isComplete()).toBe(false);
  });
  it('records finds and persists them', () => {
    const s = memoryStorage();
    const h = createHunt(s);
    expect(h.find('open-port')).toEqual({ isNew: true, count: 1, complete: false });
    expect(JSON.parse(s.data[STORAGE_KEY]!)).toEqual(['open-port']);
    // A new session reads the same progress.
    expect(createHunt(s).found()).toEqual(['open-port']);
  });
  it('ignores duplicates and unknown ids', () => {
    const h = createHunt(memoryStorage());
    h.find('debug-flag');
    expect(h.find('debug-flag')).toEqual({ isNew: false, count: 1, complete: false });
    expect(h.find('not-a-thing')).toEqual({ isNew: false, count: 1, complete: false });
    expect(h.count()).toBe(1);
  });
  it('completes after all five, in any order', () => {
    const h = createHunt(memoryStorage());
    let last;
    for (const id of [...HUNT_ITEMS].reverse()) last = h.find(id);
    expect(last).toEqual({ isNew: true, count: 5, complete: true });
    expect(h.isComplete()).toBe(true);
    expect(h.found()).toEqual([...HUNT_ITEMS]);
  });
  it('resets', () => {
    const s = memoryStorage();
    const h = createHunt(s);
    h.find('open-port');
    h.reset();
    expect(h.count()).toBe(0);
    expect(s.data[STORAGE_KEY]).toBeUndefined();
  });
  it('survives corrupt stored data', () => {
    for (const bad of ['not json', '{"a":1}', '"str"', '[1,2,"x"]', 'null']) {
      expect(parseFound(bad)).toEqual([]);
    }
    expect(parseFound('["open-port","open-port","bogus","debug-flag"]')).toEqual([
      'debug-flag',
      'open-port',
    ]);
    expect(createHunt(memoryStorage({ [STORAGE_KEY]: '%%%' })).count()).toBe(0);
  });
  it('works when storage throws or is missing', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [throwing, null]) {
      const h = createHunt(storage);
      expect(h.find('open-port').isNew).toBe(true);
      expect(h.find('open-port').isNew).toBe(false);
      expect(h.count()).toBe(1);
      h.reset();
      expect(h.count()).toBe(0);
    }
  });
  it('keeps session progress when storage can be read but writes fail', () => {
    const stored = memoryStorage({ [STORAGE_KEY]: '["debug-flag"]' });
    const h = createHunt({
      ...stored,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(h.count()).toBe(1);
    expect(h.find('open-port').count).toBe(2);
    expect(h.found()).toEqual(['debug-flag', 'open-port']);
    expect(h.find('open-port').isNew).toBe(false);
    h.reset();
    expect(h.count()).toBe(0);
    expect(h.find('default-creds').count).toBe(1);
  });
});

describe('next steps', () => {
  const pages = [
    '/',
    '/solutions/',
    '/solutions/consulting/',
    '/solutions/audit/',
    '/solutions/soc/',
    '/experience/',
    '/experience/scenarios/x/',
    '/blog/',
    '/blog/post/',
    '/resources/',
    '/about/',
    '/careers/',
    '/careers/job/',
    '/contact/',
    '/unknown/',
  ];
  it('gives one or two targets for every page, never the page itself', () => {
    for (const p of pages) {
      const steps = nextSteps(p);
      expect(steps.length, p).toBeGreaterThanOrEqual(1);
      expect(steps.length, p).toBeLessThanOrEqual(2);
      expect(
        steps.map((s) => s.path),
        p,
      ).not.toContain(p);
    }
  });
  it('points service pages along the journey', () => {
    expect(nextSteps('/solutions/consulting/')[0]!.path).toBe('/solutions/audit/');
    expect(nextSteps('/solutions/audit/')[0]!.path).toBe('/solutions/soc/');
  });
});
