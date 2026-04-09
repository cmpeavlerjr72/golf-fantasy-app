import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { colors } from '../theme';

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
    if (score === null || score === undefined) return colors.textMuted;
    if (score < 0) return colors.negative;
    if (score > 0) return colors.textSecondary;
    return colors.textPrimary;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data.leaderboard}
        keyExtractor={(item, i) => `${item.playerName}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLeaderboard} tintColor={colors.accent} />}
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
        renderItem={({ item, index }) => (
          <View style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  columnHeader: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  rowAlt: { backgroundColor: colors.bgCard },
  colPos: { width: 40, color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  colName: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  colThru: { width: 40, color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  colToday: { width: 50, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  colTotal: { width: 50, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  emptyText: { color: colors.textMuted, textAlign: 'center', padding: 40, fontSize: 16 },
});
