import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';

const CONFERENCES = ['AFC', 'NFC'];
const ODDS_COLUMNS = [
  { key: 'makePlayoffs', label: 'PO' },
  { key: 'divisionTitle', label: 'DIV' },
  { key: 'firstRoundBye', label: 'BYE' },
  { key: 'conferenceTitle', label: 'CONF' },
  { key: 'superBowl', label: 'SB' },
];

const EMPTY_CONFERENCE_RACE = {
  divisionLeaders: [],
  wildCards: [],
  inTheHunt: [],
  eliminated: [],
  seeds: [],
};

export default function PlayoffPictureScreen({ navigation }) {
  const [race, setRace] = useState(null);
  const [activeTab, setActiveTab] = useState('AFC');

  useEffect(() => {
    loadRace();
    const unsubscribe = navigation.addListener('focus', loadRace);
    return unsubscribe;
  }, [navigation]);

  const loadRace = () => {
    setRace(league.getPlayoffRace());
  };

  if (!race) return null;

  const statusLabel = (status) => {
    if (status === 'z') return 'z - bye';
    if (status === 'y') return 'y - div';
    if (status === 'x') return 'x - berth';
    if (status === 'e') return 'e';
    return '-';
  };

  const renderOdds = (team) => (
    <View style={styles.oddsGrid}>
      {ODDS_COLUMNS.map(col => (
        <View key={col.key} style={styles.oddsCell}>
          <Text style={styles.oddsLabel}>{col.label}</Text>
          <Text style={styles.oddsValue}>{team.odds?.[col.key] ?? 0}%</Text>
        </View>
      ))}
    </View>
  );

  const renderTeamRow = (team) => (
    <View key={`${team.id}-${team.seed || 'hunt'}`} style={[styles.teamRow, team.id === league.userTeamId && styles.userRow]}>
      <View style={styles.teamTopLine}>
        <View style={styles.seedBox}>
          <Text style={styles.seedText}>{team.seed || '-'}</Text>
        </View>
        <View style={styles.teamIdentity}>
          <Text style={styles.teamName}>{team.abbreviation} {team.name}</Text>
          <Text style={styles.teamMeta}>
            {team.w}-{team.l}  {team.division}  DIFF {team.pointDiff}
          </Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={[styles.statusText, team.status === 'e' && styles.eliminatedText]}>
            {statusLabel(team.status)}
          </Text>
        </View>
      </View>

      <View style={styles.detailLine}>
        <Text style={styles.detailText}>GB {team.gamesBack}</Text>
        <Text style={styles.detailText}>CONF {team.confW}-{team.confL}</Text>
        <Text style={styles.detailText}>DIV {team.divW}-{team.divL}</Text>
        <Text style={styles.detailText}>SOS {Number(team.remainingSos || 0).toFixed(3)}</Text>
      </View>
      {renderOdds(team)}
    </View>
  );

  const renderGroup = (title, teams) => {
    if (!teams || teams.length === 0) return null;
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        {teams.map(renderTeamRow)}
      </View>
    );
  };

  const renderMatchups = (confRace) => {
    const teams = confRace?.seeds || [];
    if (teams.length < 7) return null;
    const matchups = [
      { home: teams[1], away: teams[6] },
      { home: teams[2], away: teams[5] },
      { home: teams[3], away: teams[4] },
    ];
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Projected Wild Card</Text>
        <View style={styles.byeRow}>
          <Text style={styles.byeLabel}>BYE</Text>
          <Text style={styles.byeTeam}>#{teams[0].seed} {teams[0].abbreviation} {teams[0].name}</Text>
        </View>
        {matchups.map(matchup => (
          <View key={`${matchup.home.id}-${matchup.away.id}`} style={styles.matchupRow}>
            <Text style={styles.matchupSeed}>#{matchup.home.seed}</Text>
            <Text style={styles.matchupTeam}>{matchup.home.abbreviation}</Text>
            <Text style={styles.matchupVs}>vs</Text>
            <Text style={[styles.matchupTeam, { textAlign: 'right' }]}>{matchup.away.abbreviation}</Text>
            <Text style={styles.matchupSeed}>#{matchup.away.seed}</Text>
          </View>
        ))}
      </View>
    );
  };

  const currentRace = race[activeTab] || EMPTY_CONFERENCE_RACE;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>PLAYOFF PICTURE</Text>
        <Text style={styles.subtitle}>Season {league.season || 1}  Week {Math.max(1, league.currentWeek - 3)}</Text>
      </View>

      <View style={styles.tabs}>
        {CONFERENCES.map(conf => (
          <TouchableOpacity
            key={conf}
            style={[styles.tab, activeTab === conf && styles.activeTab]}
            onPress={() => setActiveTab(conf)}
          >
            <Text style={[styles.tabText, activeTab === conf && styles.activeTabText]}>{conf}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderMatchups(currentRace)}
        {renderGroup('Division Leaders', currentRace.divisionLeaders)}
        {renderGroup('Wild Card', currentRace.wildCards)}
        {renderGroup('In The Hunt', currentRace.inTheHunt)}
        {renderGroup('Eliminated', currentRace.eliminated)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 8,
  },
  backText: {
    color: '#93c5fd',
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#cbd5e1',
    marginTop: 4,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  activeTab: {
    backgroundColor: '#111827',
  },
  tabText: {
    color: '#374151',
    fontWeight: '900',
  },
  activeTabText: {
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  group: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  groupTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  teamRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  userRow: {
    backgroundColor: '#e3f2fd',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  teamTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  seedText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  teamIdentity: {
    flex: 1,
  },
  teamName: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 15,
  },
  teamMeta: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 2,
  },
  statusBox: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  statusText: {
    color: '#0f766e',
    fontWeight: '900',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  eliminatedText: {
    color: '#b91c1c',
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  detailText: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '800',
  },
  oddsGrid: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  oddsCell: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  oddsLabel: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '900',
  },
  oddsValue: {
    color: '#111827',
    fontWeight: '900',
    marginTop: 2,
  },
  byeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  byeLabel: {
    color: '#6b7280',
    fontWeight: '900',
  },
  byeTeam: {
    color: '#111827',
    fontWeight: '900',
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  matchupSeed: {
    width: 34,
    color: '#6b7280',
    fontWeight: '900',
  },
  matchupTeam: {
    flex: 1,
    color: '#111827',
    fontWeight: '900',
  },
  matchupVs: {
    width: 32,
    color: '#9ca3af',
    fontWeight: '900',
    textAlign: 'center',
  },
});
