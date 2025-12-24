import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, FlatList, SafeAreaView } from 'react-native';
import { TEAMS } from './src/data/teams';

export default function App() {
  const renderTeam = ({ item }) => (
    <View style={[styles.card, { borderLeftColor: item.colors.primary }]}>
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
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NFL Manager 2026</Text>
        <Text style={styles.subtitle}>Select a Team</Text>
      </View>
      <FlatList
        data={TEAMS}
        renderItem={renderTeam}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
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
