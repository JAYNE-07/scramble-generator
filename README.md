# Theme Word Scramble Generator

Generate printable word-scramble (anagram) puzzle books in any theme — type a
keyword (`animals`, `food`, `vehicles`, `space`…), get a book of 1–500 puzzles
where every page is a different on-theme word list, jumbled letter by letter.

Themes share the same 165-keyword dictionary as the [maze book generator](https://jayne-07.github.io/maze-generator/)
and [word-search generator](https://jayne-07.github.io/wordsearch-generator/).
In-browser PDF/PNG/ZIP export. Pages sized for 5×8″, 6×9″, or A4 trim.
Answer-key pages at the back of the book.

**Live site:** https://jayne-07.github.io/scramble-generator/

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173/
npm run build    # production bundle in dist/
npm run preview  # preview the production build
```

## Defaults

- 12 scrambled entries per puzzle (configurable, min 6, max 20)
- Each entry: shuffled letters + answer blanks + a short hint
- Source words are 4-9 letters (trivial-or-crowded outside that range)
