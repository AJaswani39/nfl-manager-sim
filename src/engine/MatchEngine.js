export const PLAY_TYPES = {
  RUN_INSIDE: 'RUN_INSIDE',
  RUN_OUTSIDE: 'RUN_OUTSIDE',
  PASS_SHORT: 'PASS_SHORT',
  PASS_DEEP: 'PASS_DEEP',
  PUNT: 'PUNT',
  FG: 'FG',
};

export const DEFENSE_TYPES = {
  RUN_DEFENSE: 'RUN_DEFENSE',
  PASS_COVERAGE: 'PASS_COVERAGE',
  BLITZ: 'BLITZ',
};

export class MatchEngine {
  constructor(homeTeam, awayTeam) {
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    
    this.state = {
      quarter: 1,
      timeRemaining: 900, // 15 mins in seconds (scaled down for gameplay speed usually)
      down: 1,
      distance: 10,
      ballOn: 20, // 0-100 scale. 0 = Own Endzone, 100 = Opponent Endzone
      possession: 'home', // 'home' or 'away'
      homeScore: 0,
      awayScore: 0,
      log: [],
      gameOver: false,
    };
  }

  // Helper to flip field
  changePossession(type = 'punt') {
    // types: 'kickoff', 'punt', 'downs', 'turnover', 'score'
    this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
    this.state.down = 1;
    this.state.distance = 10;
    
    if (type === 'kickoff' || type === 'score') {
      this.state.ballOn = 25; // Touchback logic
      this.addToLog(`Kickoff! ${this.getOffenseTeam().abbreviation} starts at their own 25.`);
    } else if (type === 'punt') {
      const puntDist = 40 + Math.floor(Math.random() * 15); // Better punt logic
      let newLoc = (100 - this.state.ballOn) + puntDist;
      if (newLoc > 100) newLoc = 80; 
      this.state.ballOn = 100 - newLoc; 
      this.addToLog(`Punt! ${this.getOffenseTeam().abbreviation} takes over at their ${Math.round(this.state.ballOn)}.`);
    } else if (type === 'downs' || type === 'turnover') {
      // Ball stays at same spot, just flipped perspective
      // Example: User fails at OPP 10 (ballOn=90). Opponent takes over at OWN 10 (ballOn=10).
      // Example: User fails at OWN 30 (ballOn=30). Opponent takes over at OPP 30 (ballOn=70).
      this.state.ballOn = 100 - this.state.ballOn;
      this.addToLog(`${this.getOffenseTeam().abbreviation} takes over at their ${Math.round(this.state.ballOn)}.`);
    }
  }

  getOffenseTeam() { return this.state.possession === 'home' ? this.homeTeam : this.awayTeam; }
  getDefenseTeam() { return this.state.possession === 'home' ? this.awayTeam : this.homeTeam; }

  resolvePlay(offChoice, defChoice) {
    if (this.state.gameOver) return;

    const off = this.getOffenseTeam();
    const def = this.getDefenseTeam();
    let yardsGained = 0;
    let description = "";
    let turnover = false;
    let touchdown = false;

    // Rock-Paper-Scissors Logic with Ratings Modifiers
    // Modifiers
    const offRating = off.ratings.offense / 100; // 0.9
    const defRating = def.ratings.defense / 100; // 0.85
    const diff = offRating - defRating; // e.g. 0.05

    // RANDOM FACTOR
    const roll = Math.random() + diff; // Higher is better for offense

    // LOGIC MATRIX
    switch (offChoice) {
      case PLAY_TYPES.RUN_INSIDE:
        if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
          yardsGained = Math.floor(Math.random() * 3) - 1; // -1 to 2
          description = "Stuffed at the line!";
          // 2% Fumble Chance
          if (Math.random() < 0.02) { turnover = true; description = "FUMBLE! Recovered by Defense!"; }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
           yardsGained = Math.floor(Math.random() * 12) + 4; // Broken play (high variance)
           description = "Breaks through the blitz!";
        } else { // Coverage
           yardsGained = Math.floor(Math.random() * 6) + 2; 
           description = "Pushes strong up the middle.";
        }
        break;

      case PLAY_TYPES.RUN_OUTSIDE:
        if (defChoice === DEFENSE_TYPES.BLITZ) {
           // 30% Chance of HUGE loss, 70% Chance of huge gain
           if (Math.random() < 0.30) {
              yardsGained = -4; 
              description = "Blitz tackle for loss!";
           } else {
              yardsGained = Math.floor(Math.random() * 10) + 5;
              description = "Beats the blitz to the edge!";
           }
        } else if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
          yardsGained = Math.floor(Math.random() * 4) - 1;
          description = "Contain holds.";
        } else {
          yardsGained = Math.floor(Math.random() * 12) + 3; 
          description = "Turns the corner!";
        }
        break;

