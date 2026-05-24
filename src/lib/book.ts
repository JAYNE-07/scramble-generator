import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { buildScramble, type Scramble } from './scramble';
import { renderScramblePage } from './render';
import { wordsForTheme } from './themes';

export type PageSize = 'a4' | '5x8' | '6x9';

export interface BookPuzzle {
  puzzle: Scramble;
  /** Title shown on the puzzle/answer page (e.g. "Puzzle 1"). */
  index: number;
}

const PAGE_FORMATS: Record<PageSize, 'a4' | [number, number]> = {
  a4: 'a4',
  '5x8': [5 * 72, 8 * 72],
  '6x9': [6 * 72, 9 * 72],
};

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const slugify = (s: string) =>
  s.trim().replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') ||
  'scramble';

const titleCase = (s: string) =>
  s.trim().replace(/\b\w/g, (m) => m.toUpperCase());

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface BatchOpts {
  entriesPerPuzzle?: number;
}

/** Tiny seeded shuffle used to mix the deck on each wrap. */
function shuffleInPlace<T>(arr: T[], seed: number) {
  let s = (seed >>> 0) || 1;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Build `count` scramble puzzles for a theme. Each puzzle gets its own seeded
 * letter-shuffle and a unique slice of the shared word deck so no word
 * repeats inside one page, and the full pool is used before any word repeats
 * across pages.
 */
export async function generateBatch(
  theme: string,
  baseSeed: number,
  count: number,
  opts: BatchOpts = {},
  onProgress?: (done: number, total: number) => void,
): Promise<{ book: BookPuzzle[]; warnings: string[] }> {
  const entriesPerPuzzle = opts.entriesPerPuzzle ?? 12;
  const book: BookPuzzle[] = [];
  const warnings: string[] = [];

  // Pool of theme words sized 4-9 letters (scramble's sweet spot).
  // wordsForTheme(theme, n, seed, maxLen, minLen).
  const fullPool = wordsForTheme(
    theme,
    1e9,
    ((baseSeed + 0x9e3779b9) >>> 0) || 1,
    9,
    4,
  );
  const totalNeeded = count * entriesPerPuzzle;
  const deck: string[] = [];
  let passSeed = (baseSeed >>> 0) || 1;
  while (deck.length < totalNeeded && fullPool.length > 0) {
    const oneDeck = [...fullPool];
    shuffleInPlace(oneDeck, passSeed);
    deck.push(...oneDeck);
    passSeed = ((passSeed * 16807) >>> 0) || 1;
  }

  if (fullPool.length === 0) {
    warnings.push(
      `No usable 4-9 letter words for "${theme}". Try a different keyword.`,
    );
  }

  for (let i = 0; i < count; i++) {
    const scrambleSeed = ((baseSeed ^ (i * 2654435761)) >>> 0) || 7;
    let words = deck.slice(i * entriesPerPuzzle, (i + 1) * entriesPerPuzzle);
    if (new Set(words).size < words.length) {
      const unique = Array.from(new Set(words));
      for (const w of fullPool) {
        if (unique.length >= entriesPerPuzzle) break;
        if (!unique.includes(w)) unique.push(w);
      }
      words = unique.slice(0, entriesPerPuzzle);
    }
    if (words.length < entriesPerPuzzle) {
      warnings.push(
        `Puzzle ${i + 1}: only ${words.length}/${entriesPerPuzzle} usable words for "${theme}".`,
      );
    }
    const puzzle = buildScramble(words, theme, scrambleSeed);
    book.push({ puzzle, index: i });
    onProgress?.(i + 1, count);
    if ((i + 1) % 5 === 0) await tick();
  }

  return { book, warnings };
}

function placeCanvas(pdf: jsPDF, canvas: HTMLCanvasElement) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = Math.max(28, pw * 0.06);
  const availW = pw - margin * 2;
  const availH = ph - margin * 2;
  const scale = Math.min(availW / canvas.width, availH / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const x = (pw - w) / 2;
  const y = (ph - h) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h, undefined, 'FAST');
}

export type AnswerLayout = 'interleaved' | 'end';

