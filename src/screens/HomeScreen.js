import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { TEAMS } from '../data/teams';
import { league } from '../engine/LeagueEngine';
import { StorageService } from '../services/StorageService';

const PHASE_LABELS = {
  preseason: 'Preseason',
  regular: 'Regular Season',
  playoffs: 'Playoffs',
  offseason: 'Offseason',
};

function formatLastSaved(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function HomeScreen({ navigation }) {
  const [slots, setSlots] = useState({ 1: null, 2: null, 3: null });
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('slot_select'); // 'slot_select' | 'team_select'
  const [targetSlot, setTargetSlot] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const refreshIndex = useCallback(async () => {
    setLoading(true);
    const index = await StorageService.getSlotIndex();
    setSlots(index.slots);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshIndex();
  }, [refreshIndex]);

  // --- Slot select actions ---

  const handleContinue = async (slotId) => {
    const result = await StorageService.loadSlot(slotId);
    if (result.success) {
      league.loadSaveData(result.data);
      league.slotId = slotId;
      navigation.navigate('Season', { teamId: result.data.userTeamId });
    } else {
      setStatusMessage('Could not load save file.');
    }
  };

  const handleStartNew = (slotId) => {
    const existing = slots[slotId];
    if (existing) {
      const key = `overwrite-${slotId}`;
      if (confirmAction !== key) {
        setConfirmAction(key);
        setStatusMessage(`Tap New Franchise again to overwrite ${existing.teamName}.`);
        return;
      }
      setConfirmAction(null);
      setStatusMessage('');
      setTargetSlot(slotId);
      setPhase('team_select');
    } else {
      setTargetSlot(slotId);
      setPhase('team_select');
    }
  };

  const deleteSlot = async (slotId) => {
    const result = await StorageService.deleteSlot(slotId);
    if (result.success) {
      if (league.slotId === slotId) {
        league.resetGame();
      }
      refreshIndex();
    } else {
      setStatusMessage('Could not delete save slot.');
    }
  };

  const handleDeleteSlot = (slotId) => {
    const existing = slots[slotId];
    if (!existing) return;
    const key = `delete-${slotId}`;
    if (confirmAction !== key) {
      setConfirmAction(key);
      setStatusMessage(`Tap delete again to remove ${existing.teamName}.`);
      return;
    }
    setConfirmAction(null);
    setStatusMessage('');
    deleteSlot(slotId);
  };

  // --- Team select actions ---

  const handlePickTeam = async (teamId) => {
    league.resetGame();
    league.userTeamId = teamId;
    league.slotId = targetSlot;
    league.generateSchedule();
    await StorageService.saveCurrentGame();
    navigation.navigate('Season', { teamId });
  };

  const handleBackToSlots = () => {
    setTargetSlot(null);
    setPhase('slot_select');
  };

  // --- Render helpers ---

  const renderSlotCard = (slotId) => {
    const data = slots[slotId];
    const team = data ? TEAMS.find(t => t.id === data.teamId) : null;
    const borderColor = team ? team.colors.primary : '#ccc';

    if (data) {
      return (
        <View key={slotId} style={[styles.slotCard, { borderLeftColor: borderColor }]}>
          <View style={styles.slotCardHeader}>
            <View style={styles.slotCardInfo}>
              <Text style={styles.slotNumber}>Slot {slotId}</Text>
              <Text style={styles.slotTeamName}>{data.teamName}</Text>
              <Text style={styles.slotMeta}>
                Season {data.season} • Week {data.currentWeek} • {PHASE_LABELS[data.phase] || data.phase}
              </Text>
              <Text style={styles.slotSaved}>Saved {formatLastSaved(data.lastSaved)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.deleteBtn, confirmAction === `delete-${slotId}` && styles.deleteBtnConfirm]}
              onPress={() => handleDeleteSlot(slotId)}
            >
              <Text style={styles.deleteBtnText}>{confirmAction === `delete-${slotId}` ? 'DELETE' : '✕'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.slotCardActions}>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={() => handleContinue(slotId)}
            >
              <Text style={styles.continueBtnText}>▶ CONTINUE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.newFranchiseSmallBtn,
                confirmAction === `overwrite-${slotId}` && styles.overwriteConfirmBtn
              ]}
              onPress={() => handleStartNew(slotId)}
            >
              <Text style={styles.newFranchiseSmallText}>
                {confirmAction === `overwrite-${slotId}` ? 'Confirm Overwrite' : 'New Franchise'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View key={slotId} style={styles.emptySlotCard}>
        <Text style={styles.slotNumber}>Slot {slotId}</Text>
        <Text style={styles.emptySlotLabel}>EMPTY SLOT</Text>
        <TouchableOpacity
          style={styles.newFranchiseBtn}
          onPress={() => handleStartNew(slotId)}
        >
          <Text style={styles.newFranchiseBtnText}>+ Start New Franchise</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTeam = ({ item }) => (
    <TouchableOpacity
      style={[styles.teamCard, { borderLeftColor: item.colors.primary }]}
      onPress={() => handlePickTeam(item.id)}
    >
      <View style={styles.teamCardHeader}>
        <Text style={styles.teamCity}>{item.city}</Text>
        <Text style={styles.teamName}>{item.name}</Text>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.statBadge}>
          <Text style={styles.statLabel}>OVR</Text>
          <Text style={styles.statValue}>{item.ratings.overall}</Text>
        </View>
        <View style={styles.statBadge}>
          <Text style={styles.statLabel}>OFF</Text>
          <Text style={styles.statValue}>{item.ratings.offense}</Text>
        </View>
        <View style={styles.statBadge}>
          <Text style={styles.statLabel}>DEF</Text>
          <Text style={styles.statValue}>{item.ratings.defense}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Team select phase ---
  if (phase === 'team_select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToSlots} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select a Team</Text>
          <Text style={styles.subtitle}>Starting new franchise in Slot {targetSlot}</Text>
        </View>
        <FlatList
          data={TEAMS}
          renderItem={renderTeam}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    );
  }

  // --- Slot select phase ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NFL Manager 2026</Text>
        <Text style={styles.subtitle}>Select a save slot</Text>
      </View>
      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
      <ScrollView contentContainerStyle={styles.slotsContainer}>
        {[1, 2, 3].map(renderSlotCard)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  backBtn: {
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '600',
  },
  slotsContainer: {
    padding: 16,
    gap: 12,
  },
  // Filled slot card
  slotCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 6,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.10)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  slotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  slotCardInfo: {
    flex: 1,
  },
  slotNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  slotTeamName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  slotMeta: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  slotSaved: {
    fontSize: 12,
    color: '#999',
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 8,
  },
  deleteBtnConfirm: {
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 16,
    color: '#e53935',
    fontWeight: 'bold',
  },
  slotCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  continueBtn: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  newFranchiseSmallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  overwriteConfirmBtn: {
    borderColor: '#e53935',
    backgroundColor: '#ffebee',
  },
  statusText: {
    color: '#e53935',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  newFranchiseSmallText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  // Empty slot card
  emptySlotCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptySlotLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#bbb',
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 16,
  },
  newFranchiseBtn: {
    backgroundColor: '#1976d2',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  newFranchiseBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Team select
  list: {
    padding: 16,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.10)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
    borderLeftWidth: 6,
  },
  teamCardHeader: {
    flex: 1,
  },
  teamCity: {
    fontSize: 14,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    minWidth: 40,
  },
  statLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});
