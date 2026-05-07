import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

export default function FreeAgencyScreen({ route }) {
  const navigation = useNavigation();
  const userTeamId = route.params?.userTeamId || league.userTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const [freeAgents, setFreeAgents] = useState(league.getFreeAgents());
  const [positionFilter, setPositionFilter] = useState(null);
  const [roster, setRoster] = useState(league.rosters[userTeamId] || []);
  const [selectedFreeAgentId, setSelectedFreeAgentId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];

  const filteredAgents = positionFilter && positionFilter !== 'ALL' 
    ? freeAgents.filter(p => p.position === positionFilter)
    : freeAgents;

  const refreshFreeAgencyState = () => {
    setFreeAgents([...league.getFreeAgents()]);
    setRoster([...(league.rosters[userTeamId] || [])]);
  };

  const handleSignPlayer = async (player) => {
    if (!player) return;
    const signed = league.signFreeAgent(userTeamId, player.id);
    if (!signed) {
      setStatusMessage('Could not sign player.');
      return;
    }
    setSelectedFreeAgentId(null);
    refreshFreeAgencyState();
    setStatusMessage(`Signed ${signed.position} ${signed.name}.`);
    await StorageService.saveGame(league.getSaveData());
  };

  const handleCutPlayer = async (player) => {
    if (!player) return;
    const cut = league.cutPlayer(userTeamId, player.id);
    if (!cut) {
      setStatusMessage('Could not release player.');
      return;
    }
    refreshFreeAgencyState();
    setStatusMessage(`Released ${cut.position} ${cut.name}.`);
    await StorageService.saveGame(league.getSaveData());
  };

  const renderFreeAgent = ({ item }) => {
    const isSelected = selectedFreeAgentId === item.id;
    return (
      <TouchableOpacity
        style={[styles.playerRow, isSelected && styles.selectedPlayerRow]}
        onPress={() => setSelectedFreeAgentId(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{item.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{item.name}</Text>
          <Text style={styles.playerDetails}>Age: {item.age}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{item.overall}</Text>
        </View>
        <TouchableOpacity style={styles.signButton} onPress={() => handleSignPlayer(item)}>
          <Text style={styles.signBtn}>+ SIGN</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderRosterPlayer = ({ item }) => (
    <View style={styles.rosterRow}>
      <View style={[styles.positionBadge, styles.rosterPosition]}>
        <Text style={styles.positionText}>{item.position}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.rosterPlayerName}>{item.name}</Text>
      </View>
      <Text style={styles.rosterRating}>{item.overall}</Text>
      <TouchableOpacity style={styles.cutButton} onPress={() => handleCutPlayer(item)}>
        <Text style={styles.cutBtn}>CUT</Text>
      </TouchableOpacity>
    </View>
  );

  const selectedFreeAgent = freeAgents.find(p => p.id === selectedFreeAgentId);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Free Agency</Text>
          <Text style={styles.subtitle}>{userTeam?.name || 'Team'} • Roster: {roster.length}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Position Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {positions.map(pos => (
          <TouchableOpacity
            key={pos}
            style={[
              styles.filterBtn,
              (positionFilter === pos || (pos === 'ALL' && !positionFilter)) && styles.filterBtnActive
            ]}
            onPress={() => setPositionFilter(pos === 'ALL' ? null : pos)}
          >
            <Text style={[
              styles.filterText,
              (positionFilter === pos || (pos === 'ALL' && !positionFilter)) && styles.filterTextActive
            ]}>{pos}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.content}>
        {/* Free Agents List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Free Agents ({filteredAgents.length})</Text>
          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
          {selectedFreeAgent && (
            <View style={styles.selectionCard}>
              <Text style={styles.selectionLabel}>Selected Free Agent</Text>
              <Text style={styles.selectionName}>{selectedFreeAgent.position} {selectedFreeAgent.name}</Text>
              <Text style={styles.selectionMeta}>
                {selectedFreeAgent.overall} OVR | Age {selectedFreeAgent.age}
              </Text>
              <TouchableOpacity style={styles.selectionSignBtn} onPress={() => handleSignPlayer(selectedFreeAgent)}>
                <Text style={styles.selectionSignText}>SIGN PLAYER</Text>
              </TouchableOpacity>
            </View>
          )}
          {filteredAgents.length > 0 ? (
            <FlatList
              data={filteredAgents}
              keyExtractor={item => item.id}
              renderItem={renderFreeAgent}
              style={styles.list}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No free agents available</Text>
            </View>
          )}
        </View>

        {/* Your Roster */}
        <View style={styles.rosterSection}>
          <Text style={styles.sectionTitle}>Your Roster ({roster.length})</Text>
          <FlatList
            data={roster.sort((a, b) => b.overall - a.overall)}
            keyExtractor={item => item.id}
            renderItem={renderRosterPlayer}
            style={styles.rosterList}
          />
        </View>
      </View>
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
  backBtn: {
    padding: 8,
  },
  backText: {
    color: '#4fc3f7',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  filterScroll: {
    maxHeight: 50,
  },
  filterContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
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
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  section: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#222',
  },
  rosterSection: {
    width: '40%',
  },
  sectionTitle: {
    color: '#fdd835',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  list: {
    flex: 1,
  },
  rosterList: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  selectedPlayerRow: {
    backgroundColor: 'rgba(76, 195, 247, 0.14)',
    borderWidth: 1,
    borderColor: '#4fc3f7',
  },
  positionBadge: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
    width: 36,
    alignItems: 'center',
  },
  rosterPosition: {
    backgroundColor: '#333',
  },
  positionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  playerDetails: {
    color: '#888',
    fontSize: 11,
  },
  ratingBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  ratingText: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: 'bold',
  },
  signButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  signBtn: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  rosterPlayerName: {
    color: '#ccc',
    fontSize: 12,
  },
  rosterRating: {
    color: '#888',
    fontSize: 12,
    marginRight: 8,
  },
  cutButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cutBtn: {
    color: '#f44336',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#4fc3f7',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  selectionCard: {
    margin: 12,
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4fc3f7',
  },
  selectionLabel: {
    color: '#4fc3f7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  selectionName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  selectionMeta: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  selectionSignBtn: {
    backgroundColor: '#4caf50',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectionSignText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
});
