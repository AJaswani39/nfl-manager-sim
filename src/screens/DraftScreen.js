import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

const POTENTIAL_COLORS = {
  'A+': '#fdd835', 'A': '#4caf50', 'B+': '#2196f3', 'B': '#03a9f4',
  'C+': '#ff9800', 'C': '#ff5722', 'D': '#9e9e9e',
};

export default function DraftScreen({ route, navigation }) {
    const { userTeamId } = route.params;
    const [prospects, setProspects] = useState([]);
    const [draftLog, setDraftLog] = useState([]);
    const [isUserTurn, setIsUserTurn] = useState(false);
    const [draftOver, setDraftOver] = useState(false);
    const [tab, setTab] = useState('prospects'); // 'prospects' | 'needs' | 'history'
    const [needs, setNeeds] = useState([]);

    useEffect(() => {
        let timer;
        const initializeDraft = async () => {
            const draftComplete = league.draftOrder && league.currentPickIndex >= league.draftOrder.length;
            if (!draftComplete && (!league.draftClass || league.draftClass.length === 0 || !league.draftOrder)) {
                league.startDraft();
                await StorageService.saveGame(league.getSaveData());
            }

            updateDraftState();
            setDraftLog(getCurrentDraftLog());
            setNeeds(league.getDraftNeeds(userTeamId));
            timer = setTimeout(() => processCpuPicks(), 1000);
        };

        initializeDraft();
        return () => clearTimeout(timer);
    }, []);

    const getCurrentDraftLog = () => {
        return (league.draftHistory || [])
            .filter(pick => pick.season === league.season)
            .map(pick => ({
                type: 'pick',
                teamId: pick.teamId,
                player: pick.player,
            }));
    };

    const updateDraftState = () => {
        setProspects([...(league.draftClass || [])]);
        setDraftOver(Boolean(league.draftOrder && league.currentPickIndex >= league.draftOrder.length));
        setIsUserTurn(Boolean(
            league.draftOrder &&
            league.currentPickIndex < league.draftOrder.length &&
            league.draftOrder[league.currentPickIndex] === userTeamId
        ));
    };

    const processCpuPicks = async () => {
        if (!league.draftOrder || league.currentPickIndex >= league.draftOrder.length) {
            updateDraftState();
            return;
        }

        const newPicks = league.resolveCpuPicks(userTeamId);
        if (newPicks.length > 0) {
             setDraftLog(prev => [...prev, ...newPicks]);
             await StorageService.saveGame(league.getSaveData());
        }
        updateDraftState();
        setNeeds(league.getDraftNeeds(userTeamId));
    };

    const handleDraftPlayer = (player, index) => {
        if (!isUserTurn) return;
        Alert.alert(
            "Draft Player",
            `Draft ${player.position} ${player.name}?\n\nOVR: ${player.overall} | Potential: ${player.potential}\nStrength: ${player.strength}\nComp: ${player.comparison}`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Draft", onPress: async () => {
                    const picked = league.userSelectPlayer(userTeamId, index);
                    if (!picked) return;
                    setDraftLog(prev => [...prev, { type: 'pick', teamId: userTeamId, player: picked }]);
                    updateDraftState();
                    setNeeds(league.getDraftNeeds(userTeamId));
                    await StorageService.saveGame(league.getSaveData());
                    setTimeout(() => processCpuPicks(), 1000);
                }}
            ]
        );
    };

    const handleFinishOffseason = async () => {
        league.startNewSeason();
        await StorageService.saveGame(league.getSaveData());
        navigation.navigate('Season', { teamId: userTeamId });
    };

    // Check if prospect fills a need
    const isNeedPosition = (pos) => {
        const topNeeds = needs.slice(0, 3);
        return topNeeds.some(n => n.position === pos);
    };

    const renderProspect = ({ item, index }) => {
        const potColor = POTENTIAL_COLORS[item.potential] || '#888';
        const fillsNeed = isNeedPosition(item.position);
        return (
            <TouchableOpacity
                style={[styles.prospectRow, isUserTurn && styles.activeRow, fillsNeed && styles.needHighlight]}
                onPress={() => handleDraftPlayer(item, index)}
                disabled={!isUserTurn}
            >
                <View style={styles.rankBox}><Text style={styles.rankText}>{index + 1}</Text></View>
                <View style={{flex:1}}>
                    <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                        <Text style={styles.pName}>{item.name}</Text>
                        {fillsNeed && <View style={styles.needDot} />}
                    </View>
                    <Text style={styles.pDetails}>{item.position} | Age: {item.age}</Text>
                    <Text style={styles.pScouting}>
                        {item.strength || 'Athlete'} | Comp: {item.comparison || '—'}
                    </Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                    <Text style={styles.pRating}>{item.overall}</Text>
                    <View style={[styles.potBadge, {borderColor: potColor}]}>
                        <Text style={[styles.potText, {color: potColor}]}>{item.potential || '?'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderNeedsTab = () => (
        <ScrollView contentContainerStyle={{padding: 10}}>
            <Text style={styles.needsTitle}>TEAM NEEDS ANALYSIS</Text>
            <Text style={styles.needsSubtitle}>Ranked by urgency (roster gaps + talent level)</Text>
            {needs.map((need, i) => (
                <View key={need.position} style={[styles.needRow, i < 3 && styles.topNeedRow]}>
                    <View style={styles.needRankBox}>
                        <Text style={[styles.needRank, i < 3 && {color: '#feca57'}]}>#{i+1}</Text>
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={styles.needPos}>{need.position}</Text>
                        <Text style={styles.needDetail}>
                            {need.count} player{need.count !== 1 ? 's' : ''} | Avg: {need.avgOvr} OVR | Best: {need.bestOvr}
                        </Text>
                    </View>
                    <View style={[styles.needScoreBox, {backgroundColor: need.needScore > 40 ? '#d32f2f' : need.needScore > 20 ? '#f57c00' : '#4caf50'}]}>
                        <Text style={styles.needScoreText}>{i < 3 ? 'HIGH' : i < 5 ? 'MED' : 'LOW'}</Text>
                    </View>
                </View>
            ))}
        </ScrollView>
    );

    const renderHistoryTab = () => {
        const history = league.draftHistory || [];
        const currentSeasonPicks = history.filter(h => h.season === league.season);
        const pastPicks = history.filter(h => h.season < league.season);

        return (
            <ScrollView contentContainerStyle={{padding: 10}}>
                {currentSeasonPicks.length > 0 && (
                    <View>
                        <Text style={styles.historySeasonLabel}>Season {league.season} (Current)</Text>
                        {currentSeasonPicks.map((pick, i) => {
                            const team = TEAMS.find(t => t.id === pick.teamId);
                            const isUser = pick.teamId === userTeamId;
                            return (
                                <View key={i} style={[styles.historyRow, isUser && styles.historyUserRow]}>
                                    <Text style={styles.historyPick}>#{pick.pick}</Text>
                                    <Text style={styles.historyTeam}>{team?.abbreviation || '???'}</Text>
                                    <Text style={styles.historyPlayer}>{pick.player.position} {pick.player.name}</Text>
                                    <Text style={styles.historyOvr}>{pick.player.overall}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}
                {pastPicks.length > 0 && (
                    <View>
                        {[...new Set(pastPicks.map(p => p.season))].sort((a,b) => b-a).map(season => (
                            <View key={season}>
                                <Text style={styles.historySeasonLabel}>Season {season}</Text>
                                {pastPicks.filter(p => p.season === season).map((pick, i) => {
                                    const team = TEAMS.find(t => t.id === pick.teamId);
                                    const isUser = pick.teamId === userTeamId;
                                    // Try to find current overall of the player
                                    const currentPlayer = league.findPlayer(pick.player.id);
                                    const currentOvr = currentPlayer?.overall || pick.player.overall;
                                    const diff = currentOvr - pick.player.overall;
                                    return (
                                        <View key={i} style={[styles.historyRow, isUser && styles.historyUserRow]}>
                                            <Text style={styles.historyPick}>#{pick.pick}</Text>
                                            <Text style={styles.historyTeam}>{team?.abbreviation || '???'}</Text>
                                            <Text style={styles.historyPlayer}>{pick.player.position} {pick.player.name}</Text>
                                            <View style={{alignItems:'flex-end'}}>
                                                <Text style={styles.historyOvr}>{currentOvr}</Text>
                                                {diff !== 0 && (
                                                    <Text style={{color: diff > 0 ? '#4caf50' : '#f44336', fontSize: 10, fontWeight:'bold'}}>
                                                        {diff > 0 ? '+' : ''}{diff}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                )}
                {history.length === 0 && (
                    <View style={{padding: 30, alignItems:'center'}}>
                        <Text style={{color:'#888', fontSize: 14}}>No draft history yet</Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>NFL DRAFT</Text>
                <Text style={styles.subtitle}>{draftOver ? "DRAFT COMPLETE" : isUserTurn ? "YOUR PICK!" : "CPU PICKING..."}</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                {[
                    { id: 'prospects', label: 'Prospects' },
                    { id: 'needs', label: 'Team Needs' },
                    { id: 'history', label: 'History' },
                ].map(t => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tab, tab === t.id && styles.tabActive]}
                        onPress={() => setTab(t.id)}
                    >
                        <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {tab === 'prospects' && (
                <View style={{flex: 1, flexDirection:'row'}}>
                    <View style={styles.leftPanel}>
                        <FlatList
                            data={prospects}
                            renderItem={renderProspect}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{padding:10}}
                        />
                    </View>
                    <View style={styles.rightPanel}>
                        <Text style={styles.sectionHeader}>Draft Board</Text>
                        <FlatList
                            data={draftLog}
                            keyExtractor={(item, i) => i.toString()}
                            renderItem={({item}) => {
                                const team = TEAMS.find(t => t.id === item.teamId);
                                return (
                                    <View style={styles.logItem}>
                                        <Text style={styles.logTeam}>{team ? team.abbreviation : 'UNK'}</Text>
                                        <Text style={styles.logPlayer}>{item.player.position} {item.player.name}</Text>
                                    </View>
                                );
                            }}
                        />
                    </View>
                </View>
            )}

            {tab === 'needs' && (
                <View style={{flex: 1}}>
                    {renderNeedsTab()}
                </View>
            )}

            {tab === 'history' && (
                <View style={{flex: 1}}>
                    {renderHistoryTab()}
                </View>
            )}

            {draftOver && (
                <View style={styles.footer}>
                     <TouchableOpacity style={styles.advanceBtn} onPress={handleFinishOffseason}>
                         <Text style={styles.btnText}>START NEW SEASON</Text>
                     </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1e272e' },
    header: { padding: 16, alignItems: 'center', borderBottomWidth: 1, borderColor: '#333' },
    title: { color: '#feca57', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
    subtitle: { color: '#fff', fontSize: 16, marginTop: 5 },

    tabRow: { flexDirection: 'row', backgroundColor: '#000', padding: 6, gap: 4 },
    tab: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center', backgroundColor: '#1e272e' },
    tabActive: { backgroundColor: '#10ac84' },
    tabText: { color: '#888', fontWeight: '700', fontSize: 13 },
    tabTextActive: { color: '#fff' },

    leftPanel: { flex: 0.6, borderRightWidth: 1, borderColor: '#333' },
    rightPanel: { flex: 0.4, backgroundColor: '#2d3436' },

    sectionHeader: { padding: 10, backgroundColor: '#000', color: '#ccc', fontWeight: 'bold' },

    prospectRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#333' },
    activeRow: { backgroundColor: 'rgba(16,172,132,0.3)' },
    needHighlight: { borderLeftWidth: 3, borderLeftColor: '#feca57' },

    rankBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#555', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    rankText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    pName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    pDetails: { color: '#aaa', fontSize: 11, marginTop: 1 },
    pScouting: { color: '#6ab04c', fontSize: 10, marginTop: 2, fontStyle: 'italic' },
    pRating: { color: '#feca57', fontSize: 18, fontWeight: 'bold' },
    potBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3 },
    potText: { fontSize: 10, fontWeight: '800' },
    needDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#feca57' },

    logItem: { padding: 8, borderBottomWidth: 1, borderColor: '#444' },
    logTeam: { color: '#feca57', fontWeight: 'bold', fontSize: 12 },
    logPlayer: { color: '#fff', fontSize: 12 },

    // Team Needs
    needsTitle: { color: '#feca57', fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
    needsSubtitle: { color: '#888', fontSize: 12, marginBottom: 16 },
    needRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#2d3436', borderRadius: 8, marginBottom: 6 },
    topNeedRow: { borderWidth: 1, borderColor: '#feca57' },
    needRankBox: { width: 35, alignItems: 'center' },
    needRank: { color: '#fff', fontWeight: '900', fontSize: 16 },
    needPos: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    needDetail: { color: '#aaa', fontSize: 11, marginTop: 2 },
    needScoreBox: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    needScoreText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },

    // Draft History
    historySeasonLabel: { color: '#feca57', fontSize: 14, fontWeight: '900', marginTop: 12, marginBottom: 6, letterSpacing: 1 },
    historyRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderColor: '#333', gap: 8 },
    historyUserRow: { backgroundColor: 'rgba(16,172,132,0.15)' },
    historyPick: { color: '#888', width: 30, fontWeight: '700', fontSize: 12 },
    historyTeam: { color: '#feca57', width: 35, fontWeight: '700', fontSize: 12 },
    historyPlayer: { color: '#fff', flex: 1, fontSize: 13 },
    historyOvr: { color: '#feca57', fontWeight: 'bold', fontSize: 14 },

    footer: { padding: 20, backgroundColor: '#000' },
    advanceBtn: { backgroundColor: '#2e86de', padding: 15, borderRadius: 8, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
