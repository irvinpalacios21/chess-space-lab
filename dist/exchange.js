import { Chess } from './vendor/chess.js';

export const PIECE_VALUES = { p:1, n:3, b:3, r:5, q:9, k:0 };

// A local exchange starts with a capture by the side to move. Each subsequent
// turn may recapture on the same square or leave the exchange with a legal move
// elsewhere. This deliberately does not evaluate those other moves.
export function analyzeExchange(position, square, { maxNodes=4000, timeLimitMs=200 }={}) {
  const game = new Chess(typeof position === 'string' ? position : position.fen());
  const starter = game.turn(), occupant = game.get(square);
  const base = { starter, square };
  if ((typeof position !== 'string' && position.isGameOver()) || game.isGameOver()) return { ...base, status:'game-over' };
  if (occupant?.type === 'k') return { ...base, status:'king' };
  if (occupant?.color === starter) return { ...base, status:'friendly' };

  const capturesOnSquare = moves => moves.filter(move => move.to === square && move.captured && move.captured !== 'k')
    .sort((a,b) => PIECE_VALUES[a.piece]-PIECE_VALUES[b.piece] || PIECE_VALUES[b.promotion || 'k']-PIECE_VALUES[a.promotion || 'k'] || a.from.localeCompare(b.from));
  const firstCaptures = capturesOnSquare(game.moves({ verbose:true }));
  if (!firstCaptures.length) return { ...base, status:occupant ? 'no-capture' : 'empty' };

  const deadline = performance.now() + timeLimitMs, memo = new Map();
  let nodes = 0;
  const exhausted = Symbol('exchange search limit');
  const rank = result => result.mateWinner ? (result.mateWinner === 'w' ? 10000 : -10000) : result.score;
  const better = (a,b,color) => !b || (color === 'w' ? rank(a)>rank(b) : rank(a)<rank(b)) || (rank(a) === rank(b) && a.line.length>b.line.length);
  function search() {
    if (++nodes>maxNodes || performance.now()>deadline) throw exhausted;
    const key = game.fen().split(' ').slice(0,4).join(' ');
    if (memo.has(key)) return memo.get(key);
    const moves = game.moves({ verbose:true }), captures = capturesOnSquare(moves), color = game.turn();
    if (!moves.length) return { score:0, line:[], mateWinner:game.isCheck() ? (color === 'w' ? 'b' : 'w') : null };
    // Being in check does not permit an imaginary pass. Stopping is possible
    // only if an actual legal move leaves this square's capture sequence.
    let best = moves.length>captures.length ? { score:0, line:[], mateWinner:null } : null;
    for (const move of captures) {
      const candidate = follow(move);
      if (better(candidate,best,color)) best = candidate;
    }
    memo.set(key,best);
    return best;
  }
  function follow(move) {
    const value = PIECE_VALUES[move.captured] + (move.promotion ? PIECE_VALUES[move.promotion]-PIECE_VALUES.p : 0);
    game.move({ from:move.from, to:move.to, ...(move.promotion ? { promotion:move.promotion } : {}) });
    let reply;
    try { reply = search(); } finally { game.undo(); }
    return { score:(move.color === 'w' ? value : -value)+reply.score, mateWinner:reply.mateWinner,
      line:[{ san:move.san, from:move.from, to:move.to, color:move.color, piece:move.piece, captured:move.captured, promotion:move.promotion || null, value },...reply.line] };
  }
  try {
    let best = null;
    // Do not include "decline the initial capture" in the root choices: users
    // need to see when starting a trade would lose material.
    for (const move of firstCaptures) {
      const candidate = follow(move);
      if (better(candidate,best,starter)) best = candidate;
    }
    return { ...base, status:'complete', gain:best.score*(starter === 'w' ? 1 : -1), whiteGain:best.score, line:best.line, mateWinner:best.mateWinner, nodes };
  } catch (error) {
    if (error === exhausted) return { ...base, status:'limit', nodes };
    throw error;
  }
}
