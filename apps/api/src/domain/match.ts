export function normalizeItemName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }
  return prev[b.length] ?? b.length;
}

export type MatchableItem = { id: string; name: string };

export type ItemMatch = MatchableItem & {
  score: number;
  method: "exact" | "includes" | "fuzzy";
};

export function matchItems(query: string, items: MatchableItem[], limit = 5): ItemMatch[] {
  const needle = normalizeItemName(query);
  if (!needle) return [];

  const scored: ItemMatch[] = items.map((item) => {
    const hay = normalizeItemName(item.name);
    if (hay === needle) {
      return { ...item, score: 1, method: "exact" as const };
    }
    if (hay.includes(needle) || needle.includes(hay)) {
      return { ...item, score: 0.85, method: "includes" as const };
    }
    const distance = levenshtein(needle, hay);
    const maxLen = Math.max(needle.length, hay.length) || 1;
    const score = 1 - distance / maxLen;
    return { ...item, score, method: "fuzzy" as const };
  });

  return scored
    .filter((item) => item.method !== "fuzzy" || item.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
