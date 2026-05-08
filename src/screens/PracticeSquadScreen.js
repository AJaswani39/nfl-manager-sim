import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

const TABS = ['PRACTICE SQUAD', 'INJURED RESERVE', 'ACTIVE ROSTER'];

export default function PracticeSquadScreen({ route }) {
  const navigation = useNavigation();
  const userTeamId = route.params?.userTeamId || league.userTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);

  const [activeTab, setActiveTab] = useState(0);
  const [practiceSquad, setPracticeSquad] = useState(league.getPracticeSquad(userTeamId));
  const [irList, setIRList] = useState(league.getIRList(userTeamId));
  const [roster, setRoster] = useState(league.rosters[userTeamId] || []);
  const [statusMessage, setStatusMessage] = useState('');

  const refreshData = useCallback(() => {
    setPracticeSquad([...league.getPracticeSquad(userTeamId)]);
    setIRList([...league.getIRList(userTeamId)]);
    setRoster([...(league.rosters[userTeamId] || [])]);
  }, [userTeamId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshData);
    return unsubscribe;
  }, [navigation, refreshData]);

  const handlePromote = async (player) => {
    const result = league.promoteFromPracticeSquad(userTeamId, player.id);
    if (!result) {
      setStatusMessage('Could not promote player.');
      return;
    }
    refreshData();
    setStatusMessage(`Promoted ${result.position} ${result.name}.`);
    await StorageService.saveCurrentGame();
  };

  const handleDemote = async (player) => {
    const result = league.demoteToPracticeSquad(userTeamId, player.id);
    if (!result) {
      setStatusMessage('Could not demote player. Practice squad may be full.');
      return;
    }
    refreshData();
    setStatusMessage(`Demoted ${result.position} ${result.name}.`);
    await StorageService.saveCurrentGame();
  };

  const handlePlaceOnIR = async (player) => {
    const state = league.playerState[player.id];
    if (!state || state.weeksOut <= 0) {
      setStatusMessage('Player must be injured to be placed on IR.');
      return;
    }
    const result = league.placeOnIR(userTeamId, player.id);
    if (!result) {
      setStatusMessage('Could not place player on IR.');
      return;
    }
    refreshData();
    setStatusMessage(`Placed ${result.position} ${result.name} on IR.`);
    await StorageService.saveCurrentGame();
  };

  const handleActivateFromIR = async (entry) => {
    if (!entry.eligible) {
      setStatusMessage(`${entry.player.name} cannot be activated yet. ${entry.weeksUntilEligible} week${entry.weeksUntilEligible !== 1 ? 's' : ''} remaining.`);
      return;
    }
    const result = league.activateFromIR(userTeamId, entry.playerId);
    if (!result) {
      setStatusMessage('Could not activate player from IR.');
      return;
    }
    refreshData();
    setStatusMessage(`Activated ${result.position} ${result.name}.`);
    await StorageService.saveCurrentGame();
  };

  const getSeverityColor = (weeksOut) => {
    if (weeksOut >= 4) return '#f44336';
    if (weeksOut >= 2) return '#ff9800';
    return '#fdd835';
  };

  const getSeverityLabel = (weeksOut) => {
    if (weeksOut >= 4) return 'SERIOUS';
    if (weeksOut >= 2) return 'MODERATE';
    return 'MINOR';
  };

  const renderPSPlayer = ({ item }) => (
    <View style={styles.playerRow}>
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
      <TouchableOpacity style={styles.actionBtn} onPress={() => handlePromote(item)}>
        <Text style={styles.promoteText}>PROMOTE</Text>
      </TouchableOpacity>
    </View>
  );

  const renderIRPlayer = ({ item }) => {
    const injuryState = league.playerState[item.playerId];
    const weeksOut = injuryState ? injuryState.weeksOut : 0;
    return (
      <View style={styles.playerRow}>
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{item.player.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{item.player.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[styles.irBadge, { backgroundColor: '#b71c1c' }]}>
              <Text style={styles.irBadgeText}>IR</Text>
            </View>
            {weeksOut > 0 && (
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(weeksOut) + '33' }]}>
                <Text style={[styles.severityText, { color: getSeverityColor(weeksOut) }]}>
                  {getSeverityLabel(weeksOut)} ({weeksOut}w)
                </Text>
              </View>
            )}
            <Text style={styles.playerDetails}>
              Week {item.weeksOnIR} of {item.minWeeks} min
            </Text>
          </View>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{item.player.overall}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, !item.eligible && styles.actionBtnDisabled]}
          onPress={() => handleActivateFromIR(item)}
        >
          <Text style={[styles.activateText, !item.eligible && styles.actionTextDisabled]}>
            {item.eligible ? 'ACTIVATE' : `${item.weeksUntilEligible}w LEFT`}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRosterPlayer = ({ item }) => {
    const injuryState = league.playerState[item.id];
    const isInjured = injuryState && injuryState.weeksOut > 0;
    return (
      <View style={styles.playerRow}>
        <View style={[styles.positionBadge, isInjured && { backgroundColor: '#b71c1c' }]}>
          <Text style={styles.positionText}>{item.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={styles.playerDetails}>Age: {item.age} • OVR: {item.overall}</Text>
            {isInjured && (
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(injuryState.weeksOut) + '33' }]}>
                <Text style={[styles.severityText, { color: getSeverityColor(injuryState.weeksOut) }]}>
                  INJURED ({injuryState.weeksOut}w)
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDemote(item)}>
            <Text style={styles.demoteText}>DEMOTE</Text>
          </TouchableOpacity>
          {isInjured && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handlePlaceOnIR(item)}>
              <Text style={styles.irActionText}>TO IR</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const sortedRoster = [...roster].sort((a, b) => b.overall - a.overall);
  const sortedPS = [...practiceSquad].sort((a, b) => b.overall - a.overall);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Practice Squad / IR</Text>
          <Text style={styles.subtitle}>
            {userTeam?.name || 'Team'} • Roster: {roster.length} • PS: {practiceSquad.length} • IR: {irList.length}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContainer}
      >
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === index && styles.tabBtnActive]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
              {tab}
              {index === 0 && ` (${practiceSquad.length})`}
              {index === 1 && ` (${irList.length})`}
              {index === 2 && ` (${roster.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <View style={styles.content}>
        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        {activeTab === 0 && (
          <>
            <Text style={styles.sectionTitle}>Practice Squad ({practiceSquad.length}/16)</Text>
            {sortedPS.length > 0 ? (
              <FlatList
                data={sortedPS}
                keyExtractor={item => item.id}
                renderItem={renderPSPlayer}
                style={styles.list}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No players on practice squad</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 1 && (
          <>
            <Text style={styles.sectionTitle}>Injured Reserve ({irList.length})</Text>
            {irList.length > 0 ? (
              <FlatList
                data={irList}
                keyExtractor={item => item.playerId}
                renderItem={renderIRPlayer}
                style={styles.list}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No players on Injured Reserve</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 2 && (
          <>
            <Text style={styles.sectionTitle}>Active Roster ({roster.length})</Text>
            <FlatList
              data={sortedRoster}
              keyExtractor={item => item.id}
              renderItem={renderRosterPlayer}
              style={styles.list}
            />
          </>
        )}
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
  tabScroll: {
    maxHeight: 50,
  },
  tabContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 6,
  },
  tabBtnActive: {
    backgroundColor: '#ff7043',
  },
  tabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    color: '#fdd835',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  statusText: {
    color: '#4fc3f7',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  list: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionTextDisabled: {
    color: '#666',
  },
  promoteText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: 'bold',
  },
  demoteText: {
    color: '#ff9800',
    fontSize: 11,
    fontWeight: 'bold',
  },
  activateText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: 'bold',
  },
  irActionText: {
    color: '#f44336',
    fontSize: 11,
    fontWeight: 'bold',
  },
  irBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  irBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  severityText: {
    fontSize: 9,
    fontWeight: 'bold',
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
