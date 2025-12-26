import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { TEAMS } from '../data/teams';
import { ROSTERS } from '../data/rosters';

export default function BoxScoreScreen({ route, navigation }) {
  const { result, playerStats, userTeamId } = route.params;
  
  const homeTeam = TEAMS.find(t => t.id === result.homeId);
  const awayTeam = TEAMS.find(t => t.id === result.awayId);
  
  const [activeTab, setActiveTab] = useState('home'); // 'home' or 'away'
  const activeTeam = activeTab === 'home' ? homeTeam : awayTeam;

  const getTeamStats = (teamId) => {
      // Get all players with stats for this team
      const roster = ROSTERS[teamId] || [];
      const rosterIds = new Set(roster.map(p => p.id));
      
      const stats = [];
      Object.keys(playerStats).forEach(pid => {
          if (rosterIds.has(pid)) {
              stats.push({ ...playerStats[pid], id: pid });
          }
      });
      return stats;
  };

  const currentStats = getTeamStats(activeTeam.id);

  // Group by Category
  const passing = currentStats.filter(p => p.passingAtt > 0).sort((a,b) => b.passingYards - a.passingYards);
  const rushing = currentStats.filter(p => p.rushingAtt > 0).sort((a,b) => b.rushingYards - a.rushingYards);
  const receiving = currentStats.filter(p => p.receptions > 0).sort((a,b) => b.receivingYards - a.receivingYards);
  const defense = currentStats.filter(p => p.tackles > 0 || p.sacks > 0 || p.interceptions > 0 || p.defTDs > 0).sort((a,b) => (b.tackles||0) - (a.tackles||0));

  const handleContinue = () => {
    navigation.navigate('Season', {
      userTeamId: userTeamId,
      result: result,
      playerStats: playerStats
    });
  };

  const renderStatRow = (label, p, statsStr) => (
      <View key={p.id} style={styles.statRow}>
          <Text style={styles.statName}>{p.name} <Text style={styles.posText}>({p.position})</Text></Text>
          <Text style={styles.statValue}>{statsStr}</Text>
      </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.scoreText}>
            {awayTeam.abbreviation} {result.awayScore} - {result.homeScore} {homeTeam.abbreviation}
        </Text>
      </View>

      <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'away' && styles.activeTab]} 
            onPress={() => setActiveTab('away')}
          >
              <Text style={[styles.tabText, activeTab === 'away' && styles.activeTabText]}>{awayTeam.name}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'home' && styles.activeTab]} 
            onPress={() => setActiveTab('home')}
          >
              <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>{homeTeam.name}</Text>
          </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
          {passing.length > 0 && (
              <View style={styles.section}>
                  <Text style={styles.sectionTitle}>PASSING</Text>
                  <View style={styles.headerRow}>
                      <Text style={styles.headerColLeft}>Player</Text>
                      <Text style={styles.headerColRight}>C/A  Yds  TD  Int</Text>
                  </View>
                  {passing.map(p => renderStatRow(p.name, p, 
                      `${p.passingComp}/${p.passingAtt}  ${p.passingYards}  ${p.passingTDs}  ${p.interceptions||0}`
                  ))}
              </View>
          )}

          {rushing.length > 0 && (
              <View style={styles.section}>
                  <Text style={styles.sectionTitle}>RUSHING</Text>
                  <View style={styles.headerRow}>
                      <Text style={styles.headerColLeft}>Player</Text>
                      <Text style={styles.headerColRight}>Att  Yds  TD</Text>
                  </View>
                  {rushing.map(p => renderStatRow(p.name, p, 
                      `${p.rushingAtt}  ${p.rushingYards}  ${p.rushingTDs}`
                  ))}
              </View>
          )}

          {receiving.length > 0 && (
              <View style={styles.section}>
                  <Text style={styles.sectionTitle}>RECEIVING</Text>
                  <View style={styles.headerRow}>
                      <Text style={styles.headerColLeft}>Player</Text>
                      <Text style={styles.headerColRight}>Rec  Yds  TD</Text>
                  </View>
                  {receiving.map(p => renderStatRow(p.name, p, 
                      `${p.receptions}  ${p.receivingYards}  ${p.receivingTDs}`
                  ))}
              </View>
          )}

          {defense.length > 0 && (
              <View style={styles.section}>
                  <Text style={styles.sectionTitle}>DEFENSE</Text>
                  <View style={styles.headerRow}>
                      <Text style={styles.headerColLeft}>Player</Text>
                      <Text style={styles.headerColRight}>Tck  Sck  Int  TD</Text>
                  </View>
                  {defense.map(p => renderStatRow(p.name, p, 
                      `${p.tackles||0}  ${p.sacks||0}  ${p.interceptions||0}  ${p.defTDs||0}`
                  ))}
              </View>
          )}
          
          <View style={{height: 40}} /> 
      </ScrollView>

      <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.buttonText}>CONTINUE TO SEASON</Text>
          </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 20,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  scoreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabs: {
      flexDirection: 'row',
      backgroundColor: '#1e1e1e',
  },
  tab: {
      flex: 1,
      padding: 15,
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
  },
  activeTab: {
      borderBottomColor: '#007AFF',
  },
  tabText: {
      color: '#888',
      fontWeight: '600',
  },
  activeTabText: {
      color: '#fff',
  },
  content: {
      flex: 1,
      padding: 10,
  },
  section: {
      marginBottom: 20,
      backgroundColor: '#1e1e1e',
      borderRadius: 8,
      padding: 10,
  },
  sectionTitle: {
      color: '#ccc',
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 10,
  },
  headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
      borderBottomWidth: 1,
      borderColor: '#333',
      paddingBottom: 5,
  },
  headerColLeft: {
      color: '#888',
      fontSize: 12,
  },
  headerColRight: {
      color: '#888',
      fontSize: 12,
      width: 150, 
      textAlign: 'right',
  },
  statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: '#252525',
  },
  statName: {
      color: '#fff',
      fontSize: 14,
      flex: 1,
  },
  posText: {
      color: '#555',
      fontSize: 12,
  },
  statValue: {
      color: '#fff',
      fontSize: 14,
      width: 150,
      textAlign: 'right',
      fontFamily: 'monospace', // Aligns numbers better
  },
  footer: {
      padding: 20,
      borderTopWidth: 1,
      borderColor: '#333',
  },
  continueButton: {
      backgroundColor: '#007AFF',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
  },
  buttonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
  }
});
