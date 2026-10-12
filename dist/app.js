import { Chess } from './vendor/chess.js';
import { analyze, pieceControl, FILES, SQUARES, NAMES } from './control.js';
import { pieceSvg } from './pieces.js';
import { analyzeExchange, PIECE_VALUES } from './exchange.js';

const $ = id => document.getElementById(id);
const initialFen = new Chess().fen();
const storageKey = 'chess-space-lab-v1';
let game = new Chess(), startFen = initialFen, timeline = [], cursor = 0;
let flipped = false, overlay = 'both', intensity = false, selected = null, hovered = null, palette = 'blue-amber';
const palettes = ['blue-amber', 'teal-rose', 'violet-green'];
let analysis, pendingPromotion = null, dragFrom = null, toastTimeout;
let pinnedSquare = null, exchangeKey = null, exchangeResult = null, exchangeTimer, inspectTimer, exchangeWorker, exchangeBusy = false, exchangePending = null, exchangeActive = null;
const exchangeCache = new Map();
const colorName = color => color === 'w' ? 'White' : 'Black';
const titleCase = word => word[0].toUpperCase() + word.slice(1);

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').hidden = true, 3500);
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ startFen, moves:timeline.map(m=>m.san), cursor, flipped, overlay, intensity, palette })); }
  catch { /* The board remains usable when browser storage is unavailable. */ }
}
function buildTimeline(fen, moves) {
  const candidate = new Chess(fen), result = [];
  for (const move of moves) result.push(candidate.move(move));
  return result;
}
function restore() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (!data) return;
    const loaded = buildTimeline(data.startFen, data.moves);
    startFen = data.startFen; timeline = loaded; cursor = Math.max(0,Math.min(loaded.length,Number.isInteger(data.cursor)?data.cursor:loaded.length));
    flipped = !!data.flipped; overlay = ['both','w','b','off'].includes(data.overlay) ? data.overlay : 'both'; intensity = !!data.intensity;
    palette = palettes.includes(data.palette) ? data.palette : 'blue-amber';
    game = new Chess(startFen);
    for (const move of timeline.slice(0,cursor)) game.move(move.san);
  } catch { game = new Chess(); startFen = initialFen; timeline = []; cursor = 0; }
}
function orderedSquares() { return flipped ? [...SQUARES].reverse() : SQUARES; }
function createBoard() {
  $('board').replaceChildren();
  for (const square of orderedSquares()) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'square'; button.dataset.square = square;
    button.tabIndex = square === (flipped ? 'h1' : 'a1') ? 0 : -1;
    $('board').append(button);
  }
  $('rank-labels').innerHTML = (flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]).map(n=>`<span>${n}</span>`).join('');
  $('file-labels').innerHTML = (flipped ? [...FILES].reverse() : [...FILES]).map(n=>`<span>${n}</span>`).join('');
}
function renderBoard() {
  const reach = new Set(selected ? pieceControl(game,selected) : []);
  const selectedPiece = selected && game.get(selected);
  const legal = new Set(selectedPiece?.color === game.turn() && !game.isGameOver() ? game.moves({ square:selected, verbose:true }).map(m=>m.to) : []);
  const lastMove = cursor ? timeline[cursor-1] : null;
  for (const button of $('board').children) {
    const square = button.dataset.square, p = game.get(square);
    const white = analysis.control.w.get(square)?.length || 0, black = analysis.control.b.get(square)?.length || 0;
    const showW = white && ['both','w'].includes(overlay), showB = black && ['both','b'].includes(overlay);
    const classes = ['square'];
    if ((FILES.indexOf(square[0]) + +square[1]) % 2 === 1) classes.push('dark');
    if (showW && showB) classes.push('control-shared'); else if (showW) classes.push('control-w'); else if (showB) classes.push('control-b');
    if (selected === square) classes.push('selected');
    if (pinnedSquare === square) classes.push('pinned-square');
    if (reach.has(square)) classes.push('reach');
    if (legal.has(square)) classes.push('legal');
    if (p) classes.push('occupied');
    if (lastMove && [lastMove.from,lastMove.to].includes(square)) classes.push('last-move');
    if (p?.type === 'k' && p.color === game.turn() && game.isCheck()) classes.push('check');
    button.className = classes.join(' ');
    button.style.setProperty('--reach-color', selectedPiece?.color === 'b' ? 'var(--coral)' : 'var(--teal)');
    if (intensity && (showW || showB)) button.style.setProperty('--strength', Math.min(.9,.48+.09*(overlay==='w'?white:overlay==='b'?black:Math.max(white,black))));
    else button.style.removeProperty('--strength');
    const pieceKey = p ? p.color + p.type : '';
    if (button.dataset.piece !== pieceKey) { button.innerHTML = p ? pieceSvg(p) : ''; button.dataset.piece = pieceKey; }
    button.draggable = !!p && p.color === game.turn() && !game.isGameOver();
    button.setAttribute('aria-label', `${square}, ${p?colorName(p.color)+' '+NAMES[p.type]:'empty'}${white?', controlled by White':''}${black?', controlled by Black':''}${legal.has(square)?', legal destination':''}`);
    button.setAttribute('aria-pressed', String(selected === square));
  }
}
function renderAnalysis() {
  for (const [color,name] of [['w','white'],['b','black']]) {
    const count = analysis.control[color].size;
    $(name+'-control-count').textContent = count;
    $(name+'-percent').textContent = (count / 64 * 100).toFixed(1)+'% of board';
    $(name+'-meter').style.width = count / 64 * 100 + '%';
    $(name+'-center').textContent = analysis.center[color];
  }
  $('shared-count').textContent = analysis.shared.length;
  $('uncontrolled-count').textContent = analysis.untouched.length;
  $('piece-totals').textContent = analysis.pieces.w.total+' / '+analysis.pieces.b.total;
  $('piece-inventory').innerHTML = '<div class="inventory-header"><span></span><span>White</span><span>Black</span></div>' + ['k','q','r','b','n','p'].map(type=>`<div class="inventory-row"><span>${pieceSvg({type,color:'b'})}${titleCase(NAMES[type])}${type==='k'||type==='q'?'':'s'}</span><span>${analysis.pieces.w[type]}</span><span>${analysis.pieces.b[type]}</span></div>`).join('');
  for (const position of ['top','bottom']) {
    const color = (position==='top') !== flipped ? 'b' : 'w';
    $(position+'-player').textContent = colorName(color);
    $(position+'-count').textContent = analysis.pieces[color].total+' pieces';
    $(position+'-token').className = 'player-token '+(color==='w'?'white':'black');
    const active = !game.isGameOver() && game.turn()===color;
    $(position+'-turn').textContent = active ? (game.isCheck()?'In check':'To move') : '';
    $(position+'-turn').className = 'turn-badge'+(active?' active':'');
  }
}
function renderInspector() {
  const p = selected && game.get(selected);
  $('clear-selection').hidden = !p;
  if (!p) $('piece-inspector').innerHTML = '<div class="inspector-icon">♘</div><div><strong>Select any piece</strong><p>See its controlled squares and legal moves. You can inspect either side.</p></div>';
  else {
    const count = pieceControl(game,selected).length;
    const moveCount = p.color === game.turn() && !game.isGameOver() ? new Set(game.moves({square:selected,verbose:true}).map(m=>m.to)).size : null;
    const suffix = moveCount === null ? `${colorName(game.turn())} is to move.` : `${moveCount} legal destination${moveCount===1?'':'s'}.`;
    $('piece-inspector').innerHTML = `<div class="inspector-icon">${pieceSvg(p)}</div><div><strong>${colorName(p.color)} ${NAMES[p.type]} on ${selected}</strong><p>Controls ${count} square${count===1?'':'s'}. ${suffix}</p></div>`;
  }
  renderSquareInspector();
}
function renderSquareInspector() {
  const square = pinnedSquare || hovered;
  $('pin-square').hidden = !square;
  $('pin-square').dataset.targetSquare = square || '';
  $('pin-square').textContent = pinnedSquare ? 'Unpin '+pinnedSquare : 'Pin '+square;
  $('pin-square').setAttribute('aria-pressed',String(!!pinnedSquare));
  const ended = game.isGameOver();
  const key = square ? game.fen()+'|'+square+(ended?'|ended':'') : null;
  if (key === exchangeKey) return;
  exchangeKey = key; exchangeResult = null; clearTimeout(exchangeTimer); exchangePending = null;
  if (!square) { $('square-inspector').innerHTML = '<p class="exchange-empty">Hover, focus, or tap a square to compare control and captures.</p>'; return; }
  const p = game.get(square), white = analysis.control.w.get(square)?.length || 0, black = analysis.control.b.get(square)?.length || 0, edge = white-black;
  const label = !white && !black ? 'No attackers' : edge === 0 ? 'Equal attackers' : `${colorName(edge>0?'w':'b')} +${Math.abs(edge)} attacker${Math.abs(edge)===1?'':'s'}`;
  $('square-inspector').innerHTML = `<div class="inspected-square"><strong>${square}</strong><span>${p ? colorName(p.color)+' '+NAMES[p.type] : 'Empty square'}</span></div><div class="square-control-counts"><span><i class="swatch white-control"></i>White <strong>${white}</strong></span><span><i class="swatch black-control"></i>Black <strong>${black}</strong></span></div><div class="square-control-edge"><span>Control edge</span><strong class="${edge>0?'white-edge':edge<0?'black-edge':''}">${label}</strong></div><div class="exchange-summary"><span class="exchange-summary-label">Exchange estimate</span><strong id="exchange-outcome">Checking captures…</strong><small id="exchange-scope">${colorName(game.turn())} to move.</small></div><button id="exchange-detail-button" class="text-button">Show details</button>`;
  if (ended) { exchangeResult = { status:'game-over' }; renderExchangeResult(); return; }
  if (exchangeCache.has(key)) { exchangeResult = exchangeCache.get(key); renderExchangeResult(); return; }
  const request = { key, fen:game.fen(), square };
  exchangeTimer = setTimeout(() => { exchangePending = request; dispatchExchange(); },80);
}
function rememberExchange(key,result) {
  exchangeCache.set(key,result);
  if (exchangeCache.size>256) exchangeCache.delete(exchangeCache.keys().next().value);
  if (key === exchangeKey) { exchangeResult = result; renderExchangeResult(); }
}
function dispatchExchange() {
  if (exchangeBusy || !exchangePending) return;
  const request = exchangePending; exchangePending = null; exchangeActive = request; exchangeBusy = true;
  try {
    if (!exchangeWorker) {
      exchangeWorker = new Worker(new URL('./exchange-worker.js',import.meta.url),{ type:'module' });
      exchangeWorker.onmessage = ({ data }) => { exchangeBusy = false; rememberExchange(data.key,data.result); dispatchExchange(); };
      exchangeWorker.onerror = () => {
        exchangeWorker.terminate(); exchangeWorker = null; exchangeBusy = false;
        rememberExchange(exchangeActive.key,{ status:'unavailable' }); dispatchExchange();
      };
    }
    exchangeWorker.postMessage(request);
  } catch {
    exchangeBusy = false;
    // Older browsers still get a bounded calculation without a worker.
    try { rememberExchange(request.key,analyzeExchange(request.fen,request.square,{ maxNodes:500,timeLimitMs:40 })); }
    catch { rememberExchange(request.key,{ status:'unavailable' }); }
    dispatchExchange();
  }
}
function exchangeDescription(result) {
  const name = colorName(game.turn()), square = pinnedSquare || hovered;
  const statuses = {
    empty:['No piece to capture','Control shows pressure on this empty square.'],
    friendly:['Friendly piece',name+' to move. Only the opponent can capture this piece.'],
    king:['Kings cannot be captured','Control still shows attacks and defenses.'],
    'no-capture':['No legal capture',name+' cannot capture on '+square+' now.'],
    'game-over':['Game over','Visit an earlier position to explore captures.'],
    limit:['Analysis incomplete','Too many capture choices to finish the estimate.'],
    unavailable:['Estimate unavailable','Control counts are still available.']
  };
  if (result.status !== 'complete') return statuses[result.status] || statuses.unavailable;
  if (result.mateWinner) return [colorName(result.mateWinner)+' delivers checkmate','In the shown capture line.'];
  const amount = Math.abs(result.gain), unit = amount === 1 ? 'pawn' : 'pawns';
  return [amount ? `${colorName(result.starter)} ${result.gain>0?'gains':'loses'} ${amount} ${unit}` : 'Even material exchange',`${colorName(result.starter)} starts. Captures on ${result.square} only.`];
}
function renderExchangeResult() {
  if (!$('exchange-outcome') || !exchangeResult) return;
  const [outcome,scope] = exchangeDescription(exchangeResult);
  $('exchange-outcome').textContent = outcome; $('exchange-scope').textContent = scope;
  if ($('exchange-dialog').open) renderExchangeDetails();
}
function renderExchangeDetails() {
  const square = pinnedSquare || hovered;
  if (!square) { $('exchange-dialog').close(); return; }
  $('exchange-dialog-title').textContent = 'Exchange on '+square;
  const lists = ['w','b'].map(color => {
    const attackers = analysis.control[color].get(square) || [];
    return `<div class="attacker-list ${color==='w'?'white-attackers':'black-attackers'}"><h3><i class="swatch ${color==='w'?'white':'black'}-control"></i>${colorName(color)} <span>${attackers.length}</span></h3>${attackers.length ? attackers.map(from=>`<span class="attacker-piece">${pieceSvg(game.get(from))}${titleCase(NAMES[game.get(from).type])} ${from}</span>`).join('') : '<p>No controlling pieces.</p>'}</div>`;
  }).join('');
  const [outcome,scope] = exchangeResult ? exchangeDescription(exchangeResult) : ['Checking captures…',colorName(game.turn())+' to move.'];
  const line = exchangeResult?.line || [];
  $('exchange-details').innerHTML = `<div class="attacker-lists">${lists}</div><div class="exchange-detail-result"><strong>${outcome}</strong><p>${scope}</p></div>${line.length ? `<h3>Capture line</h3><ol class="capture-line">${line.map(move=>`<li><strong>${colorName(move.color)} ${move.san}</strong><span>${titleCase(NAMES[move.piece])} from ${move.from} takes a ${NAMES[move.captured]}${move.promotion ? ', promotes to '+NAMES[move.promotion] : ''}.</span></li>`).join('')}</ol><p class="muted">Both sides choose their best local capture or stop recapturing when a legal move elsewhere is available.</p>` : ''}<p class="muted">Control includes pinned pieces. The capture line uses legal moves and recalculates attacks after every capture. It does not evaluate tactics elsewhere.</p><p class="muted">Material values in pawns: pawn ${PIECE_VALUES.p}, knight ${PIECE_VALUES.n}, bishop ${PIECE_VALUES.b}, rook ${PIECE_VALUES.r}, queen ${PIECE_VALUES.q}.</p>`;
}
function statusText() {
  if (game.isCheckmate()) return `Checkmate. ${colorName(game.turn()==='w'?'b':'w')} wins.`;
  if (game.isStalemate()) return 'Draw by stalemate. There are no legal moves.';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material.';
  if (game.isThreefoldRepetition()) return 'Draw by threefold repetition.';
  if (game.isDrawByFiftyMoves()) return 'Draw by the fifty-move rule.';
  if (game.isCheck()) return `${colorName(game.turn())} is in check. Make a move that protects the king.`;
  return `${colorName(game.turn())} to move. ${cursor<timeline.length?'Playing here will replace the later moves.':'Select a piece to explore its reach.'}`;
}
function renderHistory() {
  const history = $('move-history');
  if (!timeline.length) { history.innerHTML = '<p class="empty-history">Your first move starts the story.</p>'; return; }
  const firstPly = (Number(startFen.split(' ')[5])-1)*2 + (startFen.split(' ')[1]==='b'?1:0);
  const rows = new Map();
  timeline.forEach((move,index)=>{
    const number = Math.floor((firstPly+index)/2)+1;
    if (!rows.has(number)) rows.set(number, {w:null,b:null});
    rows.get(number)[move.color] = {move,index};
  });
  history.innerHTML = [...rows].map(([number,pair])=>`<div class="move-row"><span>${number}.</span>${['w','b'].map(color=>pair[color]?`<button data-ply="${pair[color].index+1}" class="${cursor===pair[color].index+1?'current':''}" aria-label="Go to move ${number}, ${colorName(color)} ${pair[color].move.san}" ${cursor===pair[color].index+1?'aria-current="step"':''}>${pair[color].move.san}</button>`:'<span></span>').join('')}</div>`).join('');
  const active = history.querySelector('.current');
  if (active) history.scrollTop = active.offsetTop - history.offsetTop - 50;
}
function render() {
  document.body.dataset.palette = palette;
  $('palette').value = palette;
  analysis = analyze(game); renderBoard(); renderAnalysis(); renderInspector(); renderHistory();
  $('game-status').textContent = statusText();
  $('position-label').textContent = cursor ? `Move ${cursor} of ${timeline.length}` : 'Starting position';
  $('first').disabled = $('back').disabled = $('undo').disabled = cursor===0;
  $('forward').disabled = $('last').disabled = cursor===timeline.length;
  $('intensity').checked = intensity;
  for (const button of $('overlay-options').children) {
    const active = button.dataset.overlay===overlay;
    button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active));
  }
}
function visit(ply) {
  game = new Chess(startFen); cursor = Math.max(0,Math.min(timeline.length,ply));
  for (const move of timeline.slice(0,cursor)) game.move(move.san);
  selected = null; render(); save();
}
function executeMove(from,to,promotion) {
  try {
    const move = game.move({from,to,...(promotion?{promotion}:{})});
    const branched = cursor<timeline.length;
    timeline = [...timeline.slice(0,cursor), move]; cursor = timeline.length; selected = to; hovered = to;
    render(); save();
    if (branched) toast('New continuation saved. Later moves were replaced.');
  } catch { toast('That move is not legal. Choose a marked destination.'); }
}
function attemptMove(from,to) {
  const candidates = game.moves({square:from,verbose:true}).filter(m=>m.to===to);
  if (!candidates.length) return false;
  if (candidates.some(m=>m.promotion)) {
    pendingPromotion = {from,to};
    $('promotion-options').innerHTML = ['q','r','b','n'].map(type=>`<button data-promotion="${type}" aria-label="Promote to ${NAMES[type]}">${pieceSvg({color:game.turn(),type})}${titleCase(NAMES[type])}</button>`).join('');
    $('promotion-dialog').showModal();
  } else executeMove(from,to);
  return true;
}
function selectSquare(square) {
  clearTimeout(inspectTimer); hovered = square; renderSquareInspector();
  const p = game.get(square), previous = selected && game.get(selected);
  if (previous?.color === game.turn() && !game.isGameOver() && square!==selected && attemptMove(selected,square)) return;
  if (p) selected = selected===square ? null : square;
  else if (selected) { toast('Choose a marked destination to move, or select another piece.'); return; }
  render();
}
function fullGame() { const result = new Chess(startFen); for (const move of timeline) result.move(move.san); return result; }
async function copyText(value,label) {
  try { await navigator.clipboard.writeText(value); toast(label+' copied.'); }
  catch {
    const input = document.createElement('textarea'); input.value=value; input.style.position='fixed'; input.style.left='-10000px'; document.body.append(input); input.select();
    const copied = document.execCommand('copy'); input.remove(); toast(copied?label+' copied.':'Copy is unavailable in this browser.');
  }
}
function resetGame() { game = new Chess(); startFen=initialFen; timeline=[]; cursor=0; selected=null; hovered=null; pinnedSquare=null; render(); save(); }

