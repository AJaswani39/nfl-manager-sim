import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function FranchiseScreen({ route }) {
  const navigation = useNavigation();
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const history = league.getFranchiseHistory();
  const championships = league.getUserChampionships();
  const totalSeasons = history.length;
  const bestFinish = history.length > 0 ? Math.min(...history.map(h => h.userFinish)) : null;
  
  // Stats summary
  const totalWins = history.reduce((sum, h) => {
    const [w] = (h.userRecord || '0-0').split('-');
    return sum + parseInt(w || 0);
  }, 0);
  const totalLosses = history.reduce((sum, h) => {
    const [, l] = (h.userRecord || '0-0').split('-');
    return sum + parseInt(l || 0);
  }, 0);

  const renderSeasonRow = ({ item }) => {
    const isChampion = item.champion?.id === userTeamId;
    
    return (
      <View style={[styles.seasonRow, isChampion && styles.championRow]}>
        <View style={styles.seasonInfo}>
          <Text style={styles.seasonNum}>Season {item.season}</Text>
          {isChampion && <Text style={styles.trophyIcon}>🏆</Text>}
        </View>
        <View style={styles.seasonDetails}>
          <Text style={styles.recordText}>{item.userRecord || 'N/A'}</Text>
          <Text style={styles.finishText}>#{item.userFinish}</Text>
        </View>
        <View style={styles.seasonMvp}>
          <Text style={styles.mvpLabel}>MVP</Text>
          <Text style={styles.mvpName}>{item.mvp?.name || 'N/A'}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Franchise</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Team Info */}
        <View style={styles.teamHeader}>
          <Text style={styles.teamName}>{userTeam?.city} {userTeam?.name}</Text>
          <Text style={styles.seasonLabel}>Current: Season {league.season || 1}</Text>
        </View>

        {/* Trophy Case */}
        <View style={styles.trophyCase}>
          <Text style={styles.trophyTitle}>🏆 Trophy Case</Text>
          <View style={styles.trophyRow}>
            <View style={styles.trophyItem}>
              <Text style={styles.trophyCount}>{championships}</Text>
              <Text style={styles.trophyLabel}>Championships</Text>
            </View>
            <View style={styles.trophyItem}>
              <Text style={styles.trophyCount}>{totalSeasons}</Text>
              <Text style={styles.trophyLabel}>Seasons</Text>
            </View>
            <View style={styles.trophyItem}>
              <Text style={styles.trophyCount}>{bestFinish || '-'}</Text>
              <Text style={styles.trophyLabel}>Best Finish</Text>
            </View>
          </View>
        </View>

        {/* Career Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Career Record</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statBig}>{totalWins}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBig}>{totalLosses}</Text>
              <Text style={styles.statLabel}>Losses</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBig}>
                {totalWins + totalLosses > 0 
                  ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(0) + '%'
                  : '-'}
              </Text>
              <Text style={styles.statLabel}>Win %</Text>
            </View>
          </View>
        </View>

        {/* Season History */}
        <Text style={styles.sectionTitle}>📜 Season History</Text>
        {history.length > 0 ? (
          <FlatList
            data={[...history].reverse()}
            keyExtractor={(item) => `season-${item.season}`}
            renderItem={renderSeasonRow}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No seasons completed yet</Text>
            <Text style={styles.emptySubtext}>Complete your first season to see history here</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: { padding: 8 },
  backText: { color: '#4fc3f7', fontSize: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 60 },
  content: {
    padding: 16,
  },
  teamHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  teamName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  seasonLabel: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  trophyCase: {
    backgroundColor: '#1a1a0a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#fdd835',
  },
  trophyTitle: {
    color: '#fdd835',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  trophyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  trophyItem: {
    alignItems: 'center',
  },
  trophyCount: {
    color: '#fdd835',
    fontSize: 36,
    fontWeight: 'bold',
  },
  trophyLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statBig: {
    color: '#4fc3f7',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  championRow: {
    backgroundColor: '#2a2a1a',
    borderWidth: 1,
    borderColor: '#fdd835',
  },
  seasonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  seasonNum: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  trophyIcon: {
    marginLeft: 6,
    fontSize: 14,
  },
  seasonDetails: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  recordText: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: 'bold',
  },
  finishText: {
    color: '#888',
    fontSize: 14,
  },
  seasonMvp: {
    alignItems: 'flex-end',
  },
  mvpLabel: {
    color: '#666',
    fontSize: 10,
  },
  mvpName: {
    color: '#888',
    fontSize: 12,
  },
  emptyState: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
