import { Chess } from './vendor/chess.js';
import { analyze, pieceControl, FILES, SQUARES, NAMES } from './control.js';
import { pieceSvg } from './pieces.js';

const $ = id => document.getElementById(id);
const initialFen = new Chess().fen();
const storageKey = 'chess-space-lab-v1';
let game = new Chess(), startFen = initialFen, timeline = [], cursor = 0;
let flipped = false, overlay = 'both', intensity = false, selected = null, hovered = null;
let analysis, pendingPromotion = null, dragFrom = null, toastTimeout;
const colorName = color => color === 'w' ? 'White' : 'Black';
const titleCase = word => word[0].toUpperCase() + word.slice(1);

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').hidden = true, 3500);
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ startFen, moves:timeline.map(m=>m.san), cursor, flipped, overlay, intensity })); }
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
    if (reach.has(square)) classes.push('reach');
    if (legal.has(square)) classes.push('legal');
    if (p) classes.push('occupied');
    if (lastMove && [lastMove.from,lastMove.to].includes(square)) classes.push('last-move');
    if (p?.type === 'k' && p.color === game.turn() && game.isCheck()) classes.push('check');
    button.className = classes.join(' ');
    button.style.setProperty('--reach-color', selectedPiece?.color === 'b' ? 'var(--coral)' : 'var(--teal)');
    if (intensity && (showW || showB)) button.style.setProperty('--strength', Math.min(.7,.15+.1*(overlay==='w'?white:overlay==='b'?black:white+black)));
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
  if (!hovered) { $('square-inspector').textContent = 'Hover a square to see which pieces control it.'; return; }
  const describe = color => (analysis.control[color].get(hovered)||[]).map(s=>titleCase(NAMES[game.get(s).type])+' '+s).join(', ') || 'none';
  $('square-inspector').textContent = `${hovered} · White: ${describe('w')}. Black: ${describe('b')}.`;
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
    timeline = [...timeline.slice(0,cursor), move]; cursor = timeline.length; selected = to;
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
function resetGame() { game = new Chess(); startFen=initialFen; timeline=[]; cursor=0; selected=null; hovered=null; render(); save(); }

$('board').addEventListener('click', e => { const button=e.target.closest('[data-square]'); if(button) selectSquare(button.dataset.square); });
$('board').addEventListener('pointerover', e => { const button=e.target.closest('[data-square]'); if(button) { hovered=button.dataset.square; renderSquareInspector(); } });
$('board').addEventListener('pointerleave', () => { hovered=null; renderSquareInspector(); });
$('board').addEventListener('focusin', e => {
  const button=e.target.closest('[data-square]'); if(!button) return;
  for(const b of $('board').children) b.tabIndex=b===button?0:-1;
  hovered=button.dataset.square; renderSquareInspector();
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
$('overlay-options').addEventListener('click', e => { if(e.target.dataset.overlay) { overlay=e.target.dataset.overlay; render(); save(); } });
$('intensity').addEventListener('change', e => { intensity=e.target.checked; render(); save(); });
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
    startFen=history.length?history[0].before:candidate.fen(); timeline=history; cursor=history.length; game=candidate; selected=null; hovered=null;
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
