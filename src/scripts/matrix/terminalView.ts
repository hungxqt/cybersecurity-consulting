export function terminalView(host: HTMLElement, reduced: () => boolean) {
  const lines: { element: HTMLElement; text: string; shown: number }[] = [];
  return {
    log(text: string) {
      const element = document.createElement('div');
      host.append(element);
      lines.push({ element, text, shown: 0 });
      if (lines.length > 100) lines.shift()!.element.remove();
    },
    tick(dt: number) {
      const follow = host.scrollHeight - host.scrollTop - host.clientHeight < 48;
      for (const line of lines) {
        line.shown = reduced()
          ? line.text.length
          : Math.min(line.text.length, line.shown + dt * 0.07);
        const text = line.text.slice(0, Math.floor(line.shown));
        if (line.element.textContent !== text) line.element.textContent = text;
      }
      if (follow) host.scrollTop = host.scrollHeight;
    },
    clear() {
      lines.length = 0;
      host.replaceChildren();
    },
  };
}
