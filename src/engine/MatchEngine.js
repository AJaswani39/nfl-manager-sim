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

const OFFENSIVE_SCHEME_WEIGHTS = {
  run_heavy: {
    insideRun: 0.34,
    outsideRun: 0.18,
    shortPass: 0.18,
    deepPass: 0.07,
    screen: 0.06,
    playAction: 0.12,
    draw: 0.05,
  },
  balanced: {
    insideRun: 0.20,
    outsideRun: 0.14,
    shortPass: 0.25,
    deepPass: 0.14,
    screen: 0.09,
    playAction: 0.11,
    draw: 0.07,
  },
  pass_heavy: {
    insideRun: 0.08,
    outsideRun: 0.06,
    shortPass: 0.30,
    deepPass: 0.24,
    screen: 0.11,
    playAction: 0.12,
    draw: 0.09,
  },
  spread: {
    insideRun: 0.08,
    outsideRun: 0.09,
    shortPass: 0.24,
    deepPass: 0.15,
    screen: 0.19,
    playAction: 0.11,
    draw: 0.14,
  },
};

const DEFENSIVE_SCHEME_WEIGHTS = {
  aggressive: { runDef: 0.26, coverage: 0.32, blitz: 0.42 },
  balanced: { runDef: 0.34, coverage: 0.42, blitz: 0.24 },
  conservative: { runDef: 0.32, coverage: 0.56, blitz: 0.12 },
  blitz_heavy: { runDef: 0.18, coverage: 0.25, blitz: 0.57 },
};


export class MatchEngine {
  constructor(homeTeam, awayTeam, homeRoster, awayRoster, isPlayoff = false, injuries = {}, homeDepthChart = null, awayDepthChart = null, homeGamePlan = null, awayGamePlan = null, userTeamId = null, random = Math.random) {
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.isPlayoff = isPlayoff;
    this.random = typeof random === 'function' ? random : Math.random;
    this.injuries = JSON.parse(JSON.stringify(injuries));
    this.newInjuries = {};
    this.receivedFirstHalf = null;
    this._userSide = userTeamId === homeTeam.id ? 'home' : (userTeamId === awayTeam.id ? 'away' : null);

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
      kickoffPending: false,
      pendingEvent: null, // { type: 'AUDIBLE', ... }
    };

    this.playerStats = {};
    this.homeRoster = homeRoster || [];
    this.awayRoster = awayRoster || [];
    this.homeDepthChart = homeDepthChart;
    this.awayDepthChart = awayDepthChart;
    this.homeGamePlan = homeGamePlan;
    this.awayGamePlan = awayGamePlan;
    this.offensivePlayHistory = {
      home: [],
      away: [],
    };

    // Pre-group players by position role once, instead of filtering on every getPlayer() call.
    // This turns ~2,500 filter operations per game into ~12 upfront filters + O(1) lookups.
    this._positionCache = {
      home: this._buildPositionCache(this.homeRoster, homeTeam.id),
      away: this._buildPositionCache(this.awayRoster, awayTeam.id),
    };

