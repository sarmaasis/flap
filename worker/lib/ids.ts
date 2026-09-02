export function randomId(prefix = ""): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${raw}` : raw;
}

export function nowMs(): number {
  return Date.now();
}
