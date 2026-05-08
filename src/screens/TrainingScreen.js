import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { StorageService } from '../services/StorageService';

export default function TrainingScreen({ route, navigation }) {
  const userTeamId = route.params?.userTeamId || league.userTeamId;
  const [selected, setSelected] = useState(league.getWeeklyTraining(userTeamId).focusId);
  const [message, setMessage] = useState('');
  const options = league.getTrainingOptions();
  const current = league.getWeeklyTraining(userTeamId);

  const handleSelect = async (focusId) => {
    const focus = league.setWeeklyTraining(userTeamId, focusId);
    setSelected(focus.focusId);
    setMessage(`${focus.name} set for Week ${league.currentWeek}.`);
    await StorageService.saveGame(league.getSaveData());
  };

  const renderEffect = (label, value) => {
    const formatted = value > 0 ? `+${value}` : `${value}`;
    const tone = value > 0 ? styles.effectPositive : value < 0 ? styles.effectRisk : styles.effectNeutral;
    return (
      <View style={styles.effectPill}>
        <Text style={styles.effectLabel}>{label}</Text>
        <Text style={[styles.effectValue, tone]}>{formatted}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>WEEKLY TRAINING</Text>
        <Text style={styles.subtitle}>Current: {current.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {message ? <Text style={styles.statusText}>{message}</Text> : null}

        <View style={styles.currentPanel}>
          <Text style={styles.panelLabel}>Active Focus</Text>
          <Text style={styles.currentName}>{current.name}</Text>
          <Text style={styles.currentSummary}>{current.summary}</Text>
        </View>

        {options.map(option => {
          const isSelected = selected === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionCard, isSelected && styles.selectedCard]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.8}
            >
              <View style={styles.optionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionName, isSelected && styles.selectedText]}>{option.name}</Text>
                  <Text style={styles.optionSummary}>{option.summary}</Text>
                </View>
                {isSelected && <Text style={styles.checkmark}>ACTIVE</Text>}
              </View>
              <View style={styles.effectRow}>
                {renderEffect('OFF', option.offenseBonus)}
                {renderEffect('DEF', option.defenseBonus)}
                {renderEffect('DEV', option.developmentBonus)}
                {renderEffect('INJ', option.injuryModifier)}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101820',
  },
  header: {
    padding: 16,
    paddingTop: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#263442',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 10,
    padding: 8,
  },
  backText: {
    color: '#7dd3fc',
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusText: {
    color: '#86efac',
    fontWeight: '800',
    marginBottom: 12,
  },
  currentPanel: {
    backgroundColor: '#172033',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2dd4bf',
  },
  panelLabel: {
    color: '#5eead4',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  currentName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  currentSummary: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 4,
  },
  optionCard: {
    backgroundColor: '#182330',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2b3a49',
  },
  selectedCard: {
    backgroundColor: '#102f2a',
    borderColor: '#2dd4bf',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionName: {
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '900',
  },
  selectedText: {
    color: '#5eead4',
  },
  optionSummary: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
  },
  checkmark: {
    color: '#5eead4',
    fontSize: 11,
    fontWeight: '900',
  },
  effectRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  effectPill: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  effectLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
  },
  effectValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  effectPositive: {
    color: '#86efac',
  },
  effectRisk: {
    color: '#fca5a5',
  },
  effectNeutral: {
    color: '#cbd5e1',
  },
});
