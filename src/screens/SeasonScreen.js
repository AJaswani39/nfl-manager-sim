import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function SeasonScreen({ route, navigation }) {
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const [currentWeek, setCurrentWeek] = useState(league.currentWeek);
  const [standings, setStandings] = useState(league.getStandingsSorted());
  const [recentResult, setRecentResult] = useState(null);

  // Helper: Get user's match for this week
  const getNextMatch = () => {
    if (league.currentWeek > 17) return null;
    const weekMatches = league.weeks[league.currentWeek - 1];
    return weekMatches.find(m => m.home.id === userTeamId || m.away.id === userTeamId);
  };

  const nextMatch = getNextMatch();

  const handleSimulateWeek = () => {
    if (league.currentWeek > 17) return;

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
      <Text style={styles.standingTeam}>{item.name}</Text>
      <Text style={styles.record}>{item.w} - {item.l}</Text>
      <Text style={styles.diff}>{item.pf - item.pa}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: userTeam.colors.primary }]}>
        <Text style={styles.weekLabel}>Week {currentWeek > 17 ? 'END' : currentWeek}</Text>
        <Text style={styles.headerTeam}>{userTeam.city} {userTeam.name}</Text>
        <Text style={styles.recordLabel}>
          Season Record: {standings.find(s => s.id === userTeamId)?.w} - {standings.find(s => s.id === userTeamId)?.l}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* ACTION AREA */}
        {currentWeek <= 17 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Matchup</Text>
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
            ) : <Text>Bye Week</Text>}

            <TouchableOpacity 
              style={styles.simButton} 
              onPress={() => navigation.navigate('Match', { 
                  homeId: nextMatch.home.id, 
                  awayId: nextMatch.away.id 
              })}
            >
              <Text style={styles.simButtonText}>PLAY GAME</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.simButton, {marginTop:10, backgroundColor:'#555'}]} onPress={handleSimulateWeek}>
              <Text style={styles.simButtonText}>QUICK SIMULATE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Season Over</Text>
            <Text style={{textAlign:'center', marginBottom:20}}>Check the standings to see if you made the playoffs!</Text>
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
        {currentWeek >= 13 && (
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
        {currentWeek >= 13 && (
           <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Playoff Picture</Text>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                 <View style={{flex:1}}>
                    <Text style={{fontWeight:'bold', marginBottom:4}}>AFC</Text>
                    {league.getPlayoffPicture().AFC.map((t, i) => (
                       <Text key={t.id} style={{fontSize:12, marginBottom:2}}>{i+1}. {t.name} ({t.w}-{t.l})</Text>
                    ))}
                 </View>
                 <View style={{flex:1}}>
                    <Text style={{fontWeight:'bold', marginBottom:4}}>NFC</Text>
                    {league.getPlayoffPicture().NFC.map((t, i) => (
                       <Text key={t.id} style={{fontSize:12, marginBottom:2}}>{i+1}. {t.name} ({t.w}-{t.l})</Text>
                    ))}
                 </View>
              </View>
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
