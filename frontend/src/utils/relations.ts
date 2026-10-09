/**
 * PostgREST returns a joined row as an OBJECT when the relation is one-to-one (e.g. one inspection per collection)
 * and as an ARRAY when it is one-to-many. These helpers let pages handle both shapes safely.
 */
export function one<T>(v: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

export function many<T>(v: T | T[] | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}
