import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

export default function CoachScreen({ route }) {
  const navigation = useNavigation();
  const userTeamId = route.params?.userTeamId || league.userTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const [currentCoach, setCurrentCoach] = useState(league.getCoach(userTeamId));
  const [statusMessage, setStatusMessage] = useState('');
  const coachTypes = league.getCoachTypes();

  const handleSelectCoach = async (coach) => {
    league.setCoach(userTeamId, coach.id);
    setCurrentCoach(league.getCoach(userTeamId));
    setStatusMessage(`Hired ${coach.name}.`);
    await StorageService.saveGame(league.getSaveData());
  };

  const renderBonusItem = (label, value) => {
    const color = value > 0 ? '#4caf50' : value < 0 ? '#f44336' : '#888';
    const prefix = value > 0 ? '+' : '';
    return (
      <View style={styles.bonusItem}>
        <Text style={styles.bonusLabel}>{label}</Text>
        <Text style={[styles.bonusValue, {color}]}>{prefix}{value}</Text>
      </View>
    );
  };

  const renderCoachCard = (coach) => {
    const isSelected = currentCoach?.id === coach.id;
    
    return (
      <TouchableOpacity 
        key={coach.id}
        style={[styles.coachCard, isSelected && styles.selectedCoach]}
        onPress={() => !isSelected && handleSelectCoach(coach)}
        disabled={isSelected}
      >
        <Text style={styles.coachIcon}>{coach.icon}</Text>
        <View style={styles.coachInfo}>
          <Text style={styles.coachName}>{coach.name}</Text>
          <Text style={styles.coachDesc}>{coach.description}</Text>
          
          <View style={styles.bonusRow}>
            {renderBonusItem('OFF', coach.bonuses.offense)}
            {renderBonusItem('DEF', coach.bonuses.defense)}
            {renderBonusItem('DEV', coach.bonuses.developmentBonus)}
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>CURRENT</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Coaching Staff</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Coach */}
        <View style={styles.currentSection}>
          <Text style={styles.teamName}>{userTeam?.city} {userTeam?.name}</Text>
          <View style={styles.currentCoachBox}>
            <Text style={styles.currentIcon}>{currentCoach?.icon || '👤'}</Text>
            <Text style={styles.currentTitle}>{currentCoach?.name || 'No Coach'}</Text>
            <Text style={styles.currentDesc}>{currentCoach?.description}</Text>
          </View>
        </View>

        {/* Coach Selection */}
        <Text style={styles.sectionTitle}>Available Coaching Styles</Text>
        <Text style={styles.sectionSubtitle}>
          Coach bonuses affect your team's performance during games
        </Text>
        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        {coachTypes.map(coach => renderCoachCard(coach))}

        {/* Bonus Explanation */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Bonus Legend</Text>
          <Text style={styles.legendItem}>• <Text style={{fontWeight: 'bold'}}>OFF</Text> - Offense rating adjustment</Text>
          <Text style={styles.legendItem}>• <Text style={{fontWeight: 'bold'}}>DEF</Text> - Defense rating adjustment</Text>
          <Text style={styles.legendItem}>• <Text style={{fontWeight: 'bold'}}>DEV</Text> - Player development bonus per season</Text>
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
  currentSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  teamName: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  currentCoachBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: '#fdd835',
  },
  currentIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  currentTitle: {
    color: '#fdd835',
    fontSize: 22,
    fontWeight: 'bold',
  },
  currentDesc: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
  },
  statusText: {
    color: '#4fc3f7',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCoach: {
    borderColor: '#4caf50',
    backgroundColor: '#1a2a1a',
  },
  coachIcon: {
    fontSize: 36,
    marginRight: 16,
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  coachDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  bonusRow: {
    flexDirection: 'row',
    gap: 16,
  },
  bonusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bonusLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
  bonusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  currentBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  legendCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  legendTitle: {
    color: '#fdd835',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendItem: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
});
