import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function ScheduleScreen({ route }) {
  const navigation = useNavigation();
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const [filter, setFilter] = useState('all'); // all, home, away

  // Get all matches involving user team
  const getAllUserMatches = () => {
    const matches = [];
    league.weeks.forEach((weekMatches, weekIndex) => {
      weekMatches.forEach(match => {
        if (match.home.id === userTeamId || match.away.id === userTeamId) {
          matches.push({
            ...match,
            week: weekIndex + 1,
            isHome: match.home.id === userTeamId,
          });
        }
      });
    });
    return matches;
  };

  const allMatches = getAllUserMatches();
  
  const filteredMatches = allMatches.filter(match => {
    if (filter === 'home') return match.isHome;
    if (filter === 'away') return !match.isHome;
    return true;
  });

  // Calculate record
  const record = allMatches.reduce((acc, m) => {
    if (!m.result) return acc;
    const userScore = m.isHome ? m.result.homeScore : m.result.awayScore;
    const oppScore = m.isHome ? m.result.awayScore : m.result.homeScore;
    if (userScore > oppScore) acc.wins++;
    else acc.losses++;
    return acc;
  }, { wins: 0, losses: 0 });

  const renderMatch = ({ item }) => {
    const opponent = item.isHome ? item.away : item.home;
    const oppTeam = TEAMS.find(t => t.id === opponent.id);
    
    // Determine result
    let resultText = '';
    let resultColor = '#888';
    let isWin = false;
    
    if (item.result) {
      const userScore = item.isHome ? item.result.homeScore : item.result.awayScore;
      const oppScore = item.isHome ? item.result.awayScore : item.result.homeScore;
      isWin = userScore > oppScore;
      resultText = `${isWin ? 'W' : 'L'} ${userScore}-${oppScore}`;
      resultColor = isWin ? '#4caf50' : '#f44336';
    }

    const isCurrent = item.week === league.currentWeek && !item.played;

    return (
      <View style={[styles.matchRow, isCurrent && styles.currentMatchRow]}>
        <View style={styles.weekBox}>
          <Text style={styles.weekNum}>WK {item.week}</Text>
          {item.week <= 3 && <Text style={styles.weekType}>PRE</Text>}
        </View>
        
        <View style={styles.matchInfo}>
          <Text style={styles.homeAway}>{item.isHome ? 'vs' : '@'}</Text>
          <View style={[styles.teamDot, { backgroundColor: oppTeam?.colors?.primary || '#666' }]} />
          <Text style={styles.oppName}>{oppTeam?.abbreviation || opponent.id}</Text>
          <Text style={styles.oppRating}>{opponent.ratings?.overall || '?'} OVR</Text>
        </View>

        <View style={styles.resultBox}>
          {item.result ? (
            <Text style={[styles.resultText, { color: resultColor }]}>{resultText}</Text>
          ) : isCurrent ? (
            <View style={styles.upcomingBadge}>
              <Text style={styles.upcomingText}>NEXT</Text>
            </View>
          ) : (
            <Text style={styles.pendingText}>--</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Schedule</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Team Info */}
      <View style={styles.teamHeader}>
        <Text style={styles.teamName}>{userTeam?.city} {userTeam?.name}</Text>
        <Text style={styles.recordText}>{record.wins}-{record.losses}</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['all', 'home', 'away'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All Games' : f === 'home' ? 'Home' : 'Away'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Schedule Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4caf50' }]} />
          <Text style={styles.legendText}>Win</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f44336' }]} />
          <Text style={styles.legendText}>Loss</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#fdd835' }]} />
          <Text style={styles.legendText}>Next Game</Text>
        </View>
      </View>

      {/* Schedule List */}
      <FlatList
        data={filteredMatches}
        keyExtractor={(item, index) => `match-${item.week}-${index}`}
        renderItem={renderMatch}
        contentContainerStyle={styles.listContent}
      />
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
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordText: {
    color: '#4fc3f7',
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  filterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4fc3f7',
  },
  filterTabText: {
    color: '#888',
    fontSize: 14,
  },
  filterTabTextActive: {
    color: '#4fc3f7',
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#888',
    fontSize: 11,
  },
  listContent: {
    padding: 12,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  currentMatchRow: {
    borderWidth: 1,
    borderColor: '#fdd835',
    backgroundColor: '#2a2a1a',
  },
  weekBox: {
    width: 50,
    alignItems: 'center',
  },
  weekNum: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  weekType: {
    color: '#666',
    fontSize: 9,
  },
  matchInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  homeAway: {
    color: '#666',
    fontSize: 12,
    width: 20,
  },
  teamDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  oppName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  oppRating: {
    color: '#888',
    fontSize: 11,
  },
  resultBox: {
    width: 70,
    alignItems: 'flex-end',
  },
  resultText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  upcomingBadge: {
    backgroundColor: '#fdd835',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  upcomingText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pendingText: {
    color: '#666',
    fontSize: 14,
  },
});
