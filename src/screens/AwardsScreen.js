import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function AwardsScreen() {
  const navigation = useNavigation();
  const awards = league.getAwards();

  const getTeamColor = (teamId) => {
    const team = TEAMS.find(t => t.id === teamId);
    return team?.colors?.primary || '#333';
  };

  const renderAwardCard = (title, icon, player, description) => {
    if (!player) {
      return (
        <View style={styles.awardCard}>
          <Text style={styles.awardIcon}>{icon}</Text>
          <Text style={styles.awardTitle}>{title}</Text>
          <Text style={styles.noAward}>No winner yet</Text>
          <Text style={styles.awardDesc}>{description}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.awardCard, { borderColor: getTeamColor(player.teamId) }]}>
        <Text style={styles.awardIcon}>{icon}</Text>
        <Text style={styles.awardTitle}>{title}</Text>
        <View style={[styles.teamBadge, { backgroundColor: getTeamColor(player.teamId) }]}>
          <Text style={styles.teamBadgeText}>{player.teamId}</Text>
        </View>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerPosition}>{player.position} • {player.overall} OVR</Text>
        {player.stats && (
          <View style={styles.statsRow}>
            {player.position === 'QB' && (
              <>
                <Text style={styles.statItem}>{player.stats.passingYards || 0} YDS</Text>
                <Text style={styles.statItem}>{player.stats.passingTDs || 0} TD</Text>
              </>
            )}
            {player.position === 'RB' && (
              <>
                <Text style={styles.statItem}>{player.stats.rushingYards || 0} YDS</Text>
                <Text style={styles.statItem}>{player.stats.rushingTDs || 0} TD</Text>
              </>
            )}
            {['WR', 'TE'].includes(player.position) && (
              <>
                <Text style={styles.statItem}>{player.stats.receivingYards || 0} YDS</Text>
                <Text style={styles.statItem}>{player.stats.receptions || 0} REC</Text>
              </>
            )}
            {['DL', 'LB', 'CB', 'S', 'DB'].includes(player.position) && (
              <>
                <Text style={styles.statItem}>{player.stats.sacks || 0} SACK</Text>
                <Text style={styles.statItem}>{player.stats.tackles || 0} TKL</Text>
                <Text style={styles.statItem}>{player.stats.interceptions || 0} INT</Text>
              </>
            )}
          </View>
        )}
        <Text style={styles.awardDesc}>{description}</Text>
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
        <Text style={styles.title}>Season Awards</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.seasonLabel}>Season {league.season || 1} • Week {league.currentWeek}</Text>

        {renderAwardCard(
          'Most Valuable Player',
          '🏆',
          awards?.mvp,
          'The league\'s most outstanding player'
        )}

        {renderAwardCard(
          'Offensive Player of the Year',
          '⚡',
          awards?.opoy,
          'Top performer on offense'
        )}

        {renderAwardCard(
          'Defensive Player of the Year',
          '🛡️',
          awards?.dpoy,
          'Dominant force on defense'
        )}

        {renderAwardCard(
          'Offensive Rookie of the Year',
          '⭐',
          awards?.oroy,
          'Best first-year player'
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
  seasonLabel: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  awardCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  awardIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  awardTitle: {
    color: '#fdd835',
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  noAward: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  teamBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  teamBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  playerPosition: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: '600',
  },
  awardDesc: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
