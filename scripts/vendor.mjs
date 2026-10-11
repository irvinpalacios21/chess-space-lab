import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('dist/vendor', {recursive:true});
await copyFile('node_modules/chess.js/dist/esm/chess.js','dist/vendor/chess.js');
await copyFile('node_modules/chess.js/LICENSE','dist/vendor/chess.js.LICENSE');
for (const font of ['manrope','dm-sans']) {
  await copyFile(`node_modules/@fontsource-variable/${font}/files/${font}-latin-wght-normal.woff2`,`dist/vendor/${font}-latin-wght-normal.woff2`);
  await copyFile(`node_modules/@fontsource-variable/${font}/LICENSE`,`dist/vendor/${font}.LICENSE`);
}
console.log('Bundled chess.js, fonts, and their licenses.');
