import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

export default function TradeScreen({ route }) {
  const navigation = useNavigation();
  const userTeamId = route.params?.userTeamId || league.userTeamId;
  const userTeam = TEAMS.find(t => t.id === userTeamId);
  
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [offeredPlayers, setOfferedPlayers] = useState([]);
  const [requestedPlayers, setRequestedPlayers] = useState([]);
  const [tradeResult, setTradeResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const tradeWindowOpen = league.isTradeWindowOpen();
  const deadlineInfo = league.getTradeDeadlineInfo();

  const otherTeams = TEAMS.filter(t => t.id !== userTeamId);
  const userRoster = league.rosters[userTeamId] || [];
  const partnerRoster = selectedPartner ? (league.rosters[selectedPartner] || []) : [];

  const toggleOfferedPlayer = (playerId) => {
    setOfferedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
    setTradeResult(null);
  };

  const toggleRequestedPlayer = (playerId) => {
    setRequestedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
    setTradeResult(null);
  };

  const handleEvaluateTrade = () => {
    if (!selectedPartner || offeredPlayers.length === 0 || requestedPlayers.length === 0) {
      setStatusMessage('Select a trade partner and at least one player from each side.');
      return;
    }

    const result = league.evaluateTrade(userTeamId, selectedPartner, offeredPlayers, requestedPlayers);
    setStatusMessage('');
    setTradeResult(result);
  };

  const handleExecuteTrade = async () => {
    if (!tradeResult?.willAccept) return;

    league.executeTrade(userTeamId, selectedPartner, offeredPlayers, requestedPlayers);
    await StorageService.saveCurrentGame();
    setOfferedPlayers([]);
    setRequestedPlayers([]);
    setTradeResult(null);
    setSelectedPartner(null);
    setStatusMessage('Trade complete.');
  };

  const renderPlayerRow = (player, isSelected, onToggle) => (
    <TouchableOpacity 
      key={player.id}
      style={[styles.playerRow, isSelected && styles.playerRowSelected]}
      onPress={onToggle}
    >
      <View style={styles.positionBadge}>
        <Text style={styles.positionText}>{player.position}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerDetails}>Age: {player.age} • Value: {league.calculatePlayerValue(player)}</Text>
      </View>
      <Text style={[styles.rating, isSelected && styles.ratingSelected]}>{player.overall}</Text>
      {isSelected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  const renderTeamOption = ({ item }) => (
    <TouchableOpacity
      style={[styles.teamOption, selectedPartner === item.id && styles.teamOptionSelected]}
      onPress={() => {
        setSelectedPartner(item.id);
        setRequestedPlayers([]);
        setTradeResult(null);
      }}
    >
      <View style={[styles.teamDot, { backgroundColor: item.colors.primary }]} />
      <Text style={[styles.teamName, selectedPartner === item.id && styles.teamNameSelected]}>
        {item.abbreviation}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trade Center</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Trade Deadline Banner */}
      {!tradeWindowOpen && (
        <View style={{backgroundColor:'#d32f2f', padding:14, alignItems:'center'}}>
          <Text style={{color:'#fff', fontWeight:'900', fontSize:16, letterSpacing:1}}>TRADE DEADLINE HAS PASSED</Text>
          <Text style={{color:'rgba(255,255,255,0.8)', fontSize:12, marginTop:4}}>Trades are no longer available this season</Text>
        </View>
      )}
      {tradeWindowOpen && deadlineInfo && !deadlineInfo.passed && deadlineInfo.weeksUntil <= 3 && (
        <View style={{backgroundColor:'#f57f17', padding:10, alignItems:'center'}}>
          <Text style={{color:'#fff', fontWeight:'bold', fontSize:13}}>
            Trade deadline in {deadlineInfo.weeksUntil} week{deadlineInfo.weeksUntil !== 1 ? 's' : ''}!
          </Text>
        </View>
      )}

      {/* Team Selector */}
      <View style={[
        styles.teamSelector,
        !tradeWindowOpen && styles.disabledSection,
        { pointerEvents: tradeWindowOpen ? 'auto' : 'none' },
      ]}>
        <Text style={styles.sectionLabel}>Select Trade Partner:</Text>
        <FlatList
          horizontal
          data={otherTeams}
          keyExtractor={item => item.id}
          renderItem={renderTeamOption}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Trade Content */}
      <View style={styles.tradeContent}>
        {/* Your Team */}
        <View style={styles.tradeColumn}>
          <Text style={styles.columnTitle}>📤 {userTeam?.abbreviation || 'YOU'} Offers</Text>
          <ScrollView style={styles.playerList}>
            {userRoster.sort((a, b) => b.overall - a.overall).map(player => 
              renderPlayerRow(player, offeredPlayers.includes(player.id), () => toggleOfferedPlayer(player.id))
            )}
          </ScrollView>
        </View>

        {/* Partner Team */}
        <View style={styles.tradeColumn}>
          <Text style={styles.columnTitle}>
            📥 {selectedPartner ? TEAMS.find(t => t.id === selectedPartner)?.abbreviation : 'Select Team'} Offers
          </Text>
          <ScrollView style={styles.playerList}>
            {selectedPartner ? (
              partnerRoster.sort((a, b) => b.overall - a.overall).map(player => 
                renderPlayerRow(player, requestedPlayers.includes(player.id), () => toggleRequestedPlayer(player.id))
              )
            ) : (
              <Text style={styles.selectPrompt}>← Select a team to view their roster</Text>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Trade Evaluation */}
      <View style={[
        styles.evaluationSection,
        !tradeWindowOpen && styles.disabledSection,
        { pointerEvents: tradeWindowOpen ? 'auto' : 'none' },
      ]}>
        {tradeResult && (
          <View style={[styles.resultBox, tradeResult.willAccept ? styles.resultAccepted : styles.resultRejected]}>
            <Text style={styles.resultText}>{tradeResult.message}</Text>
            <Text style={styles.valueText}>
              Your Value: {tradeResult.offeredValue} | Their Value: {tradeResult.requestedValue}
            </Text>
          </View>
        )}
        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.evaluateBtn} onPress={handleEvaluateTrade}>
            <Text style={styles.evaluateBtnText}>EVALUATE TRADE</Text>
          </TouchableOpacity>
          
          {tradeResult?.willAccept && (
            <TouchableOpacity style={styles.executeBtn} onPress={handleExecuteTrade}>
              <Text style={styles.executeBtnText}>EXECUTE TRADE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  teamSelector: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  disabledSection: {
    opacity: 0.4,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  teamOptionSelected: {
    backgroundColor: '#1976d2',
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  teamName: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  teamNameSelected: {
    color: '#fff',
  },
  tradeContent: {
    flex: 1,
    flexDirection: 'row',
  },
  tradeColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#222',
  },
  columnTitle: {
    color: '#fdd835',
    fontSize: 13,
    fontWeight: 'bold',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    textAlign: 'center',
  },
  playerList: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  playerRowSelected: {
    backgroundColor: '#1a3a1a',
  },
  positionBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
    width: 32,
    alignItems: 'center',
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
    fontSize: 12,
    fontWeight: '600',
  },
  playerDetails: {
    color: '#666',
    fontSize: 10,
  },
  rating: {
    color: '#4fc3f7',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  ratingSelected: {
    color: '#4caf50',
  },
  checkmark: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectPrompt: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
  },
  evaluationSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  resultBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  resultAccepted: {
    backgroundColor: '#1b5e20',
  },
  resultRejected: {
    backgroundColor: '#b71c1c',
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  valueText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  statusText: {
    color: '#4fc3f7',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  evaluateBtn: {
    flex: 1,
    backgroundColor: '#1976d2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  evaluateBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  executeBtn: {
    flex: 1,
    backgroundColor: '#4caf50',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  executeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
