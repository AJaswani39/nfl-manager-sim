import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';

const ROUNDS = ['Wild Card', 'Divisional', 'Conference', 'Super Bowl'];

export default function PlayoffBracketScreen({ navigation }) {
  const [playoffData, setPlayoffData] = useState(null);

  useEffect(() => {
    loadPlayoffData();
    const unsubscribe = navigation.addListener('focus', loadPlayoffData);
    return unsubscribe;
  }, [navigation]);

  const loadPlayoffData = () => {
    const seeds = league.getPlayoffPicture();

    // Collect matches by round from playoff weeks
    // Playoff weeks start after 20 regular weeks (3 pre + 17 reg)
    const rounds = {};
    ROUNDS.forEach(r => { rounds[r] = []; });

    for (let i = 20; i < league.weeks.length; i++) {
      const weekMatches = league.weeks[i] || [];
      weekMatches.forEach(m => {
        if (m.type && rounds[m.type]) {
          rounds[m.type].push(m);
        }
      });
    }

    setPlayoffData({ seeds, rounds });
  };

  if (!playoffData) return null;

  const { seeds, rounds } = playoffData;

  const getMatchWinner = (match) => {
    if (!match || !match.result) return null;
    return match.result.homeScore >= match.result.awayScore ? match.home : match.away;
  };

  const getTeamSeed = (teamId, conf) => {
    const confSeeds = seeds[conf];
    if (!confSeeds) return null;
    const idx = confSeeds.findIndex(t => t.id === teamId);
    return idx >= 0 ? idx + 1 : null;
  };

  const renderTeamSlot = (team, seed, isWinner, isLoser) => {
    if (!team) {
      return (
        <View style={styles.teamSlot}>
          <Text style={styles.seedNum}>-</Text>
          <Text style={[styles.teamSlotName, { color: '#555' }]}>TBD</Text>
        </View>
      );
    }

    const teamData = TEAMS.find(t => t.id === team.id);
    const color = teamData?.colors?.primary || '#555';

    return (
      <View style={[
        styles.teamSlot,
        isWinner && styles.winnerSlot,
        isLoser && styles.loserSlot,
      ]}>
        <Text style={[styles.seedNum, isWinner && { color: '#fdd835' }]}>
          {seed || '-'}
        </Text>
        <View style={[styles.teamColorBar, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[
            styles.teamSlotName,
            isWinner && styles.winnerText,
            isLoser && styles.loserText,
          ]}>
            {team.abbreviation || team.name}
          </Text>
          <Text style={styles.teamRecord}>
            {team.w !== undefined ? `${team.w}-${team.l}` : ''}
          </Text>
        </View>
        {team.result_score !== undefined && (
          <Text style={[styles.scoreText, isWinner && styles.winnerScore]}>
            {team.result_score}
          </Text>
        )}
      </View>
    );
  };

  const renderMatchup = (match, conf) => {
    if (!match) return null;

    const winner = getMatchWinner(match);
    const homeSeed = getTeamSeed(match.home.id, conf);
    const awaySeed = getTeamSeed(match.away.id, conf);

    const homeWon = winner?.id === match.home.id;
    const awayWon = winner?.id === match.away.id;

    // Attach scores for display
    const homeTeam = { ...match.home, result_score: match.result?.homeScore };
    const awayTeam = { ...match.away, result_score: match.result?.awayScore };

    return (
      <View style={styles.matchupBox} key={match.id}>
        {renderTeamSlot(homeTeam, homeSeed, homeWon, awayWon)}
        <View style={styles.matchDivider} />
        {renderTeamSlot(awayTeam, awaySeed, awayWon, homeWon)}
      </View>
    );
  };

  const renderConferenceBracket = (conf) => {
    const confColor = conf === 'AFC' ? '#d32f2f' : '#1976d2';
    const confSeeds = seeds[conf] || [];
    const byeTeam = confSeeds[0];

    return (
      <View style={styles.confSection}>
        <View style={[styles.confHeader, { backgroundColor: confColor }]}>
          <Text style={styles.confTitle}>{conf}</Text>
        </View>

        {/* Seeds */}
        <View style={styles.seedsRow}>
          {confSeeds.map((team, i) => {
            const teamData = TEAMS.find(t => t.id === team.id);
            return (
              <View key={team.id} style={styles.seedPill}>
                <Text style={styles.seedPillNum}>#{i + 1}</Text>
                <Text style={styles.seedPillName}>{teamData?.abbreviation || team.name}</Text>
                <Text style={styles.seedPillRecord}>{team.w}-{team.l}</Text>
              </View>
            );
          })}
        </View>

        {/* Bye indicator */}
        {byeTeam && (
          <View style={styles.byeBanner}>
            <Text style={styles.byeText}>
              #{1} {byeTeam.name} — First Round BYE
            </Text>
          </View>
        )}

        {/* Wild Card */}
        {renderRoundSection('Wild Card', conf, confColor)}

        {/* Divisional */}
        {renderRoundSection('Divisional', conf, confColor)}

        {/* Conference Championship */}
        {renderRoundSection('Conference', conf, confColor)}
      </View>
    );
  };

  const renderRoundSection = (roundName, conf, confColor) => {
    const matches = (rounds[roundName] || []).filter(m => {
      return m.home.conference === conf || m.away.conference === conf;
    });

    if (matches.length === 0) {
      return (
        <View style={styles.roundSection}>
          <Text style={[styles.roundLabel, { borderLeftColor: confColor }]}>{roundName}</Text>
          <Text style={styles.pendingText}>Awaiting results...</Text>
        </View>
      );
    }

    return (
      <View style={styles.roundSection}>
        <Text style={[styles.roundLabel, { borderLeftColor: confColor }]}>{roundName}</Text>
        {matches.map(m => renderMatchup(m, conf))}
      </View>
    );
  };

  // Super Bowl
  const sbMatches = rounds['Super Bowl'] || [];
  const sbMatch = sbMatches[0];
  const sbWinner = sbMatch ? getMatchWinner(sbMatch) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>PLAYOFF BRACKET</Text>
        <Text style={styles.subtitle}>Season {league.season || 1}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* AFC Bracket */}
        {renderConferenceBracket('AFC')}

        {/* Super Bowl */}
        <View style={styles.superBowlSection}>
          <View style={styles.sbHeader}>
            <Text style={styles.sbTitle}>SUPER BOWL</Text>
          </View>
          {sbMatch ? (
            <View>
              {renderMatchup(sbMatch, sbMatch.home.conference)}
              {sbWinner && (
                <View style={styles.championBanner}>
                  <Text style={styles.championTrophy}>🏆</Text>
                  <Text style={styles.championText}>
                    {sbWinner.city} {sbWinner.name}
                  </Text>
                  <Text style={styles.championSubtext}>SUPER BOWL CHAMPIONS</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.pendingText}>Awaiting Conference Champions...</Text>
          )}
        </View>

        {/* NFC Bracket */}
        {renderConferenceBracket('NFC')}
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
    paddingBottom: 40,
  },
  confSection: {
    margin: 12,
    backgroundColor: '#161b22',
    borderRadius: 12,
    overflow: 'hidden',
  },
  confHeader: {
    padding: 12,
    alignItems: 'center',
  },
  confTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  seedsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 6,
    justifyContent: 'center',
  },
  seedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#21262d',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  seedPillNum: {
    color: '#fdd835',
    fontSize: 11,
    fontWeight: '700',
  },
  seedPillName: {
    color: '#c9d1d9',
    fontSize: 12,
    fontWeight: '600',
  },
  seedPillRecord: {
    color: '#8b949e',
    fontSize: 11,
  },
  byeBanner: {
    backgroundColor: '#1c2128',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#fdd835',
  },
  byeText: {
    color: '#fdd835',
    fontSize: 12,
    fontWeight: '600',
  },
  roundSection: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  roundLabel: {
    color: '#c9d1d9',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    borderLeftWidth: 3,
    paddingLeft: 8,
  },
  matchupBox: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    overflow: 'hidden',
  },
  teamSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  winnerSlot: {
    backgroundColor: '#0d2818',
  },
  loserSlot: {
    opacity: 0.5,
  },
  seedNum: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  teamColorBar: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  teamSlotName: {
    color: '#c9d1d9',
    fontSize: 15,
    fontWeight: '700',
  },
  winnerText: {
    color: '#3fb950',
  },
  loserText: {
    color: '#555',
  },
  teamRecord: {
    color: '#8b949e',
    fontSize: 11,
  },
  scoreText: {
    color: '#8b949e',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
  winnerScore: {
    color: '#3fb950',
  },
  matchDivider: {
    height: 1,
    backgroundColor: '#21262d',
    marginHorizontal: 10,
  },
  pendingText: {
    color: '#484f58',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  superBowlSection: {
    margin: 12,
    backgroundColor: '#161b22',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fdd835',
  },
  sbHeader: {
    backgroundColor: '#1a1a0a',
    padding: 14,
    alignItems: 'center',
  },
  sbTitle: {
    color: '#fdd835',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  championBanner: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a0a',
  },
  championTrophy: {
    fontSize: 48,
    marginBottom: 8,
  },
  championText: {
    color: '#fdd835',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  championSubtext: {
    color: '#8b949e',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 4,
  },
});
