import React from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { TEAMS } from '../data/teams';
import { ROSTERS } from '../data/rosters';
import { league } from '../engine/LeagueEngine';

export default function TeamDetailScreen({ route, navigation }) {
  const { teamId } = route.params;
  const team = TEAMS.find(t => t.id === teamId);
  const players = ROSTERS[teamId] || [];

  const getPositionColor = (pos) => {
    if (['QB', 'RB', 'WR', 'TE'].includes(pos)) return '#e3f2fd'; // Offense Blue
    if (['DL', 'LB', 'DB'].includes(pos)) return '#fbe9e7'; // Defense Red
    return '#f5f5f5'; // Special/Line
  };

  const getPositionTextColor = (pos) => {
    if (['QB', 'RB', 'WR', 'TE'].includes(pos)) return '#1565c0';
    if (['DL', 'LB', 'DB'].includes(pos)) return '#c62828';
    return '#616161';
  };

  const renderPlayer = ({ item }) => {
    const stats = league.playerStats[item.id];
    const injury = league.playerState[item.id];
    const isInjured = injury && injury.weeksOut > 0;
    
    let statText = "";
    if (item.position === 'QB') statText = `${stats?.passingYards||0} yds, ${stats?.passingTDs||0} TD`;
    else if (item.position === 'RB') statText = `${stats?.rushingYards||0} yds, ${stats?.rushingTDs||0} TD`;
    else if (['WR', 'TE'].includes(item.position)) statText = `${stats?.receivingYards||0} yds, ${stats?.receivingTDs||0} TD`;

    return (
    <View style={styles.playerCard}>
      <View style={[styles.positionBadge, { backgroundColor: getPositionColor(item.position) }]}>
        <Text style={[styles.positionText, { color: getPositionTextColor(item.position) }]}>{item.position}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.name}</Text>
        <Text style={styles.playerMeta}>
            {isInjured 
                ? <Text style={{color: '#d32f2f', fontWeight: 'bold'}}>OUT ({injury.weeksOut} wks)</Text> 
                : (statText || `Age: ${item.age}`)}
        </Text>
      </View>
      <View style={styles.ratingCircle}>
        <Text style={[
          styles.ratingText, 
          { color: item.overall >= 90 ? '#d32f2f' : item.overall >= 80 ? '#1976d2' : '#388e3c' }
        ]}>
          {item.overall}
        </Text>
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: team.colors.primary }]}>
        <Text style={styles.city}>{team.city}</Text>
        <Text style={styles.teamName}>{team.name}</Text>
        <View style={styles.headerStats}>
           <Text style={styles.headerStatText}>OFF: {team.ratings.offense}</Text>
           <Text style={styles.headerStatText}>DEF: {team.ratings.defense}</Text>
           <Text style={styles.headerStatText}>OVR: {team.ratings.overall}</Text>
        </View>

        <TouchableOpacity 
          style={styles.startSeasonButton}
          onPress={() => navigation.navigate('Season', { userTeamId: team.id })}
        >
          <Text style={styles.startSeasonText}>START 2026 SEASON</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.rosterHeader}>
        <Text style={styles.rosterTitle}>Key Players (2025)</Text>
      </View>

      <FlatList
        data={players}
        renderItem={renderPlayer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  city: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  teamName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  headerStatText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rosterHeader: {
    padding: 20,
    paddingBottom: 10,
  },
  rosterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  list: {
    padding: 16,
  },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionText: {
    fontWeight: '800',
    fontSize: 14,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  playerMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  ratingCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '700',
  },
  startSeasonButton: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  startSeasonText: {
    color: '#333',
    fontWeight: '900',
    fontSize: 16,
  },
});
