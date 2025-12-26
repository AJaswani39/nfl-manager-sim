import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { league } from '../engine/LeagueEngine';

export default function NewsScreen({ navigation }) {
    const [news, setNews] = useState([]);

    useEffect(() => {
        setNews([...league.news]);
    }, []);

    const renderItem = ({ item }) => (
        <View style={styles.newsItem}>
            <View style={styles.headerRow}>
                <Text style={styles.weekText}>Week {item.week}</Text>
                <View style={[
                    styles.typeBadge, 
                    item.type === 'retire' ? { backgroundColor: '#555' } :
                    item.type === 'injury' ? { backgroundColor: '#d32f2f' } :
                    { backgroundColor: '#388e3c' }
                ]}>
                    <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                </View>
            </View>
            <Text style={styles.newsText}>{item.message}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>LEAGUE NEWS</Text>
                <View style={{width: 50}} />
            </View>

            <FlatList
                data={news}
                renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No news headlines yet.</Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 20, 
        backgroundColor: '#1e1e1e',
        borderBottomWidth: 1,
        borderColor: '#333'
    },
    backBtn: { padding: 10 },
    backText: { color: '#007AFF', fontSize: 16 },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    list: { padding: 10 },
    newsItem: { 
        backgroundColor: '#1e1e1e', 
        padding: 15, 
        borderRadius: 8, 
        marginBottom: 10,
        borderLeftWidth: 4,
        borderColor: '#007AFF'
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    weekText: { color: '#888', fontSize: 12 },
    typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    typeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    newsText: { color: '#fff', fontSize: 14, lineHeight: 20 },
    emptyText: { color: '#666', textAlign: 'center', marginTop: 50 }
});
