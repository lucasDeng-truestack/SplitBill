const FIND_MIN_ITEMS = 8;

export function shouldOfferItemFind(count: number): boolean {
  return count >= FIND_MIN_ITEMS;
}

export function normalizeItemName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function itemMatchesQuery(name: string, query: string): boolean {
  const needle = normalizeItemName(query);
  if (!needle) return true;
  const hay = normalizeItemName(name);
  if (!hay) return false;
  if (hay.includes(needle) || needle.includes(hay)) return true;
  return needle.split(" ").every((token) => hay.split(" ").some((word) => tokenFitsWord(token, word)));
}

export function filterItemsByQuery<T extends { name: string }>(items: T[], query: string): T[] {
  if (!normalizeItemName(query)) return items;
  return items.filter((item) => itemMatchesQuery(item.name, query));
}

function tokenFitsWord(token: string, word: string): boolean {
  if (!token || !word) return false;
  if (word.includes(token) || token.includes(word)) return true;
  if (token.length >= 4 && word.length >= 4 && levenshtein(token, word) <= 1) return true;
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }
  return prev[b.length] ?? b.length;
}
