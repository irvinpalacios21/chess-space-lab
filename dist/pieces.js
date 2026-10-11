const paths = {
  p: '<circle cx="22.5" cy="10" r="5.5"/><path d="M16 16 Q12 23 18 26 L16 32 Q11 33 11 38 H34 Q34 33 29 32 L27 26 Q33 23 29 16 Z"/>',
  r: '<path d="M10 7 H17 V11 H20 V7 H25 V11 H28 V7 H35 V17 L30 21 V32 H33 L35 38 H10 L12 32 H15 V21 L10 17 Z"/><path d="M15 21 H30 M15 32 H30" fill="none"/>',
  b: '<path d="M22.5 5 Q9 15 15 23 Q18 27 19 30 L15 32 L11 38 H34 L30 32 L26 30 Q27 27 30 23 Q36 15 22.5 5 Z"/><path d="M24 10 L19 19 M17 27 H28 M16 32 H29" fill="none"/>',
  n: '<path d="M11 38 H35 L33 32 Q37 22 30 12 L23 5 L23 11 L18 9 L9 24 L14 27 L23 21 Q23 28 14 32 Z"/><path d="M17 32 H32" fill="none"/><circle cx="19" cy="16" r="1.3" stroke="none" fill="currentColor"/>',
  q: '<path d="M11 15 L15 30 H30 L34 15 L27 23 L23 13 L18 23 Z"/><circle cx="10" cy="12" r="3"/><circle cx="23" cy="10" r="3"/><circle cx="35" cy="12" r="3"/><path d="M15 30 H30 L31 33 L35 38 H10 L14 33 Z"/><path d="M15 33 H30" fill="none"/>',
  k: '<path d="M22.5 4 V14 M18 8 H27" fill="none" stroke-width="3"/><path d="M22.5 16 Q13 10 11 19 Q9 24 17 30 H28 Q36 24 34 19 Q32 10 22.5 16 Z"/><path d="M17 30 H28 L30 33 L34 38 H11 L15 33 Z"/><path d="M16 33 H29 M22.5 17 V27" fill="none"/>'
};
export function pieceSvg(piece) {
  return `<svg viewBox="0 0 45 45" class="piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="1.6">${paths[piece.type]}</g></svg>`;
}
