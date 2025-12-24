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
    this.phase = 'regular'; // 'regular', 'playoffs', 'offseason'
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
       const winners = lastWeek.map(m => m.result.homeScore > m.result.awayScore ? m.home : m.away);
       
       ['AFC', 'NFC'].forEach(conf => {
          // Get Seed 1 (who had bye)
          const allSeeds = this.getPlayoffPicture()[conf];
          const seed1 = allSeeds[0];
          
          // Get WC Winners for this conference
          const confWinners = winners.filter(t => t.conference === conf);
          
          // Re-seed: Sort winners by their original seed index logic (or just find them in allSeeds)
          // Actually, we can just look up their seed index in allSeeds
          confWinners.sort((a,b) => {
             const idxA = allSeeds.findIndex(s => s.id === a.id);
             const idxB = allSeeds.findIndex(s => s.id === b.id);
             return idxA - idxB;
          }); 
          // Lowest seed (highest index) plays Seed 1
          const lowestSeed = confWinners.pop(); // Last one is worst seed
          const bestWCSeed = confWinners[0];    // Best remaining WC winner
          const secondBestWC = confWinners[1];  // Middle WC winner (wait, only 3 games. 3 winners.)
          
          // Matchups:
          // 1 vs Lowest Remaining
          // 2nd Highest Remaining vs 3rd Highest Remaining (Wait. 3 winners + 1 Bye = 4 Teams)
          // Teams: Seed 1, WC1, WC2, WC3 (Sorted by seed quality)
          // Lowest seed is WC3. 
          // Match 1: Seed 1 vs WC3 (Lowest)
          // Match 2: WC1 vs WC2
          
          newMatches.push(this.createMatch(w, seed1, lowestSeed, 'Divisional'));
          newMatches.push(this.createMatch(w, confWinners[0], confWinners[1], 'Divisional'));
       });
    }
    // CONFERENCE CHAMPIONSHIP
    else if (roundName === 'Conference') {
       const lastWeek = this.weeks[this.weeks.length - 1];
       const winners = lastWeek.map(m => m.result.homeScore > m.result.awayScore ? m.home : m.away);
       
       ['AFC', 'NFC'].forEach(conf => {
          const confWinners = winners.filter(t => t.conference === conf);
          // Higher seed assumes Home Field. Re-sort by generic seed logic if needed, 
          // but simulateWeek updates standings? No, playoffs don't update W/L.
          // We rely on getPlayoffPicture for initial seed order.
          const allSeeds = this.getPlayoffPicture()[conf];
          confWinners.sort((a,b) => allSeeds.findIndex(s=>s.id===a.id) - allSeeds.findIndex(s=>s.id===b.id)); // Best seed first
          
          newMatches.push(this.createMatch(w, confWinners[0], confWinners[1], 'Conference'));
       });
    }
    // SUPER BOWL
    else if (roundName === 'Super Bowl') {
       const lastWeek = this.weeks[this.weeks.length - 1];
       const winners = lastWeek.map(m => m.result.homeScore > m.result.awayScore ? m.home : m.away);
       // Should be 1 AFC and 1 NFC
       newMatches.push(this.createMatch(w, winners[0], winners[1], 'Super Bowl'));
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

  // Update simulateWeek to handle progression
  simulateWeek(weekIndex) {
    if (weekIndex < 0 || weekIndex >= this.weeks.length) return;
    
    const weekMatches = this.weeks[weekIndex];
    let allPlayed = true;

    weekMatches.forEach(match => {
      if (match.played) return;
      
      const homeScore = this.calculateScore(match.home, match.away);
      const awayScore = this.calculateScore(match.away, match.home);
      match.result = { homeScore, awayScore };
      match.played = true;

      // Only update Regular Season standings
      if (this.currentWeek <= 17) {
        this.updateStandings(match.home.id, homeScore, awayScore);
        this.updateStandings(match.away.id, awayScore, homeScore);
      }
      this.distributeStats(match.home.id, homeScore);
      this.distributeStats(match.away.id, awayScore);
    });

    this.currentWeek++;

    // Check for Progression triggers
    if (this.currentWeek === 18 && this.phase === 'regular') {
       this.startPlayoffs();
    } else if (this.phase === 'playoffs') {
       // Just finished a playoff week, generate next
       const lastRound = weekMatches[0].type;
       if (lastRound === 'Wild Card') this.generatePlayoffRound('Divisional');
       else if (lastRound === 'Divisional') this.generatePlayoffRound('Conference');
       else if (lastRound === 'Conference') this.generatePlayoffRound('Super Bowl');
       else if (lastRound === 'Super Bowl') {
          this.phase = 'offseason'; // End of season
       }
    }
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
