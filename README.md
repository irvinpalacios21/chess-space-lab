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

The casual board ends draws automatically on threefold repetition or the fifty-move threshold. It does not provide tournament draw-claim, clock, resignation, or online multiplayer workflows.

## Verification

```sh
npm test
npx playwright test
```

Browser checks start a local server at port 4173 and use installed Microsoft Edge. To use a Playwright-managed Chromium instead, remove `channel: 'msedge'` from `playwright.config.js` and install it with `npx playwright install chromium`.

Rules library: [chess.js 1.4.0](https://github.com/jhlywa/chess.js), BSD-2-Clause. Its license is included in `dist/vendor/`. Piece illustrations are SVGs authored for this app. No engine or telemetry is included.
