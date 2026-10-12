# Chess Space Lab

A chess board for exploring attacked and defended squares, without engine evaluations. Play both sides with standard legal moves, castling, en passant, promotion, check and game-end detection.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run vendor
npm run dev
```

Open http://localhost:4173. The browser app in `dist/` is static and includes the chess.js rules library and fonts, so it works without a runtime server beyond static hosting or external network requests.

## How control is counted

Each side's count is the union of all attacked squares. Pawn attacks are diagonal. Sliding pieces include the first occupied square and stop there. Friendly occupied squares count as defended. Pinned pieces and king adjacency count as attacks even when moving there would be illegal. Shared squares count for each side. Percentages divide by 64 and need not add to 100%.

The individual-piece calculation is in `dist/control.js`. Its union is tested against chess.js `isAttacked` for every square and both colors across example and generated positions. These maps describe attacks, not legal mobility or position strength.

Click or tap a piece, then a legal destination. Desktop dragging and keyboard navigation are supported. Inspect either side, switch overlays, show attacker intensity, flip the board, visit earlier positions, undo, import FEN/PGN, and export PGN. Games and display settings are saved in browser local storage. Playing a move from history creates a continuation and replaces future moves.

Choose Blue / amber, Teal / rose, or Violet / green under Control colors. The board, legend, statistics, and piece reach use the same palette. Striped squares indicate control by both sides. Desktop screens use three columns with a board sized to the viewport height and a separately scrolling move history. Smaller screens stack the panels.

The Exchange inspector is independent of piece selection. Hover, focus, or tap a square to compare each side's controlling pieces, then pin it to keep the square visible. Show details lists the attackers and a legal capture line. The control edge counts attackers; the exchange estimate measures material in pawn units with pawn 1, knight/bishop 3, rook 5, queen 9.

Exchange analysis evaluates the best initial capture by the actual side to move, followed by legal recaptures on the same square. Either side may stop recapturing when a legal move elsewhere is available. The calculation accounts for pins, king safety, revealed attackers, promotion, and en passant. It does not evaluate moves or tactics elsewhere, so it is a local material estimate rather than a position score. Friendly occupied squares and empty squares without en passant do not get a capture estimate. Analysis runs in a bounded background worker and reports incomplete searches without a partial score.

The casual board ends draws automatically on threefold repetition or the fifty-move threshold. It does not provide tournament draw-claim, clock, resignation, or online multiplayer workflows.

## Verification

```sh
npm test
npx playwright test
```

Browser checks start a local server at port 4173 and use installed Microsoft Edge. To use a Playwright-managed Chromium instead, remove `channel: 'msedge'` from `playwright.config.js` and install it with `npx playwright install chromium`.

Rules library: [chess.js 1.4.0](https://github.com/jhlywa/chess.js), BSD-2-Clause. Its license is included in `dist/vendor/`. Piece illustrations are SVGs authored for this app. No engine or telemetry is included.
