// Build word-scramble (anagram) puzzles. Each entry is a single word shuffled
// letter-by-letter via seeded Fisher-Yates. We re-shuffle on the unlucky case
// where the permutation matches the original word so the book never ships an
// already-solved puzzle.

export interface ScrambleEntry {
  scrambled: string;
  answer: string;
  hint: string;
}

export interface Scramble {
  entries: ScrambleEntry[];
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleString(word: string, rng: () => number): string {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

/** Capitalise + drop a single trailing 's' so "Animals" reads "Animal" as a
 *  short hint label. We only strip on words ending in a single 's' that aren't
 *  also 'ss' (e.g. "dress" -> stays "Dress"). */
function hintFor(theme: string): string {
  const t = theme.trim();
  if (!t) return 'Theme';
  const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  if (cap.length > 2 && cap.endsWith('s') && !cap.endsWith('ss')) {
    return cap.slice(0, -1);
  }
  return cap;
}

export function buildScramble(
  words: string[],
  theme: string,
  seed: number,
): Scramble {
  const rng = mulberry32(seed || 1);
  const hint = hintFor(theme);
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of words) {
    const w = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (w.length < 4 || w.length > 9) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    cleaned.push(w);
  }

  const entries: ScrambleEntry[] = [];
  for (const answer of cleaned) {
    // For very short words two letters might coincide naturally; cap retries
    // and accept whatever we have on the last attempt. With Fisher-Yates on
    // 4+ letters a non-trivial permutation is overwhelmingly likely.
    let scrambled = shuffleString(answer, rng);
    for (let attempt = 0; attempt < 10 && scrambled === answer; attempt++) {
      scrambled = shuffleString(answer, rng);
    }
    entries.push({ scrambled, answer, hint });
  }

  return { entries };
}
