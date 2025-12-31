import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { TEAMS } from '../data/teams';
import { league } from '../engine/LeagueEngine';
import { StorageService } from '../services/StorageService';

export default function HomeScreen({ navigation }) {
  const [hasSave, setHasSave] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveInfo, setSaveInfo] = useState(null);

  useEffect(() => {
    checkForSave();
  }, []);

  const checkForSave = async () => {
    setLoading(true);
    const result = await StorageService.loadGame();
    if (result.success && result.data) {
      setHasSave(true);
      const team = TEAMS.find(t => t.id === result.data.userTeamId);
      setSaveInfo({
        teamName: team ? `${team.city} ${team.name}` : 'Unknown Team',
        week: result.data.currentWeek,
        phase: result.data.phase,
        season: result.data.season || 1,
      });
    } else {
      setHasSave(false);
      setSaveInfo(null);
    }
    setLoading(false);
  };

  const handleContinue = async () => {
    const result = await StorageService.loadGame();
    if (result.success) {
      league.loadSaveData(result.data);
      navigation.navigate('Season', { teamId: result.data.userTeamId });
    } else {
      Alert.alert('Error', 'Could not load save file');
    }
  };

  const handleNewGame = (teamId) => {
    if (hasSave) {
      Alert.alert(
        'Start New Game?',
        'This will overwrite your current save. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'New Game', 
            style: 'destructive',
            onPress: () => startNewGame(teamId)
          }
        ]
      );
    } else {
      startNewGame(teamId);
    }
  };

  const startNewGame = async (teamId) => {
    league.resetGame();
    league.userTeamId = teamId;
    league.generateSchedule();
    
    // Auto-save the new game
    await StorageService.saveGame(league.getSaveData());
    
    navigation.navigate('Season', { teamId });
  };

  const renderTeam = ({ item }) => (
    <TouchableOpacity 
      style={[styles.card, { borderLeftColor: item.colors.primary }]}
      onPress={() => handleNewGame(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.city}>{item.city}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NFL Manager 2026</Text>
        <Text style={styles.subtitle}>
          {hasSave ? 'Continue or Start New' : 'Select a Team to Manage'}
        </Text>
      </View>

      {/* Continue Game Section */}
      {hasSave && saveInfo && (
        <View style={styles.continueSection}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
            <View>
              <Text style={styles.continueBtnTitle}>▶ CONTINUE</Text>
              <Text style={styles.continueBtnInfo}>
                {saveInfo.teamName} • Season {saveInfo.season} • Week {saveInfo.week}
              </Text>
            </View>
            <Text style={styles.continueArrow}>→</Text>
          </TouchableOpacity>
          
          <Text style={styles.orText}>— OR START NEW —</Text>
        </View>
      )}

      <FlatList
        data={TEAMS}
        renderItem={renderTeam}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
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
  continueSection: {
    padding: 16,
    backgroundColor: '#e8f5e9',
  },
  continueBtn: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueBtnTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  continueBtnInfo: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 2,
  },
  continueArrow: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  orText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 6,
  },
  cardHeader: {
    flex: 1,
  },
  city: {
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
