import type { Scramble, ScrambleEntry } from './scramble';

const DEFAULT_INK = '#0b1220';
const DEFAULT_MUTED = '#475569';
const DEFAULT_MONO = "'Courier New', Courier, monospace";
const DEFAULT_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';

/** Spread a word's letters with a fixed gap so the scrambled and blank
 *  segments line up nicely under a monospace font. Returns the string actually
 *  drawn (e.g. "O I L N"). */
function spaced(word: string): string {
  return word.split('').join(' ');
}

function blanksFor(len: number): string {
  return new Array(len).fill('_').join(' ');
}

function answerSpaced(answer: string): string {
  // Same visual rhythm as blanksFor — each letter sits where an underscore
  // would, with single-space gaps.
  return answer.split('').join(' ');
}

/** Render a single scramble puzzle page (title + numbered entries) to a
 *  fresh white canvas suitable for PDF/PNG export. */
export function renderScramblePage(
  scramble: Scramble,
  cell: number,
  title: string,
  opts: { answerKey?: boolean; theme?: string } = {},
): HTMLCanvasElement {
  const entries = scramble.entries;
  const lineFs = Math.round(cell * 0.6);
  const lineH = Math.round(cell * 1.5);
  const titleH = Math.max(48, cell * 2.4);
  const subH = Math.round(cell * 1.1);
  const padX = Math.round(cell * 1.2);
  const padBottom = Math.round(cell * 1.2);

  // Canvas width sized to the longest line we'll draw, plus padding. We pick
  // a generous width so 9-letter scrambled + 9-letter blanks + hint fits.
  const targetWidth = Math.round(cell * 18);
  const width = Math.max(targetWidth, padX * 2 + cell * 12);
  const height = titleH + subH + entries.length * lineH + padBottom;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Title.
  const ts = Math.max(22, Math.min(40, cell * 1.4));
  ctx.fillStyle = DEFAULT_INK;
  ctx.font = `bold ${ts}px ${DEFAULT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, titleH * 0.55);

  // Subtitle showing the theme.
  if (opts.theme) {
    const subFs = Math.max(13, Math.round(cell * 0.42));
    ctx.fillStyle = DEFAULT_MUTED;
    ctx.font = `${subFs}px ${DEFAULT_SANS}`;
    ctx.fillText(
      `(theme: ${opts.theme})`,
      width / 2,
      titleH + subH * 0.35,
    );
  }

  // Each entry: "1.  O I L N    __ __ __ __    (hint: Animal)"
  ctx.fillStyle = DEFAULT_INK;
  ctx.font = `bold ${lineFs}px ${DEFAULT_MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const baseY = titleH + subH;
  // Fixed columns. Numbers right-aligned in their gutter, scrambled letters
  // left-aligned in the next, blanks aligned to a fixed column so they line
  // up vertically across all rows. The hint is right-aligned at the page
  // edge.
  const numColRight = padX + Math.round(cell * 1.0);
  const scramX = numColRight + Math.round(cell * 0.6);
  const blanksX = scramX + Math.round(cell * 7.6);
  const hintRight = width - padX;

  // Hint uses a slightly smaller sans label so it visually separates from
  // the puzzle letters.
  const hintFs = Math.max(13, Math.round(cell * 0.42));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const y = baseY + i * lineH + lineH / 2;

    // Number, right-aligned to the gutter.
    ctx.textAlign = 'right';
    ctx.font = `bold ${lineFs}px ${DEFAULT_MONO}`;
    ctx.fillStyle = DEFAULT_INK;
    ctx.fillText(`${i + 1}.`, numColRight, y);

    // Scrambled letters.
    ctx.textAlign = 'left';
    ctx.fillStyle = DEFAULT_INK;
    ctx.fillText(spaced(entry.scrambled), scramX, y);

    // Blanks (or answer letters in the answer key).
    if (opts.answerKey) {
      ctx.fillText(answerSpaced(entry.answer), blanksX, y);
    } else {
      ctx.fillText(blanksFor(entry.answer.length), blanksX, y);
    }

    // Hint, right-aligned, sans label.
    ctx.textAlign = 'right';
    ctx.fillStyle = DEFAULT_MUTED;
    ctx.font = `${hintFs}px ${DEFAULT_SANS}`;
    ctx.fillText(`(hint: ${entry.hint})`, hintRight, y);
  }

  return canvas;
}

/** Convenience: list every answer word from a scramble (used by ZIP export
 *  filenames or wherever a flat word list is handy). */
export function answersOf(scramble: Scramble): string[] {
  return scramble.entries.map((e: ScrambleEntry) => e.answer);
}
