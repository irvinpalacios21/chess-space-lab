import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../dist/vendor/chess.js';
import { analyze, pieceControl, SQUARES } from '../dist/control.js';

test('starting counts distinguish defended squares from legal mobility', () => {
  const game = new Chess(), a = analyze(game);
  assert.equal(a.pieces.w.total,16); assert.equal(a.pieces.b.total,16);
  assert.equal(a.control.w.size,22); assert.equal(a.control.b.size,22);
  assert.equal(a.shared.length,0); assert.equal(a.untouched.length,20);
  assert.deepEqual(pieceControl(game,'e2'),['d3','f3']);
  assert(!pieceControl(game,'e2').includes('e3'));
  assert.deepEqual(a.center,{w:0,b:0});
});
test('pawn push updates control and center without counting moves as attacks', () => {
  const game = new Chess(); game.move('e4');
  assert.deepEqual(pieceControl(game,'e4'),['d5','f5']);
  assert.equal(analyze(game).center.w,1);
  assert.equal(analyze(game).pieces.w.total,16);
});
test('sliding control includes first friendly blocker and stops behind it', () => {
  const game = new Chess('4k3/8/6p1/5P2/8/3B4/8/4K3 w - - 0 1');
  const reach = pieceControl(game,'d3');
  assert(reach.includes('e4')); assert(reach.includes('f5')); assert(!reach.includes('g6'));
});
test('pinned pieces still control squares while their moves are restricted', () => {
  const game = new Chess('4k3/4n3/8/8/8/8/4R3/4K3 b - - 0 1');
  assert(pieceControl(game,'e7').includes('c6'));
  assert(analyze(game).control.b.has('c6'));
  assert.equal(game.moves({square:'e7'}).length,0);
});
test('overlapping attackers count a square once per side and keep attacker detail', () => {
  const game = new Chess('4k3/8/4p3/8/4P3/2N5/8/4K3 w - - 0 1');
  const a = analyze(game);
  assert.deepEqual(a.control.w.get('d5').sort(),['c3','e4']);
  assert.equal(a.control.w.size,new Set(a.control.w.keys()).size);
  assert(a.shared.includes('d5'));
  assert.equal(a.control.w.size+a.control.b.size-a.shared.length+a.untouched.length,64);
});
test('every attack map agrees with chess.js on both colors over 400 legal positions', () => {
  let randomState = 23814;
  const random = n => { randomState=(Math.imul(randomState,1664525)+1013904223)>>>0; return randomState % n; };
  for (let run=0;run<5;run++) {
    const game = new Chess();
    for(let step=0;step<80;step++) {
      const a=analyze(game);
      for(const s of SQUARES) for(const color of ['w','b']) assert.equal(a.control[color].has(s),game.isAttacked(s,color),`${game.fen()} ${s} ${color}`);
      const moves=game.moves(); if(!moves.length||game.isGameOver()) game.reset(); else game.move(moves[random(moves.length)]);
    }
  }
});
test('captures and undo keep piece counts consistent', () => {
  const game = new Chess(); for(const move of ['e4','d5','exd5']) game.move(move);
  assert.equal(analyze(game).pieces.b.total,15); assert.equal(analyze(game).pieces.b.p,7);
  game.undo(); assert.equal(analyze(game).pieces.b.total,16);
});
