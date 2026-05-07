import { TEAMS } from '../data/teams';
import { ROSTERS } from '../data/rosters';

// Helper to shuffle array
const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

export class LeagueEngine {
  constructor(seed = Date.now()) {
    this.setRandomSeed(seed);
    // Snapshot original TEAMS ratings so resetGame() can fully restore them
    this._originalTeamRatings = TEAMS.map(t => ({
      id: t.id,
      offense: t.ratings.offense,
      defense: t.ratings.defense,
      overall: t.ratings.overall,
    }));
    this.weeks = []; // Array of arrays of matches
    this.standings = {};
    this.playerStats = {}; // { playerId: { passingYards: 0, touchdowns: 0, ... } }
    this.playerState = {}; // { playerId: { weeksOut: 0 } }
    this.news = []; // Array of { message, type, week }
    this.rosters = JSON.parse(JSON.stringify(ROSTERS)); // Mutable Rosters
    this.freeAgents = []; // Players not on any team
    this.coaches = {}; // { teamId: coachType }
    this.salaries = {}; // { playerId: { amount, years } }
    this.teamCaps = {}; // { teamId: { spent, cap } }
    this.franchiseHistory = []; // Array of { season, champion, mvp, ... }
    this.depthCharts = {}; // { teamId: { position: [playerId, ...] } }
    this.gamePlans = {}; // { teamId: { offense: 'balanced', defense: 'balanced' } }
    this.draftHistory = []; // [{ season, pick, teamId, player: { name, position, overall } }]
    this.practiceSquads = {}; // { teamId: [playerObj, ...] } — practice squad roster
    this.injuredReserve = {}; // { teamId: [{ playerId, player, weekPlaced, minWeeks }] }
    this.currentWeek = 1;
    this.season = 1;
    this.slotId = null;
    this.phase = 'preseason'; // 'preseason', 'regular', 'playoffs', 'offseason'
    this.playerIndex = {}; // { playerId: { ...player, teamId } } — O(1) lookup
    this._standingsDirty = true; // dirty-flag for cached standings
    this._cachedStandings = null;
    this.initializeStandings();
    this.initializePlayerStats();
    this.initializeCoaches();
    this.initializeSalaries();
    this.rebuildPlayerIndex();
    this.initializeDepthCharts();
    this.initializeGamePlans();
    this.initializePracticeSquads();
    this.initializeInjuredReserve();
  }

  setRandomSeed(seed) {
    const parsed = Number(seed);
    this.randomSeed = Number.isFinite(parsed) ? parsed : Date.now();
    // LCG state must be uint32 and non-zero for better distribution.
    this._rngState = (this.randomSeed >>> 0) || 1;
  }

  _random() {
    // Deterministic LCG RNG to support reproducible simulations.
    this._rngState = (1664525 * this._rngState + 1013904223) >>> 0;
    return this._rngState / 4294967296;
  }

  // --- TRADE DEADLINE ---
  // Week 8 of regular season = internal week 11 (3 preseason + 8 regular)
  isTradeWindowOpen() {
    if (this.phase === 'preseason') return true;
    if (this.phase === 'regular') return this.currentWeek <= 11;
    return false; // playoffs/offseason: no trades
  }

  getTradeDeadlineInfo() {
    if (this.phase !== 'regular') return null;
    const regWeek = this.currentWeek - 3;
    const deadlineWeek = 8;
    if (regWeek > deadlineWeek) return { passed: true, weeksAgo: regWeek - deadlineWeek };
    return { passed: false, weeksUntil: deadlineWeek - regWeek };
  }

  // --- GAME PLANS ---
  initializeGamePlans() {
    const offOptions = ['run_heavy', 'balanced', 'pass_heavy', 'spread'];
    const defOptions = ['aggressive', 'balanced', 'conservative', 'blitz_heavy'];
    TEAMS.forEach(team => {
      if (!this.gamePlans[team.id]) {
        this.gamePlans[team.id] = {
          offense: offOptions[Math.floor(this._random() * offOptions.length)],
          defense: defOptions[Math.floor(this._random() * defOptions.length)],
        };
      }
    });
  }

  getGamePlan(teamId) {
    return this.gamePlans[teamId] || { offense: 'balanced', defense: 'balanced' };
  }

  setGamePlan(teamId, offense, defense) {
    this.gamePlans[teamId] = { offense, defense };
  }

  getPlayWeights(teamId) {
    const plan = this.getGamePlan(teamId);
    // Offense weights: [runInside, runOutside, passShort, passDeep, screen, playAction, draw]
    const offenseWeights = {
      run_heavy:  { run: 0.52, shortPass: 0.18, deepPass: 0.07, screen: 0.06, playAction: 0.12, draw: 0.05 },
      balanced:   { run: 0.34, shortPass: 0.25, deepPass: 0.14, screen: 0.09, playAction: 0.11, draw: 0.07 },
      pass_heavy: { run: 0.14, shortPass: 0.30, deepPass: 0.24, screen: 0.11, playAction: 0.12, draw: 0.09 },
      spread:     { run: 0.17, shortPass: 0.24, deepPass: 0.15, screen: 0.19, playAction: 0.11, draw: 0.14 },
    };
    const defenseWeights = {
      aggressive:   { runDef: 0.26, coverage: 0.32, blitz: 0.42 },
      balanced:     { runDef: 0.34, coverage: 0.42, blitz: 0.24 },
      conservative: { runDef: 0.32, coverage: 0.56, blitz: 0.12 },
      blitz_heavy:  { runDef: 0.18, coverage: 0.25, blitz: 0.57 },
    };
    return {
      offense: offenseWeights[plan.offense] || offenseWeights.balanced,
      defense: defenseWeights[plan.defense] || defenseWeights.balanced,
    };
  }

  getGamePlanScoreModifier(offTeamId, defTeamId) {
    const offPlan = this.getGamePlan(offTeamId);
    const defPlan = this.getGamePlan(defTeamId);
    let mod = 0;
    if (offPlan.offense === 'run_heavy') mod += 0.5;
    if (offPlan.offense === 'pass_heavy') mod += 1.0;
    if (offPlan.offense === 'spread') mod += 0.75;

    if (defPlan.defense === 'blitz_heavy') mod -= 0.5;
    if (defPlan.defense === 'conservative') mod -= 0.75;
    if (defPlan.defense === 'aggressive') mod -= 0.25;

    if (defPlan.defense === 'blitz_heavy' && offPlan.offense === 'spread') mod += 2.0;
    if (defPlan.defense === 'blitz_heavy' && offPlan.offense === 'pass_heavy') mod += 0.75;
    if (defPlan.defense === 'conservative' && offPlan.offense === 'run_heavy') mod += 1.25;
    if (defPlan.defense === 'aggressive' && offPlan.offense === 'balanced') mod -= 0.75;
    if (defPlan.defense === 'balanced' && offPlan.offense === 'spread') mod -= 0.5;
    return mod;
  }

  // --- PLAYER INDEX ---
  // O(1) lookup: playerIndex[playerId] = { ...player, teamId }
  // Replaces the O(p*t) findPlayer() closures in getLeaderboard/calculateAwards.
  rebuildPlayerIndex() {
    this.playerIndex = {};
    for (const teamId of Object.keys(this.rosters)) {
      for (const player of this.rosters[teamId]) {
        this.playerIndex[player.id] = { ...player, teamId };
      }
    }
    // Index practice squad players
    for (const teamId of Object.keys(this.practiceSquads || {})) {
      for (const player of this.practiceSquads[teamId]) {
        this.playerIndex[player.id] = { ...player, teamId, onPracticeSquad: true };
      }
    }
    // Index injured reserve players
    for (const teamId of Object.keys(this.injuredReserve || {})) {
      for (const entry of (this.injuredReserve[teamId] || [])) {
        this.playerIndex[entry.playerId] = { ...entry.player, teamId, onIR: true };
      }
    }
  }

  _indexAddPlayer(player, teamId) {
    this.playerIndex[player.id] = { ...player, teamId };
  }

  _indexRemovePlayer(playerId) {
    delete this.playerIndex[playerId];
  }

  findPlayer(playerId) {
    return this.playerIndex[playerId] || null;
  }

  initializeStandings() {
    TEAMS.forEach(team => {
      this.standings[team.id] = { w: 0, l: 0, pf: 0, pa: 0, matches: [] };
    });
    this._standingsDirty = true;
  }

  initializePlayerStats() {
    const rosters = this.rosters || ROSTERS;
    Object.keys(rosters).forEach(teamId => {
      rosters[teamId].forEach(player => {
        this.playerStats[player.id] = {
          passingYards: 0, passingTDs: 0, passingAtt: 0, passingComp: 0,
          rushingYards: 0, rushingTDs: 0, rushingAtt: 0,
          receivingYards: 0, receivingTDs: 0, receptions: 0,
          tackles: 0, sacks: 0, interceptions: 0,
          defTDs: 0, fumblesRecovered: 0
        };
      });
    });
  }

  initializeCoaches() {
    const coachTypes = this.getCoachTypes();
    TEAMS.forEach(team => {
      // Assign random coach to each team initially
      const randomType = coachTypes[Math.floor(this._random() * coachTypes.length)];
      this.coaches[team.id] = randomType.id;
    });
  }

  getCoachTypes() {
    return [
      {
        id: 'aggressive',
        name: 'Aggressive',
        icon: '🔥',
        description: 'High-risk, high-reward play calling',
        bonuses: { offense: 5, defense: -3, developmentBonus: 0 }
      },
      {
        id: 'conservative',
        name: 'Conservative',
        icon: '🛡️',
        description: 'Safe, methodical gameplay',
        bonuses: { offense: -3, defense: 5, developmentBonus: 0 }
      },
      {
        id: 'balanced',
        name: 'Balanced',
        icon: '⚖️',
        description: 'Well-rounded approach',
        bonuses: { offense: 2, defense: 2, developmentBonus: 0 }
      },
      {
        id: 'developmental',
        name: 'Player Coach',
        icon: '📈',
        description: 'Focuses on player growth',
        bonuses: { offense: 0, defense: 0, developmentBonus: 3 }
      },
      {
        id: 'offensive',
        name: 'Offensive Guru',
        icon: '⚡',
        description: 'Offensive mastermind',
        bonuses: { offense: 8, defense: -5, developmentBonus: 0 }
      },
      {
        id: 'defensive',
        name: 'Defensive Mastermind',
        icon: '🏰',
        description: 'Shutdown defense specialist',
        bonuses: { offense: -5, defense: 8, developmentBonus: 0 }
      }
    ];
  }

