import { league } from './LeagueEngine';

// Lightweight observable wrapper around the global league singleton.
// Screens can subscribe to state changes instead of manually re-reading the
// singleton. Hot mutations in the engine call notify() so listeners re-render.
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify() {
  listeners.forEach((listener) => listener());
}

export function getLeague() {
  return league;
}

export { league };
