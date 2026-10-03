// Lightweight observable wrapper around the global league singleton.
// Hot mutations in the engine call notify() so listeners re-render.
const listeners = new Set();

export function notify() {
  listeners.forEach((listener) => listener());
}