  setCoach(teamId, coachTypeId) {
    const validCoach = this.getCoachTypes().find(c => c.id === coachTypeId);
    if (validCoach) {
      this.coaches[teamId] = coachTypeId;
      this.addNews(`${teamId} hired a new ${validCoach.name} coach.`, 'transaction');
      return true;
    }
    return false;
  }

  getCoach(teamId) {
    const coachId = this.coaches[teamId] || 'balanced';
    return this.getCoachTypes().find(c => c.id === coachId) || this.getCoachTypes()[2];
  }

  getCoachBonus(teamId, type) {
    const coach = this.getCoach(teamId);
    return coach.bonuses[type] || 0;
  }

  // SALARY CAP SYSTEM
  initializeSalaries() {
    const SALARY_CAP = 200; // $200M cap
    
    TEAMS.forEach(team => {
      this.teamCaps[team.id] = { spent: 0, cap: SALARY_CAP };
    });

    // Assign initial salaries based on overall rating
    Object.keys(ROSTERS).forEach(teamId => {
      let spent = 0;
      ROSTERS[teamId].forEach(player => {
        const salary = this.calculateSalary(player.overall, player.position);
        this.salaries[player.id] = { amount: salary, years: 3 };
        spent += salary;
      });
      if (this.teamCaps[teamId]) {
        this.teamCaps[teamId].spent = spent;
      }
    });
  }

