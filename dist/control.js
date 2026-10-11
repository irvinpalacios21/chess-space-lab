export const FILES = 'abcdefgh';
export const SQUARES = Array.from({ length: 64 }, (_, i) => FILES[i % 8] + (8 - Math.floor(i / 8)));
export const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const diagonal = [[1,1], [1,-1], [-1,1], [-1,-1]];
const straight = [[1,0], [-1,0], [0,1], [0,-1]];
export function pieceControl(game, square) {
  const p = game.get(square);
  if (!p) return [];
  const x = FILES.indexOf(square[0]), y = +square[1] - 1;
  const result = [];
  const add = (dx, dy) => {
    const a = x + dx, b = y + dy;
    if (a < 0 || a > 7 || b < 0 || b > 7) return false;
    const target = FILES[a] + (b + 1);
    result.push(target);
    return !game.get(target);
  };
  if (p.type === 'p') { add(-1, p.color === 'w' ? 1 : -1); add(1, p.color === 'w' ? 1 : -1); }
  else if (p.type === 'n') { for (const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) add(dx,dy); }
  else if (p.type === 'k') { for (const [dx,dy] of [...diagonal,...straight]) add(dx,dy); }
  else {
    const rays = p.type === 'b' ? diagonal : p.type === 'r' ? straight : [...diagonal,...straight];
    for (const [dx,dy] of rays) for (let i=1; i<8; i++) if (!add(dx*i,dy*i)) break;
  }
  return result;
}
export function analyze(game) {
  const control = { w: new Map(), b: new Map() };
  const pieces = { w: { total:0, p:0,n:0,b:0,r:0,q:0,k:0 }, b: { total:0,p:0,n:0,b:0,r:0,q:0,k:0 } };
  for (const square of SQUARES) {
    const p = game.get(square);
    if (!p) continue;
    pieces[p.color].total++; pieces[p.color][p.type]++;
    for (const target of pieceControl(game,square)) {
      const owners = control[p.color].get(target) || [];
      owners.push(square); control[p.color].set(target,owners);
    }
  }
  const shared = SQUARES.filter(s => control.w.has(s) && control.b.has(s));
  const untouched = SQUARES.filter(s => !control.w.has(s) && !control.b.has(s));
  const center = ['d4','e4','d5','e5'];
  return { control, pieces, shared, untouched, center: { w: center.filter(s=>control.w.has(s)).length, b:center.filter(s=>control.b.has(s)).length } };
}
