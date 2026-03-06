import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

export default function LeaderboardScreen() {
  const [data, setData] = useState({ tournament: null, leaderboard: [] });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [])
  );

  async function loadLeaderboard() {
    setRefreshing(true);
    try {
      const result = await api.getLeaderboard();
      setData(result);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function formatScore(score) {
    if (score === null || score === undefined) return '-';
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  }

  function scoreColor(score) {
    if (score === null || score === undefined) return '#6b7a8d';
    if (score < 0) return '#ff6b6b';
    if (score > 0) return '#94b8d0';
    return '#fff';
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data.leaderboard}
        keyExtractor={(item, i) => `${item.playerName}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLeaderboard} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>
              {data.tournament ? data.tournament.name : 'Tournament Leaderboard'}
            </Text>
            <View style={styles.columnHeader}>
              <Text style={styles.colPos}>POS</Text>
              <Text style={styles.colName}>PLAYER</Text>
              <Text style={styles.colThru}>THRU</Text>
              <Text style={styles.colToday}>TODAY</Text>
              <Text style={styles.colTotal}>TOTAL</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tournament data available</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.colPos}>{item.position || '-'}</Text>
            <Text style={styles.colName} numberOfLines={1}>{item.playerName}</Text>
            <Text style={styles.colThru}>{item.thru || '-'}</Text>
            <Text style={[styles.colToday, { color: scoreColor(item.today) }]}>
              {formatScore(item.today)}
            </Text>
            <Text style={[styles.colTotal, { color: scoreColor(item.scoreToPar) }]}>
              {formatScore(item.scoreToPar)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1929' },
  header: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  columnHeader: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5f',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5f',
  },
  colPos: { width: 40, color: '#6b7a8d', fontSize: 14, fontWeight: '600' },
  colName: { flex: 1, color: '#fff', fontSize: 15 },
  colThru: { width: 40, color: '#6b7a8d', fontSize: 14, textAlign: 'center' },
  colToday: { width: 50, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  colTotal: { width: 50, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  emptyText: { color: '#6b7a8d', textAlign: 'center', padding: 40, fontSize: 16 },
});