      case PLAY_TYPES.PASS_SHORT:
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
          if (roll > 0.4) { yardsGained = Math.floor(Math.random() * 7) + 2; description = "Checkdown complete."; }
          else { 
             yardsGained = 0; description = "Incomplete, coverage was tight."; 
             if (Math.random() < 0.05) { turnover = true; description = "INTERCEPTED by the linebacker!"; yardsGained = 0; }
          }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
          // Blitz vs Short Pass: Offense usually wins quickly
          yardsGained = Math.floor(Math.random() * 10) + 4;
          description = "Hot read! Slant route open vs Blitz.";
        } else { // Run Defense
          yardsGained = Math.floor(Math.random() * 10) + 5;
          description = "Easy completion over the middle.";
        }
        break;

      case PLAY_TYPES.PASS_DEEP:
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
          if (roll > 0.75) { yardsGained = 35 + Math.floor(Math.random()*15); description = "Incredible catch deep!"; }
          else { 
             yardsGained = 0; description = "Incomplete deep.";
             if (Math.random() < 0.12) { turnover = true; description = "INTERCEPTED deep downfield!"; yardsGained = -10; }
          }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
          // Blitz vs Deep: High Risk
          if (Math.random() < 0.35) { 
             // SACK!
             yardsGained = -8; description = "SACKED! The blitz gets home."; 
             if (Math.random() < 0.20) { turnover = true; description = "STRIP SACK! FUMBLE!"; }
          } else { 
             // If not sacked, likely TD
             yardsGained = 60; touchdown = true; description = "BOMB! Has a man wide open! TOUCHDOWN!"; 
          }
        } else { // Run Defense vs Deep
           if (roll > 0.4) { yardsGained = 25; description = "Deep post route open."; }
           else { yardsGained = 0; description = "Overthrow."; }
        }
        break;

      case PLAY_TYPES.PUNT:
         this.changePossession('punt');
         return;

      case PLAY_TYPES.FG:
         const dist = 100 - this.state.ballOn + 17;
         if (dist < 45 || (dist < 55 && Math.random() > 0.3)) {
            this.addToLog(`Field Goal from ${dist} yds is GOOD!`);
            this.score(3);
            this.changePossession('score');
         } else {
            this.addToLog(`Field Goal from ${dist} yds is NO GOOD.`);
            this.changePossession('turnover'); // Missed FG is spot foul turnover
         }
         return;
    }

    // Process Result
    if (turnover) {
      // Check for Defensive Touchdown (Pick-6 or Scoop-and-Score)
      if (Math.random() < 0.08) { // 8% chance on a turnover
         this.scoreDefense(7);
         this.addToLog(description + " DEFENSE RETURNS IT FOR A TOUCHDOWN!!!");
         this.changePossession('score');
      } else {
         this.addToLog(description);
         this.changePossession('turnover');
      }
    } else {
      if (yardsGained === 0 && !description.includes("Incomplete")) description = "No Gain.";
      this.state.ballOn += yardsGained;
      this.state.distance -= yardsGained;
      
      this.addToLog(description + ` (${yardsGained} yds)`);

      // Touchdown Check
      if (this.state.ballOn >= 100 || touchdown) {
        this.score(7); // Simplified 7 pts
        this.addToLog(`TOUCHDOWN ${off.abbreviation}!`);
        this.changePossession('score');
      } else {
        // Down Logic
        if (this.state.distance <= 0) {
          this.state.down = 1;
          this.state.distance = 10;
          this.addToLog("FIRST DOWN!");
        } else {
          this.state.down++;
          if (this.state.down > 4) {
            this.addToLog("Turnover on Downs!");
            this.changePossession('downs');
          }
        }
      }
    }
  }

  score(points) {
    if (this.state.possession === 'home') this.state.homeScore += points;
    else this.state.awayScore += points;
  }

  scoreDefense(points) {
     // Scoring for the team NOT in possession
    if (this.state.possession === 'home') this.state.awayScore += points;
    else this.state.homeScore += points;
  }

  addToLog(msg) {
    this.state.log.unshift(`Q${this.state.quarter}: ${msg}`);
  }
}
