const commands = ['help', 'status', 'scan', 'pause', 'resume', 'replay', 'clear', 'exit'] as const;
export type Command = { type: (typeof commands)[number] | 'inspect' | 'unknown'; argument: string };
export function parseCommand(input: string): Command {
  const value = input.slice(0, 80).trim().replace(/\s+/g, ' ');
  const [name, argument = '', ...rest] = value.split(' ');
  const lower = name!.toLowerCase();
  if (lower === 'inspect' && /^[a-z]+-\d{2}$/i.test(argument) && !rest.length)
    return { type: 'inspect', argument: argument.toUpperCase() };
  if (commands.includes(lower as (typeof commands)[number]) && !argument)
    return { type: lower as (typeof commands)[number], argument: '' };
  return { type: 'unknown', argument: value };
}
export const HELP = 'help · status · scan · inspect <ID> · pause · resume · replay · clear · exit';
