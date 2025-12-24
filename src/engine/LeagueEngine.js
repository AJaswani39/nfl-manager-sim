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
    this.weeks = []; // Array of arrays of matches
    this.standings = {}; 
    this.playerStats = {}; // { playerId: { passingYards: 0, touchdowns: 0, ... } }
    this.currentWeek = 1;
    this.initializeStandings();
    this.initializePlayerStats();
  }

  initializeStandings() {
    TEAMS.forEach(team => {
      this.standings[team.id] = { w: 0, l: 0, pf: 0, pa: 0, matches: [] };
    });
  }

  initializePlayerStats() {
    Object.keys(ROSTERS).forEach(teamId => {
      ROSTERS[teamId].forEach(player => {
        this.playerStats[player.id] = {
          passingYards: 0, passingTDs: 0,
          rushingYards: 0, rushingTDs: 0,
          receivingYards: 0, receivingTDs: 0,
          tackles: 0, sacks: 0
        };
      });
    });
  }

  generateSchedule() {
    // [Same schedule logic as before for MVP simplification]
    for (let w = 1; w <= 17; w++) {
      const weeklyMatches = [];
      const teamsPool = shuffle([...TEAMS]);
      
      while (teamsPool.length >= 2) {
        const home = teamsPool.pop();
        const away = teamsPool.pop();
        weeklyMatches.push({ 
          id: `w${w}_${home.id}_${away.id}`,
          week: w,
          home: home,
          away: away,
          played: false,
          result: null
        });
      }
      this.weeks.push(weeklyMatches);
    }
  }

  simulateWeek(weekIndex) {
    if (weekIndex < 0 || weekIndex >= this.weeks.length) return;
    
    const weekMatches = this.weeks[weekIndex];
    weekMatches.forEach(match => {
      if (match.played) return;

      const homeScore = this.calculateScore(match.home, match.away);
      const awayScore = this.calculateScore(match.away, match.home);

      match.result = { homeScore, awayScore };
      match.played = true;

      this.updateStandings(match.home.id, homeScore, awayScore);
      this.updateStandings(match.away.id, awayScore, homeScore);

      // Distribute Stats
      this.distributeStats(match.home.id, homeScore);
      this.distributeStats(match.away.id, awayScore);
    });

    this.currentWeek++;
  }

  calculateScore(offenseTeam, defenseTeam) {
    const base = Math.floor(Math.random() * 20); 
    const matchUpDiff = (offenseTeam.ratings.offense - defenseTeam.ratings.defense) / 2;
    let score = 17 + base + matchUpDiff;
    if (Math.random() > 0.95) score += 14; 
    if (Math.random() < 0.05) score = 0; 
    return Math.max(0, Math.floor(score));
  }

  distributeStats(teamId, score) {
    const roster = ROSTERS[teamId];
    if (!roster) return;

    const qb = roster.find(p => p.position === 'QB');
    const rbs = roster.filter(p => p.position === 'RB');
    const wrs = roster.filter(p => p.position === 'WR' || p.position === 'TE');

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

    // 3. Assign to Players (Update state)
    if (qb) {
      this.playerStats[qb.id].passingYards += passingYards;
      this.playerStats[qb.id].passingTDs += passingTDs;
    }

    // Randomly distribute rushing yards/TDs among RBs
    if (rbs.length > 0) {
      let remainingRush = rushingYards;
      let remainingRushTD = rushingTDs;
      rbs.forEach((rb, idx) => {
        if (idx === rbs.length - 1) {
          this.playerStats[rb.id].rushingYards += remainingRush;
          this.playerStats[rb.id].rushingTDs += remainingRushTD;
        } else {
          const share = Math.floor(remainingRush * (0.5 + Math.random() * 0.3));
          const tdShare = remainingRushTD > 0 && Math.random() > 0.5 ? 1 : 0;
          this.playerStats[rb.id].rushingYards += share;
          this.playerStats[rb.id].rushingTDs += tdShare;
          remainingRush -= share;
          remainingRushTD -= tdShare;
        }
      });
    }

    // Randomly distribute passing yards/TDs among WRs/TEs
    if (wrs.length > 0) {
      let remainingPass = passingYards;
      let remainingPassTD = passingTDs;
      wrs.forEach((wr, idx) => {
         if (idx === wrs.length - 1) {
           this.playerStats[wr.id].receivingYards += remainingPass;
           this.playerStats[wr.id].receivingTDs += remainingPassTD;
         } else {
           const share = Math.floor(remainingPass * Math.random());
           const tdShare = remainingPassTD > 0 && Math.random() > 0.7 ? 1 : 0;
           this.playerStats[wr.id].receivingYards += share;
           this.playerStats[wr.id].receivingTDs += tdShare;
           remainingPass -= share;
           remainingPassTD -= tdShare;
         }
      });
    }
  }

  updateStandings(teamId, pointsFor, pointsAgainst) {
    const entry = this.standings[teamId];
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
}

export const league = new LeagueEngine();
league.generateSchedule();