$('board').addEventListener('click', e => { const button=e.target.closest('[data-square]'); if(button) selectSquare(button.dataset.square); });
$('board').addEventListener('pointermove', e => {
  const button=e.target.closest('[data-square]');
  if (!button || pinnedSquare || $('exchange-dialog').open || button.dataset.square===hovered) return;
  clearTimeout(inspectTimer);
  inspectTimer=setTimeout(() => { hovered=button.dataset.square; renderSquareInspector(); },80);
});
$('board').addEventListener('pointerleave', () => clearTimeout(inspectTimer));
// Keep the last inspected square visible while the pointer enters its panel.
$('board').addEventListener('focusin', e => {
  const button=e.target.closest('[data-square]'); if(!button) return;
  for(const b of $('board').children) b.tabIndex=b===button?0:-1;
  clearTimeout(inspectTimer); hovered=button.dataset.square; renderSquareInspector();
});
$('board').addEventListener('keydown', e => {
  if(e.key==='Escape') { selected=null; render(); return; }
  const direction={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[e.key];
  if(!direction) return;
  e.preventDefault(); const squares=orderedSquares(), current=squares.indexOf(e.target.dataset.square);
  const destination=current+direction;
  if(destination<0||destination>63||(Math.abs(direction)===1&&Math.floor(current/8)!==Math.floor(destination/8))) return;
  $('board').children[destination].focus();
});
$('board').addEventListener('dragstart', e => {
  const button=e.target.closest('[data-square]'); if(!button?.draggable) { e.preventDefault(); return; }
  dragFrom=button.dataset.square; selected=dragFrom; e.dataTransfer.setData('text/plain',dragFrom); e.dataTransfer.effectAllowed='move'; render();
});
$('board').addEventListener('dragover', e => { if(dragFrom) { e.preventDefault(); const button=e.target.closest('[data-square]'); if(button) button.classList.add('drop-target'); } });
$('board').addEventListener('dragleave', e => e.target.closest('[data-square]')?.classList.remove('drop-target'));
$('board').addEventListener('drop', e => {
  e.preventDefault(); const button=e.target.closest('[data-square]');
  if(button&&dragFrom&&!attemptMove(dragFrom,button.dataset.square)) toast('That move is not legal. Choose a marked destination.');
  dragFrom=null; render();
});
$('board').addEventListener('dragend', () => { dragFrom=null; render(); });
$('clear-selection').addEventListener('click', () => { selected=null; render(); });
$('pin-square').addEventListener('click', () => {
  clearTimeout(inspectTimer);
  if (pinnedSquare) { hovered=pinnedSquare; pinnedSquare=null; } else pinnedSquare=$('pin-square').dataset.targetSquare;
  renderBoard(); renderSquareInspector();
});
$('square-inspector').addEventListener('click', e => {
  if (e.target.closest('#exchange-detail-button')) { renderExchangeDetails(); $('exchange-dialog').showModal(); }
});
$('overlay-options').addEventListener('click', e => { if(e.target.dataset.overlay) { overlay=e.target.dataset.overlay; render(); save(); } });
$('intensity').addEventListener('change', e => { intensity=e.target.checked; render(); save(); });
$('palette').addEventListener('change', e => { if (palettes.includes(e.target.value)) { palette=e.target.value; render(); save(); } });
$('flip').addEventListener('click', () => { flipped=!flipped; createBoard(); render(); save(); });
$('first').addEventListener('click', () => visit(0));
$('back').addEventListener('click', () => visit(cursor-1));
$('forward').addEventListener('click', () => visit(cursor+1));
$('last').addEventListener('click', () => visit(timeline.length));
$('undo').addEventListener('click', () => { if(!cursor)return; timeline=timeline.slice(0,cursor-1); visit(timeline.length); });
$('move-history').addEventListener('click', e => { if(e.target.dataset.ply) visit(+e.target.dataset.ply); });
$('promotion-options').addEventListener('click', e => {
  const button=e.target.closest('[data-promotion]'); if(!button||!pendingPromotion)return;
  const {from,to}=pendingPromotion; pendingPromotion=null; $('promotion-dialog').close(); executeMove(from,to,button.dataset.promotion);
});
$('cancel-promotion').addEventListener('click', () => { pendingPromotion=null; $('promotion-dialog').close(); });
$('promotion-dialog').addEventListener('cancel', () => pendingPromotion=null);
$('about-button').addEventListener('click', () => $('about-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click', () => button.closest('dialog').close()));
$('new-game').addEventListener('click', () => { if(timeline.length||startFen!==initialFen) $('new-game-dialog').showModal(); else resetGame(); });
$('confirm-new-game').addEventListener('click', () => { $('new-game-dialog').close(); resetGame(); toast('New game ready. White to move.'); });
$('import-position').addEventListener('click', () => { $('position-input').value=''; $('import-error').textContent=''; $('import-dialog').showModal(); });
$('import-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const input=$('position-input').value.trim(), candidate=new Chess();
    if (/^[prnbqkPRNBQK1-8/]+\s+[wb]\s/.test(input)) candidate.load(input);
    else candidate.loadPgn(input);
    const history=candidate.history({verbose:true});
    startFen=history.length?history[0].before:candidate.fen(); timeline=history; cursor=history.length; game=candidate; selected=null; hovered=null; pinnedSquare=null;
    $('import-dialog').close(); render(); save(); toast(history.length?'Game loaded.':'Position loaded.');
  } catch (error) { $('import-error').textContent='Could not load this input. '+error.message; }
});
$('copy-fen').addEventListener('click', () => copyText(game.fen(),'FEN'));
$('export-pgn').addEventListener('click', () => {
  const pgn=fullGame().pgn();
  const url=URL.createObjectURL(new Blob([pgn],{type:'application/x-chess-pgn'}));
  const link=document.createElement('a'); link.href=url; link.download='chess-space-lab.pgn'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('PGN exported.');
});
restore(); createBoard(); render();
