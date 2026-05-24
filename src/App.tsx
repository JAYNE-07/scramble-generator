import { useCallback, useEffect, useRef, useState } from 'react';
import { renderScramblePage } from './lib/render';
import { CANONICAL_KEYWORDS } from './lib/themes';
import {
  exportBookPdf,
  exportBookZip,
  generateBatch,
  type AnswerLayout,
  type BookPuzzle,
  type PageSize,
} from './lib/book';

type Status = 'idle' | 'loading' | 'ready' | 'error';
interface Progress {
  label: string;
  done: number;
  total: number;
}

const titleCase = (s: string) =>
  s.trim().replace(/\b\w/g, (m) => m.toUpperCase());

export default function App() {
  const [keyword, setKeyword] = useState('animals');
  const [count, setCount] = useState(50);
  const [entriesPerPuzzle, setEntriesPerPuzzle] = useState(12);
  const [pageSize, setPageSize] = useState<PageSize>('6x9');
  const [answerLayout, setAnswerLayout] = useState<AnswerLayout>('end');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [book, setBook] = useState<BookPuzzle[]>([]);
  const [page, setPage] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const seedRef = useRef(1);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const current = book[page] ?? null;
  const busy = progress !== null || status === 'loading';

  const generate = useCallback(async () => {
    const theme = keyword.trim();
    if (!theme || busy) return;
    setStatus('loading');
    setError('');
    setWarnings([]);
    setBook([]);
    setProgress({ label: 'Building puzzles', done: 0, total: count });
    seedRef.current = Math.floor(Math.random() * 1e9);
    try {
      const { book: list, warnings: warns } = await generateBatch(
        theme,
        seedRef.current,
        count,
        { entriesPerPuzzle },
        (done, total) =>
          setProgress({ label: 'Building puzzles', done, total }),
      );
      setBook(list);
      setWarnings(Array.from(new Set(warns)).slice(0, 5));
      setPage(0);
      setShowAnswer(false);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setProgress(null);
    }
  }, [keyword, busy, count, entriesPerPuzzle]);

  // Draw the current puzzle into the preview canvas.
  useEffect(() => {
    if (!current || !previewRef.current) return;
    const cv = previewRef.current;
    const src = renderScramblePage(
      current.puzzle,
      28,
      `${showAnswer ? 'Answer' : 'Puzzle'} ${page + 1}`,
      { answerKey: showAnswer, theme: titleCase(keyword) },
    );
    cv.width = src.width;
    cv.height = src.height;
    const ctx = cv.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
  }, [current, page, showAnswer, keyword]);

  const flip = (d: number) => {
    setPage((p) => Math.min(book.length - 1, Math.max(0, p + d)));
    setShowAnswer(false);
  };

  const download = (data: string, filename: string) => {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
  };

  const runExport = async (kind: 'pdf' | 'zip') => {
    if (busy || !book.length) return;
    const label = kind === 'pdf' ? 'Building PDF book' : 'Zipping PNGs';
    setProgress({ label, done: 0, total: book.length * (kind === 'pdf' ? 2 : 1) });
    try {
      const cb = (d: number, t: number) => setProgress({ label, done: d, total: t });
      if (kind === 'pdf') await exportBookPdf(book, keyword, pageSize, cb, answerLayout);
      else await exportBookZip(book, keyword, cb);
    } finally {
      setProgress(null);
    }
  };

  const slug = keyword.trim().replace(/\s+/g, '-').toLowerCase() || 'scramble';
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  const entryCount = current?.puzzle.entries.length ?? 0;

  return (
    <div className="app">
      <header>
        <h1>Theme Word Scramble Generator</h1>
        <p className="sub">
          One keyword → a whole book of themed word-scramble puzzles. No sign-up.
        </p>
      </header>

      <div className="panel">
        <div className="row">
          <select
            className="keyword-select"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          >
            {CANONICAL_KEYWORDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <label className="num">
            Puzzles
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))
              }
            />
          </label>
          <label className="num">
            Entries / puzzle
            <input
              type="number"
              min={6}
              max={20}
              value={entriesPerPuzzle}
              onChange={(e) =>
                setEntriesPerPuzzle(
                  Math.max(6, Math.min(20, Number(e.target.value) || 12)),
                )
              }
            />
          </label>
          <button className="primary" onClick={generate} disabled={busy}>
            {busy ? 'Working…' : 'Generate book'}
          </button>
        </div>

        <div className="row">
          <label className="sel">
            Page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
            >
              <option value="6x9">6 × 9 in</option>
              <option value="5x8">5 × 8 in</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label className="sel">
            Answers
            <select
              value={answerLayout}
              onChange={(e) => setAnswerLayout(e.target.value as AnswerLayout)}
            >
              <option value="end">All at the back</option>
              <option value="interleaved">After each puzzle</option>
            </select>
          </label>
        </div>

        <p className="note">
          General words expand per puzzle (e.g. <em>animals</em> → cat, dog,
          rat…). Each entry is one theme word with its letters scrambled, plus
          blanks for the answer and a short hint.{' '}
          <a href="./keywords.csv" download>
            Download the full 165-keyword list (CSV)
          </a>
          .
        </p>

        {book.length > 0 && (
          <div className="row actions">
            <button onClick={generate} disabled={busy}>
              New shuffle
            </button>
            <button onClick={() => setShowAnswer((s) => !s)} disabled={busy}>
              {showAnswer ? 'Hide answer' : 'Show answer'}
            </button>
            <span className="spacer" />
            <button onClick={() => runExport('pdf')} disabled={busy}>
              Download PDF book
            </button>
            <button onClick={() => runExport('zip')} disabled={busy}>
              Download PNGs (.zip)
            </button>
            <button
              disabled={busy}
              onClick={() =>
                current &&
                download(
                  renderScramblePage(
                    current.puzzle,
                    90,
                    `${showAnswer ? 'Answer' : 'Puzzle'} ${page + 1}`,
                    { answerKey: showAnswer, theme: titleCase(keyword) },
                  ).toDataURL('image/png'),
                  `${slug}-${showAnswer ? 'answer' : 'puzzle'}-${page + 1}.png`,
                )
              }
            >
              This page PNG
            </button>
          </div>
        )}
      </div>

      {progress && (
        <div className="progress">
          <div className="bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <small>
            {progress.label}: {progress.done} / {progress.total} ({pct}%)
          </small>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {warnings.length > 0 && (
        <div className="error" style={{ background: '#1d2540', borderColor: '#3b4d80', color: '#ffd58a' }}>
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {status === 'loading' && !progress && (
        <div className="stage loadingbox">
          <div className="spinner" />
          <p>Building "{keyword.trim()}" puzzles…</p>
        </div>
      )}

      {current && (
        <>
          <div className="pager">
            <button onClick={() => flip(-1)} disabled={page === 0 || busy}>
              ‹ Prev
            </button>
            <span>
              Puzzle <strong>{page + 1}</strong> of {book.length}
            </span>
            <button
              onClick={() => flip(1)}
              disabled={page === book.length - 1 || busy}
            >
              Next ›
            </button>
          </div>
          <div className="stage">
            <div
              className="page-frame"
              style={{
                aspectRatio:
                  pageSize === '5x8'
                    ? '5 / 8'
                    : pageSize === '6x9'
                    ? '6 / 9'
                    : '210 / 297',
              }}
            >
              <h2 className="maze-title">
                {showAnswer ? 'Answer' : 'Puzzle'} {page + 1}
              </h2>
              <div className="maze-fit">
                <div className="canvas-wrap">
                  <canvas ref={previewRef} className="maze" />
                </div>
              </div>
            </div>
          </div>
          <div className="status">
            {entryCount} entr{entryCount === 1 ? 'y' : 'ies'}
            <span className="src">
              {book.length} puzzle{book.length === 1 ? '' : 's'} · theme: {titleCase(keyword)}
            </span>
          </div>
        </>
      )}

      {status === 'idle' && (
        <div className="stage hint">
          <p>Pick a theme word and a count, then "Generate book".</p>
        </div>
      )}
    </div>
  );
}
