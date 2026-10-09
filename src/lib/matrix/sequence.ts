const keys = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];
export function createKonami() {
  let recent: string[] = [];
  return {
    push(key: string, code = '') {
      const value =
        /^Key[AB]$/.test(code) && !/^[ab]$/i.test(key)
          ? code.slice(3).toLowerCase()
          : key.length === 1
            ? key.toLowerCase()
            : key;
      recent.push(value);
      while (recent.length && !keys.slice(0, recent.length).every((v, i) => v === recent[i]))
        recent.shift();
      if (recent.length !== keys.length) return false;
      recent = [];
      return true;
    },
    reset() {
      recent = [];
    },
  };
}
export function createTapCounter({ count = 5, windowMs = 3000, now = Date.now } = {}) {
  let start = -Infinity,
    taps = 0;
  return {
    push() {
      const time = now();
      if (time - start > windowMs) {
        start = time;
        taps = 0;
      }
      taps++;
      const result = { activate: taps === count, prevent: taps > 1 };
      if (result.activate) {
        taps = 0;
        start = -Infinity;
      }
      return result;
    },
  };
}
