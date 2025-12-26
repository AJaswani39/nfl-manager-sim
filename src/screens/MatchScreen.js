import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { MatchEngine, PLAY_TYPES, DEFENSE_TYPES } from '../engine/MatchEngine';
import { TEAMS } from '../data/teams';
import { league } from '../engine/LeagueEngine';

export default function MatchScreen({ route, navigation }) {
  const { homeId, awayId } = route.params;
  const homeTeam = TEAMS.find(t => t.id === homeId);
  const awayTeam = TEAMS.find(t => t.id === awayId);

  // We keep the engine instance in a ref so it persists across renders without re-initializing
  const engineRef = useRef(new MatchEngine(homeTeam, awayTeam));
  const engine = engineRef.current; // Shorthand

  // We need React State to force re-renders when the engine state changes
  const [gameState, setGameState] = useState({...engine.state});

  const handleKickoffCall = (type) => {
      // User is kicking
      engine.resolveKickoff(type);
      setGameState({...engine.state});
  };

  const handlePlayCall = (userChoice) => {
    // Check if AI is Kickoff mode
    if (gameState.kickoffPending && !isUserOffense) {
        // AI Logic for Kickoff
        // If losing by > 8 in Q4, try Onside?
        // Simple: 5% chance of Onside if losing in Q4
        let kickType = 'NORMAL';
        if (gameState.quarter === 4 && gameState.awayScore < gameState.homeScore) {
            if (Math.random() < 0.2) kickType = 'ONSIDE';
        }
        engine.resolveKickoff(kickType);
        setGameState({...engine.state});
        return;
    }

    // Normal Play Logic
    // 1. AI Choice
    let aiChoice;
    // ... rest of logic
    const isUserOff = engine.state.possession === 'home'; 
    
    if (!isUserOff) {
        // AI is Offense
        const roll = Math.random();
        if (roll < 0.4) aiChoice = PLAY_TYPES.RUN_INSIDE;
        else if (roll < 0.7) aiChoice = PLAY_TYPES.PASS_SHORT;
        else aiChoice = PLAY_TYPES.PASS_DEEP;
        
        // Resolve: AI (Off) vs User (Def)
        engine.resolvePlay(aiChoice, userChoice);
    } else {
        // AI is Defense
        const roll = Math.random();
        if (roll < 0.4) aiChoice = DEFENSE_TYPES.RUN_DEFENSE;
        else if (roll < 0.8) aiChoice = DEFENSE_TYPES.PASS_COVERAGE;
        else aiChoice = DEFENSE_TYPES.BLITZ;

        // Resolve: User (Off) vs AI (Def)
        engine.resolvePlay(userChoice, aiChoice);
    }

    // 2. Update React State
    setGameState({...engine.state});
  };

  const handleExitGame = () => {
    // Navigate back to Season screen with result
    const result = {
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      homeId: homeId,
      awayId: awayId
    };
    navigation.navigate('Season', {
      userTeamId: homeId,
      result: result
    });
  };

  const getBallLocationText = () => {
    const yard = gameState.ballOn;
    if (yard <= 0) return "ENDZONE";
    if (yard >= 100) return "ENDZONE";
    if (gameState.possession === 'home') {
      return `HOME ${yard}`;
    } else {
      return `AWAY ${100 - yard}`;
    }
  };

  const renderField = () => {
    // Calculate position of football and lines
    const ballX = (gameState.ballOn / 100) * 100; // Percentage across field
    
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
                left: `${Math.min(100, ballX + (gameState.distance / 100) * 100)}%`
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

  const isUserOffense = gameState.possession === 'home'; // User is always Home for MVP

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
});


