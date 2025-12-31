import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function LeaderboardScreen() {
  const navigation = useNavigation();
  const categories = league.getLeaderboardCategories();
  const [selectedCategory, setSelectedCategory] = useState(categories[0].key);

  const leaders = league.getLeaderboard(selectedCategory, 10);
  const currentCategory = categories.find(c => c.key === selectedCategory);

  const getTeamColor = (teamId) => {
    const team = TEAMS.find(t => t.id === teamId);
    return team?.colors?.primary || '#333';
  };

  const renderLeader = ({ item, index }) => (
    <View style={[styles.leaderRow, index === 0 && styles.topLeader]}>
      <View style={[styles.rank, index === 0 && styles.goldRank]}>
        <Text style={[styles.rankText, index === 0 && styles.goldRankText]}>
          {index + 1}
        </Text>
      </View>
      <View style={[styles.teamBadge, { backgroundColor: getTeamColor(item.teamId) }]}>
        <Text style={styles.teamBadgeText}>{item.teamId}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.name}</Text>
        <Text style={styles.playerPosition}>{item.position}</Text>
      </View>
      <View style={styles.statValue}>
        <Text style={[styles.statNumber, index === 0 && styles.topStatNumber]}>
          {item.value.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>League Leaders</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Category Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryTab,
              selectedCategory === cat.key && styles.categoryTabActive
            ]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[
              styles.categoryLabel,
              selectedCategory === cat.key && styles.categoryLabelActive
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Current Category Header */}
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>
          {currentCategory?.icon} {currentCategory?.label}
        </Text>
      </View>

      {/* Leaders List */}
      {leaders.length > 0 ? (
        <FlatList
          data={leaders}
          keyExtractor={(item) => item.id}
          renderItem={renderLeader}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No stats recorded yet</Text>
          <Text style={styles.emptySubtext}>Play some games to see leaders!</Text>
        </View>
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
  },
  placeholder: {
    width: 60,
  },
  categoryScroll: {
    maxHeight: 80,
  },
  categoryContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  categoryTab: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryTabActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  categoryIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  categoryLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#fff',
  },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  categoryTitle: {
    color: '#fdd835',
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  topLeader: {
    backgroundColor: '#2a2a1a',
    borderWidth: 1,
    borderColor: '#fdd835',
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  goldRank: {
    backgroundColor: '#fdd835',
  },
  rankText: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 12,
  },
  goldRankText: {
    color: '#000',
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  teamBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  playerPosition: {
    color: '#888',
    fontSize: 12,
  },
  statValue: {
    alignItems: 'flex-end',
  },
  statNumber: {
    color: '#4fc3f7',
    fontSize: 18,
    fontWeight: 'bold',
  },
  topStatNumber: {
    color: '#fdd835',
    fontSize: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
  },
});
