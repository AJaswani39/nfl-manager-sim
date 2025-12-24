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
  changePossession(kickoff = false) {
    this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
    this.state.down = 1;
    this.state.distance = 10;
    
    // Simple Kickoff/Punt logic
    if (kickoff) {
      this.state.ballOn = 25; // Touchback
      this.addToLog(`Kickoff! ${this.getOffenseTeam().abbreviation} starts at their own 25.`);
    } else {
      // Punt logic (flip field)
      const puntDist = 40 + Math.floor(Math.random() * 10);
      let newLoc = (100 - this.state.ballOn) + puntDist;
      if (newLoc > 100) newLoc = 80; // Touchback
      this.state.ballOn = 100 - newLoc; // Flip perspective
      this.addToLog(`Punt! ${this.getOffenseTeam().abbreviation} takes over at their ${Math.round(this.state.ballOn)}.`);
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
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
           yardsGained = Math.floor(Math.random() * 10) + 2; // Broken play
           description = "Breaks through the blitz!";
        } else { // Coverage
           yardsGained = Math.floor(Math.random() * 6) + 2; // 2 to 8
           description = "Phes strong up the middle.";
        }
        break;

      case PLAY_TYPES.RUN_OUTSIDE:
        if (defChoice === DEFENSE_TYPES.BLITZ) {
          yardsGained = Math.floor(Math.random() * 4) - 2; // Risk loss
          description = "Blitz catches the runner in the backfield!";
        } else if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
          yardsGained = Math.floor(Math.random() * 3);
          description = "Contain holds.";
        } else {
          yardsGained = Math.floor(Math.random() * 15) + 3; // Big gain
          description = "Turns the corner!";
        }
        break;

      case PLAY_TYPES.PASS_SHORT:
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
          if (roll > 0.5) { yardsGained = Math.floor(Math.random() * 5); description = "Checkdown complete."; }
          else { yardsGained = 0; description = "Incomplete, coverage was tight."; }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
          yardsGained = Math.floor(Math.random() * 12) + 5;
          description = "Quick slant beats the blitz!";
        } else { // Run Defense
          yardsGained = Math.floor(Math.random() * 8) + 4;
          description = "Easy completion over the middle.";
        }
        break;

      case PLAY_TYPES.PASS_DEEP:
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
          if (roll > 0.8) { yardsGained = 40; description = "Incredible catch in traffic!"; }
          else if (roll < 0.2) { 
             turnover = true; description = "INTERCEPTED deep downfield!"; 
             yardsGained = -10; // Return
          } else {
             yardsGained = 0; description = "Incomplete deep.";
          }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
          if (roll > 0.6) { yardsGained = 70; touchdown = true; description = "BOMB! Has a man open! TOUCHDOWN!"; }
          else { yardsGained = -8; description = "SACKED! The blitz gets home."; }
        } else {
           if (roll > 0.4) { yardsGained = 25; description = "Deep post route open."; }
           else { yardsGained = 0; description = "Overthrow."; }
        }
        break;

      case PLAY_TYPES.PUNT:
         this.changePossession();
         return;

      case PLAY_TYPES.FG:
         const dist = 100 - this.state.ballOn + 17;
         if (dist < 45 || (dist < 55 && Math.random() > 0.3)) {
            this.addToLog(`Field Goal from ${dist} yds is GOOD!`);
            this.score(3);
            this.changePossession(true);
         } else {
            this.addToLog(`Field Goal from ${dist} yds is NO GOOD.`);
            this.changePossession(false);
         }
         return;
    }

    // Process Result
    if (turnover) {
      this.addToLog(description);
      this.changePossession();
    } else {
      if (yardsGained === 0 && !description.includes("Incomplete")) description = "No Gain.";
      this.state.ballOn += yardsGained;
      this.state.distance -= yardsGained;
      
      this.addToLog(description + ` (${yardsGained} yds)`);

      // Touchdown Check
      if (this.state.ballOn >= 100 || touchdown) {
        this.score(7); // Simplified 7 pts
        this.addToLog(`TOUCHDOWN ${off.abbreviation}!`);
        this.changePossession(true);
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
            this.changePossession();
          }
        }
      }
    }
  }

  score(points) {
    if (this.state.possession === 'home') this.state.homeScore += points;
    else this.state.awayScore += points;
  }

  addToLog(msg) {
    this.state.log.unshift(`Q${this.state.quarter}: ${msg}`);
  }
}
