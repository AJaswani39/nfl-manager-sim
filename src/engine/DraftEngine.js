import { TEAMS } from '../data/teams';
import { DRAFT_POSITIONS, FIRST_NAMES, LAST_NAMES, pickFrom, clamp } from './util';

const POTENTIALS = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];
const POTENTIAL_WEIGHTS = [0.03, 0.07, 0.15, 0.30, 0.20, 0.15, 0.10];

const STRENGTHS_BY_POSITION = {
  QB: ['Arm Strength', 'Pocket Awareness', 'Mobility', 'Deep Ball Accuracy', 'Leadership'],
  RB: ['Vision', 'Breakaway Speed', 'Pass Catching', 'Power Running', 'Elusiveness'],
  WR: ['Route Running', 'Deep Threat', 'Contested Catches', 'YAC Ability', 'Hands'],
  TE: ['Blocking', 'Red Zone Target', 'Seam Routes', 'Versatility', 'Size'],
  OL: ['Pass Protection', 'Run Blocking', 'Athleticism', 'Anchor Strength', 'Technique'],
  DL: ['Pass Rush', 'Bull Rush', 'Interior Disruption', 'Edge Speed', 'Motor'],
  LB: ['Tackling', 'Coverage Skills', 'Blitz Ability', 'Sideline-to-Sideline', 'Instincts'],
  DB: ['Ball Skills', 'Man Coverage', 'Zone Coverage', 'Tackling', 'Speed'],
};

const COMPARISONS_BY_POSITION = {
  QB: ['Patrick Mahomes', 'Josh Allen', 'Lamar Jackson', 'Joe Burrow', 'Jalen Hurts'],
  RB: ['Derrick Henry', 'Saquon Barkley', 'Christian McCaffrey', 'Josh Jacobs', 'Breece Hall'],
  WR: ["Ja'Marr Chase", 'Justin Jefferson', 'Tyreek Hill', 'CeeDeE Lamb', 'Amon-Ra St. Brown'],
  TE: ['Travis Kelce', 'Mark Andrews', 'George Kittle', 'TJ Hockenson', 'Sam LaPorta'],
  OL: ['Penei Sewell', 'Rashawn Slater', 'Tristan Wirfs', 'Joe Alt', 'Paris Johnson Jr.'],
  DL: ['Myles Garrett', 'Micah Parsons', 'Chris Jones', 'Aidan Hutchinson', 'Jalen Carter'],
  LB: ['Fred Warner', 'Roquan Smith', 'Devin White', 'Daiyan Henley', 'Patrick Queen'],
  DB: ['Sauce Gardner', 'Devon Witherspoon', 'Patrick Surtain II', 'Jaire Alexander', 'Derwin James'],
};

const MAX_SCOUT_LEVEL = 3;
const CPU_PICK_POOL_SIZE = 12;

const POTENTIAL_VALUE = {
  'A+': 10,
  A: 8,
  'B+': 6,
  B: 4,
  'C+': 2,
  C: 0,
  D: -2,
};

function pickWeightedPotential(random) {
  const potRoll = random();
  let cumulative = 0;
  for (let i = 0; i < POTENTIALS.length; i++) {
    cumulative += POTENTIAL_WEIGHTS[i];
    if (potRoll < cumulative) return POTENTIALS[i];
  }
  return 'C';
}

function potentialBand(potential) {
  if (['A+', 'A'].includes(potential)) return 'A range';
  if (['B+', 'B'].includes(potential)) return 'B range';
  if (['C+', 'C'].includes(potential)) return 'C range';
  return 'Developmental';
}

function roundLabel(pickIndex) {
  return Math.floor(pickIndex / TEAMS.length) + 1;
}

