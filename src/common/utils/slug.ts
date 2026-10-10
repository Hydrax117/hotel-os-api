export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
