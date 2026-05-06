import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { StorageService } from '../services/StorageService';

const OFFENSE_OPTIONS = [
  {
    id: 'run_heavy',
    name: 'Run Heavy',
    icon: '🏈',
    description: 'Pound the rock. High run rate with play-action mixed in.',
    detail: 'Run 52% | Short 18% | Deep 7% | PA 12%',
    strength: 'Controls clock, wears down defense',
    weakness: 'Predictable against stacked boxes',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: '⚖️',
    description: 'Even mix of run and pass. Hard to predict.',
    detail: 'Run 34% | Short 25% | Deep 14% | PA 11%',
    strength: 'Versatile, no exploitable tendency',
    weakness: 'Doesn\'t dominate in any area',
  },
  {
    id: 'pass_heavy',
    name: 'Pass Heavy',
    icon: '🎯',
    description: 'Air it out. High volume passing attack.',
    detail: 'Run 14% | Short 30% | Deep 24% | PA 12%',
    strength: 'Explosive scoring, big plays',
    weakness: 'Vulnerable to blitz packages',
  },
  {
    id: 'spread',
    name: 'Spread',
    icon: '🌐',
    description: 'Spread the field with screens, draws, and misdirection.',
    detail: 'Run 17% | Short 24% | Deep 15% | Screen 19% | Draw 14%',
    strength: 'Beats blitz-heavy defenses',
    weakness: 'Less effective in short yardage',
  },
];

const DEFENSE_OPTIONS = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    icon: '🔥',
    description: 'Pressure the QB with frequent blitzes and tight coverage.',
    detail: 'Run Def 26% | Coverage 32% | Blitz 42%',
    strength: 'Forces turnovers, disrupts passing',
    weakness: 'Gives up big plays if beaten',
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: '⚖️',
    description: 'Solid against both run and pass.',
    detail: 'Run Def 34% | Coverage 42% | Blitz 24%',
    strength: 'No exploitable weakness',
    weakness: 'Doesn\'t dominate in any area',
  },
  {
    id: 'conservative',
    name: 'Conservative',
    icon: '🛡️',
    description: 'Bend but don\'t break. Prevent big plays.',
    detail: 'Run Def 32% | Coverage 56% | Blitz 12%',
    strength: 'Prevents deep passes, stops the run',
    weakness: 'Allows short completions, slow drives',
  },
  {
    id: 'blitz_heavy',
    name: 'Blitz Heavy',
    icon: '⚡',
    description: 'All-out pressure. Send everyone after the QB.',
    detail: 'Run Def 18% | Coverage 25% | Blitz 57%',
    strength: 'Sacks, turnovers, disruption',
    weakness: 'Exploited by screens and spread offenses',
  },
];

export default function GamePlanScreen({ route, navigation }) {
  const { userTeamId } = route.params;
  const currentPlan = league.getGamePlan(userTeamId);
  const [offense, setOffense] = useState(currentPlan.offense);
  const [defense, setDefense] = useState(currentPlan.defense);

  const handleSelectOffense = async (id) => {
    setOffense(id);
    league.setGamePlan(userTeamId, id, defense);
    await StorageService.saveGame(league.getSaveData());
  };

  const handleSelectDefense = async (id) => {
    setDefense(id);
    league.setGamePlan(userTeamId, offense, id);
    await StorageService.saveGame(league.getSaveData());
  };

  const renderOption = (option, isSelected, onSelect) => (
    <TouchableOpacity
      key={option.id}
      style={[styles.optionCard, isSelected && styles.selectedCard]}
      onPress={() => onSelect(option.id)}
    >
      <View style={styles.optionHeader}>
        <Text style={styles.optionIcon}>{option.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionName, isSelected && styles.selectedText]}>
            {option.name}
          </Text>
          <Text style={styles.optionDesc}>{option.description}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.optionDetail}>{option.detail}</Text>
      <View style={styles.tradeoffRow}>
        <Text style={styles.strengthText}>+ {option.strength}</Text>
        <Text style={styles.weaknessText}>- {option.weakness}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>GAME PLAN</Text>
        <Text style={styles.subtitle}>Set your team's strategy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>OFFENSIVE SCHEME</Text>
        {OFFENSE_OPTIONS.map(opt => renderOption(opt, offense === opt.id, handleSelectOffense))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>DEFENSIVE SCHEME</Text>
        {DEFENSE_OPTIONS.map(opt => renderOption(opt, defense === opt.id, handleSelectDefense))}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#fdd835',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#21262d',
  },
  selectedCard: {
    borderColor: '#3fb950',
    backgroundColor: '#0d2818',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionName: {
    color: '#c9d1d9',
    fontSize: 17,
    fontWeight: '800',
  },
  selectedText: {
    color: '#3fb950',
  },
  optionDesc: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    color: '#3fb950',
    fontSize: 22,
    fontWeight: '900',
  },
  optionDetail: {
    color: '#58a6ff',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    paddingLeft: 38,
  },
  tradeoffRow: {
    paddingLeft: 38,
    gap: 2,
  },
  strengthText: {
    color: '#3fb950',
    fontSize: 11,
  },
  weaknessText: {
    color: '#f85149',
    fontSize: 11,
  },
});
