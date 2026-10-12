import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../dist/vendor/chess.js';
import { analyze } from '../dist/control.js';
import { analyzeExchange } from '../dist/exchange.js';

const estimate = (fen,square,options) => analyzeExchange(new Chess(fen),square,{ timeLimitMs:2000,...options });

test('three attackers versus one yields one pawn, not two pawns of material', () => {
  const game = new Chess('7k/8/8/2p5/3p4/2P1P3/8/K2Q4 w - - 0 1'), before=game.fen();
  const controls=analyze(game);
  assert.equal(controls.control.w.get('d4').length-controls.control.b.get('d4').length,2);
  const result=analyzeExchange(game,'d4');
  assert.equal(result.gain,1); assert.deepEqual(result.line.map(m=>m.san),['cxd4','cxd4','exd4']);
  assert.equal(game.fen(),before); assert.equal(game.history().length,0);
});

test('more attackers can still produce a losing capture', () => {
  const fen='7k/8/8/2p5/R2p4/8/8/K2R4 w - - 0 1';
  const controls=analyze(new Chess(fen));
  assert.equal(controls.control.w.get('d4').length,2); assert.equal(controls.control.b.get('d4').length,1);
  const result=estimate(fen,'d4');
  assert.equal(result.gain,-3); assert.equal(result.line.length,3);
});

test('a rook revealed behind the first attacker can recapture', () => {
  const result=estimate('3r3k/8/8/8/3p4/8/3R4/K2R4 w - - 0 1','d4');
  assert.equal(result.gain,1); assert.deepEqual(result.line.map(m=>m.from),['d2','d8','d1']);
});

test('pinned attackers cannot initiate a capture', () => {
  assert.equal(estimate('k3r3/8/8/8/8/3pR3/8/4K3 w - - 0 1','d3').status,'no-capture');
});

test('a pinned defender counts as control but cannot recapture', () => {
  const fen='4k3/4n3/2p5/1B6/8/8/4R3/4K3 w - - 0 1';
  assert.deepEqual(analyze(new Chess(fen)).control.b.get('c6'),['e7']);
  const result=estimate(fen,'c6');
  assert.equal(result.gain,1); assert.equal(result.line.length,1);
});

test('a king cannot capture a defended piece', () => {
  assert.equal(estimate('k3r3/8/8/8/8/8/4p3/4K3 w - - 0 1','e2').status,'no-capture');
});

test('Black material gain uses Black as the starting side', () => {
  const result=estimate('3q3k/8/2p1p3/3P4/2P5/8/8/K7 b - - 0 1','d5');
  assert.equal(result.starter,'b'); assert.equal(result.gain,1); assert.equal(result.whiteGain,-1);
});

test('capture promotion includes the promotion material gain', () => {
  const result=estimate('1r5k/P7/8/8/8/8/8/7K w - - 0 1','b8');
  assert.equal(result.gain,13); assert.equal(result.line[0].promotion,'q');
});

test('en passant can start an exchange on an empty destination', () => {
  const result=estimate('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','d6');
  assert.equal(result.gain,1); assert.equal(result.line[0].san,'exd6');
});

test('friendly, empty, king and finished positions have explicit states', () => {
  const game=new Chess();
  assert.equal(analyzeExchange(game,'e2').status,'friendly');
  assert.equal(analyzeExchange(game,'e4').status,'empty');
  assert.equal(analyzeExchange(game,'e8').status,'king');
  game.loadPgn('1. f3 e5 2. g4 Qh4#');
  assert.equal(analyzeExchange(game,'h4').status,'game-over');
});

test('a search limit returns no misleading partial score', () => {
  const result=estimate('7k/8/8/2p5/3p4/2P1P3/8/K2Q4 w - - 0 1','d4',{maxNodes:1});
  assert.equal(result.status,'limit'); assert.equal(result.gain,undefined);
});

test('a capture delivering mate is identified as checkmate', () => {
  const result=estimate('7k/7p/6KQ/8/8/8/8/8 w - - 0 1','h7');
  assert.equal(result.status,'complete'); assert.equal(result.mateWinner,'w');
  assert.equal(result.line[0].san,'Qxh7#');
});

test('an already drawn game preserves repetition state', () => {
  const game=new Chess();
  for (const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) game.move(move);
  assert(game.isThreefoldRepetition());
  assert.equal(analyzeExchange(game,'e7').status,'game-over');
});

test('every move in the displayed line is legal and captures on the target', () => {
  const fen='7k/8/8/2p5/R2p4/8/8/K2R4 w - - 0 1', game=new Chess(fen);
  const result=estimate(fen,'d4');
  for (const entry of result.line) { const move=game.move(entry.san); assert.equal(move.to,'d4'); assert(move.captured); }
});
