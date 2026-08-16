import { ROSTERS } from '../data/rosters';

export const SAVE_SCHEMA_VERSION = 2;

export const SAVE_FIELDS = [
  'slotId',
  'weeks',
  'standings',
  'playerStats',
  'playerState',
  'news',
  'rosters',
  'currentWeek',
  'phase',
  'userTeamId',
  'season',
  'draftClass',
  'draftOrder',
  'currentPickIndex',
  'draftScouting',
  'freeAgents',
  'coaches',
  'salaries',
  'teamCaps',
  'franchiseHistory',
  'superBowlWinner',
  'awards',
  'depthCharts',
  'gamePlans',
  'draftHistory',
  'practiceSquads',
  'injuredReserve',
  'trainingFocus',
  'randomSeed',
  'rngState',
  'playoffOddsCache',
];

// Fresh defaults per call so two deserializations never share mutable state.
// Reference types (objects/arrays) are created anew each time; primitives are fine.
function getDefaults() {
  return {
    weeks: [],
    standings: {},
    playerStats: {},
    playerState: {},
    news: [],
    rosters: JSON.parse(JSON.stringify(ROSTERS)),
    currentWeek: 1,
    phase: 'preseason',
    userTeamId: undefined,
    season: 1,
    slotId: null,
    draftClass: null,
    draftOrder: null,
    currentPickIndex: 0,
    draftScouting: null,
    freeAgents: [],
    coaches: {},
    salaries: {},
    teamCaps: {},
    franchiseHistory: [],
    superBowlWinner: null,
    awards: null,
    depthCharts: {},
    gamePlans: {},
    draftHistory: [],
    practiceSquads: {},
    injuredReserve: {},
    trainingFocus: {},
    randomSeed: undefined,
    rngState: undefined,
    playoffOddsCache: null,
  };
}

export function serializeLeague(league) {
  const data = { schemaVersion: SAVE_SCHEMA_VERSION };
  SAVE_FIELDS.forEach((key) => {
    data[key] = league[key];
  });
  return data;
}

export function deserializeLeague(league, data) {
  if (!data) return false;
  const defaults = getDefaults();
  SAVE_FIELDS.forEach((key) => {
    league[key] = data[key] !== undefined ? data[key] : defaults[key];
  });
  // Ensure roster exists even if the save payload omitted it.
  if (!league.rosters || !Array.isArray(league.rosters)) {
    league.rosters = JSON.parse(JSON.stringify(ROSTERS));
  }
  league.season = data.season || 1;
  league.slotId = data.slotId != null ? data.slotId : null;
  league.setRandomSeed(data.randomSeed || Date.now());
  if (Number.isFinite(data.rngState)) {
    league._rngState = (data.rngState >>> 0) || 1;
  }
  league._standingsDirty = true;
  league._cachedStandings = null;
  league.rebuildPlayerIndex();
  Object.keys(league.rosters).forEach((teamId) => {
    if (!league.depthCharts[teamId]) league.ensureDepthChart(teamId);
  });
  if (!league.gamePlans || Object.keys(league.gamePlans).length === 0) {
    league.initializeGamePlans();
  }
  league.initializePracticeSquads();
  league.initializeInjuredReserve();
  if (!league.trainingFocus) league.initializeTraining();
  return true;
}
