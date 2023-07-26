const TOKENS = new Map<string, any>();
let ctr = 1;

export function tokenToString(x: any): string {
  if (typeof x === 'string') {
    return x;
  }

  const token = `\${Token${ctr++}}`;
  TOKENS.set(token, x);
  return token;
}

export function deepResolve(x: any): any {
  if (typeof x === 'string') {
    return fromString(x);
  }
  if (Array.isArray(x)) {
    return x.map(deepResolve);
  }
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(
      ([k, v]) => [k, deepResolve(v)]));
  }
  return x;
}

export function fromString(x: string): any {
  const found = TOKENS.get(x);
  return found !== undefined ? found : x;
}