  // DEPTH CHART SYSTEM
  initializeDepthCharts() {
    const CHART_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];
    const rosters = this.rosters || ROSTERS;
    Object.keys(rosters).forEach(teamId => {
      this.depthCharts[teamId] = {};
      CHART_POSITIONS.forEach(pos => {
        const players = rosters[teamId]
          .filter(p => p.position === pos)
          .sort((a, b) => (b.overall || 0) - (a.overall || 0));
        this.depthCharts[teamId][pos] = players.map(p => p.id);
      });
    });
  }

  ensureDepthChart(teamId) {
    const CHART_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];
    if (!this.depthCharts[teamId]) this.depthCharts[teamId] = {};

    const roster = this.rosters[teamId] || [];
    CHART_POSITIONS.forEach(pos => {
      const rosterIds = roster.filter(p => p.position === pos).map(p => p.id);
      const existing = this.depthCharts[teamId][pos] || [];
      // Keep existing order for players still on roster, append new ones sorted by overall
      const kept = existing.filter(id => rosterIds.includes(id));
      const added = rosterIds.filter(id => !kept.includes(id));
      const addedSorted = roster
        .filter(p => added.includes(p.id))
        .sort((a, b) => (b.overall || 0) - (a.overall || 0))
        .map(p => p.id);
      this.depthCharts[teamId][pos] = [...kept, ...addedSorted];
    });
  }

  getDepthChart(teamId) {
    if (!this.depthCharts[teamId]) {
      this.ensureDepthChart(teamId);
    }
    return this.depthCharts[teamId];
  }

  setDepthOrder(teamId, position, orderedPlayerIds) {
    if (!this.depthCharts[teamId]) this.ensureDepthChart(teamId);
    const roster = this.rosters[teamId] || [];
    const validIds = roster.filter(p => p.position === position).map(p => p.id);
    this.depthCharts[teamId][position] = orderedPlayerIds.filter(id => validIds.includes(id));
  }

  getDepthOrderedRoster(teamId, position) {
    this.ensureDepthChart(teamId);
    const chart = this.depthCharts[teamId][position] || [];
    const roster = this.rosters[teamId] || [];

    const ordered = [];
    chart.forEach(id => {
      const p = roster.find(pl => pl.id === id);
      if (p) ordered.push(p);
    });
    // Append any roster members at this position missing from depth chart
    roster.forEach(p => {
      if (p.position === position && !ordered.find(o => o.id === p.id)) {
        ordered.push(p);
      }
    });
    return ordered;
  }

  addToDepthChart(teamId, player) {
    if (!this.depthCharts[teamId]) this.ensureDepthChart(teamId);
    const pos = player.position;
    if (!this.depthCharts[teamId][pos]) this.depthCharts[teamId][pos] = [];
    if (!this.depthCharts[teamId][pos].includes(player.id)) {
      this.depthCharts[teamId][pos].push(player.id);
    }
  }

  removeFromDepthChart(teamId, playerId) {
    if (!this.depthCharts[teamId]) return;
    Object.keys(this.depthCharts[teamId]).forEach(pos => {
      this.depthCharts[teamId][pos] = this.depthCharts[teamId][pos].filter(id => id !== playerId);
    });
  }

  calculateSalary(overall, position) {
    // Base salary from overall
    let base = Math.floor((overall - 60) * 0.5); // 0-20M base
    
    // Position premium
    if (position === 'QB') base = Math.floor(base * 1.8);
    else if (['WR', 'CB', 'DL'].includes(position)) base = Math.floor(base * 1.2);
    
    return Math.max(1, Math.min(45, base)); // $1M min, $45M max
  }

  getTeamCap(teamId) {
    return this.teamCaps[teamId] || { spent: 0, cap: 200 };
  }

  getPlayerSalary(playerId) {
    return this.salaries[playerId] || { amount: 1, years: 1 };
  }

  getCapSpace(teamId) {
    const cap = this.getTeamCap(teamId);
    return cap.cap - cap.spent;
  }

  getExpiringContracts(teamId) {
    const roster = this.rosters[teamId] || [];
    return roster.filter(player => {
      const contract = this.getPlayerSalary(player.id);
      return contract.years <= 1;
    }).map(player => ({
      ...player,
      contract: this.getPlayerSalary(player.id),
    }));
  }

  extendContract(teamId, playerId, years, salary) {
    this.salaries[playerId] = { amount: salary, years };
    this.updateTeamSpending(teamId);
  }

  calculateExtensionCost(player) {
    const baseSalary = this.calculateSalary(player.overall, player.position);
    // Extension premium: 10-20% above base depending on age
    const ageFactor = player.age <= 27 ? 1.2 : player.age <= 30 ? 1.1 : 1.0;
    return Math.max(1, Math.floor(baseSalary * ageFactor));
  }

  decrementContractYears() {
    Object.keys(this.salaries).forEach(playerId => {
      const contract = this.salaries[playerId];
      if (contract && contract.years > 0) {
        contract.years -= 1;
      }
    });
  }

  getExpiredContractPlayers(teamId) {
    const roster = this.rosters[teamId] || [];
    return roster.filter(player => {
      const contract = this.salaries[player.id];
      return contract && contract.years <= 0;
    });
  }

  updateTeamSpending(teamId) {
    const roster = this.rosters[teamId] || [];
    let spent = 0;
    roster.forEach(player => {
      spent += this.getPlayerSalary(player.id).amount;
    });
    if (this.teamCaps[teamId]) {
      this.teamCaps[teamId].spent = spent;
    }
  }

  // FRANCHISE HISTORY
  recordSeasonHistory() {
    const standings = this.getStandingsSorted();
    const champion = this.superBowlWinner || standings[0]; // prefer actual SB winner
    const champStandings = champion ? this.standings[champion.id] : null;
    const awards = this.getAwards();

    const seasonRecord = {
      season: this.season,
      champion: champion
        ? { id: champion.id, name: champion.name, record: champStandings ? `${champStandings.w}-${champStandings.l}` : '?' }
        : null,
      mvp: awards?.mvp ? { name: awards.mvp.name, teamId: awards.mvp.teamId, position: awards.mvp.position } : null,
      opoy: awards?.opoy ? { name: awards.opoy.name, teamId: awards.opoy.teamId } : null,
      dpoy: awards?.dpoy ? { name: awards.dpoy.name, teamId: awards.dpoy.teamId } : null,
      userTeamId: this.userTeamId,
      userRecord: this.standings[this.userTeamId] ? `${this.standings[this.userTeamId].w}-${this.standings[this.userTeamId].l}` : null,
      userFinish: standings.findIndex(s => s.id === this.userTeamId) + 1
    };
    
    this.franchiseHistory.push(seasonRecord);
  }

  getFranchiseHistory() {
    return this.franchiseHistory || [];
  }

  getUserChampionships() {
    return this.franchiseHistory.filter(h => h.champion?.id === this.userTeamId).length;
  }

  generateSchedule() {
    // 1. PRESEASON (3 Weeks)
    // Random matchups, don't care about constraints much
    for (let w = 1; w <= 3; w++) {
        const weeklyMatches = [];
        const teamsPool = shuffle([...TEAMS]);
        while (teamsPool.length >= 2) {
            weeklyMatches.push({ 
                id: `pre_w${w}_${teamsPool.length}`,
                week: w,
                home: teamsPool.pop(),
                away: teamsPool.pop(),
                played: false,
                result: null,
                isPreseason: true,
                type: 'Preseason'
            });
        }
        this.weeks.push(weeklyMatches);
    }

    // 2. REGULAR SEASON (17 Weeks)
    for (let w = 1; w <= 17; w++) {
      const weeklyMatches = [];
      const teamsPool = shuffle([...TEAMS]);
      
      while (teamsPool.length >= 2) {
        const home = teamsPool.pop();
        const away = teamsPool.pop();
        weeklyMatches.push({ 
          id: `reg_w${w}_${home.id}_${away.id}`,
          week: w, // This "week" property is internal relative to the block, 
                   // but strictly we access by index in simulateWeek.
          home: home,
          away: away,
          played: false,
          result: null,
          isPreseason: false,
          type: 'Regular'
        });
      }
      this.weeks.push(weeklyMatches);
    }
  }

  startPlayoffs() {
    this.phase = 'playoffs';
    this.generatePlayoffRound('Wild Card');
  }

  generatePlayoffRound(roundName) {
    const seeds = this.getPlayoffPicture(); // Returns { AFC: [7 teams], NFC: [7 teams] } sorted by seed result
    const newMatches = [];
    const w = this.weeks.length + 1; // Week 18+

    // WILD CARD ROUND (Weeks 1-17 done. This is Week 18)
    if (roundName === 'Wild Card') {
       // AFC & NFC: 2 vs 7, 3 vs 6, 4 vs 5. (Seed 1 Bye)
       ['AFC', 'NFC'].forEach(conf => {
          const t = seeds[conf];
          newMatches.push(this.createMatch(w, t[1], t[6], 'Wild Card')); // 2 vs 7
          newMatches.push(this.createMatch(w, t[2], t[5], 'Wild Card')); // 3 vs 6
          newMatches.push(this.createMatch(w, t[3], t[4], 'Wild Card')); // 4 vs 5
       });
    } 
    // DIVISIONAL ROUND
    else if (roundName === 'Divisional') {
       // We need to know who won the WC round to re-seed.
       // The previous week (last in this.weeks) contains the results.
       const lastWeek = this.weeks[this.weeks.length - 1];
       const winners = lastWeek
         .filter(m => m.result != null) // guard against unplayed games
         .map(m => m.result.homeScore >= m.result.awayScore ? m.home : m.away);

       ['AFC', 'NFC'].forEach(conf => {
          // Get Seed 1 (who had bye)
          const allSeeds = this.getPlayoffPicture()[conf];
          const seed1 = allSeeds[0];

          // Get WC Winners for this conference
          const confWinners = winners.filter(t => t.conference === conf);
          if (confWinners.length < 2) return; // not enough results to generate matchups

          // Re-seed by original playoff seed order
          confWinners.sort((a,b) => {
             const idxA = allSeeds.findIndex(s => s.id === a.id);
             const idxB = allSeeds.findIndex(s => s.id === b.id);
             return idxA - idxB;
          });
          // Lowest seed (highest index) plays Seed 1
          // Match 1: Seed 1 vs WC3 (Lowest)
          // Match 2: WC1 vs WC2
          const lowestSeed = confWinners.pop(); // worst seeded WC winner

          newMatches.push(this.createMatch(w, seed1, lowestSeed, 'Divisional'));
          if (confWinners.length >= 2) {
            newMatches.push(this.createMatch(w, confWinners[0], confWinners[1], 'Divisional'));
          }
       });
    }
    // CONFERENCE CHAMPIONSHIP
    else if (roundName === 'Conference') {
       const lastWeek = this.weeks[this.weeks.length - 1];
       const winners = lastWeek
         .filter(m => m.result != null)
         .map(m => m.result.homeScore >= m.result.awayScore ? m.home : m.away);

       ['AFC', 'NFC'].forEach(conf => {
          const confWinners = winners.filter(t => t.conference === conf);
          if (confWinners.length < 2) return; // guard: need exactly 2 per conference
          const allSeeds = this.getPlayoffPicture()[conf];
          confWinners.sort((a,b) => allSeeds.findIndex(s=>s.id===a.id) - allSeeds.findIndex(s=>s.id===b.id));

          newMatches.push(this.createMatch(w, confWinners[0], confWinners[1], 'Conference'));
       });
    }
    // SUPER BOWL
    else if (roundName === 'Super Bowl') {
       const lastWeek = this.weeks[this.weeks.length - 1];
       const winners = lastWeek
         .filter(m => m.result != null)
         .map(m => m.result.homeScore >= m.result.awayScore ? m.home : m.away);
       if (winners.length >= 2) {
         // winners[0] = AFC champion, winners[1] = NFC champion
         newMatches.push(this.createMatch(w, winners[0], winners[1], 'Super Bowl'));
       }
    }

    this.weeks.push(newMatches);
  }

  createMatch(week, home, away, type) {
     return {
        id: `p_${week}_${home.id}_${away.id}`,
        week: week,
        home: home,
        away: away,
        played: false,
        result: null,
        type: type // 'Wild Card', etc
     };
  }

  applyGameResult(result, gameStats, newInjuries) {
      if (!result) return;
      // Find the match in current week or recent weeks
      // We look for the exact match ID or team combo in currentWeek-1 (since currWeek is 1-based)
      // Actually we might be in next week if we clicked simulate? No, user plays THEN simulates.
      
      const w = this.currentWeek - 1;
      if (w < 0 || w >= this.weeks.length) return;
      
      const match = this.weeks[w].find(m => 
        (m.home.id === result.homeId && m.away.id === result.awayId) || 
        (m.home.id === result.awayId && m.away.id === result.homeId)
      );

      if (!match) return;

      match.result = result;
      match.played = true;

      // Update Standings (if regular & not preseason)
      if (this.phase === 'regular' && !match.isPreseason) {
          this.updateStandings(match.home.id, result.homeScore, result.awayScore);
          this.updateStandings(match.away.id, result.awayScore, result.homeScore);
      }

      // Merge Stats
      if (gameStats) {
          Object.keys(gameStats).forEach(playerId => {
              const src = gameStats[playerId];
              if (!this.playerStats[playerId]) {
                  this.playerStats[playerId] = { ...src };
              } else {
                  const dest = this.playerStats[playerId];
                  // Safe accumulation
                  const add = (k) => (dest[k] = (dest[k] || 0) + (src[k] || 0));
                  add('passingYards'); add('passingTDs'); add('passingAtt'); add('passingComp');
                  add('rushingYards'); add('rushingTDs'); add('rushingAtt');
                  add('receivingYards'); add('receivingTDs'); add('receptions');
                  add('tackles'); add('sacks'); add('interceptions');
                  add('defTDs'); add('fumblesRecovered');
              }
          });
      }

      // Record Injuries
      if (newInjuries) {
          Object.keys(newInjuries).forEach(pid => {
              this.playerState[pid] = { weeksOut: newInjuries[pid] };
          });
      }
  }

  // Update simulateWeek to handle progression
  simulateWeek(weekIndex) {
    // Process Healing if advancing current week
    if (weekIndex === this.currentWeek - 1) {
        Object.keys(this.playerState).forEach(pid => {
            if (this.playerState[pid].weeksOut > 0) {
                this.playerState[pid].weeksOut--;
                // Don't auto-clear injury state for players on IR
                const isOnIR = Object.values(this.injuredReserve || {}).some(
                  irList => irList.some(e => e.playerId === pid)
                );
                if (this.playerState[pid].weeksOut <= 0 && !isOnIR) {
                  delete this.playerState[pid];
                }
            }
        });

        // CPU teams auto-manage practice squad and IR
        TEAMS.forEach(team => {
          if (team.id !== this.userTeamId) {
            this.cpuManagePracticeSquadAndIR(team.id);
          }
        });
    }

    if (weekIndex < 0 || weekIndex >= this.weeks.length) return;
    
    const weekMatches = this.weeks[weekIndex];
    let allPlayed = true;

    // Check if this is the start of Regular Season transition?
    // No, we handle transitions at end of week.

    weekMatches.forEach(match => {
      if (match.played) return;
      
      const homeScore = this.calculateScore(match.home, match.away);
      const awayScore = this.calculateScore(match.away, match.home);
      match.result = { homeScore, awayScore };
      match.played = true;
      this.generateGameNews(match);

      // STARTING PRESEASON LOGIC
      if (match.isPreseason) {
          // Do NOT update standings.
          // Optional: Distribute stats? Maybe reduced stats for starters?
          // For now, let's distribute stats just for fun, or skip to save DB size?
          // Let's skip stats for Preseason to keep signals clean.
          return; 
      }

      // REGULAR & PLAYOFFS
      // Only update Regular Season standings
      if (this.phase === 'regular' && !match.isPreseason) {
        this.updateStandings(match.home.id, homeScore, awayScore);
        this.updateStandings(match.away.id, awayScore, homeScore);
      }
      this.distributeStats(match.home.id, homeScore);
      this.distributeStats(match.away.id, awayScore);
    });

    this.currentWeek++;

    // CHECK PHASE TRANSITIONS
    // Preseason is index 0, 1, 2 (Weeks 1-3).
    // Regular is index 3..19 (Weeks 4-20) -> labeled Week 1-17
    
    // We just finished weekIndex.
    // If we finished index 2 (Preseason Week 3), next is index 3 (Reg Week 1)
    if (weekIndex === 2) { 
        this.phase = 'regular';
    }
    
    // If we finished index 19 (Reg Week 17), next is Playoffs
    // Preseason(3) + Regular(17) = 20 weeks total. Indices 0-19.
    // So if this.currentWeek (which was just incremented) is > 20...
    // this.currentWeek is now weekIndex + 2 effectively? (starts at 1)
    // Let's track strictly by index
    
    const totalRegWeeks = 3 + 17; // 20
    if (this.currentWeek > totalRegWeeks && this.phase === 'regular') {
       this.phase = 'playoffs'; // Transition state for UI
       this.startPlayoffs(); 
    } 
    else if (this.phase === 'regular') {
       this.checkElimination();
    } 
    else if (this.phase === 'playoffs') {
       // Just finished a playoff week, generate next
       const lastRound = weekMatches[0].type;
       if (lastRound === 'Wild Card') this.generatePlayoffRound('Divisional');
       else if (lastRound === 'Divisional') this.generatePlayoffRound('Conference');
       else if (lastRound === 'Conference') this.generatePlayoffRound('Super Bowl');
       else if (lastRound === 'Super Bowl') {
          // Record the actual Super Bowl winner before transitioning
          const sbMatch = weekMatches[0];
          if (sbMatch && sbMatch.result) {
            this.superBowlWinner = sbMatch.result.homeScore >= sbMatch.result.awayScore
              ? sbMatch.home
              : sbMatch.away;
          }
          this.phase = 'offseason'; // End of season
       }
    }

    this.generateWeeklyNews();
  }

  checkElimination() {
      // MVP logic: If MaxPossibleWins < Seed 7 Wins, Eliminated.
      const picture = this.getPlayoffPicture();
      ['AFC', 'NFC'].forEach(conf => {
          const seeds = picture[conf]; // Top 7 are seeds. Rest are 'In the Hunt' or 'Eliminated'
          if (seeds.length < 7) return;
          
          const seed7 = seeds[6]; // The cutoff
          const thresholdWins = seed7.w;
          
          // Check all teams in this conference
          const confTeams = this.getStandingsSorted().filter(t => t.conference === conf);
          
          confTeams.forEach(team => {
             const gamesPlayed = team.w + team.l; // + ties? MVP no ties.
             const gamesRemaining = 17 - gamesPlayed;
             const maxWins = team.w + gamesRemaining;
             
             if (maxWins < thresholdWins) {
                 this.standings[team.id].eliminated = true;
             } else {
                 this.standings[team.id].eliminated = false;
             }
             
             // Check Clinched (If MinWins > Seed 8 MaxWins)
             // ... Logic for another day
          });
      });
  }