    this.performCoinToss();
    
  }

  _random() {
      return this.random();
  }

  isInjured(pid) {
      return this.injuries[pid] && this.injuries[pid].weeksOut > 0;
  }

  checkForInjury(player, side) {
      if (!player) return;
      if (this._random() < 0.015) { // 1.5% Chance
          const weeks = Math.floor(this._random() * 5) + 1;
          this.injuries[player.id] = { weeksOut: weeks };
          this.newInjuries[player.id] = weeks;
          this.addToLog(`INJURY ALERT: ${player.name} is hurt on the play!`);

          // Show substitution modal for user's team
          if (side && side === this._userSide && !this.state.pendingEvent) {
            const cache = this._positionCache[side];
            if (cache) {
              const posGroup = this._getPositionGroup(player.position);
              const candidates = (cache[posGroup] || [])
                .filter(p => p.id !== player.id && !this.isInjured(p.id));

              if (candidates.length > 0) {
                this.state.pendingEvent = {
                  type: 'INJURY_SUB',
                  title: 'Player Injured',
                  message: `${player.name} (${player.position}, OVR ${player.overall}) is out ${weeks} week${weeks > 1 ? 's' : ''}. Choose a replacement.`,
                  injuredPlayer: player,
                  candidates: candidates.map(c => ({
                    id: c.id,
                    name: c.name,
                    position: c.position,
                    overall: c.overall,
                  })),
                  options: candidates.map(c => ({
                    label: `${c.name} (${c.position}, ${c.overall} OVR)`,
                    action: c.id,
                  })),
                };
              }
            }
          }
      }
  }

  _getPositionGroup(position) {
    if (['WR', 'TE'].includes(position)) return 'WR';
    if (['DL', 'LB'].includes(position)) return 'DL';
    if (['DB', 'CB', 'S'].includes(position)) return 'DB';
    return position;
  }

  // Returns TRUE if an event interrupted the play
  checkRandomEvents(offChoice) {
      this.state.pendingEvent = null;
      
      // 1. AUDIBLE (User Offense Only for now)
      // 5% chance if it's a normal play
      const userIsOnOffense = this._userSide && this.state.possession === this._userSide;
      if (userIsOnOffense && this._random() < 0.05 && offChoice) {
          this.state.pendingEvent = {
              type: 'AUDIBLE',
              title: 'Quarterback Audible',
              message: 'Your QB sees a weakness! He wants to change the play.',
              options: [
                  { label: 'Allow Audible', action: 'ALLOW' },
                  { label: 'Stick to Plan', action: 'DENY' }
              ],
              originalPlay: offChoice
          };
          return true;
      }

      // 2. FALSE START (Offense Penalty)
      // 3% chance
      if (this._random() < 0.03) {
          this.state.ballOn = Math.max(1, this.state.ballOn - 5);
          this.state.distance += 5;
          this.addToLog("FALSE START! Offense pushed back 5 yards.");
          // No choice, just a notification interruption? 
          // Or just happen instantly. Let's make it an interruption so user sees it.
          this.state.pendingEvent = {
              type: 'PENALTY',
              title: 'False Start',
              message: 'Lineman jumped early! 5 yard penalty.',
              options: [{ label: 'OK', action: 'OK' }]
          };
          return true;
      }

       // 3. ENCROACHMENT (Defense Penalty)
      // 3% chance
      if (this._random() < 0.03) {
          this.addToLog("ENCROACHMENT! Defense jumps offside. 5 yards.");
          this.state.ballOn = Math.min(99, this.state.ballOn + 5);
          this.state.distance -= 5;
          
          if (this.state.distance <= 0) {
              this.state.down = 1;
              this.state.distance = 10;
              this.addToLog("FIRST DOWN by Penalty!");
          }

          this.state.pendingEvent = {
              type: 'PENALTY',
              title: 'Encroachment',
              message: 'Defense jumped! Free 5 yards.',
              options: [{ label: 'OK', action: 'OK' }]
          };
          return true;
      }

      return false;
  }

  resolveEvent(action) {
      const evt = this.state.pendingEvent;
      if (!evt) return;

      if (evt.type === 'AUDIBLE') {
          if (action === 'ALLOW') {
              // Pick a "better" play? Or just random different one?
              // Let's say he switches to a PASS if it was RUN, or vice versa
              let newPlay = this.getAudiblePlay(evt.originalPlay);
              this.addToLog(`Audible called! Switched to ${newPlay}.`);
              // We need to resolve the play now, but we don't have defense choice easily here 
              // unless we passed it or stored it.
              // For simplicity, let's just return the NEW PLAY and let the UI/Controller re-submit?
              // Or better: store "pendingPlayContext" in state?
              // Let's rely on the UI to re-call resolvePlay with the new play.
              this.state.pendingEvent = null;
              return { newPlay: newPlay };
          } else {
              this.addToLog("Audible overruled. Sticking to original play.");
              this.state.pendingEvent = null;
              return { newPlay: evt.originalPlay };
          }
      } else if (evt.type === 'INJURY_SUB') {
          // action = playerId of the chosen replacement
          const chosen = evt.candidates?.find(c => c.id === action);
          if (chosen) {
            this.addToLog(`${chosen.name} enters the game replacing ${evt.injuredPlayer.name}.`);
          }
          this.state.pendingEvent = null;
          return { newPlay: null };
      } else {
          // Just clearing the modal for penalties
          this.state.pendingEvent = null;
          return { newPlay: null }; // No play to run immediately, it was a dead ball foul
      }
  }

  getAudiblePlay(original) {
      // Simple switch logic
      if (original.includes('RUN')) return 'PASS_SHORT'; 
      return 'RUN_INSIDE'; 
  }

  resolveKickoff(type) {
      this.state.kickoffPending = false;

      const kickingSide   = this.state.possession;
      const receivingSide = kickingSide === 'home' ? 'away' : 'home';
      const returner = this.getPlayerFromSide(receivingSide, 'KR');

      const kickingTeam = this.getOffenseTeam();

      if (type === 'ONSIDE') {
          // 15% chance of recovery
          const success = this._random() < 0.15;
          if (success) {
              this.addToLog(`ONSIDE KICK RECOVERED by ${kickingTeam.name}!`);
              this.state.ballOn = 45; // Recovered at own 45
              this.state.down = 1; this.state.distance = 10;
          } else {
              this.addToLog(`Onside kick failed. Recovered by receiving team.`);
              this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
              this.state.ballOn = 55; // Opponent 45
              this.state.down = 1; this.state.distance = 10;
          }
      } else {
          // NORMAL KICKOFF
          this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
          
          const rand = this._random();
          if (rand < 0.60) {
              // Touchback
              this.addToLog(`Kickoff! Touchback.`);
              this.state.ballOn = 25;
          } else if (rand < 0.98) {
              // Return
              let returnYds = 15 + Math.floor(this._random() * 20); // 15-35 yds return
              
              // Big Return Chance
              if (this._random() < 0.05) returnYds += 30; // Breakaway
              
              // TD Chance
              if (this._random() < 0.01) {
                  this.state.ballOn = 100;
                  this.score(7);
                  this.addToLog(`KICKOFF RETURN TOUCHDOWN by ${returner.name}! INCREDIBLE!`);
                  this.changePossession('score');
                  return;
              }

              // Muff Chance
              if (this._random() < 0.02) {
                  if (this._random() < 0.5) {
                      this.addToLog(`MUFFED KICKOFF by ${returner.name}! Recovered by Kicking Team!`);
                      this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
                      this.state.ballOn = 20;
                      this.state.down = 1; this.state.distance = 10;
                  } else {
                      this.addToLog(`MUFFED KICKOFF by ${returner.name}! Recovered at the 10.`);
                      this.state.ballOn = 10;
                      this.state.down = 1; this.state.distance = 10;
                  }
                  return;
              }

              let startYard = 20 + Math.floor(this._random() * 15); // Own 20-35
              if (returnYds > 40) startYard += 20; // Big return

              this.state.ballOn = startYard;
              this.addToLog(`${returner.name} returns the kickoff to the ${this.getYardLineText(startYard)}.`);
          } else {
              // Kick out of bounds
              this.addToLog("Kickoff out of bounds. Penalty.");
              this.state.ballOn = 40;
          }
          
          this.state.down = 1; this.state.distance = 10;
      }
  }

  performCoinToss() {
      // 50/50 Coin Toss
      const homeWon = this._random() > 0.5;
      // Winner elects to receive in Q1 (Simplicity)
      this.state.possession = homeWon ? 'home' : 'away';
      this.receivedFirstHalf = homeWon ? 'home' : 'away'; // Track for Q3 flip
      
      this.state.ballOn = 25; // Touchback start
      // Note: We can't log here easily because logs show Q1 15:00.
      // We'll trust the UI can show who has ball.
  }

  startOvertimeCoinToss() {
      const homeWon = this._random() > 0.5;
      this.state.possession = homeWon ? 'home' : 'away';
      this.state.ballOn = 25;
      this.addToLog(`Overtime Coin Toss: ${homeWon ? this.homeTeam.name : this.awayTeam.name} wins and receives!`);
  }

  getYardLineText(yard) {
     const y = Math.round(yard);
     if (y === 50) return "the 50";
     if (y > 50) return `Opp ${100 - y}`;
     return `Own ${y}`;
  }

  // Helper to flip field
  changePossession(type = 'punt') {
    // types: 'kickoff', 'punt', 'downs', 'turnover', 'score', 'safety_kick'

    // Capture sides before any possession flip (needed for named special teams players)
    const puntingSide   = this.state.possession;
    const receivingSide = puntingSide === 'home' ? 'away' : 'home';

    // Safety Kick
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
      const punter   = this.getPlayerFromSide(puntingSide, 'P');
      const returner = this.getPlayerFromSide(receivingSide, 'KR');
      const puntDist = 35 + Math.floor(this._random() * 25); // 35-60 yds
      const landingSpot = this.state.ballOn + puntDist;

      if (landingSpot >= 100) {
          newLoc = 20;
          this.addToLog(`${punter.name} punts into the endzone. Touchback.`);
      } else {
          const pinned = landingSpot >= 95;

          // Muffed Catch Chance (3%)
          if (this._random() < 0.03) {
               if (this._random() < 0.5) {
                   this.addToLog(`MUFFED PUNT by ${returner.name}! Recovered by Kicking Team!`);
                   this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
                   this.state.ballOn = landingSpot;
                   this.state.down = 1; this.state.distance = 10;
                   return;
               } else {
                   newLoc = 100 - landingSpot;
                   this.addToLog(`MUFFED PUNT by ${returner.name}! Recovered at the ${this.getYardLineText(newLoc)}.`);
               }
          } else if (pinned) {
              const spot = 100 - landingSpot;
              newLoc = spot;
              this.addToLog(`${punter.name} pins ${this.getOffenseTeam().abbreviation} at the ${this.getYardLineText(spot)}!`);
          } else {
              const rand = this._random();

              if (rand < 0.25) {
                  newLoc = 100 - landingSpot;
                  this.addToLog(`Fair catch by ${returner.name}.`);
              } else {
                   let returnYards = -2 + Math.floor(this._random() * 12);
                   if (this._random() < 0.08) returnYards += 15;

                   if (this._random() < 0.01) {
                        this.state.ballOn = 100;
                        this.score(7);
                        this.addToLog(`PUNT RETURN TOUCHDOWN by ${returner.name}!!!`);
                        this.changePossession('score');
                        return;
                   }

                   const finalSpot = landingSpot - returnYards;
                   newLoc = 100 - finalSpot;
                   if (newLoc <= 0) newLoc = 1;

                   this.addToLog(`${returner.name} returns ${returnYards} yds to ${this.getYardLineText(newLoc)}.`);
              }
          }
      }
    } 
    else if (type === 'downs' || type === 'turnover') {
         this.addToLog(`${this.getOffenseTeam().abbreviation} takes over at ${this.getYardLineText(newLoc)}.`);
    }
    
    this.state.ballOn = newLoc;
  }

  getOffenseTeam() { return this.state.possession === 'home' ? this.homeTeam : this.awayTeam; }
  getDefenseTeam() { return this.state.possession === 'home' ? this.awayTeam : this.homeTeam; }

  // Fetch a player from a specific side regardless of current possession (for special teams)
  getPlayerFromSide(side, positionGroup) {
    const cache = this._positionCache[side];
    if (!cache) return { name: 'Player' };
    const candidates = cache[positionGroup] || cache.all;
    const healthy = candidates.filter(p => !this.isInjured(p.id));
    const pool = healthy.length > 0 ? healthy : candidates;
    if (pool.length === 0) return { name: 'Player' };
    return pool[0];
  }

  _buildPositionCache(roster, teamId) {
    if (!roster || roster.length === 0) return null;
    const prefix = teamId.toLowerCase() + '_';
    const clean = roster.filter(p => p.id && (p.id.startsWith(prefix) || p.id.startsWith('rookie_') || p.id.startsWith('fa_')));
    const base = clean.length > 0 ? clean : roster;
    return {
      all: base,
      QB: base.filter(p => p.position === 'QB'),
      RB: base.filter(p => p.position === 'RB'),
      WR: base.filter(p => p.position === 'WR' || p.position === 'TE'),
      DL: base.filter(p => p.position === 'DL'),
      LB: base.filter(p => p.position === 'LB'),
      FRONT: base.filter(p => p.position === 'DL' || p.position === 'LB'),
      DB: base.filter(p => p.position === 'DB' || p.position === 'CB' || p.position === 'S'),
      K:  base.filter(p => p.position === 'K'),
      P:  base.filter(p => p.position === 'P'),
      KR: base.filter(p => p.position === 'RB' || p.position === 'DB'),
    };
  }

  chooseAIOffensePlay(side) {
    const plan = side === 'home' ? this.homeGamePlan : this.awayGamePlan;
    const w = plan?.offense || null;
    const weights = OFFENSIVE_SCHEME_WEIGHTS[w] || OFFENSIVE_SCHEME_WEIGHTS.balanced;

    const roll = this._random();
    let cumulative = 0;
    cumulative += weights.insideRun;
    if (roll < cumulative) return PLAY_TYPES.RUN_INSIDE;
    cumulative += weights.outsideRun;
    if (roll < cumulative) return PLAY_TYPES.RUN_OUTSIDE;
    cumulative += weights.shortPass;
    if (roll < cumulative) return PLAY_TYPES.PASS_SHORT;
    cumulative += weights.deepPass;
    if (roll < cumulative) return PLAY_TYPES.PASS_DEEP;
    cumulative += weights.screen;
    if (roll < cumulative) return PLAY_TYPES.PASS_SCREEN;
    cumulative += weights.playAction;
    if (roll < cumulative) return PLAY_TYPES.PASS_PLAY_ACTION;
    return PLAY_TYPES.RUN_DRAW;
  }

  chooseAIDefensePlay(side) {
    const plan = side === 'home' ? this.homeGamePlan : this.awayGamePlan;
    const w = plan?.defense || null;
    let weights = DEFENSIVE_SCHEME_WEIGHTS[w] || DEFENSIVE_SCHEME_WEIGHTS.balanced;
    weights = this.getAdaptiveDefenseWeights(weights);

    const roll = this._random();
    let cumulative = 0;
    cumulative += weights.runDef;
    if (roll < cumulative) return DEFENSE_TYPES.RUN_DEFENSE;
    cumulative += weights.coverage;
    if (roll < cumulative) return DEFENSE_TYPES.PASS_COVERAGE;
    return DEFENSE_TYPES.BLITZ;
  }

  getAdaptiveDefenseWeights(baseWeights) {
    const offenseSide = this.state.possession;
    const recent = this.offensivePlayHistory[offenseSide] || [];
    const lastSix = recent.slice(-6);
    if (lastSix.length < 3) return baseWeights;

    const runCount = lastSix.filter(p => p.includes('RUN')).length;
    const drawCount = lastSix.filter(p => p === PLAY_TYPES.RUN_DRAW).length;
    const passCount = lastSix.filter(p => p.includes('PASS')).length;

    let weights = { ...baseWeights };
    if (drawCount >= 2) {
      weights.runDef += 0.22;
      weights.blitz += 0.12;
      weights.coverage = Math.max(0.10, weights.coverage - 0.34);
    } else if (runCount >= 4) {
      weights.runDef += 0.20;
      weights.blitz += 0.05;
      weights.coverage = Math.max(0.12, weights.coverage - 0.25);
    } else if (passCount >= 4) {
      weights.coverage += 0.18;
      weights.blitz += 0.08;
      weights.runDef = Math.max(0.12, weights.runDef - 0.26);
    }

    const total = weights.runDef + weights.coverage + weights.blitz;
    return {
      runDef: weights.runDef / total,
      coverage: weights.coverage / total,
      blitz: weights.blitz / total,
    };
  }

  trackOffensivePlay(offChoice) {
    if (!offChoice || offChoice === PLAY_TYPES.PUNT || offChoice === PLAY_TYPES.FG) return;
    const side = this.state.possession;
    this.offensivePlayHistory[side].push(offChoice);
    if (this.offensivePlayHistory[side].length > 12) {
      this.offensivePlayHistory[side].shift();
    }
  }

  getPlayer(teamType, positionGroup) {
      const team = teamType === 'OFF' ? this.getOffenseTeam() : this.getDefenseTeam();
      const isHome = team.id === this.homeTeam.id;
      const side = isHome ? 'home' : 'away';
      const cache = this._positionCache[side];
      const depthChart = isHome ? this.homeDepthChart : this.awayDepthChart;
      if (!cache) return { name: 'Player' };

      // Pick from pre-grouped cache, filtering out injured players
      const candidates = (cache[positionGroup] && cache[positionGroup].length > 0)
        ? cache[positionGroup]
        : ((positionGroup === 'DL' || positionGroup === 'LB') ? cache.FRONT : cache.all);
      const healthy = candidates.filter(p => !this.isInjured(p.id));
      const pool = healthy.length > 0 ? healthy : (candidates.length > 0 ? candidates : cache.all);

      if (pool.length === 0) return { name: 'Player' };

      // If we have a depth chart, build an ordered list for weighted selection
      if (depthChart) {
          const chartKeys = positionGroup === 'WR' ? ['WR', 'TE'] :
                            positionGroup === 'DL' ? ['DL', 'LB'] :
                            positionGroup === 'LB' ? ['LB', 'DL'] :
                            positionGroup === 'DB' ? ['DB', 'CB', 'S'] :
                            [positionGroup];

          const ordered = [];
          chartKeys.forEach(key => {
              (depthChart[key] || []).forEach(id => {
                  const p = pool.find(pl => pl.id === id);
                  if (p && !ordered.find(o => o.id === id)) ordered.push(p);
              });
          });
          // Append any healthy pool members not in the depth chart
          pool.forEach(p => { if (!ordered.find(o => o.id === p.id)) ordered.push(p); });

          if (ordered.length === 0) return pool[Math.floor(this._random() * pool.length)];

          // QB, K, P: always use starter
          if (positionGroup === 'QB' || positionGroup === 'K' || positionGroup === 'P') return ordered[0];

          // RB: starter ~70%, backup ~25%, third ~5%
          if (positionGroup === 'RB') {
              const r = this._random();
              if (ordered.length === 1 || r < 0.70) return ordered[0];
              if (ordered.length === 2 || r < 0.95) return ordered[1];
              return ordered[2] || ordered[1];
          }

          // WR / DL / DB: weighted 50/30/15/5 across top 4
          const weights = [0.50, 0.30, 0.15, 0.05];
          const top = ordered.slice(0, 4);
          let rand = this._random() * weights.slice(0, top.length).reduce((a, b) => a + b, 0);
          for (let i = 0; i < top.length; i++) {
              rand -= weights[i];
              if (rand <= 0) return top[i];
          }
          return top[top.length - 1];
      }

      // No depth chart — pure random from healthy pool
      return pool[Math.floor(this._random() * pool.length)];
  }

  recordStat(player, statType, value = 1) {
      if (!player || !player.id) return;
      if (!this.playerStats[player.id]) {
          this.playerStats[player.id] = { 
              name: player.name, 
              position: player.position,
              passingYards: 0, passingTDs: 0, passingAtt: 0, passingComp: 0,
              rushingYards: 0, rushingTDs: 0, rushingAtt: 0,
              receivingYards: 0, receivingTDs: 0, receptions: 0,
              tackles: 0, sacks: 0, interceptions: 0, defTDs: 0, fumblesRecovered: 0
          };
      }
      const s = this.playerStats[player.id];
      if (typeof s[statType] !== 'undefined') s[statType] += value;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  getMatchupModifier(offenseTeam, defenseTeam) {
    const offRating = offenseTeam?.ratings?.offense || 80;
    const defRating = defenseTeam?.ratings?.defense || 80;
    return this.clamp((offRating - defRating) / 40, -0.30, 0.30);
  }

  ratedChance(base, matchup, impact = 0.35) {
    return this.clamp(base + (matchup * impact), 0.02, 0.98);
  }

  ratedYards(min, max, matchup, impact = 4) {
    const roll = min + Math.floor(this._random() * (max - min + 1));
    return roll + Math.round(matchup * impact);
  }

  resolvePlay(offChoice, defChoice) {
    if (this.state.gameOver) return;
    this.trackOffensivePlay(offChoice);

    const off = this.getOffenseTeam();
    const def = this.getDefenseTeam();
    
    // PLAYERS
    const qb = this.getPlayer('OFF', 'QB');
    const rb = this.getPlayer('OFF', 'RB');
    const wr = this.getPlayer('OFF', 'WR'); // Target
    const dl = this.getPlayer('DEF', 'DL'); // Tackler/Sacker
    const lb = this.getPlayer('DEF', 'LB');
    const db = this.getPlayer('DEF', 'DB'); // Secondary
    const k  = this.getPlayer('OFF', 'K');
    
    // Generic tackler
    const tackler = this._random() < 0.5 ? dl : (this._random() < 0.5 ? lb : db);

    let yardsGained = 0;
    let description = "";
    let turnover = false;
    let turnoverPlayer = null; // Track who got the ball
    let touchdown = false;

    const matchup = this.getMatchupModifier(off, def);

    switch (offChoice) {
      // RUNS
      case PLAY_TYPES.RUN_INSIDE:
        this.recordStat(rb, 'rushingAtt', 1);
        if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
          yardsGained = this.ratedYards(-2, 3, matchup, 4);
          description = `${rb.name} stuffed at the line by ${dl.name}!`;
          this.recordStat(dl, 'tackles', 1);
          if (this._random() < this.ratedChance(0.04, -matchup, 0.05)) { 
              if (this._random() < 0.5) {
                  turnover = true; 
                  turnoverPlayer = dl;
                  description = `FUMBLE! ${rb.name} loses the ball! Recovered by ${dl.name}!`; 
              } else {
                  description = `FUMBLE! ${rb.name} bobbles it but recovers!`;
                  yardsGained = 0;
              }
          }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
           yardsGained = this.ratedYards(3, 13, matchup, 4);
           description = `${rb.name} breaks through the blitz!`;
        } else { 
           yardsGained = this.ratedYards(2, 7, matchup, 4);
           description = `${rb.name} pushes strong up the middle.`;
           this.recordStat(tackler, 'tackles', 1);
        }
        break;

      case PLAY_TYPES.RUN_OUTSIDE:
        this.recordStat(rb, 'rushingAtt', 1);
        if (defChoice === DEFENSE_TYPES.BLITZ) {
           if (this._random() < this.ratedChance(0.30, -matchup, 0.28)) {
              yardsGained = this.ratedYards(-5, -2, matchup, 2); description = `${lb.name} tackles ${rb.name} for a loss!`;
              this.recordStat(lb, 'tackles', 1);
           } else {
              yardsGained = this.ratedYards(4, 13, matchup, 4); description = `${rb.name} beats the blitz to the edge!`;
           }
        } else if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
          yardsGained = this.ratedYards(-2, 3, matchup, 4); description = `${rb.name} contained by ${dl.name}.`;
          this.recordStat(dl, 'tackles', 1);
        } else {
          yardsGained = this.ratedYards(3, 13, matchup, 4); description = `${rb.name} turns the corner!`;
        }
        break;

      case PLAY_TYPES.RUN_DRAW:
        this.recordStat(rb, 'rushingAtt', 1);
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
           if (this._random() < this.ratedChance(0.12, -matchup, 0.20)) {
             yardsGained = this.ratedYards(-3, 2, matchup, 3);
             description = `${lb.name} diagnoses the draw late and drags down ${rb.name}.`;
             this.recordStat(lb, 'tackles', 1);
           } else {
             yardsGained = this.ratedYards(3, 10, matchup, 4);
             description = `Draw play opens up for ${rb.name}.`;
           }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
           yardsGained = this.ratedYards(-6, -2, matchup, 2);
           description = `${dl.name} crashes down and blows up the draw play.`;
           this.recordStat(dl, 'tackles', 1);
           if (this._random() < this.ratedChance(0.08, -matchup, 0.06)) {
              if (this._random() < 0.45) {
                  turnover = true;
                  turnoverPlayer = dl;
                  description = `FUMBLE! ${dl.name} punches it loose on the draw and recovers!`;
                  this.recordStat(dl, 'fumblesRecovered', 1);
              } else {
                  description = `FUMBLE! ${rb.name} loses it on the draw but falls back on the ball.`;
                  yardsGained = Math.min(yardsGained, -2);
              }
           }
        } else {
           yardsGained = this.ratedYards(-3, 2, matchup, 3);
           description = `${rb.name} swallowed up by ${tackler.name} on the draw.`;
           this.recordStat(tackler, 'tackles', 1);
           if (this._random() < this.ratedChance(0.05, -matchup, 0.05)) {
              if (this._random() < 0.35) {
                  turnover = true;
                  turnoverPlayer = tackler;
                  description = `FUMBLE! ${tackler.name} rips it out from ${rb.name} and recovers!`;
                  this.recordStat(tackler, 'fumblesRecovered', 1);
              } else {
                  description = `FUMBLE! ${rb.name} briefly loses the draw handoff but recovers.`;
                  yardsGained = 0;
              }
           }
        }
        break;

      // PASSES
      case PLAY_TYPES.PASS_SHORT:
        this.recordStat(qb, 'passingAtt', 1);
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
          if (this._random() < this.ratedChance(0.58, matchup, 0.38)) { 
              yardsGained = this.ratedYards(2, 8, matchup, 3); 
              description = `${qb.name} connects with ${wr.name}.`; 
              this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
          }
          else { 
             yardsGained = 0; description = `${qb.name}'s pass incomplete.`; 
             if (this._random() < this.ratedChance(0.05, -matchup, 0.08)) { 
                 turnover = true; 
                 turnoverPlayer = lb;
                 description = `INTERCEPTED by ${lb.name}!`; 
                 this.recordStat(qb, 'interceptions', 1); this.recordStat(lb, 'interceptions', 1);
                 yardsGained = 0; 
             }
          }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
          if (this._random() < this.ratedChance(0.20, -matchup, 0.22)) {
             yardsGained = this.ratedYards(-7, -4, matchup, 2); description = `SACK! ${dl.name} gets home before the short route develops.`;
             this.recordStat(dl, 'sacks', 1);
             if (this._random() < this.ratedChance(0.10, -matchup, 0.08)) {
                turnover = true;
                turnoverPlayer = dl;
                description = `STRIP SACK! ${dl.name} knocks it loose and recovers!`;
                this.recordStat(dl, 'fumblesRecovered', 1);
             }
          } else {
            yardsGained = this.ratedYards(4, 12, matchup, 3); description = `${qb.name} hits ${wr.name} on the slant vs Blitz.`;
            this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
          }
        } else { 
          yardsGained = this.ratedYards(5, 13, matchup, 3); description = `Easy completion to ${wr.name}.`;
          this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
        }
        break;

      case PLAY_TYPES.PASS_SCREEN:
         this.recordStat(qb, 'passingAtt', 1);
         if (defChoice === DEFENSE_TYPES.BLITZ) {
            if (this._random() < this.ratedChance(0.13, -matchup, 0.15)) {
              yardsGained = this.ratedYards(-7, -4, matchup, 2);
              description = `SACK! ${dl.name} gets to ${qb.name} before the screen can set up.`;
              this.recordStat(dl, 'sacks', 1);
            } else {
              yardsGained = this.ratedYards(5, 17, matchup, 4);
              description = `Perfect screen to ${rb.name} against the blitz!`;
              this.recordStat(qb, 'passingComp', 1); this.recordStat(rb, 'receptions', 1); // Screen often to RB
            }
         } else if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
            yardsGained = this.ratedYards(-3, 1, matchup, 3);
            description = `Screen sniffed out by ${tackler.name}.`;
            this.recordStat(qb, 'passingComp', 1); this.recordStat(rb, 'receptions', 1); // Completed for loss
            this.recordStat(tackler, 'tackles', 1);
            if (this._random() < this.ratedChance(0.05, -matchup, 0.07)) { 
                turnover = true; 
                turnoverPlayer = dl;
                description = `Screen pass JUMPED by ${dl.name}! INTERCEPTION!`; 
                this.recordStat(qb, 'interceptions', 1); this.recordStat(dl, 'interceptions', 1);
            }
         } else {
            yardsGained = this.ratedYards(0, 5, matchup, 3);
            description = `Screen to ${rb.name} gets a few.`;
            this.recordStat(qb, 'passingComp', 1); this.recordStat(rb, 'receptions', 1);
         }
         break;

      case PLAY_TYPES.PASS_PLAY_ACTION:
         this.recordStat(qb, 'passingAtt', 1);
         if (defChoice === DEFENSE_TYPES.RUN_DEFENSE) {
             if (this._random() < this.ratedChance(0.82, matchup, 0.25)) {
               yardsGained = this.ratedYards(9, 24, matchup, 5);
               description = `${qb.name} fakes, throws deep to ${wr.name}! Wide open!`;
               this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
             } else {
               yardsGained = 0;
               description = `${db.name} recovers after the fake and breaks up the play-action shot.`;
             }
         } else if (defChoice === DEFENSE_TYPES.BLITZ) {
             if (this._random() < this.ratedChance(0.74, -matchup, 0.20)) {
               yardsGained = this.ratedYards(-8, -5, matchup, 2); description = `SACK! ${dl.name} gets to ${qb.name}!`;
               this.recordStat(dl, 'sacks', 1);
             } else {
               yardsGained = this.ratedYards(8, 18, matchup, 4);
               description = `${qb.name} barely gets it out to ${wr.name} behind the blitz.`;
               this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
             }
             if (yardsGained < 0 && this._random() < this.ratedChance(0.15, -matchup, 0.08)) { 
                 if (this._random() < 0.5) {
                     turnover = true; 
                     turnoverPlayer = dl;
                     description = `STRIP SACK! ${qb.name} loses it! Recovered by ${dl.name}!`; 
                 } else {
                     description = `STRIP SACK! ${qb.name} fumbles but recovers!`;
                 }
             }
         } else {
             yardsGained = this.ratedYards(0, 8, matchup, 3);
             description = `Coverage holds up.`; // Incomplete? Or checkdown? Let's say checkdown
             if (yardsGained > 0) { 
                 description = `Checkdown to ${rb.name}.`;
                 this.recordStat(qb, 'passingComp', 1); this.recordStat(rb, 'receptions', 1);
             } else {
                 description = `${qb.name} throws it away.`;
             }
         }
         break;

      case PLAY_TYPES.PASS_DEEP:
        this.recordStat(qb, 'passingAtt', 1);
        if (defChoice === DEFENSE_TYPES.PASS_COVERAGE) {
          if (this._random() < this.ratedChance(0.25, matchup, 0.35)) { 
              yardsGained = this.ratedYards(28, 42, matchup, 6); 
              description = `Incredible catch deep by ${wr.name}!`; 
              this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
          }
          else { 
             yardsGained = 0; description = `Deep pass to ${wr.name} incomplete.`;
             if (this._random() < this.ratedChance(0.11, -matchup, 0.12)) { 
                 turnover = true; 
                 turnoverPlayer = db;
                 description = `INTERCEPTED deep by ${db.name}!`; 
                 this.recordStat(qb, 'interceptions', 1); this.recordStat(db, 'interceptions', 1);
                 yardsGained = -10; 
             }
          }
        } else if (defChoice === DEFENSE_TYPES.BLITZ) {
          if (this._random() < this.ratedChance(0.38, -matchup, 0.22)) { 
             yardsGained = this.ratedYards(-9, -6, matchup, 2); description = `SACKED! ${dl.name} buries ${qb.name}!`; 
             this.recordStat(dl, 'sacks', 1);
             if (this._random() < this.ratedChance(0.18, -matchup, 0.10)) { 
                 if (this._random() < 0.5) {
                     turnover = true; 
                     turnoverPlayer = dl;
                     description = `STRIP SACK! ${dl.name} forces the fumble! Recovered by Defense!`; 
                 } else {
                     description = `STRIP SACK! ${dl.name} forces the fumble but ${qb.name} recovers!`;
                 }
             }
          } else if (this._random() < this.ratedChance(0.18, matchup, 0.20)) { 
             yardsGained = this.ratedYards(42, 60, matchup, 6); touchdown = this.state.ballOn + yardsGained >= 100; description = `BOMB! ${qb.name} hits ${wr.name} over the blitz!`; 
             this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
          } else if (this._random() < this.ratedChance(0.48, matchup, 0.18)) {
             yardsGained = this.ratedYards(18, 30, matchup, 5); description = `${wr.name} finds space behind the pressure.`;
             this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
          } else {
             yardsGained = 0; description = `${qb.name} throws deep under pressure but misses ${wr.name}.`;
          }
        } else {
           if (this._random() < this.ratedChance(0.58, matchup, 0.32)) { 
               yardsGained = this.ratedYards(18, 30, matchup, 5); description = `${wr.name} beats the coverage deep.`; 
               this.recordStat(qb, 'passingComp', 1); this.recordStat(wr, 'receptions', 1);
           }
           else { yardsGained = 0; description = `${qb.name} overthrows ${wr.name}.`; }
        }
        break;

      case PLAY_TYPES.PUNT:
         this.changePossession('punt');
         return;

      case PLAY_TYPES.FG: {
         const dist = 100 - this.state.ballOn + 17;
         if (dist < 45 || (dist < 55 && this._random() > 0.3)) {
            this.addToLog(`Field Goal from ${dist} yds by ${k.name} is GOOD!`);
            this.score(3);
            this.changePossession('score');
         } else {
            this.addToLog(`Field Goal from ${dist} yds by ${k.name} is NO GOOD.`);
            this.changePossession('turnover');
         }
         return;
      }
    }

    // Process Result
    if (turnover) {
      if (this._random() < 0.08) { // 8% chance on a turnover
         this.scoreDefense(7);
         const returnerName = turnoverPlayer ? turnoverPlayer.name : "DEFENSE";
         this.addToLog(description + ` ${returnerName} RETURNS IT FOR A TOUCHDOWN!!!`);
         if (turnoverPlayer) this.recordStat(turnoverPlayer, 'defTDs', 1);
         this.changePossession('score');
      } else {
         this.addToLog(description);
         this.changePossession('turnover');
      }
    } else {
      if (yardsGained === 0 && !description.includes("Incomplete") && !description.includes("throw")) description = "No Gain.";
      
      // Update YARDS stats
      if (offChoice.includes("RUN")) this.recordStat(rb, 'rushingYards', yardsGained);
      if (offChoice.includes("PASS")) this.recordStat(qb, 'passingYards', yardsGained);
      if (offChoice.includes("PASS") && yardsGained > 0) {
          // If screen -> RB, else WR. Simplified check
          if (offChoice === PLAY_TYPES.PASS_SCREEN || (description.includes("Checkdown"))) this.recordStat(rb, 'receivingYards', yardsGained);
          else this.recordStat(wr, 'receivingYards', yardsGained);
      }

      this.state.ballOn += yardsGained;
      this.state.distance -= yardsGained;
      
      this.addToLog(description + ` (${yardsGained} yds)`);

      // SAFETY CHECK
      if (this.state.ballOn <= 0) {
          this.scoreDefense(2);
          this.addToLog(`SAFETY! ${qb.name} tackled in the endzone by ${dl.name}!`);
          this.recordStat(dl, 'sacks', 1); // Safety is usually a sack
          this.changePossession('safety_kick');
      }
      else if (this.state.ballOn >= 100 || touchdown) {
        this.score(7);
        // TD Stats
        if (offChoice.includes("RUN")) this.recordStat(rb, 'rushingTDs', 1);
        if (offChoice.includes("PASS")) {
             this.recordStat(qb, 'passingTDs', 1); 
             if (offChoice === PLAY_TYPES.PASS_SCREEN || (description.includes("Checkdown"))) this.recordStat(rb, 'receivingTDs', 1);
             else this.recordStat(wr, 'receivingTDs', 1);
        }
        
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
    
    // Check for injuries — pass side so we can show substitution modals for user's team
    const offSide = this.state.possession;
    const defSide = offSide === 'home' ? 'away' : 'home';
    const offParticipants = [qb];
    if (offChoice.includes("RUN")) offParticipants.push(rb);
    if (offChoice.includes("PASS")) offParticipants.push(wr);
    const defParticipants = [dl, lb, db];

    for (const p of [...new Set(offParticipants)]) {
      this.checkForInjury(p, offSide);
      if (this.state.pendingEvent) break;
    }
    if (!this.state.pendingEvent) {
      for (const p of [...new Set(defParticipants)]) {
        this.checkForInjury(p, defSide);
        if (this.state.pendingEvent) break;
      }
    }

    this.tickClock();
  }

  score(points) {
    if (this.state.possession === 'home') this.state.homeScore += points;
    else this.state.awayScore += points;
    
    // In OT, if a team scores, game might be over depending on rules (simplification: any score wins for now. Wait, FG on first poss is not win)
    // Simplify for now: Playoff OT -> sudden death? Or new rules?
    // Let's do Sudden Death for sim plicity in MVP.
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

    const timeBurn = 30 + Math.floor(this._random() * 15);
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
             this.state.timeRemaining = 600; // 10 mins for OT
             this.addToLog("End of Regulation. TIED GAME! Going to Overtime!");
             this.startOvertimeCoinToss();
         } else {
             this.state.timeRemaining = 0;
             this.state.gameOver = true;
             this.addToLog("GAME OVER");
         }
      } else {
          // OT Time Expired (Still Tied)
          if (this.isPlayoff) {
               // Double OT in Playoffs until winner
               const currentOT = this.state.quarter - 4; // 1, 2, ...
               this.state.quarter++;
               this.state.timeRemaining = 900; // 15 min quarters in Playoff OT ? or just continuous. Let's do 15.
               this.addToLog(`End of OT${currentOT}. Still Tied! Starting OT${currentOT+1}`);
               // Possession continues where it left off, usually.
          } else {
              // Regular Season: Tie Game
              this.state.timeRemaining = 0;
              this.state.gameOver = true;
              this.addToLog("OT Ended. TIE GAME.");
          }
      }
    }
  }

  addToLog(msg) {
    if (this.state.log.length > 50) this.state.log.pop();
    let qLabel = `Q${this.state.quarter}`;
    if (this.state.quarter > 4) {
        const otNum = this.state.quarter - 4;
        qLabel = otNum === 1 ? 'OT' : `OT${otNum}`;
    }
    
    this.state.log.unshift(`${qLabel} ${Math.floor(this.state.timeRemaining/60)}:${(this.state.timeRemaining%60).toString().padStart(2,'0')} - ${msg}`);
  }

  getMatchStats() {
      return {
          stats: this.playerStats,
          injuries: this.newInjuries
      };
  }
}
