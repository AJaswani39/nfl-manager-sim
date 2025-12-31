import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function CompareScreen() {
  const navigation = useNavigation();
  
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [selectingSlot, setSelectingSlot] = useState(null); // 1 or 2
  const [positionFilter, setPositionFilter] = useState(null);

  // Get all players from all rosters
  const getAllPlayers = () => {
    const players = [];
    Object.keys(league.rosters).forEach(teamId => {
      const roster = league.rosters[teamId] || [];
      roster.forEach(player => {
        players.push({
          ...player,
          teamId,
          stats: league.playerStats[player.id] || {}
        });
      });
    });
    return players.sort((a, b) => b.overall - a.overall);
  };

  const allPlayers = getAllPlayers();
  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
  
  const filteredPlayers = positionFilter && positionFilter !== 'ALL'
    ? allPlayers.filter(p => p.position === positionFilter)
    : allPlayers;

  const handleSelectPlayer = (player) => {
    if (selectingSlot === 1) {
      setPlayer1(player);
    } else if (selectingSlot === 2) {
      setPlayer2(player);
    }
    setSelectingSlot(null);
  };

  const getStatComparison = (stat1, stat2) => {
    if (stat1 > stat2) return { better: 1, color1: '#4caf50', color2: '#f44336' };
    if (stat2 > stat1) return { better: 2, color1: '#f44336', color2: '#4caf50' };
    return { better: 0, color1: '#fff', color2: '#fff' };
  };

  const renderStatRow = (label, val1, val2) => {
    const comp = getStatComparison(val1 || 0, val2 || 0);
    return (
      <View style={styles.statRow}>
        <Text style={[styles.statValue, {color: comp.color1}]}>{val1 || 0}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, {color: comp.color2}]}>{val2 || 0}</Text>
      </View>
    );
  };

  const renderPlayerSlot = (player, slot) => {
    if (!player) {
      return (
        <TouchableOpacity 
          style={styles.emptySlot}
          onPress={() => setSelectingSlot(slot)}
        >
          <Text style={styles.emptySlotIcon}>+</Text>
          <Text style={styles.emptySlotText}>Select Player {slot}</Text>
        </TouchableOpacity>
      );
    }

    const teamColor = TEAMS.find(t => t.id === player.teamId)?.colors?.primary || '#333';

    return (
      <TouchableOpacity 
        style={[styles.playerSlot, {borderColor: teamColor}]}
        onPress={() => setSelectingSlot(slot)}
      >
        <View style={[styles.teamBadge, {backgroundColor: teamColor}]}>
          <Text style={styles.teamBadgeText}>{player.teamId}</Text>
        </View>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerDetails}>{player.position} • Age {player.age}</Text>
        <View style={styles.overallBadge}>
          <Text style={styles.overallText}>{player.overall}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPlayerOption = ({ item }) => {
    const isSelected = (player1?.id === item.id) || (player2?.id === item.id);
    return (
      <TouchableOpacity 
        style={[styles.playerOption, isSelected && styles.playerOptionSelected]}
        onPress={() => handleSelectPlayer(item)}
        disabled={isSelected}
      >
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{item.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.optionName}>{item.name}</Text>
          <Text style={styles.optionTeam}>{item.teamId}</Text>
        </View>
        <Text style={styles.optionRating}>{item.overall}</Text>
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
        <Text style={styles.title}>Compare Players</Text>
        <View style={styles.placeholder} />
      </View>

      {selectingSlot ? (
        // Player Selection Mode
        <View style={styles.selectionMode}>
          <Text style={styles.selectionTitle}>Select Player {selectingSlot}</Text>
          
          {/* Position Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {positions.map(pos => (
              <TouchableOpacity
                key={pos}
                style={[styles.filterBtn, (positionFilter === pos || (pos === 'ALL' && !positionFilter)) && styles.filterBtnActive]}
                onPress={() => setPositionFilter(pos === 'ALL' ? null : pos)}
              >
                <Text style={[styles.filterText, (positionFilter === pos || (pos === 'ALL' && !positionFilter)) && styles.filterTextActive]}>
                  {pos}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredPlayers}
            keyExtractor={item => item.id}
            renderItem={renderPlayerOption}
            style={styles.playerList}
          />

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectingSlot(null)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Comparison View
        <ScrollView style={styles.comparisonView}>
          {/* Player Slots */}
          <View style={styles.slotsRow}>
            {renderPlayerSlot(player1, 1)}
            <View style={styles.vsCircle}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            {renderPlayerSlot(player2, 2)}
          </View>

          {/* Stats Comparison */}
          {player1 && player2 && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Season Stats</Text>
              
              {/* Offensive Stats */}
              <Text style={styles.categoryLabel}>Passing</Text>
              {renderStatRow('Yards', player1.stats.passingYards, player2.stats.passingYards)}
              {renderStatRow('TDs', player1.stats.passingTDs, player2.stats.passingTDs)}
              
              <Text style={styles.categoryLabel}>Rushing</Text>
              {renderStatRow('Yards', player1.stats.rushingYards, player2.stats.rushingYards)}
              {renderStatRow('TDs', player1.stats.rushingTDs, player2.stats.rushingTDs)}
              
              <Text style={styles.categoryLabel}>Receiving</Text>
              {renderStatRow('Yards', player1.stats.receivingYards, player2.stats.receivingYards)}
              {renderStatRow('Receptions', player1.stats.receptions, player2.stats.receptions)}
              
              <Text style={styles.categoryLabel}>Defense</Text>
              {renderStatRow('Tackles', player1.stats.tackles, player2.stats.tackles)}
              {renderStatRow('Sacks', player1.stats.sacks, player2.stats.sacks)}
              {renderStatRow('INTs', player1.stats.interceptions, player2.stats.interceptions)}
            </View>
          )}
        </ScrollView>
      )}
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
  comparisonView: {
    flex: 1,
  },
  slotsRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  emptySlot: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    minHeight: 150,
  },
  emptySlotIcon: {
    color: '#666',
    fontSize: 36,
    marginBottom: 8,
  },
  emptySlotText: {
    color: '#666',
    fontSize: 14,
  },
  playerSlot: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    minHeight: 150,
  },
  teamBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  teamBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playerDetails: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  overallBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  overallText: {
    color: '#4fc3f7',
    fontSize: 20,
    fontWeight: 'bold',
  },
  vsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  vsText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsSection: {
    padding: 16,
  },
  statsTitle: {
    color: '#fdd835',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  categoryLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    width: 60,
    textAlign: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    flex: 1,
    textAlign: 'center',
  },
  selectionMode: {
    flex: 1,
  },
  selectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 16,
  },
  filterScroll: {
    maxHeight: 50,
    paddingHorizontal: 12,
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
  },
  filterTextActive: {
    color: '#fff',
  },
  playerList: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  playerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  playerOptionSelected: {
    opacity: 0.5,
  },
  positionBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
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
  optionName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  optionTeam: {
    color: '#888',
    fontSize: 11,
  },
  optionRating: {
    color: '#4fc3f7',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  cancelBtnText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: '600',
  },
});
