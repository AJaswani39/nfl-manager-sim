import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

export default function SalaryCapScreen({ route }) {
  const navigation = useNavigation();
  const { userTeamId } = route.params;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const cap = league.getTeamCap(userTeamId);
  const capSpace = league.getCapSpace(userTeamId);
  const roster = league.rosters[userTeamId] || [];
  
  // Sort by salary descending
  const sortedRoster = [...roster].sort((a, b) => {
    const salA = league.getPlayerSalary(a.id).amount;
    const salB = league.getPlayerSalary(b.id).amount;
    return salB - salA;
  });

  const getCapStatusColor = () => {
    const percent = cap.spent / cap.cap;
    if (percent > 0.95) return '#f44336';
    if (percent > 0.85) return '#ff9800';
    return '#4caf50';
  };

  const renderPlayer = ({ item }) => {
    const salary = league.getPlayerSalary(item.id);
    const percentOfCap = ((salary.amount / cap.cap) * 100).toFixed(1);
    
    return (
      <View style={styles.playerRow}>
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{item.position}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{item.name}</Text>
          <Text style={styles.playerDetails}>{item.overall} OVR • {salary.years}yr</Text>
        </View>
        <View style={styles.salaryInfo}>
          <Text style={styles.salaryAmount}>${salary.amount}M</Text>
          <Text style={styles.salaryPercent}>{percentOfCap}%</Text>
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
        <Text style={styles.title}>Salary Cap</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cap Overview */}
        <View style={styles.capOverview}>
          <Text style={styles.teamName}>{userTeam?.city} {userTeam?.name}</Text>
          
          {/* Cap Bar */}
          <View style={styles.capBarContainer}>
            <View style={styles.capBarBg}>
              <View 
                style={[
                  styles.capBarFill, 
                  { width: `${Math.min(100, (cap.spent / cap.cap) * 100)}%`, backgroundColor: getCapStatusColor() }
                ]} 
              />
            </View>
            <View style={styles.capLabels}>
              <Text style={styles.capSpent}>${cap.spent}M Spent</Text>
              <Text style={styles.capTotal}>${cap.cap}M Cap</Text>
            </View>
          </View>

          {/* Cap Space */}
          <View style={styles.capSpaceBox}>
            <Text style={styles.capSpaceLabel}>Available Cap Space</Text>
            <Text style={[styles.capSpaceAmount, { color: getCapStatusColor() }]}>
              ${capSpace}M
            </Text>
          </View>
        </View>

        {/* Top Earners */}
        <Text style={styles.sectionTitle}>💰 Roster Salaries</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.headerPos}>POS</Text>
          <Text style={styles.headerPlayer}>PLAYER</Text>
          <Text style={styles.headerSalary}>SALARY</Text>
        </View>
        
        <FlatList
          data={sortedRoster}
          keyExtractor={item => item.id}
          renderItem={renderPlayer}
          scrollEnabled={false}
        />

        {/* Cap Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>💡 Salary Cap Info</Text>
          <Text style={styles.legendText}>
            • Each team has a $200M salary cap{'\n'}
            • Player salaries are based on overall rating and position{'\n'}
            • QBs command premium salaries{'\n'}
            • Free agents have lesser salaries
          </Text>
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
  capOverview: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  teamName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  capBarContainer: {
    marginBottom: 20,
  },
  capBarBg: {
    height: 24,
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  capBarFill: {
    height: '100%',
    borderRadius: 12,
  },
  capLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  capSpent: {
    color: '#888',
    fontSize: 12,
  },
  capTotal: {
    color: '#888',
    fontSize: 12,
  },
  capSpaceBox: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  capSpaceLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  capSpaceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerPos: {
    color: '#666',
    fontSize: 10,
    width: 40,
  },
  headerPlayer: {
    color: '#666',
    fontSize: 10,
    flex: 1,
  },
  headerSalary: {
    color: '#666',
    fontSize: 10,
    width: 80,
    textAlign: 'right',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    marginBottom: 2,
    borderRadius: 6,
  },
  positionBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  positionText: {
    color: '#fff',
    fontSize: 9,
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
    color: '#666',
    fontSize: 11,
  },
  salaryInfo: {
    alignItems: 'flex-end',
  },
  salaryAmount: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  salaryPercent: {
    color: '#666',
    fontSize: 10,
  },
  legendCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  legendTitle: {
    color: '#fdd835',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legendText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 20,
  },
});
