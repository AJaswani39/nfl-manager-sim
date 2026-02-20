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
  constructor() {
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
    this.currentWeek = 1;
    this.season = 1;
    this.phase = 'preseason'; // 'preseason', 'regular', 'playoffs', 'offseason'
    this.initializeStandings();
    this.initializePlayerStats();
    this.initializeCoaches();
    this.initializeSalaries();
    this.initializeDepthCharts();
  }

  initializeStandings() {
    TEAMS.forEach(team => {
      this.standings[team.id] = { w: 0, l: 0, pf: 0, pa: 0, matches: [] };
    });
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
      const randomType = coachTypes[Math.floor(Math.random() * coachTypes.length)];
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
                if (this.playerState[pid].weeksOut <= 0) delete this.playerState[pid];
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
    const base = Math.floor(Math.random() * 20); 
    const matchUpDiff = (offenseTeam.ratings.offense - defenseTeam.ratings.defense) / 2;
    let score = 17 + base + matchUpDiff;
    if (Math.random() > 0.95) score += 14; 
    if (Math.random() < 0.05) score = 0; 
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
      if (Math.random() > 0.4) passingTDs++; else rushingTDs++;
    }

    // 2. Determine Yards (Approx 10-15 yards per point + base)
    const totalYards = 150 + (score * 10) + Math.floor(Math.random() * 100);
    const passingYards = Math.floor(totalYards * (0.6 + Math.random() * 0.2));
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
          const starterShare = idx === 0 ? (0.60 + Math.random() * 0.15) : (0.3 + Math.random() * 0.2);
          const share = Math.floor(remainingRush * starterShare);
          const tdShare = remainingRushTD > 0 && (idx === 0 ? Math.random() > 0.3 : Math.random() > 0.6) ? 1 : 0;
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
          share = Math.floor(remainingPass * (starterShares[idx] + (Math.random() * 0.1 - 0.05)));
        } else {
          share = Math.floor(remainingPass * Math.random() * 0.3);
        }
        share = Math.max(0, Math.min(share, remainingPass));
        const tdShare = remainingPassTD > 0 && (idx === 0 ? Math.random() > 0.4 : Math.random() > 0.7) ? 1 : 0;
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
  }

  getStandingsSorted() {
    return Object.keys(this.standings)
      .map(teamId => {
        const team = TEAMS.find(t => t.id === teamId);
        return { ...team, ...this.standings[teamId] };
      })
      .sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa));
  }

  // LEADERBOARD LOGIC
  getLeaderboard(statKey, limit = 10) {
    // Find player info from rosters
    const findPlayer = (playerId) => {
      for (const teamId of Object.keys(this.rosters)) {
        const player = this.rosters[teamId].find(p => p.id === playerId);
        if (player) return { ...player, teamId };
      }
      return null;
    };

    return Object.keys(this.playerStats)
      .map(playerId => {
        const stats = this.playerStats[playerId];
        const player = findPlayer(playerId);
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
    const findPlayer = (playerId) => {
      for (const teamId of Object.keys(this.rosters)) {
        const player = this.rosters[teamId].find(p => p.id === playerId);
        if (player) return { ...player, teamId };
      }
      return null;
    };

    // Calculate scores for all players
    const playerScores = Object.keys(this.playerStats)
      .map(playerId => {
        const stats = this.playerStats[playerId];
        const player = findPlayer(playerId);
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
    if (this.currentWeek > 17) return {}; // Season over, odds are 100% or 0%

    const SIMULATIONS = 50;
    const teamPlayoffCounts = {};
    TEAMS.forEach(t => teamPlayoffCounts[t.id] = 0);

    // Current State snapshot
    const currentStandings = JSON.parse(JSON.stringify(this.standings));
    const startWeek = this.currentWeek;

    for (let sim = 0; sim < SIMULATIONS; sim++) {
      // 1. Clone Standings
      const simStandings = JSON.parse(JSON.stringify(currentStandings));
      
      // 2. Simulate Remaining Games
      for (let w = startWeek; w <= 17; w++) {
        const weekMatches = this.weeks[w-1];
        weekMatches.forEach(match => {
           // Quick sim: 50/50 + rating bias
           const homeAdv = match.home.ratings.overall > match.away.ratings.overall ? 0.6 : 0.4;
           const homeWins = Math.random() < homeAdv;
           const winnerId = homeWins ? match.home.id : match.away.id;
           simStandings[winnerId].w++; 
        });
      }

      // 3. Determine Seeds for this Sim
      // (Simplified: Just take top 7 per conference by Wins)
      const allTeams = TEAMS.map(t => ({...t, w: simStandings[t.id].w}));
      const afc = allTeams.filter(t => t.conference === 'AFC').sort((a, b) => b.w - a.w).slice(0, 7);
      const nfc = allTeams.filter(t => t.conference === 'NFC').sort((a, b) => b.w - a.w).slice(0, 7);
      
      [...afc, ...nfc].forEach(t => teamPlayoffCounts[t.id]++);
    }

    // Convert to Percentages
    const odds = {};
    Object.keys(teamPlayoffCounts).forEach(id => {
      odds[id] = Math.round((teamPlayoffCounts[id] / SIMULATIONS) * 100);
    });

    return odds;
  }
  // DRAFT & OFFSEASON
  
  addNews(message, type = 'general') {
       this.news.unshift({
           message,
           type, 
           week: this.currentWeek,
           timestamp: Date.now()
       });
       if (this.news.length > 50) this.news.pop();
   }

   generateTransactions() {
        const actions = [
            "signed a 1-year extension.",
            "is testing Free Agency.",
            "demanded a trade.",
            "was seen training with a new QB coach.",
            "guarantees a playoff spot this year."
        ];
        
        for(let i=0; i<3; i++) {
             const teamId = TEAMS[Math.floor(Math.random()*TEAMS.length)].id;
             const roster = this.rosters[teamId];
             if (roster && roster.length > 0) {
                 const p = roster[Math.floor(Math.random()*roster.length)];
                 const action = actions[Math.floor(Math.random()*actions.length)];
                 this.addNews(`${p.name} (${p.position}) ${action}`, 'transaction');
             }
        }
   }

  generateDraftClass() {
     const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
     const firstNames = ['DeAndre', 'Marcus', 'Caleb', 'Trevor', 'Kenny', 'Jalen', 'Sauce', 'Tyreek', 'Justin', 'Patrick', 'Joe'];
     const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
     
     this.draftClass = [];
     for(let i=0; i<60; i++) { // 60 prospects
         const pos = positions[Math.floor(Math.random() * positions.length)];
         const overall = 65 + Math.floor(Math.random() * 25); // 65-90
         this.draftClass.push({
             id: `rookie_${Date.now()}_${i}`,
             name: `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastNames[Math.floor(Math.random()*lastNames.length)]}`,
             position: pos,
             overall: overall,
             age: 21 + Math.floor(Math.random()*3)
         });
     }
     this.draftClass.sort((a,b) => b.overall - a.overall); // Sort by quality for CPU
  }

  startDraft() {
     this.generateDraftClass();
     
     // Generate Order (Reverse Standings)
     const sortedTeams = this.getStandingsSorted().reverse(); // Worst teams first
     this.draftOrder = sortedTeams.map(t => t.id);
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
            this.addToDepthChart(teamId, pick);

            displayLog.push({ type: 'pick', teamId: teamId, player: pick });
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
      this.addToDepthChart(userTeamId, pick);

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
      const pos = positions[Math.floor(Math.random() * positions.length)];
      const rating = 60 + Math.floor(Math.random() * 25); // 60-85 range (veterans)
      const age = 26 + Math.floor(Math.random() * 8); // 26-33 range
      
      newFAs.push({
        id: `fa_${Date.now()}_${i}`,
        name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
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
    this.removeFromDepthChart(teamId, playerId);
    this.freeAgents.push(player);
    this.freeAgents.sort((a, b) => b.overall - a.overall);

    this.addNews(`${player.name} (${player.position}) was released by ${teamId}.`, 'transaction');
    return player;
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
      
      // 3. Reset Player Stats
      this.playerStats = {};
      this.initializePlayerStats();
      
      // 4. Generate New Schedule
      this.generateSchedule();
      
      // 5. Progression & Retirement
      const progressionNews = [];
      Object.keys(this.rosters).forEach(teamId => {
          const roster = this.rosters[teamId];
          const kept = [];
          const coach = this.getCoach(teamId);
          const devBonus = (coach && coach.bonuses && coach.bonuses.developmentBonus) || 0;

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

              if (Math.random() < retireChance) {
                  this.addNews(`${p.name} (${p.position}) has retired after ${p.age - 21} seasons.`, 'retire');
              } else {
                  // Position-adjusted age for progression curve
                  // QBs/Ks/Ps peak later, RBs peak earlier
                  let effectiveAge = p.age;
                  if (['QB', 'K', 'P'].includes(p.position)) effectiveAge -= 2;
                  else if (p.position === 'RB') effectiveAge += 1;

                  // Base progression by age bracket
                  let change = 0;
                  if (effectiveAge < 25) {
                      change = Math.floor(Math.random() * 4) + 1;       // +1 to +4
                  } else if (effectiveAge < 28) {
                      change = Math.floor(Math.random() * 3);           // +0 to +2
                  } else if (effectiveAge < 31) {
                      change = Math.floor(Math.random() * 3) - 1;      // -1 to +1
                  } else if (effectiveAge < 34) {
                      change = -(Math.floor(Math.random() * 3) + 1);   // -1 to -3
                  } else {
                      change = -(Math.floor(Math.random() * 4) + 2);   // -2 to -5
                  }

                  // Coach development bonus for young players
                  if (devBonus > 0 && p.age < 26) {
                      change += Math.floor(Math.random() * (devBonus + 1)); // +0 to +devBonus
                  }

                  // Performance bonus based on season stats
                  const stats = this.playerStats[p.id];
                  if (stats) {
                      let performed = false;
                      if (['QB'].includes(p.position) && ((stats.passingYards || 0) > 2000 || (stats.passingTDs || 0) > 15)) performed = true;
                      if (['RB'].includes(p.position) && ((stats.rushingYards || 0) > 700 || (stats.rushingTDs || 0) > 5)) performed = true;
                      if (['WR', 'TE'].includes(p.position) && ((stats.receivingYards || 0) > 500 || (stats.receivingTDs || 0) > 4)) performed = true;
                      if (['DL', 'LB', 'DB', 'CB', 'S'].includes(p.position) && ((stats.tackles || 0) > 40 || (stats.sacks || 0) > 5)) performed = true;
                      if (performed) change += Math.floor(Math.random() * 2) + 1; // +1 to +2
                  }

                  p.overall = Math.max(50, Math.min(99, oldOverall + change));
                  kept.push(p);

                  // Track notable changes for news
                  if (change >= 3) {
                      progressionNews.push({ name: p.name, pos: p.position, overall: p.overall, change, type: 'improve' });
                  } else if (change <= -3) {
                      progressionNews.push({ name: p.name, pos: p.position, overall: p.overall, change, type: 'decline' });
                  }
              }
          });

          this.rosters[teamId] = kept;

          // Update Team Ratings based on new roster
          if (kept.length > 0) {
              const totalOvr = kept.reduce((sum, p) => sum + p.overall, 0);
              const avgOvr = Math.round(totalOvr / kept.length);

              const team = TEAMS.find(t => t.id === teamId);
              if (team) {
                  team.ratings.overall = avgOvr;
                  team.ratings.offense = avgOvr;
                  team.ratings.defense = avgOvr;
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
      
      // 6. Sync depth charts (remove retired players, keep user ordering)
      Object.keys(this.rosters).forEach(teamId => {
          this.ensureDepthChart(teamId);
      });

      this.generateTransactions();
      this.generateFreeAgents();
  }

  // SAVE/LOAD GAME
  getSaveData() {
    return {
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
    // Ensure all teams have depth charts (handles saves from before this feature)
    Object.keys(this.rosters).forEach(teamId => {
      if (!this.depthCharts[teamId]) this.ensureDepthChart(teamId);
    });
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
    this.draftClass = null;
    this.draftOrder = null;
    this.currentPickIndex = 0;
    this.freeAgents = [];
    this.coaches = {};
    this.salaries = {};
    this.teamCaps = {};
    this.franchiseHistory = [];
    this.depthCharts = {};
    this.initializeStandings();
    this.initializePlayerStats();
    this.initializeCoaches();
    this.initializeSalaries();
    this.initializeDepthCharts();
  }
}

export const league = new LeagueEngine();
league.generateSchedule();
