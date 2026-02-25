import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Animated, Modal } from 'react-native';
import { MatchEngine, PLAY_TYPES, DEFENSE_TYPES } from '../engine/MatchEngine';
import { TEAMS } from '../data/teams';
import { league } from '../engine/LeagueEngine';

export default function MatchScreen({ route, navigation }) {
  const { homeId, awayId, isPlayoff, userTeamId, injuries } = route.params;
  const homeTeam = TEAMS.find(t => t.id === homeId);
  const awayTeam = TEAMS.find(t => t.id === awayId);

  // We keep the engine instance in a ref so it persists across renders without re-initializing
  const engineRef = useRef(new MatchEngine(
      homeTeam,
      awayTeam,
      league.rosters[homeId],
      league.rosters[awayId],
      isPlayoff,
      injuries,
      league.getDepthChart(homeId),
      league.getDepthChart(awayId),
      league.getGamePlan(homeId),
      league.getGamePlan(awayId)
  ));
  const engine = engineRef.current; // Shorthand

  // We need React State to force re-renders when the engine state changes
  const [gameState, setGameState] = useState({...engine.state});
  
  // Store context for resuming plays after event interruption
  const [pendingContext, setPendingContext] = useState(null); 

  const handleKickoffCall = (type) => {
      // User is kicking
      engine.resolveKickoff(type);
      setGameState({...engine.state});
  };

  const handlePlayCall = (userChoice) => {
    // Check if AI is Kickoff mode
    if (gameState.kickoffPending && !isUserOffense) {
        // AI Logic for Kickoff
        // If losing in Q4, chance of onside kick
        let kickType = 'NORMAL';
        const aiIsHome = userTeamId !== homeId;
        const aiScore = aiIsHome ? gameState.homeScore : gameState.awayScore;
        const userScore = aiIsHome ? gameState.awayScore : gameState.homeScore;
        if (gameState.quarter === 4 && aiScore < userScore) {
            if (Math.random() < 0.2) kickType = 'ONSIDE';
        }
        engine.resolveKickoff(kickType);
        setGameState({...engine.state});
        return;
    }

    // Normal Play Logic
    
    // 1. AI Choice
    let aiChoice;
    const isUserHome = userTeamId === homeId;
    const isUserOff = isUserHome ? engine.state.possession === 'home' : engine.state.possession === 'away';
    
    if (!isUserOff) {
        // AI is Offense — use game plan weights
        const aiSide = isUserHome ? 'away' : 'home';
        aiChoice = engine.chooseAIOffensePlay(aiSide);
    } else {
        // AI is Defense — use game plan weights
        const aiSide = isUserHome ? 'away' : 'home';
        aiChoice = engine.chooseAIDefensePlay(aiSide);
    }

    // 2. CHECK FOR RANDOM EVENTS INTERRUPTIONS
    const interrupted = engine.checkRandomEvents(isUserOff ? userChoice : null);
    if (interrupted) {
        // Save context so we can resume after modal
        setPendingContext({ userChoice, aiChoice, isUserOff });
        setGameState({...engine.state}); // Trigger re-render to show modal
        return;
    }

    // 3. Resolve Normally if no interrupt
    resolvePlayFinal(userChoice, aiChoice, isUserOff);
  };

  const resolvePlayFinal = (userChoice, aiChoice, isUserOff) => {
      if (!isUserOff) {
        // Resolve: AI (Off) vs User (Def)
        engine.resolvePlay(aiChoice, userChoice);
      } else {
        // Resolve: User (Off) vs AI (Def)
        engine.resolvePlay(userChoice, aiChoice);
      }
      setGameState({...engine.state});
  };

  const handleEventDecision = (action) => {
      // 1. Tell engine to resolve the event
      const result = engine.resolveEvent(action);
      
      // 2. If result has a newPlay, we resume execution with stored context
      if (result && pendingContext) {
          if (result.newPlay) {
              // It was an audible or something changing the play
              // User (Offense) changed play -> result.newPlay
              // Context has AI choice
              
              // NOTE: checkRandomEvents only triggers for User Offense Audibles currently
              resolvePlayFinal(result.newPlay, pendingContext.aiChoice, pendingContext.isUserOff);
          } else {
             // Null play (e.g. penalty just happened, dead ball).
             // Just update state
             setGameState({...engine.state});
          }
      } else {
          // Just update state (e.g. modal closed)
          setGameState({...engine.state});
      }
      
      setPendingContext(null);
  };

  const handleExitGame = () => {
    // Navigate back to Season screen with result
    const result = {
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      homeId: homeId,
      awayId: awayId
    };
    
    // Get stats from engine
    const { stats, injuries: newInjuries } = engine.getMatchStats();
    
    navigation.navigate('BoxScore', {
      userTeamId,
      result,
      playerStats: stats,
      injuries: newInjuries
    });
  };

  const getBallLocationText = () => {
    const yard = gameState.ballOn;
    if (yard <= 0) return "ENDZONE";
    if (yard >= 100) return "ENDZONE";
    
    // Logic: 0-50 is "Own", 50-100 is "Opponent"
    // BUT we need to label them by Team Name
    const isHomePoss = gameState.possession === 'home';
    const offTeam = isHomePoss ? homeTeam.abbreviation : awayTeam.abbreviation;
    const defTeam = isHomePoss ? awayTeam.abbreviation : homeTeam.abbreviation;
    
    if (yard <= 50) {
        return `${offTeam} ${yard}`;
    } else {
        return `${defTeam} ${100 - yard}`;
    }
  };

  const renderField = () => {
    // Calculate position of football and lines
    // MatchEngine 'ballOn' is always relative to Offense (0 -> 100)
    // Home drives Left -> Right (0 -> 100)
    // Away drives Right -> Left (100 -> 0)
    
    let ballX = gameState.ballOn;
    let driveDir = 1; // 1 for L->R, -1 for R->L
    
    if (gameState.possession === 'away') {
        ballX = 100 - gameState.ballOn;
        driveDir = -1;
    }
    
    return (
      <View style={styles.fieldContainer}>
        <View style={styles.endzoneLeft}>
          <Text style={styles.endzoneText}>{homeTeam.abbreviation}</Text>
        </View>
        
        <View style={styles.fieldSurface}>
          {/* Yard lines */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(yard => (
            <View
              key={yard}
              style={[styles.yardLine, { left: `${yard}%` }]}
            />
          ))}
          
          {/* Line of scrimmage */}
          <View
            style={[styles.los, { left: `${ballX}%` }]}
          />
          
          {/* First down line */}
          {gameState.distance > 0 && (
            <View
              style={[styles.firstDownLine, {
                left: `${Math.min(100, Math.max(0, ballX + (gameState.distance * driveDir)))}%` 
              }]}
            />
          )}
          
          {/* Football */}
          <View
            style={[styles.football, { left: `${ballX}%` }]}
          />
        </View>
        
        <View style={styles.endzoneRight}>
          <Text style={styles.endzoneText}>{awayTeam.abbreviation}</Text>
        </View>
      </View>
    );
  };

  const isUserHome = userTeamId === homeId;
  const isUserOffense = isUserHome ? gameState.possession === 'home' : gameState.possession === 'away';

  return (
    <SafeAreaView style={styles.container}>
      {/* ... Scoreboard ... */}
      <View style={styles.scoreboard}>
         <View style={styles.teamScore}>
            <Text style={styles.teamAbbr}>{homeTeam.abbreviation}</Text>
            <Text style={styles.score}>{gameState.homeScore}</Text>
         </View>
         <View style={styles.gameClock}>
            <Text style={styles.quarter}>{gameState.gameOver ? "FINAL" : gameState.quarter > 4 ? "OT" : `Q${gameState.quarter}`}</Text>
            <Text style={styles.time}>{Math.floor(gameState.timeRemaining / 60)}:{(gameState.timeRemaining % 60).toString().padStart(2,'0')}</Text>
         </View>
         <View style={styles.teamScore}>
            <Text style={styles.teamAbbr}>{awayTeam.abbreviation}</Text>
            <Text style={styles.score}>{gameState.awayScore}</Text>
         </View>
      </View>

      {/* ... Field ... */}
      {renderField()}

      {/* ... Situation ... */}
      <View style={styles.situation}>
         {gameState.kickoffPending ? (
             <Text style={styles.downDist}>KICKOFF</Text>
         ) : (
             <Text style={styles.downDist}>{gameState.down === 1 ? '1st' : gameState.down === 2 ? '2nd' : gameState.down === 3 ? '3rd' : '4th'} & {gameState.distance}</Text>
         )}
         <Text style={styles.ballLoc}>at {getBallLocationText()}</Text>
      </View>

      {/* ... Log ... */}
      <ScrollView style={styles.logContainer}>
         {gameState.log.map((entry, i) => (
             <Text key={i} style={[styles.logEntry, i===0 && styles.latestLog]}>{entry}</Text>
         ))}
      </ScrollView>

       {/* EVENT MODAL */}
       {gameState.pendingEvent && (
          <Modal transparent={true} animationType="fade" visible={true}>
              <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                      <Text style={styles.modalTitle}>{gameState.pendingEvent.title}</Text>
                      <Text style={styles.modalMessage}>{gameState.pendingEvent.message}</Text>
                      
                      <View style={styles.modalButtons}>
                          {gameState.pendingEvent.options.map((opt, i) => (
                              <TouchableOpacity key={i} style={styles.modalBtn} onPress={() => handleEventDecision(opt.action)}>
                                  <Text style={styles.modalBtnText}>{opt.label}</Text>
                              </TouchableOpacity>
                          ))}
                      </View>
                  </View>
              </View>
          </Modal>
       )}

      {/* CONTROLS */}
      <View style={styles.controls}>
         {!gameState.gameOver ? (
            <>
                {gameState.kickoffPending ? (
                    /* KICKOFF UI */
                    <>
                        <Text style={styles.playCallTitle}>{isUserOffense ? "KICKOFF CHOICE" : "AWAITING KICKOFF"}</Text>
                        <View style={styles.buttonGrid}>
                            {isUserOffense ? (
                                <>
                                <TouchableOpacity style={[styles.playBtn, styles.specialBtn]} onPress={() => handleKickoffCall('NORMAL')}><Text style={styles.btnText}>NORMAL KICK</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.specialBtn, {backgroundColor: '#d35400'}]} onPress={() => handleKickoffCall('ONSIDE')}><Text style={styles.btnText}>ONSIDE KICK (15%)</Text></TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity style={[styles.playBtn, {width:'100%', backgroundColor:'#555'}]} onPress={() => handlePlayCall(null)}><Text style={styles.btnText}>RECEIVE KICK</Text></TouchableOpacity>
                            )}
                        </View>
                    </>
                ) : (
                    /* NORMAL PLAY CALLING */
                    <>
                        <Text style={styles.playCallTitle}>{isUserOffense ? "CALL OFFENSE" : "CALL DEFENSE"}</Text>
                        <View style={styles.buttonGrid}>
                            {isUserOffense ? (
                                <>
                                {/* RUNS */}
                                <TouchableOpacity style={[styles.playBtn, styles.runBtn]} onPress={() => handlePlayCall(PLAY_TYPES.RUN_INSIDE)}><Text style={styles.btnText}>RUN INSIDE</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.runBtn]} onPress={() => handlePlayCall(PLAY_TYPES.RUN_OUTSIDE)}><Text style={styles.btnText}>RUN OUTSIDE</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.runBtn]} onPress={() => handlePlayCall(PLAY_TYPES.RUN_DRAW)}><Text style={styles.btnText}>DRAW</Text></TouchableOpacity>
                                
                                {/* PASSES */}
                                <TouchableOpacity style={[styles.playBtn, styles.passBtn]} onPress={() => handlePlayCall(PLAY_TYPES.PASS_SHORT)}><Text style={styles.btnText}>PASS SHORT</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.passBtn]} onPress={() => handlePlayCall(PLAY_TYPES.PASS_SCREEN)}><Text style={styles.btnText}>SCREEN</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.passBtn]} onPress={() => handlePlayCall(PLAY_TYPES.PASS_PLAY_ACTION)}><Text style={styles.btnText}>PLAY ACTION</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.passBtn]} onPress={() => handlePlayCall(PLAY_TYPES.PASS_DEEP)}><Text style={styles.btnText}>PASS DEEP</Text></TouchableOpacity>
                                
                                {/* SPECIAL */}
                                <View style={{flexDirection:'row', width:'100%', justifyContent:'space-between', marginTop:5}}>
                                    <TouchableOpacity style={[styles.playBtn, styles.specialBtn, {width:'48%'}]} onPress={() => handlePlayCall(PLAY_TYPES.PUNT)}><Text style={styles.btnText}>PUNT</Text></TouchableOpacity>
                                    <TouchableOpacity style={[styles.playBtn, styles.specialBtn, {width:'48%'}]} onPress={() => handlePlayCall(PLAY_TYPES.FG)}><Text style={styles.btnText}>FIELD GOAL</Text></TouchableOpacity>
                                </View>
                                </>
                            ) : (
                                <>
                                <TouchableOpacity style={[styles.playBtn, styles.defBtn]} onPress={() => handlePlayCall(DEFENSE_TYPES.RUN_DEFENSE)}><Text style={styles.btnText}>RUN DEFENSE</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.defBtn]} onPress={() => handlePlayCall(DEFENSE_TYPES.PASS_COVERAGE)}><Text style={styles.btnText}>COVERAGE</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, styles.defBtn]} onPress={() => handlePlayCall(DEFENSE_TYPES.BLITZ)}><Text style={styles.btnText}>BLITZ</Text></TouchableOpacity>
                                </>
                            )}
                        </View>
                    </>
                )}
            </>
         ) : (
            <TouchableOpacity style={styles.exitBtn} onPress={handleExitGame}>
                <Text style={styles.exitBtnText}>RETURN TO SEASON</Text>
            </TouchableOpacity>
         )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e', // Dark mode for stadium feel
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    borderBottomWidth:1,
    borderBottomColor:'#333'
  },
  teamScore: { alignItems: 'center' },
  teamAbbr: { color: '#888', fontWeight: '900', fontSize: 14 },
  score: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  gameClock: { alignItems: 'center' },
  quarter: { color: '#fdd835', fontWeight: 'bold' },
  time: { color: '#fff' },
  
  fieldContainer: {
    height: 100,
    flexDirection: 'row',
    marginVertical: 10,
  },
  endzoneLeft: { width: '10%', backgroundColor: '#00338D', justifyContent: 'center', alignItems: 'center' },
  endzoneRight: { width: '10%', backgroundColor: '#C60C30', justifyContent: 'center', alignItems: 'center' },
  endzoneText: { color: '#fff', fontWeight: 'bold', transform: [{rotate: '-90deg'}] },
  fieldSurface: {
    flex: 1,
    backgroundColor: '#4caf50',
    position: 'relative',
    overflow: 'hidden'
  },
  yardLine: {
    position: 'absolute',
    top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)',
  },
  football: {
    position: 'absolute',
    top: '40%',
    width: 10, height: 6,
    borderRadius: 3,
    backgroundColor: '#795548',
    marginTop: -3,
    marginLeft: -5,
    zIndex: 10,
  },
  los: {
    position: 'absolute',
    top: 0, bottom: 0, width: 2, backgroundColor: 'blue',
  },
  firstDownLine: {
    position: 'absolute',
    top: 0, bottom: 0, width: 2, backgroundColor: 'yellow',
  },

  situation: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2c2c2c',
  },
  downDist: {
    color: '#fdd835',
    fontSize: 20,
    fontWeight: 'bold',
  },
  ballLoc: {
    color: '#aaa',
    fontSize: 14,
  },

  logContainer: {
    flex: 1,
    padding: 16,
  },
  logEntry: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace', // Ticker feel
  },
  latestLog: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },

  controls: {
    backgroundColor: '#333',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  playCallTitle: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  playBtn: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 6,
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  runBtn: {
    backgroundColor: '#1565c0', // Darker Blue
  },
  passBtn: {
    backgroundColor: '#0288d1', // Lighter Blue
  },
  defBtn: {
    backgroundColor: '#d32f2f',
    width: '30%',
  },
  specialBtn: {
    backgroundColor: '#424242',
    width: '45%',
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  exitBtn: {
      backgroundColor: '#4caf50',
      padding: 20,
      borderRadius: 8,
      alignItems: 'center',
      width: '100%',
  },
  exitBtnText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 18,
      letterSpacing: 1,
  },
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  modalContent: {
      width: '80%',
      backgroundColor: '#222',
      borderRadius: 16,
      padding: 24,
      borderWidth: 2,
      borderColor: '#fdd835',
      alignItems: 'center',
  },
  modalTitle: {
      color: '#fdd835',
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 12,
      textAlign: 'center',
      textTransform: 'uppercase',
  },
  modalMessage: {
      color: '#fff',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
  },
  modalButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      width: '100%',
  },
  modalBtn: {
      backgroundColor: '#1976d2',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center',
  },
  modalBtnText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
  }
});
