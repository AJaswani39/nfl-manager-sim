import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

export default function SeasonScreen({ route, navigation }) {
  const { teamId } = route.params;
  const userTeamId = teamId || league.userTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const [currentWeek, setCurrentWeek] = useState(league.currentWeek);
  const [standings, setStandings] = useState(league.getStandingsSorted());
  const [recentResult, setRecentResult] = useState(null);

  // Set userTeamId on league if not already set
  useEffect(() => {
    if (userTeamId && !league.userTeamId) {
      league.userTeamId = userTeamId;
    }
  }, [userTeamId]);

  // Refresh data when screen receives focus (e.g. returning from Match or Draft)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setCurrentWeek(league.currentWeek);
      setStandings(league.getStandingsSorted());
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.result) {
      const { result, playerStats, injuries } = route.params;
      league.applyGameResult(result, playerStats, injuries);
      
      navigation.setParams({ result: null, playerStats: null, injuries: null });
      
      setCurrentWeek(league.currentWeek);
      setStandings(league.getStandingsSorted());
      
      // Auto-save after each game
      StorageService.saveGame(league.getSaveData());
      
      // Show result feedback
      const oppId = result.homeId === userTeamId ? result.awayId : result.homeId;
      const oppTeam = TEAMS.find(t => t.id === oppId);
      
      setRecentResult({
        won: (result.homeScore > result.awayScore && result.homeId === userTeamId) || 
             (result.awayScore > result.homeScore && result.awayId === userTeamId),
        score: `${result.awayScore} - ${result.homeScore}`,
        opponent: oppTeam ? oppTeam.abbreviation : 'OPP'
      });
    }
  }, [route.params?.result]);

  // Helper: Get user's match for this week
  const getNextMatch = () => {
    // if (league.currentWeek > 17) return null; // REMOVED LIMIT
    if (league.currentWeek > league.weeks.length) return null; // Safety check
    const weekMatches = league.weeks[league.currentWeek - 1];
    return weekMatches.find(m => m.home.id === userTeamId || m.away.id === userTeamId);
  };

  const nextMatch = getNextMatch();

  const handleSimulateWeek = () => {
    // if (league.currentWeek > 17) return; // REMOVED LIMIT
    
    // Capture the result of the user's game before simulating
    const match = getNextMatch();
    
    league.simulateWeek(league.currentWeek - 1);
    
    // Update state
    setCurrentWeek(league.currentWeek);
    setStandings(league.getStandingsSorted());

    // Show result
    if (match && match.result) {
      const weWon = (match.home.id === userTeamId && match.result.homeScore > match.result.awayScore) ||
                    (match.away.id === userTeamId && match.result.awayScore > match.result.homeScore);
      setRecentResult({
        won: weWon,
        score: `${match.result.awayScore} - ${match.result.homeScore}`, // Away - Home format usually
        opponent: match.home.id === userTeamId ? match.away.abbreviation : match.home.abbreviation
      });
    }
  };

  const renderStanding = ({ item, index }) => (
    <View style={[styles.standingRow, item.id === userTeamId && styles.userRow]}>
      <Text style={styles.rank}>{index + 1}</Text>
      <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
         <Text style={styles.standingTeam}>{item.name}</Text>
         {item.eliminated && <Text style={{color:'red', fontWeight:'bold', marginLeft:5}}>E</Text>}
         {/* Could add Z/Y/X for clinched later */}
      </View>
      <Text style={styles.record}>{item.w} - {item.l}</Text>
      <Text style={styles.diff}>{item.pf - item.pa}</Text>
    </View>
  );

  const getWeekLabel = () => {
      if (league.phase === 'preseason') return `Preseason Week ${currentWeek}`;
      if (league.phase === 'regular') return `Week ${currentWeek - 3}`;
      if (league.phase === 'playoffs') {
          // Look at first match of current week to get type
          if (league.weeks[currentWeek-1] && league.weeks[currentWeek-1][0]) {
              return `Playoffs: ${league.weeks[currentWeek-1][0].type}`;
          }
          return "Playoffs";
      }
      return "Offseason";
  };

  const userStats = standings.find(s => s.id === userTeamId);
  // Opponent ID
  const oppId = nextMatch ? (nextMatch.home.id === userTeamId ? nextMatch.away.id : nextMatch.home.id) : null;
  const oppStats = oppId ? standings.find(s => s.id === oppId) : null;
  
  const isSpoilerGame = userStats?.eliminated && oppStats && !oppStats.eliminated && league.phase === 'regular';
  const knockedOutOpponent = route.params?.knockedOutOpponent;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: userTeam.colors.primary }]}>
        <Text style={styles.weekLabel}>{getWeekLabel()}</Text>
        <Text style={styles.headerTeam}>{userTeam.city} {userTeam.name}</Text>
        <Text style={styles.recordLabel}>
          Season Record: {userStats?.w} - {userStats?.l}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* ACTION AREA */}
        {league.phase !== 'offseason' ? (
          <View style={styles.section}>
            {knockedOutOpponent && (
                <View style={{backgroundColor:'#feca57', padding:10, borderRadius:8, marginBottom:16, alignItems:'center', borderWidth:2, borderColor:'#fff'}}>
                    <Text style={{color:'#000', fontWeight:'bold', fontSize:16, textAlign:'center'}}>
                        SPOILER SUCCESS!
                    </Text>
                    <Text style={{color:'#333', textAlign:'center', marginTop:4}}>
                        You knocked {knockedOutOpponent} out of the playoffs!
                    </Text>
                </View>
            )}

            <TouchableOpacity 
              style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:10, backgroundColor:'#1e1e1e', borderRadius:8, marginBottom:16, borderLeftWidth: 4, borderColor: '#007AFF'}}
              onPress={() => navigation.navigate('News')}
            >
                <View>
                    <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>📰 LEAGUE NEWS</Text>
                    <Text style={{color:'#888', fontSize:12}}>Retirements, Trades & More</Text>
                </View>
                <Text style={{color:'#007AFF', fontSize: 20}}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:10, backgroundColor:'#1e1e1e', borderRadius:8, marginBottom:16, borderLeftWidth: 4, borderColor: '#fdd835'}}
              onPress={() => navigation.navigate('Leaderboard')}
            >
                <View>
                    <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>🏆 STAT LEADERS</Text>
                    <Text style={{color:'#888', fontSize:12}}>League-wide leaderboards</Text>
                </View>
                <Text style={{color:'#fdd835', fontSize: 20}}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:10, backgroundColor:'#1e1e1e', borderRadius:8, marginBottom:16, borderLeftWidth: 4, borderColor: '#4caf50'}}
              onPress={() => navigation.navigate('FreeAgency', { userTeamId })}
            >
                <View>
                    <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>✍️ FREE AGENCY</Text>
                    <Text style={{color:'#888', fontSize:12}}>Sign or release players</Text>
                </View>
                <Text style={{color:'#4caf50', fontSize: 20}}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:10, backgroundColor:'#1e1e1e', borderRadius:8, marginBottom:16, borderLeftWidth: 4, borderColor: '#f44336'}}
              onPress={() => navigation.navigate('Trade', { userTeamId })}
            >
                <View>
                    <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>🔄 TRADE CENTER</Text>
                    <Text style={{color:'#888', fontSize:12}}>Make trades with other teams</Text>
                </View>
                <Text style={{color:'#f44336', fontSize: 20}}>→</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Next Matchup</Text>
            {isSpoilerGame && (
                <View style={{backgroundColor:'#d32f2f', padding:5, borderRadius:4, marginBottom:5, alignItems:'center'}}>
                    <Text style={{color:'#fff', fontWeight:'bold'}}>SPOILER ALERT: KNOCK THEM OUT!</Text>
                </View>
            )}
            {nextMatch ? (
              <View style={styles.matchupCard}>
                <View style={styles.teamSide}>
                  <Text style={styles.vsTeam}>{nextMatch.away.abbreviation}</Text>
                  <Text style={styles.vsRating}>{nextMatch.away.ratings.overall} OVR</Text>
                </View>
                <View style={styles.vsCenter}>
                  <Text style={styles.vsText}>@</Text>
                </View>
                <View style={styles.teamSide}>
                  <Text style={styles.vsTeam}>{nextMatch.home.abbreviation}</Text>
                  <Text style={styles.vsRating}>{nextMatch.home.ratings.overall} OVR</Text>
                </View>
              </View>
            ) : <Text style={{marginBottom:10, fontStyle:'italic'}}>No match this week (Bye or eliminated)</Text>}

            {/* Play Button */}
            {nextMatch && !nextMatch.played ? (
                 <TouchableOpacity 
                  style={styles.simButton} 
                  onPress={() => navigation.navigate('Match', { 
                      homeId: nextMatch.home.id, 
                      awayId: nextMatch.away.id,
                      userTeamId: userTeamId,
                      injuries: league.playerState
                  })}
                >
                  <Text style={styles.simButtonText}>PLAY GAME</Text>
                </TouchableOpacity>
            ) : nextMatch && nextMatch.played ? (
                <View style={[styles.simButton, {backgroundColor:'#555'}]}>
                    <Text style={styles.simButtonText}>GAME PLAYED</Text>
                </View>
            ) : null}
            
            {/* Sim Button */}
            {(!nextMatch || nextMatch.played) && (
                <TouchableOpacity style={[styles.simButton, {marginTop:10, backgroundColor:'#333'}]} onPress={handleSimulateWeek}>
                  <Text style={styles.simButtonText}>
                      {league.phase === 'playoffs' ? "SIMULATE ROUND" : "SIMULATE WEEK"}
                  </Text>
                </TouchableOpacity>
            )}

            {/* Quick Sim (Only Regular Season) */}
            {league.phase === 'regular' && (!nextMatch || nextMatch.played) && (
                <TouchableOpacity style={[styles.simButton, {marginTop:10, backgroundColor:'#777'}]} onPress={() => {
                    for(let i=0; i<4; i++) league.simulateWeek(league.currentWeek - 1);
                    setCurrentWeek(league.currentWeek);
                    setStandings(league.getStandingsSorted());
                }}>
                  <Text style={styles.simButtonText}>QUICK SIM (4w)</Text>
                </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Season Over</Text>
            <TouchableOpacity style={styles.simButton} onPress={() => navigation.navigate('Draft', { userTeamId })}>
                <Text style={styles.simBtnText}>START OFFSEASON</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LAST WEEK RESULT */}
        {recentResult && (
          <View style={[styles.resultCard, recentResult.won ? styles.wonCard : styles.lostCard]}>
             <Text style={styles.resultTitle}>{recentResult.won ? "VICTORY" : "DEFEAT"}</Text>
             <Text style={styles.resultScore}>vs {recentResult.opponent}: {recentResult.score}</Text>
          </View>
        )}

        {/* STANDINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>League Standings</Text>
          <View style={styles.tableHeader}>
             <Text style={styles.rank}>#</Text>
             <Text style={styles.standingTeam}>Team</Text>
             <Text style={styles.record}>Rec</Text>
             <Text style={styles.diff}>Diff</Text>
          </View>
          {standings.map((item, index) => <View key={item.id}>{renderStanding({item, index})}</View>)}
        </View>

        {/* PLAYOFF ODDS (Week 13+) */}
        {currentWeek >= 16 && (
          <View style={styles.section}>
             <Text style={styles.sectionTitle}>Playoff Hunt (Odds to Make)</Text>
             {league.getStandingsSorted().filter((_, i) => i < 16).map(team => {
                const odds = league.calculatePlayoffOdds()[team.id] || 0;
                return (
                  <View key={team.id} style={styles.standingRow}>
                    <Text style={styles.standingTeam}>{team.name}</Text>
                    <Text style={{fontWeight: 'bold', color: odds > 50 ? 'green' : odds < 20 ? 'red' : 'orange'}}>
                      {odds}%
                    </Text>
                  </View>
                )
             })}
          </View>
        )}

        {/* BRACKET PREVIEW */}
        {currentWeek >= 16 && (
           <View style={{margin:16, marginTop:0}}>
              <Text style={styles.sectionTitle}>Projected Playoff Matchups</Text>
              
              {['AFC', 'NFC'].map(conf => {
                const teams = league.getPlayoffPicture()[conf];
                return (
                  <View key={conf} style={{marginBottom: 20, backgroundColor: '#fff', borderRadius:12, padding:16}}>
                    <Text style={{fontWeight:'900', fontSize:18, color: conf==='AFC'?'#d32f2f':'#1976d2', marginBottom:10}}>{conf} PLAYOFFS</Text>
                    
                    {/* BYE */}
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8, paddingBottom:8, borderBottomWidth:1, borderColor:'#eee'}}>
                       <Text style={{color:'#888', fontWeight:'bold'}}>BYE (No. 1 Seed)</Text>
                       <Text style={{fontWeight:'bold'}}>{teams[0].name} ({teams[0].w}-{teams[0].l})</Text>
                    </View>

                    {/* MATCHUPS */}
                    {[
                      {high:1, low:6}, // Seed 2 vs 7 (index 1 vs 6)
                      {high:2, low:5}, // Seed 3 vs 6 (index 2 vs 5)
                      {high:3, low:4}  // Seed 4 vs 5 (index 3 vs 4)
                    ].map((m, i) => (
                      <View key={i} style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                         <View style={{width:'45%'}}>
                            <Text style={{fontSize:10, color:'#888'}}>#{m.high+1}</Text>
                            <Text style={{fontWeight:'600'}}>{teams[m.high].name}</Text>
                            <Text style={{fontSize:10, color:'#555'}}>({teams[m.high].w}-{teams[m.high].l})</Text>
                         </View>
                         <Text style={{fontWeight:'900', color:'#ccc'}}>VS</Text>
                         <View style={{width:'45%', alignItems:'flex-end'}}>
                            <Text style={{fontSize:10, color:'#888'}}>#{m.low+1}</Text>
                            <Text style={{fontWeight:'600'}}>{teams[m.low].name}</Text>
                            <Text style={{fontSize:10, color:'#555'}}>({teams[m.low].w}-{teams[m.low].l})</Text>
                         </View>
                      </View>
                    ))}
                  </View>
                )
              })}
           </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  header: {
    padding: 24,
    paddingTop: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  weekLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    marginBottom: 5,
  },
  headerTeam: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 5,
  },
  recordLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
    marginBottom: 12,
  },
  matchupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
  },
  teamSide: {
    flex: 1,
    alignItems: 'center',
  },
  vsCenter: {
    width: 40,
    alignItems: 'center',
  },
  vsTeam: {
    fontSize: 24,
    fontWeight: '900',
    color: '#333',
  },
  vsRating: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  vsText: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
  simButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  simButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
  resultCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  wonCard: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  lostCard: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ef9a9a',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    color: '#333',
  },
  resultScore: {
    fontWeight: '600',
    color: '#555',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  standingRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  userRow: {
    backgroundColor: '#e3f2fd',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  rank: {
    width: 30,
    fontWeight: '700',
    color: '#888',
  },
  standingTeam: {
    flex: 1,
    fontWeight: '600',
    color: '#333',
  },
  record: {
    width: 60,
    textAlign: 'center',
    fontWeight: '700',
  },
  diff: {
    width: 40,
    textAlign: 'right',
    color: '#666',
    fontSize: 12,
  },
});
