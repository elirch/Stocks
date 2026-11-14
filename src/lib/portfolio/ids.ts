let counter = 0;

/** Local, non-secret row ids. Unique within a browser session. */
export function makeId(): string {
  counter += 1;
  return `h${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
