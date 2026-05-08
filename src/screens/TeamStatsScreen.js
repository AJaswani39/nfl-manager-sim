import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

const STAT_CATEGORIES = [
  { key: 'totalOffenseYards', label: 'Total Offense', suffix: ' YDS', section: 'offense' },
  { key: 'passingYards', label: 'Passing Yards', suffix: ' YDS', section: 'offense' },
  { key: 'rushingYards', label: 'Rushing Yards', suffix: ' YDS', section: 'offense' },
  { key: 'passingTDs', label: 'Passing TDs', suffix: '', section: 'offense' },
  { key: 'rushingTDs', label: 'Rushing TDs', suffix: '', section: 'offense' },
  { key: 'totalTDs', label: 'Total TDs', suffix: '', section: 'offense' },
  { key: 'pointsFor', label: 'Points Scored', suffix: '', section: 'offense' },
  { key: 'sacks', label: 'Sacks', suffix: '', section: 'defense' },
  { key: 'interceptions', label: 'Interceptions', suffix: '', section: 'defense' },
  { key: 'tackles', label: 'Tackles', suffix: '', section: 'defense' },
  { key: 'fumblesRecovered', label: 'Fumbles Recovered', suffix: '', section: 'defense' },
  { key: 'pointsAgainst', label: 'Points Allowed', suffix: '', section: 'defense', lowerBetter: true },
  { key: 'pointDiff', label: 'Point Differential', suffix: '', section: 'overall' },
];

export default function TeamStatsScreen({ route, navigation }) {
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('offense');

  const loadStats = useCallback(() => {
    const teamStats = league.getTeamSeasonStats(userTeamId);
    const ranks = {};
    STAT_CATEGORIES.forEach(cat => {
      ranks[cat.key] = league.getTeamStatRank(userTeamId, cat.key);
    });
    setStats({ ...teamStats, ranks });
  }, [userTeamId]);

  useEffect(() => {
    loadStats();
    const unsubscribe = navigation.addListener('focus', loadStats);
    return unsubscribe;
  }, [loadStats, navigation]);

  if (!stats) return null;

  const getRankColor = (rank) => {
    if (rank <= 5) return '#3fb950';
    if (rank <= 10) return '#58a6ff';
    if (rank <= 20) return '#fdd835';
    if (rank <= 28) return '#f57c00';
    return '#f85149';
  };

  const getRankLabel = (rank) => {
    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
    return `${rank}${suffix}`;
  };

  const filteredCategories = STAT_CATEGORIES.filter(c =>
    tab === 'all' || c.section === tab
  );

  const renderStatRow = (cat) => {
    const value = stats[cat.key] || 0;
    const rank = stats.ranks[cat.key] || 32;
    const rankColor = getRankColor(rank);
    const barWidth = Math.max(5, Math.min(100, ((33 - rank) / 32) * 100));

    return (
      <View key={cat.key} style={styles.statRow}>
        <View style={styles.statHeader}>
          <Text style={styles.statLabel}>{cat.label}</Text>
          <Text style={[styles.statValue, cat.key === 'pointDiff' && { color: value >= 0 ? '#3fb950' : '#f85149' }]}>
            {cat.key === 'pointDiff' && value > 0 ? '+' : ''}{value.toLocaleString()}{cat.suffix}
          </Text>
        </View>
        <View style={styles.rankRow}>
          <View style={styles.rankBarBg}>
            <View style={[styles.rankBarFill, { width: `${barWidth}%`, backgroundColor: rankColor }]} />
          </View>
          <View style={[styles.rankBadge, { borderColor: rankColor }]}>
            <Text style={[styles.rankText, { color: rankColor }]}>{getRankLabel(rank)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>TEAM STATS</Text>
        <Text style={styles.subtitle}>{userTeam?.city} {userTeam?.name}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { id: 'offense', label: 'Offense' },
          { id: 'defense', label: 'Defense' },
          { id: 'all', label: 'All' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key Numbers */}
      <View style={styles.keyNumbers}>
        <View style={styles.keyItem}>
          <Text style={styles.keyValue}>{stats.pointsFor}</Text>
          <Text style={styles.keyLabel}>PF</Text>
        </View>
        <View style={styles.keyDivider} />
        <View style={styles.keyItem}>
          <Text style={styles.keyValue}>{stats.pointsAgainst}</Text>
          <Text style={styles.keyLabel}>PA</Text>
        </View>
        <View style={styles.keyDivider} />
        <View style={styles.keyItem}>
          <Text style={[styles.keyValue, { color: stats.pointDiff >= 0 ? '#3fb950' : '#f85149' }]}>
            {stats.pointDiff >= 0 ? '+' : ''}{stats.pointDiff}
          </Text>
          <Text style={styles.keyLabel}>DIFF</Text>
        </View>
        <View style={styles.keyDivider} />
        <View style={styles.keyItem}>
          <Text style={styles.keyValue}>{stats.totalTDs}</Text>
          <Text style={styles.keyLabel}>TDs</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredCategories.map(cat => renderStatRow(cat))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    padding: 16,
    paddingTop: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 10,
    padding: 8,
  },
  backText: {
    color: '#58a6ff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#161b22',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  tabActive: {
    backgroundColor: '#0d2818',
    borderColor: '#3fb950',
  },
  tabText: {
    color: '#8b949e',
    fontWeight: '700',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#3fb950',
  },
  keyNumbers: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#161b22',
    marginHorizontal: 12,
    borderRadius: 12,
  },
  keyItem: {
    flex: 1,
    alignItems: 'center',
  },
  keyValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  keyLabel: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  keyDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#21262d',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  statRow: {
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    color: '#c9d1d9',
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#21262d',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rankBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rankBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
