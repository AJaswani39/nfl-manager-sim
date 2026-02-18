import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { league } from '../engine/LeagueEngine';
import { TEAMS } from '../data/teams';
import { StorageService } from '../services/StorageService';

export default function DraftScreen({ route, navigation }) {
    const { userTeamId } = route.params;
    const [prospects, setProspects] = useState([]);
    const [draftLog, setDraftLog] = useState([]);
    const [isUserTurn, setIsUserTurn] = useState(false);
    const [draftOver, setDraftOver] = useState(false);

    useEffect(() => {
        // Start Draft if not already
        if (!league.draftClass || league.draftClass.length === 0) {
            league.startDraft();
        }
        
        // Initial state
        updateDraftState();
        
        // Auto-advance CPU picks after a delay
        const timer = setTimeout(() => {
            processCpuPicks();
        }, 1000); // 1-second delay for effect

        return () => clearTimeout(timer);
    }, []);

    const updateDraftState = () => {
        setProspects([...league.draftClass]); // Copy to force render
    };

    const processCpuPicks = () => {
        const newPicks = league.resolveCpuPicks(userTeamId);
        if (newPicks.length > 0) {
             setDraftLog(prev => [...prev, ...newPicks]);
             updateDraftState();
        }
        
        // Check if it's user turn or draft over
        if (league.currentPickIndex >= league.draftOrder.length) {
            setDraftOver(true);
        } else if (league.draftOrder[league.currentPickIndex] === userTeamId) {
            setIsUserTurn(true);
        }
    };

    const handleDraftPlayer = (player, index) => {
        if (!isUserTurn) return;

        Alert.alert(
            "Draft Player",
            `Draft ${player.position} ${player.name} (Overall: ${player.overall})?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Draft", onPress: () => {
                    const picked = league.userSelectPlayer(userTeamId, index);
                    
                    // Add to log
                    setDraftLog(prev => [...prev, { type: 'pick', teamId: userTeamId, player: picked }]);
                    setIsUserTurn(false);
                    updateDraftState();

                    // Resume CPU picks
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

    const renderProspect = ({ item, index }) => (
        <TouchableOpacity 
            style={[styles.prospectRow, isUserTurn && styles.activeRow]}
            onPress={() => handleDraftPlayer(item, index)}
            disabled={!isUserTurn}
        >
            <View style={styles.rankBox}><Text style={styles.rankText}>{index + 1}</Text></View>
            <View style={{flex:1}}>
                <Text style={styles.pName}>{item.name}</Text>
                <Text style={styles.pDetails}>{item.position} | Age: {item.age}</Text>
            </View>
            <Text style={styles.pRating}>{item.overall}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>NFL DRAFT</Text>
                <Text style={styles.subtitle}>{draftOver ? "DRAFT COMPLETE" : isUserTurn ? "YOUR PICK!" : "CPU PICKING..."}</Text>
            </View>

            <View style={{flex: 1, flexDirection:'row'}}>
                {/* PROSPECTS LIST */}
                <View style={styles.leftPanel}>
                    <Text style={styles.sectionHeader}>Top Prospects</Text>
                    <FlatList
                        data={prospects}
                        renderItem={renderProspect}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{padding:10}}
                    />
                </View>

                {/* DRAFT LOG */}
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
                            )
                        }}
                    />
                </View>
            </View>

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
    header: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderColor: '#333' },
    title: { color: '#feca57', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
    subtitle: { color: '#fff', fontSize: 16, marginTop: 5 },
    
    leftPanel: { flex: 0.6, borderRightWidth: 1, borderColor: '#333' },
    rightPanel: { flex: 0.4, backgroundColor: '#2d3436' },
    
    sectionHeader: { padding: 10, backgroundColor: '#000', color: '#ccc', fontWeight: 'bold' },
    
    prospectRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#333' },
    activeRow: { backgroundColor: '#10ac84' },
    
    rankBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#555', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    rankText: { color: '#fff', fontWeight: 'bold' },
    pName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    pDetails: { color: '#aaa', fontSize: 12 },
    pRating: { color: '#feca57', fontSize: 18, fontWeight: 'bold' },

    logItem: { padding: 8, borderBottomWidth: 1, borderColor: '#444' },
    logTeam: { color: '#feca57', fontWeight: 'bold', fontSize: 12 },
    logPlayer: { color: '#fff', fontSize: 12 },

    footer: { padding: 20, backgroundColor: '#000' },
    advanceBtn: { backgroundColor: '#2e86de', padding: 15, borderRadius: 8, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
