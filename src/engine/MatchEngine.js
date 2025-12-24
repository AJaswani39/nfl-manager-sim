export const PLAY_TYPES = {
  RUN_INSIDE: 'RUN_INSIDE',
  RUN_OUTSIDE: 'RUN_OUTSIDE',
  PASS_SHORT: 'PASS_SHORT',
  PASS_DEEP: 'PASS_DEEP',
  PASS_SCREEN: 'PASS_SCREEN',
  PASS_PLAY_ACTION: 'PASS_PLAY_ACTION',
  RUN_DRAW: 'RUN_DRAW',
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
    this.receivedFirstHalf = null;

    this.state = {
      quarter: 1,
      timeRemaining: 900, 
      down: 1,
      distance: 10,
      ballOn: 25, 
      possession: 'home', 
      homeScore: 0,
      awayScore: 0,
      log: [],
      gameOver: false,
      kickoffPending: false, // New State
    };
    
    this.performCoinToss();
  }

  resolveKickoff(type) {
      this.state.kickoffPending = false;
      
      if (type === 'ONSIDE') {
          // 15% chance of recovery
          const success = Math.random() < 0.15;
          if (success) {
              this.addToLog(`ONSIDE KICK RECOVERED by ${this.getOffenseTeam().name}!`);
              this.state.ballOn = 45; // Recovered at own 45
              this.state.down = 1; this.state.distance = 10;
          } else {
              this.addToLog(`Onside kick failed. Recovered by receiving team.`);
              this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
              this.state.ballOn = 55; // Opponent 45
              this.state.down = 1; this.state.distance = 10;
          }
      } else {
          // Normal Kickoff -> Touchback (Simplification)
          this.addToLog(`Kickoff! Touchback.`);
          this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
          this.state.ballOn = 25;
          this.state.down = 1; this.state.distance = 10;
      }
  }

  performCoinToss() {
      // 50/50 Coin Toss
      const homeWon = Math.random() > 0.5;
      const winner = homeWon ? this.homeTeam : this.awayTeam;
      // Winner elects to receive in Q1 (Simplicity)
      this.state.possession = homeWon ? 'home' : 'away';
      this.receivedFirstHalf = homeWon ? 'home' : 'away'; // Track for Q3 flip
      const receiver = homeWon ? this.homeTeam : this.awayTeam;
      
      this.state.ballOn = 25; // Touchback start
      // Note: We can't log here easily because logs show Q1 15:00.
      // We'll trust the UI can show who has ball.
  }

  startOvertimeCoinToss() {
      const homeWon = Math.random() > 0.5;
      this.state.possession = homeWon ? 'home' : 'away';
      this.state.ballOn = 25;
      this.addToLog(`Overtime Coin Toss: ${homeWon ? this.homeTeam.name : this.awayTeam.name} wins and receives!`);
  }

  // Helper to flip field
  changePossession(type = 'punt') {
    // types: 'kickoff', 'punt', 'downs', 'turnover', 'score', 'safety_kick'
    
    // Safety Kick: Kicking team sets up at 20. Punts/Kicks. 
    // Usually good field position for returner.
    if (type === 'safety_kick') {
        this.addToLog(`Free Kick after Safety from ${this.getOffenseTeam().abbreviation}.`);
        this.state.ballOn = 45; // Receiving team (new possession) gets it at Own 45
        this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
        this.state.down = 1; this.state.distance = 10;
        return;
    }
    
    // SCORE: Don't flip yet. Set Kickoff mode.
    if (type === 'score') {
        this.state.kickoffPending = true;
        this.state.ballOn = 35; // Kickoff spot
        // Do NOT flip possession. Offense (Scorer) is now Kicking Team.
        return;
    }

    this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
    this.state.down = 1;
    this.state.distance = 10;
    
    // Default Flip (Downs, Turnover)
    let newLoc = 100 - this.state.ballOn;

    if (type === 'kickoff') {
       // Should use resolveKickoff now, but keep fallback
       newLoc = 25; 
    } else if (type === 'punt') {
      const puntDist = 35 + Math.floor(Math.random() * 25); // 35-60 yds
      const rawLoc = (100 - this.state.ballOn) + puntDist; 
      
      if (rawLoc > 100) {
          // Touchback
          newLoc = 20;
          this.addToLog("Punt bounces into Endzone. Touchback.");
      } else if (rawLoc >= 95) {
          // Coffin Corner (Pin Deep)
          newLoc = 100 - rawLoc; // e.g. 98 -> 2yd line (Wait: 100-98 = 2. Correct logic is 100 - rawLoc IS 2 from their goal?)
          // Wait: 
          // Kicking team at 50. Punt 48 yds. rawLoc = 98 (2 yds from endzone).
          // Field Flip: 100 - 98 = 2. 
          // Correct.
          this.addToLog(`Perfect Punt! Ball downed at the ${Math.round(100-rawLoc)} yard line!`);
          newLoc = 100 - rawLoc;
      } else {
          // Muffed Catch Chance (5%)
          if (Math.random() < 0.05) {
               this.addToLog("MUFFED PUNT! Recovered by Kicking Team!");
               // Revert possession change
               this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
               this.state.ballOn = rawLoc; // Recover at landing spot (e.g. 80)
               this.state.down = 1; this.state.distance = 10;
               return; // Exit
          }

          let returnYards = Math.floor(Math.random() * 12);
          newLoc = (100 - rawLoc) + returnYards;
          this.addToLog(`Punt returned ${returnYards} yds to ${Math.round(newLoc)}.`);
      }
    } 
    else if (type === 'downs' || type === 'turnover') {
         this.addToLog(`${this.getOffenseTeam().abbreviation} takes over at their ${Math.round(newLoc)}.`);
    }
    
    this.state.ballOn = newLoc;
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
          yardsGained = Math.floor(Math.random() * 3) - 1; 
          description = "Stuffed at the line!";
          if (Math.random() < 0.02) { turnover = true; description = "FUMBLE! Recovered by Defense!"; }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
           yardsGained = Math.floor(Math.random() * 12) + 4; 
           description = "Breaks through the blitz!";
        } else { 
           yardsGained = Math.floor(Math.random() * 6) + 2; 
           description = "Pushes strong up the middle.";
        }
        break;

      case PLAY_TYPES.RUN_OUTSIDE:
        if (defChoice === DEFENSE_TYPES.BLITZ) {
           if (Math.random() < 0.30) {
              yardsGained = -4; description = "Blitz tackle for loss!";
           } else {
              yardsGained = Math.floor(Math.random() * 10) + 5; description = "Beats the blitz to the edge!";
           }
        } else if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
          yardsGained = Math.floor(Math.random() * 4) - 1; description = "Contain holds.";
        } else {
          yardsGained = Math.floor(Math.random() * 12) + 3; description = "Turns the corner!";
        }
        break;

      case PLAY_TYPES.RUN_DRAW:
        // Good vs PASS_COVERAGE, Bag vs RUN_DEFENSE/BLITZ
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
           yardsGained = Math.floor(Math.random() * 10) + 5;
           description = "Defense drops back, Draw play wide open!";
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
           yardsGained = -2; description = "Blitz blows up the slow handoff.";
        } else {
           yardsGained = 1; description = "Run defense swallows the draw.";
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
          yardsGained = Math.floor(Math.random() * 10) + 4; description = "Hot read! Slant route open vs Blitz.";
        } else { 
          yardsGained = Math.floor(Math.random() * 10) + 5; description = "Easy completion over the middle.";
        }
        break;

      case PLAY_TYPES.PASS_SCREEN:
         // Good vs BLITZ, Bad vs MAN/COVERAGE
         if (defChoice === DEFENSE_TYPES.BLITZ) {
            yardsGained = Math.floor(Math.random() * 15) + 5;
            description = "Perfect screen call against the blitz!";
         } else if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
            yardsGained = Math.floor(Math.random() * 3) - 2;
            description = "Screen sniffed out by coverage.";
            if (Math.random() < 0.05) { turnover = true; description = "Screen pass JUMPED! INTERCEPTION!"; }
         } else {
            yardsGained = Math.floor(Math.random() * 5);
            description = "Screen play gets a few yards.";
         }
         break;

      case PLAY_TYPES.PASS_PLAY_ACTION:
         // Good vs RUN_DEFENSE, Bad vs BLITZ
         if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
             yardsGained = Math.floor(Math.random() * 20) + 10;
             description = "Defense bites on the fake! Wide open!";
         } else if (defChoice === DEFENSE_TYPES.BLITZ) {
             yardsGained = -7; description = "SACK! No time for the fake.";
             if (Math.random() < 0.15) { turnover = true; description = "STRIP SACK on the play action!"; }
         } else {
             yardsGained = Math.floor(Math.random() * 10);
             description = "Coverage holds up on play action.";
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
          if (Math.random() < 0.35) { 
             yardsGained = -8; description = "SACKED! The blitz gets home."; 
             if (Math.random() < 0.20) { turnover = true; description = "STRIP SACK! FUMBLE!"; }
          } else { 
             yardsGained = 60; touchdown = true; description = "BOMB! Has a man wide open! TOUCHDOWN!"; 
          }
        } else {
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
            this.changePossession('turnover');
         }
         return;
    }

    // Process Result
    if (turnover) {
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

      // SAFETY CHECK
      if (this.state.ballOn <= 0) {
          this.scoreDefense(2);
          this.addToLog("SAFETY! Tackled in the endzone!");
          this.changePossession('safety_kick');
      }
      else if (this.state.ballOn >= 100 || touchdown) {
        this.score(7);
        this.addToLog(`TOUCHDOWN ${off.abbreviation}!`);
        this.changePossession('score');
      } else {
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
    
    this.tickClock();
  }

  score(points) {
    if (this.state.possession === 'home') this.state.homeScore += points;
    else this.state.awayScore += points;
    
    if (this.state.quarter > 4) {
        this.addToLog("OT Score! Game Over!");
        this.state.gameOver = true;
    }
  }

  scoreDefense(points) {
    if (this.state.possession === 'home') this.state.awayScore += points;
    else this.state.homeScore += points;
    
    if (this.state.quarter > 4) {
        this.addToLog("OT Score! Game Over!");
        this.state.gameOver = true;
    }
  }

  tickClock() {
    if (this.state.gameOver) return;

    const timeBurn = 30 + Math.floor(Math.random() * 15);
    this.state.timeRemaining -= timeBurn;

    if (this.state.timeRemaining <= 0) {
      // Quarter Change
      if (this.state.quarter < 4) {
         
         const oldQ = this.state.quarter;
         this.state.quarter++;
         this.state.timeRemaining = 900;
         this.addToLog(`End of Quarter ${oldQ}`);
         
         // HALFTIME LOGIC (End of Q2)
         if (oldQ === 2) {
             this.addToLog("HALFTIME");
             // Flip possession to whoever kicked off in Q1
             // If Home Received in Q1, Away Receives in Q3
             const receiverInQ3 = this.receivedFirstHalf === 'home' ? 'away' : 'home';
             this.state.possession = receiverInQ3;
             this.state.ballOn = 25; // Touchback start
             this.state.down = 1;
             this.state.distance = 10;
             this.addToLog(`${this.getOffenseTeam().name} receives the 2nd half kickoff.`);
         }
      } else if (this.state.quarter === 4) {
         // Check for Overtime
         if (this.state.homeScore === this.state.awayScore) {
             this.state.quarter = 5;
             this.state.timeRemaining = 600; // 10 mins
             this.addToLog("End of Regulation. TIED GAME! Going to Overtime!");
             this.startOvertimeCoinToss();
         } else {
             this.state.timeRemaining = 0;
             this.state.gameOver = true;
             this.addToLog("GAME OVER");
         }
      } else {
          // OT Time Expired (Still Tied)
          this.state.timeRemaining = 0;
          this.state.gameOver = true;
          this.addToLog("OT Ended. TIE GAME.");
      }
    }
  }

  addToLog(msg) {
    if (this.state.log.length > 50) this.state.log.pop();
    const qLabel = this.state.quarter > 4 ? 'OT' : `Q${this.state.quarter}`;
    this.state.log.unshift(`${qLabel} ${Math.floor(this.state.timeRemaining/60)}:${(this.state.timeRemaining%60).toString().padStart(2,'0')} - ${msg}`);
  }
}
