import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function InjuryReportScreen({ route, navigation }) {
  const { userTeamId } = route.params;
  const [filter, setFilter] = useState('my_team'); // 'my_team' | 'all'
  const [injuries, setInjuries] = useState([]);

  useEffect(() => {
    loadInjuries();
    const unsubscribe = navigation.addListener('focus', loadInjuries);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadInjuries();
  }, [filter]);

  const loadInjuries = () => {
    const injuredPlayers = [];

    // Check which players are on IR for quick lookup
    const irPlayerSet = new Set();
    const irEligibility = {};
    Object.entries(league.injuredReserve || {}).forEach(([teamId, irList]) => {
      const enriched = league.getIRList(teamId);
      enriched.forEach(entry => {
        irPlayerSet.add(entry.playerId);
        irEligibility[entry.playerId] = entry;
      });
    });

    Object.entries(league.playerState).forEach(([playerId, state]) => {
      if (state && state.weeksOut > 0) {
        const playerInfo = league.findPlayer(playerId);
        if (!playerInfo) return;

        if (filter === 'my_team' && playerInfo.teamId !== userTeamId) return;

        const team = TEAMS.find(t => t.id === playerInfo.teamId);
        const isOnIR = irPlayerSet.has(playerId);
        const irInfo = irEligibility[playerId];
        injuredPlayers.push({
          id: playerId,
          name: playerInfo.name,
          position: playerInfo.position,
          overall: playerInfo.overall,
          age: playerInfo.age,
          teamId: playerInfo.teamId,
          teamName: team ? team.abbreviation : '???',
          teamColor: team?.colors?.primary || '#555',
          weeksOut: state.weeksOut,
          isUserTeam: playerInfo.teamId === userTeamId,
          isOnIR,
          irWeeksUntilEligible: irInfo ? irInfo.weeksUntilEligible : 0,
          irEligible: irInfo ? irInfo.eligible : false,
        });
      }
    });

    // Sort: user team first, then by weeks remaining desc
    injuredPlayers.sort((a, b) => {
      if (a.isUserTeam !== b.isUserTeam) return a.isUserTeam ? -1 : 1;
      return b.weeksOut - a.weeksOut;
    });

    setInjuries(injuredPlayers);
  };

  const getSeverityColor = (weeks) => {
    if (weeks >= 4) return '#d32f2f';
    if (weeks >= 2) return '#f57c00';
    return '#fdd835';
  };

  const getSeverityLabel = (weeks) => {
    if (weeks >= 4) return 'SERIOUS';
    if (weeks >= 2) return 'MODERATE';
    return 'MINOR';
  };

  const renderInjury = ({ item }) => (
    <View style={[styles.injuryRow, item.isUserTeam && styles.userTeamRow]}>
      <View style={[styles.teamBar, { backgroundColor: item.teamColor }]} />
      <View style={styles.playerSection}>
        <View style={styles.topRow}>
          <Text style={styles.playerName}>{item.name}</Text>
          {item.isOnIR && (
            <View style={[styles.severityBadge, { backgroundColor: '#b71c1c', marginRight: 6 }]}>
              <Text style={styles.severityText}>IR</Text>
            </View>
          )}
          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.weeksOut) }]}>
            <Text style={styles.severityText}>{getSeverityLabel(item.weeksOut)}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailText}>{item.position} | {item.overall} OVR</Text>
          <Text style={styles.teamText}>{item.teamName}</Text>
        </View>
        <View style={styles.timelineRow}>
          <Text style={styles.weeksText}>
            {item.isOnIR
              ? (item.irEligible
                ? 'IR - Eligible to activate'
                : `IR - ${item.irWeeksUntilEligible}w until eligible`)
              : `${item.weeksOut} week${item.weeksOut !== 1 ? 's' : ''} remaining`
            }
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min(100, (1 - item.weeksOut / 5) * 100)}%`,
              backgroundColor: getSeverityColor(item.weeksOut),
            }]} />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>INJURY REPORT</Text>
        <Text style={styles.subtitle}>{injuries.length} player{injuries.length !== 1 ? 's' : ''} injured</Text>
      </View>

      {/* Filter Toggle */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'my_team' && styles.filterBtnActive]}
          onPress={() => setFilter('my_team')}
        >
          <Text style={[styles.filterText, filter === 'my_team' && styles.filterTextActive]}>My Team</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All Teams</Text>
        </TouchableOpacity>
      </View>

      {injuries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏥</Text>
          <Text style={styles.emptyText}>No injuries to report!</Text>
          <Text style={styles.emptySubtext}>All players are healthy</Text>
        </View>
      ) : (
        <FlatList
          data={injuries}
          renderItem={renderInjury}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#161b22',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  filterBtnActive: {
    backgroundColor: '#0d2818',
    borderColor: '#3fb950',
  },
  filterText: {
    color: '#8b949e',
    fontWeight: '700',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#3fb950',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  injuryRow: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  userTeamRow: {
    borderWidth: 1,
    borderColor: '#30363d',
  },
  teamBar: {
    width: 5,
  },
  playerSection: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerName: {
    color: '#c9d1d9',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  severityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailText: {
    color: '#8b949e',
    fontSize: 12,
  },
  teamText: {
    color: '#58a6ff',
    fontSize: 12,
    fontWeight: '600',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weeksText: {
    color: '#c9d1d9',
    fontSize: 12,
    fontWeight: '600',
    width: 120,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#21262d',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#c9d1d9',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#8b949e',
    fontSize: 14,
    marginTop: 4,
  },
});