export async function exportBookPdf(
  book: BookPuzzle[],
  theme: string,
  pageSize: PageSize,
  onProgress: (done: number, total: number) => void,
  answerLayout: AnswerLayout = 'end',
) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: PAGE_FORMATS[pageSize],
  });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const name = titleCase(theme);
  // High render-resolution per cell. The PDF placeCanvas() downsizes to
  // fit the page, so a big source canvas guarantees crisp letters at
  // print (300 DPI) and on retina screens.
  const CELL = pageSize === '5x8' ? 72 : pageSize === '6x9' ? 80 : 88;

  // Cover page (jsPDF starts with one blank page).
  const coverTitle = Math.min(52, pw * 0.11);
  const coverSub = Math.min(16, pw * 0.038);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(coverTitle);
  pdf.text(`${name.toUpperCase()}`, pw / 2, ph * 0.4, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(Math.min(28, pw * 0.07));
  pdf.text('WORD SCRAMBLE', pw / 2, ph * 0.4 + coverTitle * 0.95, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(coverSub);
  pdf.text(
    `${book.length} puzzles  ·  ${
      answerLayout === 'interleaved'
        ? 'answer follows each puzzle'
        : 'answer key at the back'
    }`,
    pw / 2,
    ph * 0.4 + coverTitle * 0.95 + coverSub * 2.4,
    { align: 'center' },
  );

  const total = book.length * 2;
  let done = 0;
  const fmt = PAGE_FORMATS[pageSize];

  if (answerLayout === 'interleaved') {
    for (let i = 0; i < book.length; i++) {
      const { puzzle } = book[i];
      pdf.addPage(fmt, 'portrait');
      placeCanvas(
        pdf,
        renderScramblePage(puzzle, CELL, `Puzzle ${i + 1}`, { theme: name }),
      );
      done++;
      onProgress(done, total);
      pdf.addPage(fmt, 'portrait');
      placeCanvas(
        pdf,
        renderScramblePage(puzzle, CELL, `Answer ${i + 1}`, {
          answerKey: true,
          theme: name,
        }),
      );
      done++;
      onProgress(done, total);
      if (i % 4 === 0) await tick();
    }
  } else {
    for (let i = 0; i < book.length; i++) {
      const { puzzle } = book[i];
      pdf.addPage(fmt, 'portrait');
      placeCanvas(
        pdf,
        renderScramblePage(puzzle, CELL, `Puzzle ${i + 1}`, { theme: name }),
      );
      done++;
      onProgress(done, total);
      if (i % 4 === 0) await tick();
    }
    pdf.addPage(fmt, 'portrait');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.min(36, pw * 0.08));
    pdf.text('ANSWER KEY', pw / 2, ph * 0.5, { align: 'center' });
    for (let i = 0; i < book.length; i++) {
      const { puzzle } = book[i];
      pdf.addPage(fmt, 'portrait');
      placeCanvas(
        pdf,
        renderScramblePage(puzzle, CELL, `Answer ${i + 1}`, {
          answerKey: true,
          theme: name,
        }),
      );
      done++;
      onProgress(done, total);
      if (i % 4 === 0) await tick();
    }
  }

  pdf.save(`${slugify(theme)}-scramble-book-${pageSize}.pdf`);
}

export async function exportBookZip(
  book: BookPuzzle[],
  theme: string,
  onProgress: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const puzzleDir = zip.folder('puzzles')!;
  const answerDir = zip.folder('answers')!;
  const pad = (n: number) => String(n).padStart(3, '0');
  const CELL = 90;
  const name = titleCase(theme);

  for (let i = 0; i < book.length; i++) {
    const { puzzle } = book[i];
    const q = renderScramblePage(puzzle, CELL, `Puzzle ${i + 1}`, {
      theme: name,
    })
      .toDataURL('image/png')
      .split(',')[1];
    const a = renderScramblePage(puzzle, CELL, `Answer ${i + 1}`, {
      answerKey: true,
      theme: name,
    })
      .toDataURL('image/png')
      .split(',')[1];
    puzzleDir.file(`puzzle-${pad(i + 1)}.png`, q, { base64: true });
    answerDir.file(`answer-${pad(i + 1)}.png`, a, { base64: true });
    onProgress(i + 1, book.length);
    if (i % 3 === 0) await tick();
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
  });
  saveBlob(blob, `${slugify(theme)}-scramble-book.zip`);
}
