import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function SeasonRecapScreen({ route }) {
  const navigation = useNavigation();
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const standings = league.getStandingsSorted();
  const userStanding = standings.findIndex(s => s.id === userTeamId) + 1;
  const userRecord = league.standings[userTeamId];
  const awards = league.getAwards();

  // Get champion (1st in standings or last playoff winner)
  const champion = standings[0];

  // Get user's best player
  const getUserBestPlayer = () => {
    const roster = league.rosters[userTeamId] || [];
    let best = null;
    let bestScore = 0;

    roster.forEach(player => {
      const stats = league.playerStats[player.id];
      if (stats) {
        const score = league.calculatePlayerScore(stats, player.position);
        if (score > bestScore) {
          bestScore = score;
          best = { ...player, stats, score };
        }
      }
    });

    return best;
  };

  const bestPlayer = getUserBestPlayer();

  const handleContinue = () => {
    navigation.navigate('Draft', { userTeamId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.seasonLabel}>SEASON {league.season || 1}</Text>
          <Text style={styles.title}>SEASON RECAP</Text>
        </View>

        {/* Your Team Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 {userTeam?.name || 'Your Team'}</Text>
          <View style={styles.recordRow}>
            <View style={styles.recordItem}>
              <Text style={styles.recordBig}>{userRecord?.w || 0}</Text>
              <Text style={styles.recordLabel}>WINS</Text>
            </View>
            <View style={styles.recordDivider} />
            <View style={styles.recordItem}>
              <Text style={styles.recordBig}>{userRecord?.l || 0}</Text>
              <Text style={styles.recordLabel}>LOSSES</Text>
            </View>
            <View style={styles.recordDivider} />
            <View style={styles.recordItem}>
              <Text style={[styles.recordBig, {color: '#fdd835'}]}>#{userStanding}</Text>
              <Text style={styles.recordLabel}>RANK</Text>
            </View>
          </View>
        </View>

        {/* Champion */}
        <View style={[styles.card, styles.championCard]}>
          <Text style={styles.championIcon}>🏆</Text>
          <Text style={styles.championLabel}>LEAGUE CHAMPION</Text>
          <Text style={styles.championName}>{champion?.city} {champion?.name}</Text>
          <Text style={styles.championRecord}>{champion?.w}-{champion?.l}</Text>
        </View>

        {/* Your MVP */}
        {bestPlayer && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⭐ Your Team MVP</Text>
            <Text style={styles.mvpName}>{bestPlayer.name}</Text>
            <Text style={styles.mvpDetails}>{bestPlayer.position} • {bestPlayer.overall} OVR</Text>
            {bestPlayer.stats && (
              <View style={styles.statsRow}>
                {bestPlayer.position === 'QB' && (
                  <Text style={styles.statText}>{bestPlayer.stats.passingYards || 0} YDS • {bestPlayer.stats.passingTDs || 0} TD</Text>
                )}
                {bestPlayer.position === 'RB' && (
                  <Text style={styles.statText}>{bestPlayer.stats.rushingYards || 0} YDS • {bestPlayer.stats.rushingTDs || 0} TD</Text>
                )}
                {['WR', 'TE'].includes(bestPlayer.position) && (
                  <Text style={styles.statText}>{bestPlayer.stats.receivingYards || 0} YDS • {bestPlayer.stats.receptions || 0} REC</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* League MVP */}
        {awards?.mvp && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆 League MVP</Text>
            <Text style={styles.mvpName}>{awards.mvp.name}</Text>
            <Text style={styles.mvpDetails}>{awards.mvp.teamId} • {awards.mvp.position}</Text>
          </View>
        )}

        {/* Continue Button */}
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>CONTINUE TO OFFSEASON →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  seasonLabel: {
    color: '#888',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fdd835',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  recordBig: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  recordLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  recordDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  championCard: {
    backgroundColor: '#1a1a0a',
    borderWidth: 2,
    borderColor: '#fdd835',
    alignItems: 'center',
  },
  championIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  championLabel: {
    color: '#fdd835',
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 8,
  },
  championName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  championRecord: {
    color: '#888',
    fontSize: 16,
    marginTop: 4,
  },
  mvpName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  mvpDetails: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  statText: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: '600',
  },
  continueBtn: {
    backgroundColor: '#4caf50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
