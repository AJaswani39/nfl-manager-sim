import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StorageService } from '../services/StorageService';
import { league } from '../engine/LeagueEngine';

export default function SettingsScreen({ route }) {
  const navigation = useNavigation();
  const { userTeamId } = route.params;
  
  const [autoSave, setAutoSave] = useState(true);
  const [showInjuries, setShowInjuries] = useState(true);
  const [simSpeed, setSimSpeed] = useState('normal');

  const handleDeleteSave = () => {
    Alert.alert(
      'Delete Franchise?',
      'This will delete your current franchise save and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteSave();
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          }
        }
      ]
    );
  };

  const handleResetGame = () => {
    Alert.alert(
      'Reset Game',
      'This will reset the entire game to Week 1. Your current progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            league.resetGame();
            league.generateSchedule();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }
      ]
    );
  };

  const renderToggle = (label, description, value, onToggle) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: '#4caf50' }}
        thumbColor={value ? '#fff' : '#888'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Game Settings */}
        <Text style={styles.sectionTitle}>⚙️ Game Settings</Text>
        
        {renderToggle(
          'Auto-Save',
          'Automatically save after each game',
          autoSave,
          setAutoSave
        )}
        
        {renderToggle(
          'Show Injuries',
          'Display injury indicators on players',
          showInjuries,
          setShowInjuries
        )}

        {/* Sim Speed */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Simulation Speed</Text>
            <Text style={styles.settingDesc}>Speed of Quick Sim results</Text>
          </View>
          <View style={styles.speedOptions}>
            {['slow', 'normal', 'fast'].map(speed => (
              <TouchableOpacity
                key={speed}
                style={[styles.speedBtn, simSpeed === speed && styles.speedBtnActive]}
                onPress={() => setSimSpeed(speed)}
              >
                <Text style={[styles.speedText, simSpeed === speed && styles.speedTextActive]}>
                  {speed.charAt(0).toUpperCase() + speed.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info */}
        <Text style={styles.sectionTitle}>📊 Game Info</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Season</Text>
            <Text style={styles.infoValue}>{league.season || 1}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Week</Text>
            <Text style={styles.infoValue}>{league.currentWeek}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Team</Text>
            <Text style={styles.infoValue}>{userTeamId || 'None'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Championships</Text>
            <Text style={styles.infoValue}>{league.getUserChampionships()}</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionTitle}>⚠️ Danger Zone</Text>
        
        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteSave}>
          <Text style={styles.dangerBtnText}>🗑️ Delete Save Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.dangerBtn, styles.dangerResetBtn]} onPress={handleResetGame}>
          <Text style={styles.dangerBtnText}>🔄 Reset Entire Game</Text>
        </TouchableOpacity>

        {/* Credits */}
        <View style={styles.credits}>
          <Text style={styles.creditsTitle}>NFL Manager</Text>
          <Text style={styles.creditsText}>Built with React Native</Text>
          <Text style={styles.creditsVersion}>v1.0.0</Text>
        </View>
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
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  speedOptions: {
    flexDirection: 'row',
    gap: 4,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  speedBtnActive: {
    backgroundColor: '#1976d2',
  },
  speedText: {
    color: '#888',
    fontSize: 11,
  },
  speedTextActive: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#2a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  dangerResetBtn: {
    borderColor: '#ff9800',
    backgroundColor: '#2a2a1a',
  },
  dangerBtnText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '600',
  },
  credits: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  creditsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  creditsText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  creditsVersion: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
  },
});
