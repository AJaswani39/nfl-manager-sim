import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

export default function ContractScreen({ route, navigation }) {
  const userTeamId = route.params?.userTeamId || league.userTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  const [roster, setRoster] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'expiring' | 'extended'
  const [statusMessage, setStatusMessage] = useState('');

  const loadRoster = useCallback(() => {
    const players = (league.rosters[userTeamId] || []).map(p => ({
      ...p,
      contract: league.getPlayerSalary(p.id),
      extensionCost: league.calculateExtensionCost(p),
    }));
    players.sort((a, b) => a.contract.years - b.contract.years || b.overall - a.overall);
    setRoster(players);
  }, [userTeamId]);

  useEffect(() => {
    loadRoster();
    const unsubscribe = navigation.addListener('focus', loadRoster);
    return unsubscribe;
  }, [loadRoster, navigation]);

  const handleExtend = async (player) => {
    const cost = player.extensionCost;
    const capSpace = league.getCapSpace(userTeamId);

    if (cost > capSpace + player.contract.amount) {
      setStatusMessage(`Not enough cap space. Need $${cost}M, available $${capSpace}M.`);
      return;
    }

    league.extendContract(userTeamId, player.id, 3, cost);
    setStatusMessage(`Extended ${player.name} for 3 years at $${cost}M/year.`);
    await StorageService.saveCurrentGame();
    loadRoster();
  };

  const getYearsColor = (years) => {
    if (years <= 0) return '#f85149';
    if (years === 1) return '#f57c00';
    if (years === 2) return '#fdd835';
    return '#3fb950';
  };

  const getYearsLabel = (years) => {
    if (years <= 0) return 'EXPIRED';
    return `${years}yr`;
  };

  const filteredRoster = roster.filter(p => {
    if (filter === 'expiring') return p.contract.years <= 1;
    if (filter === 'extended') return p.contract.years >= 3;
    return true;
  });

  const capInfo = league.getTeamCap(userTeamId);

  const renderPlayer = ({ item }) => {
    const yearsColor = getYearsColor(item.contract.years);
    const isExpiring = item.contract.years <= 1;

    return (
      <View style={[styles.playerRow, isExpiring && styles.expiringRow]}>
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName}>{item.name}</Text>
            {isExpiring && <View style={styles.warningDot} />}
          </View>
          <Text style={styles.playerDetails}>
            {item.position} | {item.overall} OVR | Age {item.age}
          </Text>
        </View>
        <View style={styles.contractInfo}>
          <Text style={styles.salaryText}>${item.contract.amount}M</Text>
          <Text style={[styles.yearsText, { color: yearsColor }]}>
            {getYearsLabel(item.contract.years)}
          </Text>
        </View>
        {isExpiring && (
          <TouchableOpacity style={styles.extendBtn} onPress={() => handleExtend(item)}>
            <Text style={styles.extendBtnText}>EXTEND</Text>
            <Text style={styles.extendCost}>${item.extensionCost}M</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CONTRACTS</Text>
        <Text style={styles.subtitle}>{userTeam?.city} {userTeam?.name}</Text>
      </View>

      {/* Cap Info */}
      <View style={styles.capBar}>
        <View style={styles.capItem}>
          <Text style={styles.capLabel}>SALARY CAP</Text>
          <Text style={styles.capValue}>${capInfo.cap}M</Text>
        </View>
        <View style={styles.capItem}>
          <Text style={styles.capLabel}>SPENT</Text>
          <Text style={[styles.capValue, { color: '#f85149' }]}>${capInfo.spent}M</Text>
        </View>
        <View style={styles.capItem}>
          <Text style={styles.capLabel}>SPACE</Text>
          <Text style={[styles.capValue, { color: '#3fb950' }]}>${capInfo.cap - capInfo.spent}M</Text>
        </View>
      </View>
      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

      {/* Filter */}
      <View style={styles.filterRow}>
        {[
          { id: 'all', label: 'All' },
          { id: 'expiring', label: 'Expiring' },
          { id: 'extended', label: 'Locked Up' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredRoster}
        renderItem={renderPlayer}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No players match this filter</Text>
          </View>
        }
      />
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
  capBar: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  capItem: {
    flex: 1,
    alignItems: 'center',
  },
  capLabel: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  capValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  statusText: {
    color: '#58a6ff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  filterBtn: {
    flex: 1,
    padding: 8,
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
    fontSize: 13,
  },
  filterTextActive: {
    color: '#3fb950',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  expiringRow: {
    borderWidth: 1,
    borderColor: '#f57c00',
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    color: '#c9d1d9',
    fontSize: 15,
    fontWeight: '700',
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f57c00',
  },
  playerDetails: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  contractInfo: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  salaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  yearsText: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  extendBtn: {
    backgroundColor: '#238636',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  extendBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  extendCost: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 14,
  },
});