// ... existing code ...

  calculateScore(offenseTeam, defenseTeam) {
    const base = Math.floor(this._random() * 20);
    const matchUpDiff = (offenseTeam.ratings.offense - defenseTeam.ratings.defense) / 3;
    const planMod = this.getGamePlanScoreModifier(offenseTeam.id, defenseTeam.id);
    const offCoachBonus = this.getCoachBonus(offenseTeam.id, 'offense');
    const defCoachBonus = this.getCoachBonus(defenseTeam.id, 'defense');
    let score = 17 + base + matchUpDiff + planMod + offCoachBonus - defCoachBonus;
    if (this._random() > 0.95) score += 14;
    if (this._random() < 0.05) score = 0;
    return Math.max(0, Math.floor(score));
  }

  ensurePlayerStats(playerId) {
    if (!this.playerStats[playerId]) {
      this.playerStats[playerId] = {
        passingYards: 0, passingTDs: 0, passingAtt: 0, passingComp: 0,
        rushingYards: 0, rushingTDs: 0, rushingAtt: 0,
        receivingYards: 0, receivingTDs: 0, receptions: 0,
        tackles: 0, sacks: 0, interceptions: 0
      };
    }
  }

  distributeStats(teamId, score) {
    const roster = this.rosters[teamId];
    if (!roster) return;

    // Use depth chart order: starters get the lion's share
    const qbs = this.getDepthOrderedRoster(teamId, 'QB');
    const rbs = this.getDepthOrderedRoster(teamId, 'RB');
    const wrs = [...this.getDepthOrderedRoster(teamId, 'WR'), ...this.getDepthOrderedRoster(teamId, 'TE')];
    const qb = qbs[0] || null;

    // 1. Determine Touchdowns
    const tds = Math.floor(score / 7);
    let passingTDs = 0;
    let rushingTDs = 0;

    for (let i = 0; i < tds; i++) {
      if (this._random() > 0.4) passingTDs++; else rushingTDs++;
    }

    // 2. Determine Yards (Approx 10-15 yards per point + base)
    const totalYards = 150 + (score * 10) + Math.floor(this._random() * 100);
    const passingYards = Math.floor(totalYards * (0.6 + this._random() * 0.2));
    const rushingYards = totalYards - passingYards;

    // 3. Assign to Players — starters get majority share
    if (qb) {
      this.ensurePlayerStats(qb.id);
      this.playerStats[qb.id].passingYards += passingYards;
      this.playerStats[qb.id].passingTDs += passingTDs;
    }

    // RB1 gets ~65% of rushing, rest split among backups
    if (rbs.length > 0) {
      let remainingRush = rushingYards;
      let remainingRushTD = rushingTDs;
      rbs.forEach((rb, idx) => {
        this.ensurePlayerStats(rb.id);
        if (idx === rbs.length - 1) {
          this.playerStats[rb.id].rushingYards += Math.max(0, remainingRush);
          this.playerStats[rb.id].rushingTDs += Math.max(0, remainingRushTD);
        } else {
          const starterShare = idx === 0 ? (0.60 + this._random() * 0.15) : (0.3 + this._random() * 0.2);
          const share = Math.floor(remainingRush * starterShare);
          const tdShare = remainingRushTD > 0 && (idx === 0 ? this._random() > 0.3 : this._random() > 0.6) ? 1 : 0;
          this.playerStats[rb.id].rushingYards += share;
          this.playerStats[rb.id].rushingTDs += tdShare;
          remainingRush -= share;
          remainingRushTD -= tdShare;
        }
      });
    }

    // WR1 ~35%, WR2 ~25%, rest split
    if (wrs.length > 0) {
      const starterShares = [0.35, 0.25];
      let remainingPass = passingYards;
      let remainingPassTD = passingTDs;
      wrs.forEach((wr, idx) => {
        this.ensurePlayerStats(wr.id);
        let share;
        if (idx === wrs.length - 1) {
          share = Math.max(0, remainingPass);
        } else if (idx < starterShares.length) {
          share = Math.floor(remainingPass * (starterShares[idx] + (this._random() * 0.1 - 0.05)));
        } else {
          share = Math.floor(remainingPass * this._random() * 0.3);
        }
        share = Math.max(0, Math.min(share, remainingPass));
        const tdShare = remainingPassTD > 0 && (idx === 0 ? this._random() > 0.4 : this._random() > 0.7) ? 1 : 0;
        this.playerStats[wr.id].receivingYards += share;
        this.playerStats[wr.id].receivingTDs += tdShare;
        remainingPass -= share;
        remainingPassTD -= tdShare;
      });
    }
  }

  updateStandings(teamId, pointsFor, pointsAgainst) {
    const entry = this.standings[teamId];
    if (!entry) return;
    entry.pf += pointsFor;
    entry.pa += pointsAgainst;
    if (pointsFor > pointsAgainst) entry.w++;
    else if (pointsFor < pointsAgainst) entry.l++;
    this._standingsDirty = true;
  }

  getStandingsSorted() {
    if (!this._standingsDirty && this._cachedStandings) {
      return this._cachedStandings;
    }
    this._cachedStandings = Object.keys(this.standings)
      .map(teamId => {
        const team = TEAMS.find(t => t.id === teamId);
        return { ...team, ...this.standings[teamId] };
      })
      .sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa));
    this._standingsDirty = false;
    return this._cachedStandings;
  }

  // LEADERBOARD LOGIC
  getLeaderboard(statKey, limit = 10) {
    return Object.keys(this.playerStats)
      .map(playerId => {
        const stats = this.playerStats[playerId];
        const player = this.findPlayer(playerId);
        if (!player) return null;
        return {
          ...player,
          stats,
          value: stats[statKey] || 0
        };
      })
      .filter(p => p && p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  getLeaderboardCategories() {
    return [
      { key: 'passingYards', label: 'Passing Yards', icon: '🏈' },
      { key: 'passingTDs', label: 'Passing TDs', icon: '🎯' },
      { key: 'rushingYards', label: 'Rushing Yards', icon: '🏃' },
      { key: 'rushingTDs', label: 'Rushing TDs', icon: '💨' },
      { key: 'receivingYards', label: 'Receiving Yards', icon: '🙌' },
      { key: 'receptions', label: 'Receptions', icon: '🤲' },
      { key: 'sacks', label: 'Sacks', icon: '💥' },
      { key: 'tackles', label: 'Tackles', icon: '🛡️' },
      { key: 'interceptions', label: 'Interceptions', icon: '🔒' },
    ];
  }

  // AWARDS SYSTEM
  getTeamSeasonStats(teamId) {
    const roster = this.rosters[teamId] || [];
    const stats = {
      passingYards: 0, passingTDs: 0, passingAtt: 0, passingComp: 0,
      rushingYards: 0, rushingTDs: 0, rushingAtt: 0,
      receivingYards: 0, receivingTDs: 0, receptions: 0,
      tackles: 0, sacks: 0, interceptions: 0,
      defTDs: 0, fumblesRecovered: 0,
    };
    roster.forEach(player => {
      const ps = this.playerStats[player.id];
      if (!ps) return;
      Object.keys(stats).forEach(key => {
        stats[key] += ps[key] || 0;
      });
    });
    // Derived stats
    const standing = this.standings[teamId];
    stats.totalOffenseYards = stats.passingYards + stats.rushingYards;
    stats.totalTDs = stats.passingTDs + stats.rushingTDs + stats.receivingTDs;
    stats.pointsFor = standing?.pf || 0;
    stats.pointsAgainst = standing?.pa || 0;
    stats.pointDiff = stats.pointsFor - stats.pointsAgainst;
    stats.turnovers = stats.interceptions; // simplified — we track INTs on defense
    return stats;
  }

  getAllTeamStats() {
    const allStats = [];
    TEAMS.forEach(team => {
      const stats = this.getTeamSeasonStats(team.id);
      allStats.push({ teamId: team.id, ...stats });
    });
    return allStats;
  }

  getTeamStatRank(teamId, statKey) {
    const all = this.getAllTeamStats();
    // Higher is better for most stats; lower is better for pointsAgainst
    const isLowerBetter = statKey === 'pointsAgainst';
    all.sort((a, b) => isLowerBetter ? a[statKey] - b[statKey] : b[statKey] - a[statKey]);
    const rank = all.findIndex(s => s.teamId === teamId) + 1;
    return rank;
  }

  calculatePlayerScore(stats, position) {
    // Calculate a weighted score based on position
    let score = 0;
    
    if (['QB'].includes(position)) {
      score = (stats.passingYards || 0) * 0.04 + 
              (stats.passingTDs || 0) * 4 - 
              (stats.interceptions || 0) * 2;
    } else if (['RB'].includes(position)) {
      score = (stats.rushingYards || 0) * 0.1 + 
              (stats.rushingTDs || 0) * 6 +
              (stats.receivingYards || 0) * 0.05;
    } else if (['WR', 'TE'].includes(position)) {
      score = (stats.receivingYards || 0) * 0.1 + 
              (stats.receivingTDs || 0) * 6 +
              (stats.receptions || 0) * 0.5;
    } else if (['DL', 'LB'].includes(position)) {
      score = (stats.sacks || 0) * 6 + 
              (stats.tackles || 0) * 1 +
              (stats.interceptions || 0) * 8;
    } else if (['CB', 'S', 'DB'].includes(position)) {
      score = (stats.interceptions || 0) * 10 + 
              (stats.tackles || 0) * 0.5;
    }
    
    return score;
  }

  calculateAwards() {
    // Calculate scores for all players
    const playerScores = Object.keys(this.playerStats)
      .map(playerId => {
        const stats = this.playerStats[playerId];
        const player = this.findPlayer(playerId);
        if (!player) return null;

        return {
          ...player,
          stats,
          score: this.calculatePlayerScore(stats, player.position)
        };
      })
      .filter(p => p && p.score > 0)
      .sort((a, b) => b.score - a.score);

    // MVP - Highest overall score
    const mvp = playerScores[0] || null;

    // OPOY - Highest offensive player (QB, RB, WR, TE)
    const offensivePositions = ['QB', 'RB', 'WR', 'TE'];
    const opoy = playerScores.find(p => offensivePositions.includes(p.position)) || null;

    // DPOY - Highest defensive player
    const defensivePositions = ['DL', 'LB', 'CB', 'S', 'DB'];
    const dpoy = playerScores.find(p => defensivePositions.includes(p.position)) || null;

    // OROY - Highest rookie (id contains 'rookie_')
    const oroy = playerScores.find(p => p.id.startsWith('rookie_')) || null;

    this.awards = { mvp, opoy, dpoy, oroy };
    return this.awards;
  }

  getAwards() {
    if (!this.awards) {
      this.calculateAwards();
    }
    return this.awards;
  }
  
  // PLAYOFF LOGIC
  
  getPlayoffPicture() {
    // 1. Separate into Conferences
    const afc = [];
    const nfc = [];
    
    // Sort all teams by record first
    const allTeams = this.getStandingsSorted();
    
    allTeams.forEach(t => {
      if (t.conference === 'AFC') afc.push(t);
      else nfc.push(t);
    });

    // 2. Determine Division Winners (Top record in each Div)
    const getSeeds = (confTeams) => {
      const divisions = { East: [], North: [], South: [], West: [] };
      confTeams.forEach(t => divisions[t.division].push(t));
      
      const winners = [];
      const wildCards = [];

      Object.values(divisions).forEach(div => {
         // Div is already sorted by Wins because confTeams was sorted
         winners.push(div[0]); 
         for(let i=1; i<div.length; i++) wildCards.push(div[i]);
      });

      // Sort winners by record (Seeds 1-4)
      winners.sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa));
      
      // Sort wildcards by record (Seeds 5-7)
      wildCards.sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa));

      return [...winners, wildCards[0], wildCards[1], wildCards[2]]; // Top 4 winners + top 3 WC
    };

    return {
      AFC: getSeeds(afc),
      NFC: getSeeds(nfc)
    };
  }

  // Calculate Probability (Monte Carlo Lite)
  // We run 50 simulations of the remaining season
  calculatePlayoffOdds() {
    const SIMULATIONS = 50;
    const teamPlayoffCounts = {};
    TEAMS.forEach(t => teamPlayoffCounts[t.id] = 0);
    const totalRegularWeeks = 3 + 17;

    if (this.phase === 'playoffs' || this.phase === 'offseason' || this.currentWeek > totalRegularWeeks) {
      const picture = this.getPlayoffPicture();
      [...picture.AFC, ...picture.NFC].forEach(team => {
        if (team) teamPlayoffCounts[team.id] = SIMULATIONS;
      });

      const lockedOdds = {};
      Object.keys(teamPlayoffCounts).forEach(id => {
        lockedOdds[id] = Math.round((teamPlayoffCounts[id] / SIMULATIONS) * 100);
      });
      return lockedOdds;
    }

    if (this.phase !== 'regular') return {};

    // Snapshot only the fields the simulation actually uses (w, l)
    // Avoids 50x JSON.parse(JSON.stringify()) of the full standings with match arrays
    const baseRecords = {};
    for (const teamId of Object.keys(this.standings)) {
      baseRecords[teamId] = {
        w: this.standings[teamId].w,
        l: this.standings[teamId].l,
        pf: this.standings[teamId].pf,
        pa: this.standings[teamId].pa,
      };
    }

    // Pre-collect remaining matches once instead of re-reading this.weeks per sim
    const startWeek = this.currentWeek;
    const remainingMatches = [];
    for (let w = startWeek; w <= totalRegularWeeks; w++) {
      const weekMatches = this.weeks[w - 1];
      if (!weekMatches) continue;
      for (const match of weekMatches) {
        if (match.played || match.isPreseason) continue;
        remainingMatches.push({
          homeId: match.home.id,
          awayId: match.away.id,
          homeAdv: match.home.ratings.overall > match.away.ratings.overall ? 0.6 : 0.4,
        });
      }
    }

    // Pre-split TEAMS by conference once
    const afcTeams = TEAMS.filter(t => t.conference === 'AFC');
    const nfcTeams = TEAMS.filter(t => t.conference === 'NFC');
    const getSeeds = (teams, records) => {
      const divisions = { East: [], North: [], South: [], West: [] };
      teams.forEach(team => {
        const record = records[team.id] || { w: 0, l: 0, pf: 0, pa: 0 };
        divisions[team.division].push({ ...team, ...record });
      });

      const sortTeams = (a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa);
      const winners = [];
      const wildCards = [];
      Object.values(divisions).forEach(div => {
        div.sort(sortTeams);
        if (div[0]) winners.push(div[0]);
        for (let i = 1; i < div.length; i++) wildCards.push(div[i]);
      });

      winners.sort(sortTeams);
      wildCards.sort(sortTeams);
      return [...winners, ...wildCards].slice(0, 7);
    };

    for (let sim = 0; sim < SIMULATIONS; sim++) {
      const simRecords = {};
      Object.keys(baseRecords).forEach(teamId => {
        simRecords[teamId] = { ...baseRecords[teamId] };
      });

      // Simulate remaining games
      for (const m of remainingMatches) {
        const homeWon = Math.random() < m.homeAdv;
        const winnerId = homeWon ? m.homeId : m.awayId;
        const loserId = homeWon ? m.awayId : m.homeId;
        simRecords[winnerId].w++;
        simRecords[loserId].l++;
      }

      getSeeds(afcTeams, simRecords).forEach(team => teamPlayoffCounts[team.id]++);
      getSeeds(nfcTeams, simRecords).forEach(team => teamPlayoffCounts[team.id]++);
    }

    // Convert to Percentages
    const odds = {};
    Object.keys(teamPlayoffCounts).forEach(id => {
      odds[id] = Math.round((teamPlayoffCounts[id] / SIMULATIONS) * 100);
    });

    return odds;
  }
  // DRAFT & OFFSEASON
  
  generateGameNews(match) {
    if (match.isPreseason) return;
    const { homeScore, awayScore } = match.result;
    const homeWon = homeScore >= awayScore;
    const winner = homeWon ? match.home : match.away;
    const loser  = homeWon ? match.away : match.home;
    const winScore = homeWon ? homeScore : awayScore;
    const loseScore = homeWon ? awayScore : homeScore;
    const margin = winScore - loseScore;
    const combined = homeScore + awayScore;

    if (match.type === 'Super Bowl') {
      this.addNews(`${winner.name} win Super Bowl ${this.season}, defeating ${loser.name} ${winScore}-${loseScore}.`, 'result');
      return;
    }

    if (['Wild Card', 'Divisional', 'Conference'].includes(match.type)) {
      this.addNews(`${winner.name} advance past ${loser.name} in the ${match.type} round, ${winScore}-${loseScore}.`, 'result');
      return;
    }

    if (loseScore === 0) {
      this.addNews(`${winner.name} shut out ${loser.name} ${winScore}-0.`, 'result');
      return;
    }

    if (margin > 21) {
      this.addNews(`${winner.name} dominate ${loser.name} in a ${winScore}-${loseScore} blowout.`, 'result');
      return;
    }

    if (combined > 55) {
      this.addNews(`${match.home.name} and ${match.away.name} combine for ${combined} points in a ${homeScore}-${awayScore} shootout.`, 'result');
      return;
    }

    if (margin <= 3) {
      this.addNews(`${winner.name} edge out ${loser.name} ${winScore}-${loseScore} in a close contest.`, 'result');
      return;
    }

    // Always report the user's team result
    if (match.home.id === this.userTeamId || match.away.id === this.userTeamId) {
      const userWon = winner.id === this.userTeamId;
      this.addNews(`${winner.name} ${userWon ? 'defeat' : 'fall to'} ${loser.name} ${winScore}-${loseScore}.`, 'result');
    }
  }

  addNews(message, type = 'general') {
       this.news.unshift({
           message,
           type, 
           week: this.currentWeek,
           timestamp: Date.now()
       });
       if (this.news.length > 50) this.news.pop();
   }

   generateWeeklyNews() {
    // 1. Injury returns — players about to come back next week
    Object.keys(this.playerState).forEach(playerId => {
      const state = this.playerState[playerId];
      if (state && state.weeksOut === 1) {
        const player = this.findPlayer(playerId);
        if (player) {
          this.addNews(`${player.name} (${player.position}) is expected to return from injury next week.`, 'injury');
        }
      }
    });

    // 2. Win/loss streaks — any team on a 4-game streak
    if (this.phase === 'regular') {
      TEAMS.forEach(team => {
        const allMatches = (this.standings[team.id]?.matches || [])
          .filter(m => m.played && !m.isPreseason);
        const recent = allMatches.slice(-4);
        if (recent.length < 4) return;
        const results = recent.map(m => {
          const isHome = m.home.id === team.id;
          return isHome ? m.result.homeScore > m.result.awayScore
                        : m.result.awayScore > m.result.homeScore;
        });
        if (results.every(r => r === true))  this.addNews(`${team.name} have won 4 straight games.`, 'general');
        if (results.every(r => r === false)) this.addNews(`${team.name} have lost 4 straight games.`, 'general');
      });
    }

    // 3. Trade deadline reminder — 1 week out
    const info = this.getTradeDeadlineInfo();
    if (info && !info.passed && info.weeksUntil === 1) {
      this.addNews('Trade deadline is next week. Make your moves now.', 'general');
    }
  }

  generateDraftClass() {
     const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
     const firstNames = ['DeAndre', 'Marcus', 'Caleb', 'Trevor', 'Kenny', 'Jalen', 'Sauce', 'Tyreek', 'Justin', 'Patrick', 'Joe', 'Bryce', 'CJ', 'Drake', 'Brock', 'Aidan', 'Will', 'Devon', 'Jayden', 'Malik'];
     const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Robinson', 'Clark', 'Lewis', 'Walker'];
     const potentials = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'];
     const potentialWeights = [0.03, 0.07, 0.15, 0.30, 0.20, 0.15, 0.10];
     const strengthsByPos = {
       QB: ['Arm Strength', 'Pocket Awareness', 'Mobility', 'Deep Ball Accuracy', 'Leadership'],
       RB: ['Vision', 'Breakaway Speed', 'Pass Catching', 'Power Running', 'Elusiveness'],
       WR: ['Route Running', 'Deep Threat', 'Contested Catches', 'YAC Ability', 'Hands'],
       TE: ['Blocking', 'Red Zone Target', 'Seam Routes', 'Versatility', 'Size'],
       OL: ['Pass Protection', 'Run Blocking', 'Athleticism', 'Anchor Strength', 'Technique'],
       DL: ['Pass Rush', 'Bull Rush', 'Interior Disruption', 'Edge Speed', 'Motor'],
       LB: ['Tackling', 'Coverage Skills', 'Blitz Ability', 'Sideline-to-Sideline', 'Instincts'],
       DB: ['Ball Skills', 'Man Coverage', 'Zone Coverage', 'Tackling', 'Speed'],
     };
     const comparisons = {
       QB: ['Patrick Mahomes', 'Josh Allen', 'Lamar Jackson', 'Joe Burrow', 'Jalen Hurts'],
       RB: ['Derrick Henry', 'Saquon Barkley', 'Christian McCaffrey', 'Josh Jacobs', 'Breece Hall'],
       WR: ["Ja'Marr Chase", 'Justin Jefferson', 'Tyreek Hill', 'CeeDee Lamb', 'Amon-Ra St. Brown'],
       TE: ['Travis Kelce', 'Mark Andrews', 'George Kittle', 'TJ Hockenson', 'Sam LaPorta'],
       OL: ['Penei Sewell', 'Rashawn Slater', 'Tristan Wirfs', 'Joe Alt', 'Paris Johnson Jr.'],
       DL: ['Myles Garrett', 'Micah Parsons', 'Chris Jones', 'Aidan Hutchinson', 'Jalen Carter'],
       LB: ['Fred Warner', 'Roquan Smith', 'Devin White', 'Daiyan Henley', 'Patrick Queen'],
       DB: ['Sauce Gardner', 'Devon Witherspoon', 'Patrick Surtain II', 'Jaire Alexander', 'Derwin James'],
     };

     this.draftClass = [];
     const prospectCount = TEAMS.length * 3;
     for(let i=0; i<prospectCount; i++) {
         const pos = positions[Math.floor(this._random() * positions.length)];
         const overall = 65 + Math.floor(this._random() * 25); // 65-90
         // Weighted potential selection
         const potRoll = this._random();
         let cumulative = 0;
         let potential = 'C';
         for (let j = 0; j < potentials.length; j++) {
           cumulative += potentialWeights[j];
           if (potRoll < cumulative) { potential = potentials[j]; break; }
         }
         // Higher overall prospects tend to have better potential
         if (overall >= 83 && this._random() < 0.5) potential = potentials[Math.floor(this._random() * 3)]; // A+, A, or B+
         const posStrengths = strengthsByPos[pos] || ['Athleticism'];
         const strength = posStrengths[Math.floor(this._random() * posStrengths.length)];
         const posComps = comparisons[pos] || ['Unknown'];
         const comparison = posComps[Math.floor(this._random() * posComps.length)];

         this.draftClass.push({
             id: `rookie_${Date.now()}_${i}`,
             name: `${firstNames[Math.floor(this._random()*firstNames.length)]} ${lastNames[Math.floor(this._random()*lastNames.length)]}`,
             position: pos,
             overall: overall,
             age: 21 + Math.floor(this._random()*3),
             potential: potential,
             strength: strength,
             comparison: comparison,
         });
     }
     this.draftClass.sort((a,b) => b.overall - a.overall);
  }

  getDraftNeeds(teamId) {
    const roster = this.rosters[teamId] || [];
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
    const needs = positions.map(pos => {
      const posPlayers = roster.filter(p => p.position === pos);
      const count = posPlayers.length;
      const avgOvr = count > 0 ? Math.round(posPlayers.reduce((s, p) => s + p.overall, 0) / count) : 0;
      const bestOvr = count > 0 ? Math.max(...posPlayers.map(p => p.overall)) : 0;
      // Need score: fewer players + lower average = higher need
      let needScore = (3 - Math.min(count, 3)) * 20 + Math.max(0, 80 - avgOvr);
      return { position: pos, count, avgOvr, bestOvr, needScore };
    });
    needs.sort((a, b) => b.needScore - a.needScore);
    return needs;
  }

  startDraft() {
     this.generateDraftClass();
     
     // Generate Order (Reverse Standings)
     const sortedTeams = this.getStandingsSorted().reverse(); // Worst teams first
     const baseOrder = sortedTeams.map(t => t.id);
     this.draftOrder = [];
     for (let round = 0; round < 3; round++) {
       this.draftOrder.push(...baseOrder);
     }
     this.currentPickIndex = 0;
  }

  resolveCpuPicks(userTeamId) {
     const displayLog = [];
     
     while (this.currentPickIndex < this.draftOrder.length) {
         const teamId = this.draftOrder[this.currentPickIndex];
         if (teamId === userTeamId) {
             return displayLog; // Stop and let user pick
         }
         
         // CPU Pick: Best available
         const pick = this.draftClass.shift();
         if (pick) {
            pick.stats = {}; // Init stats
            if (!this.rosters[teamId]) this.rosters[teamId] = [];
            this.rosters[teamId].push(pick);
            this._indexAddPlayer(pick, teamId);
            this.addToDepthChart(teamId, pick);

            displayLog.push({ type: 'pick', teamId: teamId, player: pick });
            this.draftHistory.push({ season: this.season, pick: this.currentPickIndex + 1, teamId, player: { name: pick.name, position: pick.position, overall: pick.overall, id: pick.id } });
         }
         this.currentPickIndex++;
     }
     return displayLog;
  }

  userSelectPlayer(userTeamId, playerIndex) {
      if (!this.draftClass || playerIndex < 0 || playerIndex >= this.draftClass.length) return null;
      const pick = this.draftClass.splice(playerIndex, 1)[0];
      if (!pick) return null;

      pick.stats = {};
      if (!this.rosters[userTeamId]) this.rosters[userTeamId] = [];
      this.rosters[userTeamId].push(pick);
      this._indexAddPlayer(pick, userTeamId);
      this.addToDepthChart(userTeamId, pick);

      this.draftHistory.push({ season: this.season, pick: this.currentPickIndex + 1, teamId: userTeamId, player: { name: pick.name, position: pick.position, overall: pick.overall, id: pick.id } });
      this.currentPickIndex++; // Move past user
      return pick;
  }

  // FREE AGENCY LOGIC
  generateFreeAgents() {
    // Generate some random free agents each offseason
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
    const firstNames = ['Mike', 'Chris', 'David', 'Tyler', 'Brandon', 'Jason', 'Ryan', 'Kevin', 'Matt', 'Alex'];
    const lastNames = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson'];
    
    const newFAs = [];
    for (let i = 0; i < 15; i++) {
      const pos = positions[Math.floor(this._random() * positions.length)];
      const rating = 60 + Math.floor(this._random() * 25); // 60-85 range (veterans)
      const age = 26 + Math.floor(this._random() * 8); // 26-33 range
      
      newFAs.push({
        id: `fa_${Date.now()}_${i}`,
        name: `${firstNames[Math.floor(this._random() * firstNames.length)]} ${lastNames[Math.floor(this._random() * lastNames.length)]}`,
        position: pos,
        overall: rating,
        age: age,
        stats: {},
      });
    }
    
    // Keep existing FAs that weren't signed (up to 20 total)
    this.freeAgents = [...this.freeAgents, ...newFAs].slice(0, 30);
    this.freeAgents.sort((a, b) => b.overall - a.overall);
  }

  getFreeAgents(positionFilter = null) {
    if (!positionFilter) return this.freeAgents;
    return this.freeAgents.filter(p => p.position === positionFilter);
  }

  signFreeAgent(teamId, playerId) {
    const playerIndex = this.freeAgents.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;
    
    const player = this.freeAgents.splice(playerIndex, 1)[0];
    
    if (!this.rosters[teamId]) this.rosters[teamId] = [];
    this.rosters[teamId].push(player);
    this._indexAddPlayer(player, teamId);

    // Initialize stats
    if (!this.playerStats[player.id]) {
      this.playerStats[player.id] = {
        passingYards: 0, passingTDs: 0, passingAtt: 0, passingComp: 0,
        rushingYards: 0, rushingTDs: 0, rushingAtt: 0,
        receivingYards: 0, receivingTDs: 0, receptions: 0,
        tackles: 0, sacks: 0, interceptions: 0
      };
    }

    this.addToDepthChart(teamId, player);
    this.addNews(`${player.name} (${player.position}) signed with ${teamId}.`, 'transaction');
    return player;
  }

  cutPlayer(teamId, playerId) {
    const roster = this.rosters[teamId];
    if (!roster) return null;

    const playerIndex = roster.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;

    const player = roster.splice(playerIndex, 1)[0];
    this._indexRemovePlayer(player.id);
    this.removeFromDepthChart(teamId, playerId);
    this.freeAgents.push(player);
    this.freeAgents.sort((a, b) => b.overall - a.overall);

    this.addNews(`${player.name} (${player.position}) was released by ${teamId}.`, 'transaction');
    return player;
  }

  // --- PRACTICE SQUAD ---
  initializePracticeSquads() {
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];
    const firstNames = ['Mike', 'Chris', 'David', 'Tyler', 'Brandon', 'Jason', 'Ryan', 'Kevin', 'Matt', 'Alex',
                        'Jordan', 'Sam', 'Trey', 'Jalen', 'Darius', 'Marcus', 'Terrell', 'DeShawn', 'Malik', 'Andre'];
    const lastNames = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson',
                       'Thomas', 'Jackson', 'White', 'Harris', 'Thompson', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall'];

    TEAMS.forEach(team => {
      if (this.practiceSquads[team.id] && this.practiceSquads[team.id].length > 0) return;
      this.practiceSquads[team.id] = [];
      for (let i = 0; i < 10; i++) {
        const pos = positions[Math.floor(this._random() * positions.length)];
        const overall = 50 + Math.floor(this._random() * 23); // 50-72
        const age = 22 + Math.floor(this._random() * 6); // 22-27
        const player = {
          id: `ps_${team.id}_${Date.now()}_${i}`,
          name: `${firstNames[Math.floor(this._random() * firstNames.length)]} ${lastNames[Math.floor(this._random() * lastNames.length)]}`,
          position: pos,
          overall,
          age,
          stats: {},
        };
        this.practiceSquads[team.id].push(player);
        this._indexAddPlayer(player, team.id);
      }
    });
  }

  _generatePracticeSquadPlayer(teamId, index) {
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];
    const firstNames = ['Mike', 'Chris', 'David', 'Tyler', 'Brandon', 'Jason', 'Ryan', 'Kevin', 'Matt', 'Alex',
                        'Jordan', 'Sam', 'Trey', 'Jalen', 'Darius', 'Marcus', 'Terrell', 'DeShawn', 'Malik', 'Andre'];
    const lastNames = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson',
                       'Thomas', 'Jackson', 'White', 'Harris', 'Thompson', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall'];
    const pos = positions[Math.floor(this._random() * positions.length)];
    const overall = 50 + Math.floor(this._random() * 23);
    const age = 22 + Math.floor(this._random() * 6);
    return {
      id: `ps_${teamId}_${Date.now()}_${index}`,
      name: `${firstNames[Math.floor(this._random() * firstNames.length)]} ${lastNames[Math.floor(this._random() * lastNames.length)]}`,
      position: pos,
      overall,
      age,
      stats: {},
    };
  }

  getPracticeSquad(teamId) {
    return this.practiceSquads[teamId] || [];
  }

  promoteFromPracticeSquad(teamId, playerId) {
    const ps = this.practiceSquads[teamId];
    if (!ps) return null;
    const idx = ps.findIndex(p => p.id === playerId);
    if (idx === -1) return null;

    const player = ps.splice(idx, 1)[0];
    if (!this.rosters[teamId]) this.rosters[teamId] = [];
    this.rosters[teamId].push(player);
    this._indexAddPlayer(player, teamId);
    this.addToDepthChart(teamId, player);

    // Assign salary
    const salary = this.calculateSalary(player.overall, player.position);
    this.salaries[player.id] = { amount: salary, years: 1 };
    this.updateTeamSpending(teamId);

    // Init stats
    this.ensurePlayerStats(player.id);
    this.addNews(`${player.name} (${player.position}) promoted from practice squad by ${teamId}.`, 'transaction');
    return player;
  }

  demoteToPracticeSquad(teamId, playerId) {
    const roster = this.rosters[teamId];
    if (!roster) return null;
    const idx = roster.findIndex(p => p.id === playerId);
    if (idx === -1) return null;

    // Reject if practice squad is full (max 16)
    const ps = this.practiceSquads[teamId] || [];
    if (ps.length >= 16) return null;

    const player = roster.splice(idx, 1)[0];
    this.removeFromDepthChart(teamId, playerId);

    // Remove salary
    delete this.salaries[playerId];
    this.updateTeamSpending(teamId);

    if (!this.practiceSquads[teamId]) this.practiceSquads[teamId] = [];
    this.practiceSquads[teamId].push(player);
    this._indexAddPlayer(player, teamId);
    this.addNews(`${player.name} (${player.position}) demoted to practice squad by ${teamId}.`, 'transaction');
    return player;
  }

  // --- INJURED RESERVE ---
  initializeInjuredReserve() {
    TEAMS.forEach(team => {
      if (!this.injuredReserve[team.id]) {
        this.injuredReserve[team.id] = [];
      }
    });
  }

  placeOnIR(teamId, playerId) {
    const roster = this.rosters[teamId];
    if (!roster) return null;
    const idx = roster.findIndex(p => p.id === playerId);
    if (idx === -1) return null;

    // Must be injured to go on IR
    const state = this.playerState[playerId];
    if (!state || state.weeksOut <= 0) return null;

    const player = roster.splice(idx, 1)[0];
    this.removeFromDepthChart(teamId, playerId);

    if (!this.injuredReserve[teamId]) this.injuredReserve[teamId] = [];
    this.injuredReserve[teamId].push({
      playerId: player.id,
      player: player,
      weekPlaced: this.currentWeek,
      minWeeks: 4,
    });

    this._indexAddPlayer(player, teamId);
    this.addNews(`${player.name} (${player.position}) placed on Injured Reserve by ${teamId}.`, 'injury');
    return player;
  }

  activateFromIR(teamId, playerId) {
    const irList = this.injuredReserve[teamId];
    if (!irList) return null;
    const idx = irList.findIndex(e => e.playerId === playerId);
    if (idx === -1) return null;

    const entry = irList[idx];
    const weeksOnIR = this.currentWeek - entry.weekPlaced;
    if (weeksOnIR < entry.minWeeks) return null; // not eligible yet

    irList.splice(idx, 1);
    const player = entry.player;

    // Clear injury state
    delete this.playerState[playerId];

    // Re-add to active roster
    if (!this.rosters[teamId]) this.rosters[teamId] = [];
    this.rosters[teamId].push(player);
    this._indexAddPlayer(player, teamId);
    this.addToDepthChart(teamId, player);

    this.addNews(`${player.name} (${player.position}) activated from Injured Reserve by ${teamId}.`, 'injury');
    return player;
  }

  getIRList(teamId) {
    const irList = this.injuredReserve[teamId] || [];
    return irList.map(entry => ({
      ...entry,
      weeksOnIR: this.currentWeek - entry.weekPlaced,
      eligible: (this.currentWeek - entry.weekPlaced) >= entry.minWeeks,
      weeksUntilEligible: Math.max(0, entry.minWeeks - (this.currentWeek - entry.weekPlaced)),
    }));
  }

  // --- CPU AUTO-MANAGEMENT ---
  cpuManagePracticeSquadAndIR(teamId) {
    // 1. Place heavily injured players (3+ weeks) on IR
    const roster = this.rosters[teamId] || [];
    const toIR = [];
    roster.forEach(player => {
      const state = this.playerState[player.id];
      if (state && state.weeksOut >= 3) {
        toIR.push(player.id);
      }
    });
    toIR.forEach(pid => this.placeOnIR(teamId, pid));

    // 2. Activate eligible IR players
    const irList = this.getIRList(teamId);
    irList.forEach(entry => {
      if (entry.eligible) {
        this.activateFromIR(teamId, entry.playerId);
      }
    });

    // 3. If roster is thin at a position, promote from practice squad
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
    const currentRoster = this.rosters[teamId] || [];
    positions.forEach(pos => {
      const posPlayers = currentRoster.filter(p => p.position === pos);
      const healthyCount = posPlayers.filter(p => !this.playerState[p.id] || this.playerState[p.id].weeksOut <= 0).length;
      if (healthyCount < 1) {
        const ps = this.practiceSquads[teamId] || [];
        const candidates = ps.filter(p => p.position === pos).sort((a, b) => b.overall - a.overall);
        if (candidates.length > 0) {
          this.promoteFromPracticeSquad(teamId, candidates[0].id);
        }
      }
    });
  }

  // TRADE SYSTEM
  calculatePlayerValue(player) {
    // Simple value formula based on overall, age, and position
    let baseValue = player.overall * 10;
    
    // Age adjustment
    if (player.age < 25) baseValue += 150; // Young premium
    else if (player.age > 30) baseValue -= 100; // Veteran discount
    else if (player.age > 33) baseValue -= 200;
    
    // Position premiums
    if (player.position === 'QB') baseValue += 200;
    else if (['WR', 'CB', 'DL'].includes(player.position)) baseValue += 50;
    
    return Math.max(100, baseValue);
  }

  evaluateTrade(offeringTeamId, receivingTeamId, playersOffered, playersRequested) {
    // Calculate total value of players offered vs requested
    let offeredValue = 0;
    let requestedValue = 0;

    playersOffered.forEach(playerId => {
      const player = this.rosters[offeringTeamId]?.find(p => p.id === playerId);
      if (player) offeredValue += this.calculatePlayerValue(player);
    });

    playersRequested.forEach(playerId => {
      const player = this.rosters[receivingTeamId]?.find(p => p.id === playerId);
      if (player) requestedValue += this.calculatePlayerValue(player);
    });

    // AI will accept if value is within 15% of fair
    const fairnessRatio = offeredValue / (requestedValue || 1);
    const willAccept = fairnessRatio >= 0.85;

    return {
      offeredValue,
      requestedValue,
      fairnessRatio,
      willAccept,
      message: willAccept 
        ? 'Trade Accepted!' 
        : fairnessRatio < 0.5 
          ? 'Insulting offer. Add more value.' 
          : 'Close, but we need a bit more.'
    };
  }

  executeTrade(team1Id, team2Id, players1, players2) {
    // Move players1 from team1 to team2
    players1.forEach(playerId => {
      const roster = this.rosters[team1Id];
      if (!roster) return;
      const idx = roster.findIndex(p => p.id === playerId);
      if (idx === -1) return;
      const player = roster.splice(idx, 1)[0];
      if (!this.rosters[team2Id]) this.rosters[team2Id] = [];
      this.rosters[team2Id].push(player);
      this._indexAddPlayer(player, team2Id);
    });

    // Move players2 from team2 to team1
    players2.forEach(playerId => {
      const roster = this.rosters[team2Id];
      if (!roster) return;
      const idx = roster.findIndex(p => p.id === playerId);
      if (idx === -1) return;
      const player = roster.splice(idx, 1)[0];
      if (!this.rosters[team1Id]) this.rosters[team1Id] = [];
      this.rosters[team1Id].push(player);
      this._indexAddPlayer(player, team1Id);
    });

    // Sync depth charts for both teams
    this.ensureDepthChart(team1Id);
    this.ensureDepthChart(team2Id);

    // Generate news
    const team1 = TEAMS.find(t => t.id === team1Id);
    const team2 = TEAMS.find(t => t.id === team2Id);
    this.addNews(`TRADE: ${team1?.abbreviation || team1Id} and ${team2?.abbreviation || team2Id} complete multi-player deal.`, 'transaction');
  }

  startNewSeason() {
      // 0. Record history before resetting
      this.recordSeasonHistory();
      this.season = (this.season || 1) + 1;
      this.awards = null;        // Reset awards for new season
      this.superBowlWinner = null; // Reset SB winner for new season
      
      // 1. Reset Week
      this.currentWeek = 1;
      this.phase = 'preseason';
      this.weeks = [];
      
      // 2. Reset Standings
      this.standings = {};
      this.initializeStandings();
      
      // 2.5. Decrement contract years
      this.decrementContractYears();

      // 3. Reset Player Stats
      this.playerStats = {};
      this.initializePlayerStats();
      
      // 4. Generate New Schedule
      this.generateSchedule();
      
      // 5. Progression, Retirement & Team Rating Update — single pass per team
      // Build teamById lookup to avoid TEAMS.find() O(32) per team inside loop
      const teamById = {};
      TEAMS.forEach(t => { teamById[t.id] = t; });

      const progressionNews = [];
      Object.keys(this.rosters).forEach(teamId => {
          const roster = this.rosters[teamId];
          const kept = [];
          const coach = this.getCoach(teamId);
          const devBonus = (coach && coach.bonuses && coach.bonuses.developmentBonus) || 0;
          let totalOvr = 0;

          roster.forEach(p => {
              p.age++;
              const oldOverall = p.overall || 0;

              // Retirement Check
              let retireChance = 0;
              if (p.age > 40) retireChance = 1.0;
              else if (p.age > 35) retireChance = 0.4;
              else if (p.age > 32) retireChance = 0.1;

              // QBs, Ks, Ps play longer
              if (['QB', 'K', 'P'].includes(p.position)) retireChance *= 0.5;

              if (this._random() < retireChance) {
                  this.addNews(`${p.name} (${p.position}) has retired after ${p.age - 21} seasons.`, 'retire');
              } else {
                  let effectiveAge = p.age;
                  if (['QB', 'K', 'P'].includes(p.position)) effectiveAge -= 2;
                  else if (p.position === 'RB') effectiveAge += 1;

                  let change = 0;
                  if (effectiveAge < 25) {
                      change = Math.floor(this._random() * 4) + 1;
                  } else if (effectiveAge < 28) {
                      change = Math.floor(this._random() * 3);
                  } else if (effectiveAge < 31) {
                      change = Math.floor(this._random() * 3) - 1;
                  } else if (effectiveAge < 34) {
                      change = -(Math.floor(this._random() * 3) + 1);
                  } else {
                      change = -(Math.floor(this._random() * 4) + 2);
                  }

                  if (devBonus > 0 && p.age < 26) {
                      change += Math.floor(this._random() * (devBonus + 1));
                  }

                  const stats = this.playerStats[p.id];
                  if (stats) {
                      let performed = false;
                      if (['QB'].includes(p.position) && ((stats.passingYards || 0) > 2000 || (stats.passingTDs || 0) > 15)) performed = true;
                      if (['RB'].includes(p.position) && ((stats.rushingYards || 0) > 700 || (stats.rushingTDs || 0) > 5)) performed = true;
                      if (['WR', 'TE'].includes(p.position) && ((stats.receivingYards || 0) > 500 || (stats.receivingTDs || 0) > 4)) performed = true;
                      if (['DL', 'LB', 'DB', 'CB', 'S'].includes(p.position) && ((stats.tackles || 0) > 40 || (stats.sacks || 0) > 5)) performed = true;
                      if (performed) change += Math.floor(this._random() * 2) + 1;
                  }

                  // Potential drives upside — decline is unaffected
                  if (change > 0 && p.potential) {
                    const potentialMultiplier = {
                      'A+': 1.5, 'A': 1.3, 'B+': 1.15, 'B': 1.0, 'C+': 0.85, 'C': 0.7, 'D': 0.5
                    };
                    const mult = potentialMultiplier[p.potential] ?? 1.0;
                    change = Math.round(change * mult);
                  }

                  p.overall = Math.max(50, Math.min(99, oldOverall + change));
                  kept.push(p);
                  totalOvr += p.overall; // accumulate in same pass

                  if (change >= 3) {
                      progressionNews.push({ name: p.name, pos: p.position, overall: p.overall, change, type: 'improve' });
                  } else if (change <= -3) {
                      progressionNews.push({ name: p.name, pos: p.position, overall: p.overall, change, type: 'decline' });
                  }
              }
          });

          this.rosters[teamId] = kept;

          // Update Team Ratings in same pass — O(1) lookup via teamById
          if (kept.length > 0) {
              const avgOvr = Math.round(totalOvr / kept.length);
              const team = teamById[teamId];
              if (team) {
                  const offPositions = new Set(['QB', 'RB', 'WR', 'TE', 'OL']);
                  const defPositions = new Set(['DL', 'LB', 'DB', 'CB', 'S']);
                  const offPlayers = kept.filter(p => offPositions.has(p.position));
                  const defPlayers = kept.filter(p => defPositions.has(p.position));
                  const offAvg = offPlayers.length > 0
                      ? Math.round(offPlayers.reduce((s, p) => s + p.overall, 0) / offPlayers.length)
                      : avgOvr;
                  const defAvg = defPlayers.length > 0
                      ? Math.round(defPlayers.reduce((s, p) => s + p.overall, 0) / defPlayers.length)
                      : avgOvr;
                  team.ratings.overall = avgOvr;
                  team.ratings.offense = offAvg;
                  team.ratings.defense = defAvg;
              }
          }
      });

      // Generate news for biggest movers
      progressionNews.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      progressionNews.slice(0, 8).forEach(item => {
          if (item.type === 'improve') {
              this.addNews(`${item.name} (${item.pos}) made a leap to ${item.overall} OVR (+${item.change}) this offseason.`, 'transaction');
          } else {
              this.addNews(`${item.name} (${item.pos}) declined to ${item.overall} OVR (${item.change}) this offseason.`, 'transaction');
          }
      });

      this.generateFreeAgents();

      // Rebuild player index after roster mutations (retirements, progressions)
      this.rebuildPlayerIndex();

      // Sync depth charts: remove retired players, keep existing order for survivors
      Object.keys(this.rosters).forEach(teamId => {
          this.ensureDepthChart(teamId);
      });

      // Clear all IR — activate everyone back to rosters for the new season
      Object.keys(this.injuredReserve).forEach(teamId => {
        const irList = this.injuredReserve[teamId] || [];
        irList.forEach(entry => {
          delete this.playerState[entry.playerId];
          if (!this.rosters[teamId]) this.rosters[teamId] = [];
          this.rosters[teamId].push(entry.player);
          this.addToDepthChart(teamId, entry.player);
        });
        this.injuredReserve[teamId] = [];
      });

      // Age practice squad players, apply minor progression/retirement, replenish
      Object.keys(this.practiceSquads).forEach(teamId => {
        const ps = this.practiceSquads[teamId] || [];
        const kept = [];
        ps.forEach(p => {
          p.age++;
          if (p.age > 30 && this._random() < 0.3) return; // released/retired
          const change = Math.floor(this._random() * 5) - 2; // -2 to +2
          p.overall = Math.max(45, Math.min(75, p.overall + change));
          kept.push(p);
        });
        this.practiceSquads[teamId] = kept;

        // Replenish to 10 if below
        let idx = 0;
        while (this.practiceSquads[teamId].length < 10) {
          const newPlayer = this._generatePracticeSquadPlayer(teamId, idx++);
          this.practiceSquads[teamId].push(newPlayer);
          this._indexAddPlayer(newPlayer, teamId);
        }
      });

      // Rebuild index again after IR/PS changes
      this.rebuildPlayerIndex();

      this.draftClass = null;
      this.draftOrder = null;
      this.currentPickIndex = 0;
  }

  // SAVE/LOAD GAME
  getSaveData() {
    return {
      slotId: this.slotId,
      weeks: this.weeks,
      standings: this.standings,
      playerStats: this.playerStats,
      playerState: this.playerState,
      news: this.news,
      rosters: this.rosters,
      currentWeek: this.currentWeek,
      phase: this.phase,
      userTeamId: this.userTeamId,
      season: this.season || 1,
      draftClass: this.draftClass,
      draftOrder: this.draftOrder,
      currentPickIndex: this.currentPickIndex,
      freeAgents: this.freeAgents,
      coaches: this.coaches,
      salaries: this.salaries,
      teamCaps: this.teamCaps,
      franchiseHistory: this.franchiseHistory,
      superBowlWinner: this.superBowlWinner || null,
      awards: this.awards || null,
      depthCharts: this.depthCharts,
      gamePlans: this.gamePlans,
      draftHistory: this.draftHistory,
      practiceSquads: this.practiceSquads,
      injuredReserve: this.injuredReserve,
      randomSeed: this.randomSeed,
      rngState: this._rngState,
    };
  }

  loadSaveData(data) {
    if (!data) return false;
    this.weeks = data.weeks || [];
    this.standings = data.standings || {};
    this.playerStats = data.playerStats || {};
    this.playerState = data.playerState || {};
    this.news = data.news || [];
    this.rosters = data.rosters || JSON.parse(JSON.stringify(ROSTERS));
    this.currentWeek = data.currentWeek || 1;
    this.phase = data.phase || 'preseason';
    this.userTeamId = data.userTeamId;
    this.season = data.season || 1;
    this.slotId = data.slotId != null ? data.slotId : null;
    this.draftClass = data.draftClass;
    this.draftOrder = data.draftOrder;
    this.currentPickIndex = data.currentPickIndex;
    this.freeAgents = data.freeAgents || [];
    this.coaches = data.coaches || {};
    this.salaries = data.salaries || {};
    this.teamCaps = data.teamCaps || {};
    this.franchiseHistory = data.franchiseHistory || [];
    this.superBowlWinner = data.superBowlWinner || null;
    this.awards = data.awards || null;
    this.depthCharts = data.depthCharts || {};
    this.gamePlans = data.gamePlans || {};
    this.draftHistory = data.draftHistory || [];
    this.practiceSquads = data.practiceSquads || {};
    this.injuredReserve = data.injuredReserve || {};
    this.setRandomSeed(data.randomSeed || Date.now());
    if (Number.isFinite(data.rngState)) {
      this._rngState = (data.rngState >>> 0) || 1;
    }
    this._standingsDirty = true;
    this._cachedStandings = null;
    this.rebuildPlayerIndex();
    // Ensure all teams have depth charts (handles saves from before this feature)
    Object.keys(this.rosters).forEach(teamId => {
      if (!this.depthCharts[teamId]) this.ensureDepthChart(teamId);
    });
    // Ensure all teams have game plans (handles saves from before this feature)
    if (!this.gamePlans || Object.keys(this.gamePlans).length === 0) {
      this.initializeGamePlans();
    }
    // Ensure all teams have practice squads and IR (handles saves from before this feature)
    this.initializePracticeSquads();
    this.initializeInjuredReserve();
    return true;
  }

  resetGame() {
    // Restore original TEAMS ratings that may have been mutated by startNewSeason
    this._originalTeamRatings.forEach(orig => {
      const team = TEAMS.find(t => t.id === orig.id);
      if (team) {
        team.ratings.offense = orig.offense;
        team.ratings.defense = orig.defense;
        team.ratings.overall = orig.overall;
      }
    });

    this.weeks = [];
    this.standings = {};
    this.playerStats = {};
    this.playerState = {};
    this.news = [];
    this.rosters = JSON.parse(JSON.stringify(ROSTERS));
    this.currentWeek = 1;
    this.phase = 'preseason';
    this.userTeamId = null;
    this.season = 1;
    this.slotId = null;
    this.draftClass = null;
    this.draftOrder = null;
    this.currentPickIndex = 0;
    this.freeAgents = [];
    this.coaches = {};
    this.salaries = {};
    this.teamCaps = {};
    this.franchiseHistory = [];
    this.depthCharts = {};
    this.gamePlans = {};
    this.draftHistory = [];
    this.practiceSquads = {};
    this.injuredReserve = {};
    this._standingsDirty = true;
    this._cachedStandings = null;
    this.initializeStandings();
    this.initializePlayerStats();
    this.initializeCoaches();
    this.initializeSalaries();
    this.rebuildPlayerIndex();
    this.initializeDepthCharts();
    this.initializeGamePlans();
    this.initializePracticeSquads();
    this.initializeInjuredReserve();
  }
}

export const league = new LeagueEngine();
league.generateSchedule();