export const DraftEngine = {
  initializeDraftScouting(points = 12) {
    this.draftScouting = {
      points,
      reports: {},
    };
  },

  ensureDraftScouting() {
    if (!this.draftScouting || typeof this.draftScouting !== 'object') {
      this.initializeDraftScouting();
    }
    if (!this.draftScouting.reports) this.draftScouting.reports = {};
    if (!Number.isFinite(this.draftScouting.points)) this.draftScouting.points = 12;
  },

  generateDraftClass() {
    this.draftClass = [];
    this.initializeDraftScouting();
    const prospectCount = TEAMS.length * 3;

    for (let i = 0; i < prospectCount; i++) {
      const position = pickFrom(DRAFT_POSITIONS, () => this._random());
      const overall = 65 + Math.floor(this._random() * 25);
      let potential = pickWeightedPotential(() => this._random());

      if (overall >= 83 && this._random() < 0.5) {
        potential = POTENTIALS[Math.floor(this._random() * 3)];
      }

      const strengths = STRENGTHS_BY_POSITION[position] || ['Athleticism'];
      const comparisons = COMPARISONS_BY_POSITION[position] || ['Unknown'];

      this.draftClass.push({
        id: `rookie_${Date.now()}_${i}`,
        name: `${pickFrom(FIRST_NAMES, () => this._random())} ${pickFrom(LAST_NAMES, () => this._random())}`,
        position,
        overall,
        age: 21 + Math.floor(this._random() * 3),
        potential,
        strength: pickFrom(strengths, () => this._random()),
        comparison: pickFrom(comparisons, () => this._random()),
      });
    }

    this.draftClass.sort((a, b) => b.overall - a.overall);
  },

  getDraftScoutingPoints() {
    this.ensureDraftScouting();
    return this.draftScouting.points;
  },

  getProspectScoutLevel(playerId) {
    this.ensureDraftScouting();
    return this.draftScouting.reports[playerId]?.level || 0;
  },

  scoutProspect(playerId) {
    this.ensureDraftScouting();
    const prospect = (this.draftClass || []).find(player => player.id === playerId);
    if (!prospect || this.draftScouting.points <= 0) return null;

    const currentLevel = this.getProspectScoutLevel(playerId);
    if (currentLevel >= MAX_SCOUT_LEVEL) return this.getDraftProspectView(prospect);

    this.draftScouting.points -= 1;
    this.draftScouting.reports[playerId] = { level: currentLevel + 1 };
    return this.getDraftProspectView(prospect);
  },

  getDraftProspectView(prospect) {
    const scoutLevel = this.getProspectScoutLevel(prospect.id);
    const margin = scoutLevel === 0 ? 8 : scoutLevel === 1 ? 5 : scoutLevel === 2 ? 3 : 0;
    const low = clamp(prospect.overall - margin, 50, 99);
    const high = clamp(prospect.overall + margin, 50, 99);

    return {
      ...prospect,
      scoutLevel,
      isFullyScouted: scoutLevel >= MAX_SCOUT_LEVEL,
      projectedOverall: scoutLevel >= MAX_SCOUT_LEVEL ? `${prospect.overall}` : `${low}-${high}`,
      projectedPotential: scoutLevel >= 2 ? potentialBand(prospect.potential) : 'Unknown',
      visiblePotential: scoutLevel >= MAX_SCOUT_LEVEL ? prospect.potential : '?',
      visibleStrength: scoutLevel >= 1 ? prospect.strength : 'Scout to reveal trait',
      visibleComparison: scoutLevel >= MAX_SCOUT_LEVEL ? prospect.comparison : 'Scout to reveal comp',
    };
  },

  getDraftProspects() {
    return (this.draftClass || []).map(prospect => this.getDraftProspectView(prospect));
  },

  getDraftNeeds(teamId) {
    const roster = this.rosters[teamId] || [];
    const needs = DRAFT_POSITIONS.map(position => {
      const posPlayers = roster.filter(p => p.position === position);
      const count = posPlayers.length;
      const avgOvr = count > 0 ? Math.round(posPlayers.reduce((sum, p) => sum + p.overall, 0) / count) : 0;
      const bestOvr = count > 0 ? Math.max(...posPlayers.map(p => p.overall)) : 0;
      const needScore = (3 - Math.min(count, 3)) * 20 + Math.max(0, 80 - avgOvr);
      return { position, count, avgOvr, bestOvr, needScore };
    });
    needs.sort((a, b) => b.needScore - a.needScore);
    return needs;
  },

  startDraft() {
    this.generateDraftClass();

    const sortedTeams = this.getStandingsSorted().reverse();
    const baseOrder = sortedTeams.map(team => team.id);
    this.draftOrder = [];
    for (let round = 0; round < 3; round++) {
      this.draftOrder.push(...baseOrder);
    }
    this.currentPickIndex = 0;
  },

  getCpuDraftPickScore(teamId, prospect, boardIndex = 0) {
    const needs = this.getDraftNeeds(teamId);
    const need = needs.find(item => item.position === prospect.position);
    const needScore = need ? need.needScore : 0;
    const topNeedBonus = needs.slice(0, 3).some(item => item.position === prospect.position) ? 8 : 0;
    const valueScore = prospect.overall - boardIndex * 0.35;
    const upsideScore = POTENTIAL_VALUE[prospect.potential] || 0;
    const round = roundLabel(this.currentPickIndex || 0);
    const roundNeedWeight = round === 1 ? 0.35 : round === 2 ? 0.55 : 0.75;
    const randomness = (this._random() - 0.5) * 4;

    return valueScore + upsideScore + topNeedBonus + needScore * roundNeedWeight + randomness;
  },

  selectCpuDraftPick(teamId) {
    if (!this.draftClass || this.draftClass.length === 0) return null;

    const candidateCount = Math.min(CPU_PICK_POOL_SIZE, this.draftClass.length);
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < candidateCount; i++) {
      const prospect = this.draftClass[i];
      const score = this.getCpuDraftPickScore(teamId, prospect, i);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return {
      index: bestIndex,
      score: bestScore,
      prospect: this.draftClass[bestIndex],
    };
  },

  draftPlayerToTeam(teamId, playerIndex, context = {}) {
    if (!this.draftClass || playerIndex < 0 || playerIndex >= this.draftClass.length) return null;
    const pick = this.draftClass.splice(playerIndex, 1)[0];
    if (!pick) return null;

    pick.stats = {};
    if (!this.rosters[teamId]) this.rosters[teamId] = [];
    this.rosters[teamId].push(pick);
    this._indexAddPlayer(pick, teamId);
    this.addToDepthChart(teamId, pick);

    this.draftHistory.push({
      season: this.season,
      pick: this.currentPickIndex + 1,
      teamId,
      rationale: context.rationale || null,
      player: { name: pick.name, position: pick.position, overall: pick.overall, id: pick.id },
    });

    return pick;
  },

  resolveCpuPicks(userTeamId) {
    const displayLog = [];

    while (this.currentPickIndex < this.draftOrder.length) {
      const teamId = this.draftOrder[this.currentPickIndex];
      if (teamId === userTeamId) return displayLog;

      const selection = this.selectCpuDraftPick(teamId);
      const needs = this.getDraftNeeds(teamId);
      const positionalNeed = selection
        ? needs.find(need => need.position === selection.prospect.position)
        : null;
      const rationale = positionalNeed && needs.indexOf(positionalNeed) < 3 ? 'need' : 'value';
      const pick = selection ? this.draftPlayerToTeam(teamId, selection.index, { rationale }) : null;
      if (pick) {
        displayLog.push({
          type: 'pick',
          teamId,
          player: pick,
          rationale,
        });
      }
      this.currentPickIndex++;
    }
    return displayLog;
  },

  userSelectPlayer(userTeamId, playerIndex) {
    const pick = this.draftPlayerToTeam(userTeamId, playerIndex);
    if (!pick) return null;
    this.currentPickIndex++;
    return pick;
  },
};
