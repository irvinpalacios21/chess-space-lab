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
  await expect(page.locator('.header-note')).not.toBeVisible();
  await move(page,'e2','e4'); await expect(sq(page,'e4')).toHaveAttribute('data-piece','wp');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('desktop board, analysis, and long history fit the viewport', async ({page}) => {
  await load(page,'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 9. Nbd2 h6 10. Nf1 Be6 11. Bc2 d5 12. exd5 Qxd5 13. Be3 Bxe3 14. Nxe3 Qd6 15. Qe2 Rad8 16. Rad1 Rfe8 17. Bb1 Ne7 18. d4 exd4 19. Nxd4');
  await sq(page,'d4').click();
  await expect(page.locator('#exchange-outcome')).not.toHaveText('Checking captures…');
  for (const size of [{width:1912,height:910},{width:1440,height:900},{width:1366,height:768},{width:1280,height:720},{width:1100,height:700}]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width:size.width,height:size.height});
    for (const selector of ['#board','.board-toolbar','.board-legend','.analysis-panel','.game-panel','.exchange-section','.moves-section','.footer-note']) {
      const box=await page.locator(selector).first().boundingBox();
      expect(box.y+box.height,selector+' at '+size.width+'x'+size.height).toBeLessThanOrEqual(size.height);
    }
    const exchangeBox=await page.locator('.exchange-section').boundingBox(), detailBox=await page.locator('#exchange-detail-button').boundingBox();
    expect(detailBox.y+detailBox.height).toBeLessThanOrEqual(exchangeBox.y+exchangeBox.height);
    expect((await page.locator('#move-history').boundingBox()).height).toBeGreaterThanOrEqual(35);
    expect(await page.locator('#move-history').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  }
  await page.locator('#move-history').evaluate(el=>el.scrollTop=0);
  await page.getByRole('button',{name:'Go to move 1, White e4'}).click();
  await expect(page.locator('#position-label')).toHaveText('Move 1 of 37');
  await page.locator('#last').click();
  await expect(page.locator('#position-label')).toHaveText('Move 37 of 37');
  await page.screenshot({path:'artifacts/desktop-compact.png',fullPage:true});
});

test('exchange estimates preserve piece selection, show legal trades, and support pinning', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await load(page,'7k/8/8/2p5/3p4/2P1P3/8/K2Q4 w - - 0 1');
  await sq(page,'c3').click();
  await sq(page,'d4').hover();
  await expect(page.locator('#piece-inspector')).toContainText('White pawn on c3');
  await expect(page.locator('.square-control-edge')).toContainText('White +2 attackers');
  await expect(page.locator('#exchange-outcome')).toHaveText('White gains 1 pawn');
  await page.getByRole('button',{name:'Show details',exact:true}).click();
  await expect(page.locator('#exchange-dialog')).toBeVisible();
  await expect(page.locator('.white-attackers')).toContainText('Pawn c3');
  await expect(page.locator('.black-attackers')).toContainText('Pawn c5');
  await expect(page.locator('#exchange-dialog .capture-line li')).toHaveCount(3);
  await page.getByRole('button',{name:'Close exchange details'}).click();
  await page.getByRole('button',{name:'Pin d4',exact:true}).click();
  await page.setViewportSize({width:1912,height:910});
  await page.screenshot({path:'artifacts/exchange-inspector.png',fullPage:true});
  await sq(page,'h8').hover();
  await expect(page.locator('.inspected-square')).toContainText('d4');
  await expect(page.locator('#piece-inspector')).toContainText('White pawn on c3');
  await expect(sq(page,'d4')).toHaveClass(/pinned-square/);
  await page.locator('#flip').click();
  await expect(page.locator('#pin-square')).toHaveAttribute('aria-pressed','true');
  await sq(page,'d4').click();
  await expect(sq(page,'d4')).toHaveAttribute('data-piece','wp');
  await expect(page.locator('#exchange-outcome')).toHaveText('Even material exchange');
  await expect(page.locator('#exchange-scope')).toContainText('Black starts');
  await page.getByRole('button',{name:'Unpin d4',exact:true}).click();
  await sq(page,'h8').hover();
  await expect(page.locator('#exchange-outcome')).toHaveText('Kings cannot be captured');
  expect(errors).toEqual([]);
});

test('exchange inspector handles losing trades, pinned attackers, and empty squares', async ({page}) => {
  await load(page,'7k/8/8/2p5/R2p4/8/8/K2R4 w - - 0 1');
  await sq(page,'d4').hover();
  await expect(page.locator('.square-control-edge')).toContainText('White +1 attacker');
  await expect(page.locator('#exchange-outcome')).toHaveText('White loses 3 pawns');
  await load(page,'k3r3/8/8/8/8/3pR3/8/4K3 w - - 0 1');
  await sq(page,'d3').hover();
  await expect(page.locator('#exchange-outcome')).toHaveText('No legal capture');
  await sq(page,'a4').hover();
  await expect(page.locator('#exchange-outcome')).toHaveText('No piece to capture');
  await sq(page,'e3').hover();
  await expect(page.locator('#exchange-outcome')).toHaveText('Friendly piece');
});

test('touch and keyboard can inspect exchanges without relying on hover', async ({browser}) => {
  const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});
  const page=await context.newPage(); await page.goto('http://localhost:4173/');
  await load(page,'7k/8/8/2p5/3p4/2P1P3/8/K2Q4 w - - 0 1');
  await sq(page,'d4').tap();
  await expect(page.locator('#exchange-outcome')).toHaveText('White gains 1 pawn');
  await expect(page.locator('#piece-inspector')).toContainText('Black pawn on d4');
  await page.locator('#clear-selection').click();
  await sq(page,'e3').focus(); await page.keyboard.press('ArrowUp');
  await expect(sq(page,'e4')).toBeFocused();
  await expect(page.locator('.inspected-square')).toContainText('e4');
  await expect(page.locator('#exchange-outcome')).toHaveText('No piece to capture');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await context.close();
});

test('palettes update all control indicators and persist with the game', async ({page}) => {
  await load(page,'1. e4 e5 2. Nf3 Nc6 3. Bc4');
  for (const palette of ['blue-amber','teal-rose','violet-green']) {
    await page.getByLabel('Control colors').selectOption(palette);
    const colors=await page.evaluate(()=>{
      const color=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor;
      const overlay=selector=>getComputedStyle(document.querySelector(selector),'::before').backgroundColor;
      return {w:color('.white-control'),b:color('.black-control'),boardW:overlay('.control-w'),boardB:overlay('.control-b'),shared:getComputedStyle(document.querySelector('.control-shared'),'::before').backgroundImage};
    });
    expect(colors.w).not.toBe(colors.b);
    expect(colors.boardW).toBe(colors.w); expect(colors.boardB).toBe(colors.b);
    expect(colors.shared).toContain(colors.w); expect(colors.shared).toContain(colors.b);
    await page.reload();
    await expect(page.getByLabel('Control colors')).toHaveValue(palette);
    await expect(page.locator('#move-history button')).toHaveCount(5);
  }
  await page.getByLabel('Control colors').selectOption('blue-amber');
  await page.setViewportSize({width:1912,height:910});
  await page.screenshot({path:'artifacts/desktop-palettes.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/mobile-palettes.png',fullPage:true});
});
