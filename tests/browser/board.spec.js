import { test, expect } from '@playwright/test';
const sq = (page,square) => page.locator(`[data-square="${square}"]`);
async function move(page,from,to) { await sq(page,from).click(); await sq(page,to).click(); }
async function load(page,fen) {
  await page.getByRole('button',{name:'Load FEN / PGN'}).click();
  await page.getByLabel('Paste a FEN position or PGN game').fill(fen);
  await page.getByRole('button',{name:'Load board',exact:true}).click();
  await expect(page.locator('#import-dialog')).not.toBeVisible();
}
test.beforeEach(async ({page}) => { await page.goto('/'); });

test('opening, individual reach, overlays, capture, undo, and persistence', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await expect(page.locator('.square')).toHaveCount(64);
  await expect(page.locator('#white-control-count')).toHaveText('22');
  await sq(page,'e2').click();
  await expect(sq(page,'d3')).toHaveClass(/reach/); await expect(sq(page,'e4')).toHaveClass(/legal/);
  await expect(sq(page,'e3')).not.toHaveClass(/reach/);
  await sq(page,'e5').click(); await expect(sq(page,'e2')).toHaveAttribute('data-piece','wp');
  await sq(page,'e4').click(); await expect(sq(page,'e4')).toHaveAttribute('data-piece','wp');
  await expect(page.locator('#piece-inspector')).toContainText('White pawn on e4');
  await expect(sq(page,'d5')).toHaveClass(/reach/);
  await move(page,'d7','d5'); await move(page,'e4','d5');
  await expect(page.locator('#piece-totals')).toHaveText('16 / 15');
  await page.getByRole('button',{name:'Undo the latest move'}).click();
  await expect(page.locator('#piece-totals')).toHaveText('16 / 16');
  await page.locator('[data-overlay="off"]').click(); await expect(page.locator('.control-w,.control-b,.control-shared')).toHaveCount(0);
  await page.locator('[data-overlay="both"]').click(); await page.locator('#intensity').check();
  await page.reload(); await expect(sq(page,'e4')).toHaveAttribute('data-piece','wp'); await expect(sq(page,'d5')).toHaveAttribute('data-piece','bp');
  await expect(page.locator('#intensity')).toBeChecked();
  await expect(page.locator('#move-history button')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('castling, en passant, and four promotion choices', async ({page}) => {
  await load(page,'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  await move(page,'e1','g1'); await expect(sq(page,'f1')).toHaveAttribute('data-piece','wr'); await expect(sq(page,'g1')).toHaveAttribute('data-piece','wk');
  await load(page,'4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  await move(page,'e5','d6'); await expect(sq(page,'d5')).toHaveAttribute('data-piece',''); await expect(sq(page,'d6')).toHaveAttribute('data-piece','wp');
  await expect(page.locator('#piece-totals')).toHaveText('2 / 1');
  for (const [name,key] of [['queen','q'],['rook','r'],['bishop','b'],['knight','n']]) {
    await load(page,'7k/P7/8/8/8/8/8/7K w - - 0 1');
    await move(page,'a7','a8'); await expect(page.locator('#promotion-dialog')).toBeVisible();
    await page.getByRole('button',{name:`Promote to ${name}`,exact:true}).click();
    await expect(sq(page,'a8')).toHaveAttribute('data-piece','w'+key);
  }
});
test('check rejects illegal moves and checkmate ends play', async ({page}) => {
  await load(page,'4r1k1/8/8/8/8/8/P7/4K3 w - - 0 1');
  await sq(page,'a2').click(); await expect(sq(page,'a3')).not.toHaveClass(/legal/);
  await sq(page,'a3').click(); await expect(sq(page,'a2')).toHaveAttribute('data-piece','wp');
  await expect(page.locator('#game-status')).toContainText('White is in check');
  await load(page,'1. f3 e5 2. g4 Qh4#');
  await expect(page.locator('#game-status')).toHaveText('Checkmate. Black wins.');
  await expect(page.locator('#move-history button')).toHaveCount(4);
  await sq(page,'e1').click(); await expect(page.locator('.legal')).toHaveCount(0);
});
test('history reconstructs counts and permits a new continuation', async ({page}) => {
  await load(page,'1. e4 d5 2. exd5 Qxd5');
  await expect(page.locator('#piece-totals')).toHaveText('15 / 15');
  await page.getByRole('button',{name:'Go to move 1, White e4'}).click();
  await expect(page.locator('#piece-totals')).toHaveText('16 / 16');
  await move(page,'e7','e5'); await expect(page.locator('#move-history button')).toHaveCount(2);
  await expect(page.locator('#move-history')).toContainText('e5');
  await page.locator('#first').click(); await expect(sq(page,'e2')).toHaveAttribute('data-piece','wp');
  await page.locator('#last').click(); await expect(sq(page,'e5')).toHaveAttribute('data-piece','bp');
});
test('invalid import preserves position; flipped board, drag and keyboard work', async ({page}) => {
  await page.locator('#flip').click(); await expect(page.locator('#board button').first()).toHaveAttribute('data-square','h1');
  await expect(page.locator('#top-player')).toHaveText('White');
  await sq(page,'e2').dragTo(sq(page,'e4')); await expect(sq(page,'e4')).toHaveAttribute('data-piece','wp');
  await page.locator('#import-position').click(); await page.locator('#position-input').fill('bad chess position'); await page.locator('#import-form button[type="submit"]').click();
  await expect(page.locator('#import-error')).not.toBeEmpty();
  await page.getByRole('button',{name:'Cancel import'}).click(); await expect(sq(page,'e4')).toHaveAttribute('data-piece','wp');
  await sq(page,'d7').focus(); await page.keyboard.press('ArrowRight'); await expect(sq(page,'c7')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#piece-inspector')).toContainText('Black pawn on c7');
});
test('small screens keep board and controls visible without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#board')).toBeVisible();
  await move(page,'e2','e4'); await expect(sq(page,'e4')).toHaveAttribute('data-piece','wp');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
