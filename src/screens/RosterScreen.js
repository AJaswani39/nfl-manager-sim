import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

const DEPTH_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];

export default function RosterScreen({ route }) {
  const navigation = useNavigation();
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);

  const [positionFilter, setPositionFilter] = useState(null);
  const [sortBy, setSortBy] = useState('overall');
  const [viewMode, setViewMode] = useState('roster'); // 'roster' | 'depth'
  const [depthChart, setDepthChart] = useState(() => league.getDepthChart(userTeamId));

  // Refresh depth chart when screen gets focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setDepthChart({ ...league.getDepthChart(userTeamId) });
    });
    return unsubscribe;
  }, [navigation, userTeamId]);

  const roster = league.rosters[userTeamId] || [];
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K'];

  // Filter and sort
  const filteredRoster = positionFilter && positionFilter !== 'ALL'
    ? roster.filter(p => p.position === positionFilter)
    : roster;

  const sortedRoster = [...filteredRoster].sort((a, b) => {
    switch (sortBy) {
      case 'overall':
        return b.overall - a.overall;
      case 'position':
        return a.position.localeCompare(b.position);
      case 'age':
        return a.age - b.age;
      case 'salary':
        return league.getPlayerSalary(b.id).amount - league.getPlayerSalary(a.id).amount;
      default:
        return 0;
    }
  });

  // Team stats
  const avgOverall = roster.length > 0
    ? Math.round(roster.reduce((sum, p) => sum + p.overall, 0) / roster.length)
    : 0;
  const avgAge = roster.length > 0
    ? (roster.reduce((sum, p) => sum + (p.age || 25), 0) / roster.length).toFixed(1)
    : 0;

  // Depth chart handlers
  const handleMoveUp = (position, index) => {
    if (index === 0) return;
    const chart = { ...depthChart };
    const arr = [...(chart[position] || [])];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    chart[position] = arr;
    league.setDepthOrder(userTeamId, position, arr);
    setDepthChart({ ...chart });
    StorageService.saveGame(league.getSaveData());
  };

  const handleMoveDown = (position, index) => {
    const chart = { ...depthChart };
    const arr = [...(chart[position] || [])];
    if (index >= arr.length - 1) return;
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    chart[position] = arr;
    league.setDepthOrder(userTeamId, position, arr);
    setDepthChart({ ...chart });
    StorageService.saveGame(league.getSaveData());
  };

  const getPositionColor = (pos) => {
    if (['QB'].includes(pos)) return { backgroundColor: '#e91e63' };
    if (['RB'].includes(pos)) return { backgroundColor: '#4caf50' };
    if (['WR', 'TE'].includes(pos)) return { backgroundColor: '#2196f3' };
    if (['OL'].includes(pos)) return { backgroundColor: '#795548' };
    if (['DL', 'LB'].includes(pos)) return { backgroundColor: '#f44336' };
    if (['DB', 'CB', 'S'].includes(pos)) return { backgroundColor: '#9c27b0' };
    return { backgroundColor: '#666' };
  };

  const getOverallColor = (ovr) => {
    if (ovr >= 90) return { color: '#fdd835' };
    if (ovr >= 80) return { color: '#4caf50' };
    if (ovr >= 70) return { color: '#4fc3f7' };
    return { color: '#888' };
  };

  const renderPlayer = ({ item }) => {
    const stats = league.playerStats[item.id] || {};
    const salary = league.getPlayerSalary(item.id);
    const isInjured = league.playerState[item.id]?.weeksOut > 0;

    let keyStat = '';
    if (item.position === 'QB') {
      keyStat = `${stats.passingYards || 0} YDS, ${stats.passingTDs || 0} TD`;
    } else if (item.position === 'RB') {
      keyStat = `${stats.rushingYards || 0} YDS, ${stats.rushingTDs || 0} TD`;
    } else if (['WR', 'TE'].includes(item.position)) {
      keyStat = `${stats.receivingYards || 0} YDS, ${stats.receptions || 0} REC`;
    } else if (['DL', 'LB'].includes(item.position)) {
      keyStat = `${stats.tackles || 0} TKL, ${stats.sacks || 0} SCK`;
    } else if (['DB', 'CB', 'S'].includes(item.position)) {
      keyStat = `${stats.tackles || 0} TKL, ${stats.interceptions || 0} INT`;
    }

    return (
      <View style={[styles.playerRow, isInjured && styles.injuredRow]}>
        <View style={[styles.positionBadge, getPositionColor(item.position)]}>
          <Text style={styles.positionText}>{item.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName}>{item.name}</Text>
            {isInjured && <Text style={styles.injuryBadge}>INJ</Text>}
          </View>
          <Text style={styles.playerStats}>{keyStat}</Text>
        </View>
        <View style={styles.ratingBox}>
          <Text style={[styles.overallText, getOverallColor(item.overall)]}>{item.overall}</Text>
          <Text style={styles.ageText}>Age {item.age || 25}</Text>
        </View>
        <View style={styles.salaryBox}>
          <Text style={styles.salaryText}>${salary.amount}M</Text>
        </View>
      </View>
    );
  };

  const renderDepthSection = (position) => {
    const chart = depthChart[position] || [];
    if (chart.length === 0) return null;

    return (
      <View key={position} style={styles.depthSection}>
        <View style={[styles.depthPositionHeader, getPositionColor(position)]}>
          <Text style={styles.depthPositionText}>{position}</Text>
        </View>
        {chart.map((playerId, index) => {
          const player = roster.find(p => p.id === playerId);
          if (!player) return null;
          const isInjured = league.playerState[player.id]?.weeksOut > 0;
          const label = `${position}${index + 1}`;

          return (
            <View key={playerId} style={[styles.depthRow, isInjured && styles.depthRowInjured, index === 0 && styles.depthRowStarter]}>
              <Text style={[styles.depthLabel, index === 0 && styles.depthLabelStarter]}>{label}</Text>
              <Text style={[styles.depthName, isInjured && styles.depthNameInjured]}>{player.name}</Text>
              {isInjured && <Text style={styles.depthInjuryTag}>INJ</Text>}
              <Text style={[styles.depthOvr, getOverallColor(player.overall)]}>{player.overall}</Text>
              <View style={styles.depthArrows}>
                <TouchableOpacity
                  onPress={() => handleMoveUp(position, index)}
                  style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
                  disabled={index === 0}
                >
                  <Text style={styles.arrowText}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleMoveDown(position, index)}
                  style={[styles.arrowBtn, index === chart.length - 1 && styles.arrowDisabled]}
                  disabled={index === chart.length - 1}
                >
                  <Text style={styles.arrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
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
        <Text style={styles.title}>Team Roster</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Team Summary */}
      <View style={styles.teamSummary}>
        <Text style={styles.teamName}>{userTeam?.city} {userTeam?.name}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{roster.length}</Text>
            <Text style={styles.summaryLabel}>Players</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgOverall}</Text>
            <Text style={styles.summaryLabel}>Avg OVR</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgAge}</Text>
            <Text style={styles.summaryLabel}>Avg Age</Text>
          </View>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'roster' && styles.modeBtnActive]}
          onPress={() => setViewMode('roster')}
        >
          <Text style={[styles.modeBtnText, viewMode === 'roster' && styles.modeBtnTextActive]}>Roster</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'depth' && styles.modeBtnActive]}
          onPress={() => setViewMode('depth')}
        >
          <Text style={[styles.modeBtnText, viewMode === 'depth' && styles.modeBtnTextActive]}>Depth Chart</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'roster' ? (
        <>
          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {positions.map(pos => (
              <TouchableOpacity
                key={pos}
                style={[styles.filterBtn, (positionFilter === pos || (pos === 'ALL' && !positionFilter)) && styles.filterBtnActive]}
                onPress={() => setPositionFilter(pos === 'ALL' ? null : pos)}
              >
                <Text style={[styles.filterText, (positionFilter === pos || (pos === 'ALL' && !positionFilter)) && styles.filterTextActive]}>
                  {pos}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sort Options */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort:</Text>
            {['overall', 'position', 'age', 'salary'].map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.sortBtn, sortBy === option && styles.sortBtnActive]}
                onPress={() => setSortBy(option)}
              >
                <Text style={[styles.sortText, sortBy === option && styles.sortTextActive]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Roster List */}
          <FlatList
            data={sortedRoster}
            keyExtractor={item => item.id}
            renderItem={renderPlayer}
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : (
        /* Depth Chart View */
        <ScrollView contentContainerStyle={styles.depthContent}>
          <Text style={styles.depthHint}>Use arrows to set your starters. Top player at each position gets the most playing time.</Text>
          {DEPTH_POSITIONS.map(pos => renderDepthSection(pos))}
        </ScrollView>
      )}
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
  teamSummary: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: '#4fc3f7',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#888',
    fontSize: 11,
  },
  // View mode toggle
  modeToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 4,
    backgroundColor: '#1a1a1a',
  },
  modeBtnActive: {
    backgroundColor: '#1976d2',
  },
  modeBtnText: { color: '#666', fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  // Roster view styles
  filterScroll: {
    maxHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 6,
  },
  filterBtnActive: {
    backgroundColor: '#1976d2',
  },
  filterText: {
    color: '#888',
    fontSize: 12,
  },
  filterTextActive: {
    color: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sortLabel: {
    color: '#888',
    fontSize: 12,
    marginRight: 8,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 4,
  },
  sortBtnActive: {
    backgroundColor: '#333',
    borderRadius: 4,
  },
  sortText: {
    color: '#666',
    fontSize: 11,
  },
  sortTextActive: {
    color: '#4fc3f7',
  },
  listContent: {
    padding: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  injuredRow: {
    opacity: 0.6,
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    width: 36,
    alignItems: 'center',
    marginRight: 10,
  },
  positionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  injuryBadge: {
    marginLeft: 6,
    fontSize: 10,
    color: '#f44336',
    fontWeight: 'bold',
  },
  playerStats: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  ratingBox: {
    alignItems: 'center',
    marginRight: 12,
  },
  overallText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  ageText: {
    color: '#666',
    fontSize: 10,
  },
  salaryBox: {
    width: 50,
    alignItems: 'flex-end',
  },
  salaryText: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '600',
  },
  // Depth chart styles
  depthContent: {
    padding: 12,
    paddingBottom: 40,
  },
  depthHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  depthSection: {
    marginBottom: 16,
  },
  depthPositionHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  depthPositionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  depthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 6,
    marginBottom: 3,
  },
  depthRowStarter: {
    backgroundColor: '#1a2a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  depthRowInjured: {
    opacity: 0.5,
  },
  depthLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    width: 36,
  },
  depthLabelStarter: {
    color: '#4caf50',
  },
  depthName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  depthNameInjured: {
    color: '#888',
  },
  depthInjuryTag: {
    color: '#f44336',
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 8,
  },
  depthOvr: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    width: 30,
    textAlign: 'right',
  },
  depthArrows: {
    flexDirection: 'row',
  },
  arrowBtn: {
    padding: 6,
    marginLeft: 4,
    backgroundColor: '#333',
    borderRadius: 4,
    width: 28,
    alignItems: 'center',
  },
  arrowDisabled: {
    opacity: 0.2,
  },
  arrowText: {
    color: '#fff',
    fontSize: 10,
  },
});
