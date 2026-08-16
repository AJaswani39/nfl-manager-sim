import { TEAMS } from '../data/teams';

export function shuffle(array, random = Math.random) {
  let currentIndex = array.length;
  let randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex -= 1;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

export function pickFrom(list, random = Math.random) {
  return list[Math.floor(random() * list.length)];
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function blankPlayerStats() {
  return {
    passingYards: 0,
    passingTDs: 0,
    passingAtt: 0,
    passingComp: 0,
    rushingYards: 0,
    rushingTDs: 0,
    rushingAtt: 0,
    receivingYards: 0,
    receivingTDs: 0,
    receptions: 0,
    tackles: 0,
    sacks: 0,
    interceptions: 0,
    defTDs: 0,
    fumblesRecovered: 0,
  };
}

const TEAMS_BY_ID = TEAMS.reduce((acc, team) => {
  acc[team.id] = team;
  return acc;
}, {});

export function getTeamById(teamId) {
  return TEAMS_BY_ID[teamId] || null;
}
