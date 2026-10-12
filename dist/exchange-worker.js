import { analyzeExchange } from './exchange.js';

self.onmessage = ({ data }) => {
  const { key, fen, square } = data;
  try { self.postMessage({ key, result:analyzeExchange(fen,square) }); }
  catch { self.postMessage({ key, result:{ status:'unavailable' } }); }
};
