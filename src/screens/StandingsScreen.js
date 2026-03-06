import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

export default function StandingsScreen({ route }) {
  const { leagueId } = route.params;
  const [standings, setStandings] = useState(null);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadStandings();
    }, [leagueId])
  );

  async function loadStandings() {
    setRefreshing(true);
    try {
      const data = await api.getStandings(leagueId);
      setStandings(data);
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
    if (score === null || score === undefined) return '#8a9a5b';
    if (score < 0) return '#ff6b6b';
    if (score > 0) return '#b0c4a8';
    return '#fff';
  }

  if (!standings) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading standings...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={standings.standings}
        keyExtractor={(item) => item.memberId.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadStandings} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{standings.leagueName}</Text>
            {standings.tournament && (
              <Text style={styles.subtitle}>{standings.tournament.name}</Text>
            )}
            <Text style={styles.subtitle}>Best {standings.scoringTopN} of each team count</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <TouchableOpacity
              style={[styles.teamRow, expandedTeam === item.memberId && styles.teamRowExpanded]}
              onPress={() => setExpandedTeam(expandedTeam === item.memberId ? null : item.memberId)}
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{item.teamName}</Text>
                <Text style={styles.ownerName}>{item.displayName}</Text>
              </View>
              <Text style={[styles.teamScore, { color: scoreColor(item.teamScore) }]}>
                {formatScore(item.teamScore)}
              </Text>
            </TouchableOpacity>

            {expandedTeam === item.memberId && (
              <View style={styles.playersContainer}>
                {item.players.map((player, i) => {
                  const isCounting = i < item.countingPlayers &&
                    player.scoreToPar !== null &&
                    item.players.filter(p => p.scoreToPar !== null)
                      .sort((a, b) => a.scoreToPar - b.scoreToPar)
                      .slice(0, standings.scoringTopN)
                      .some(p => p.playerName === player.playerName);

                  return (
                    <View key={i} style={[styles.playerRow, isCounting && styles.countingPlayer]}>
                      <Text style={styles.playerPosition}>{player.position || '-'}</Text>
                      <Text style={styles.playerName}>{player.playerName}</Text>
                      <Text style={styles.playerThru}>{player.thru || '-'}</Text>
                      <Text style={[styles.playerScore, { color: scoreColor(player.scoreToPar) }]}>
                        {formatScore(player.scoreToPar)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a472a' },
  loadingText: { color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#8a9a5b', fontSize: 14, marginBottom: 2 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 12, padding: 16,
  },
  teamRowExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  rank: { color: '#8a9a5b', fontSize: 20, fontWeight: 'bold', width: 30, textAlign: 'center' },
  teamInfo: { flex: 1, marginLeft: 12 },
  teamName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  ownerName: { color: '#8a9a5b', fontSize: 13 },
  teamScore: { fontSize: 22, fontWeight: 'bold' },
  playersContainer: {
    backgroundColor: '#244a34', marginHorizontal: 16, marginBottom: 6,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 8,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#2d5a3d',
  },
  countingPlayer: { backgroundColor: '#2d5a3d', borderRadius: 6 },
  playerPosition: { color: '#8a9a5b', width: 30, fontSize: 13, textAlign: 'center' },
  playerName: { flex: 1, color: '#fff', fontSize: 14 },
  playerThru: { color: '#8a9a5b', fontSize: 13, width: 36, textAlign: 'center' },
  playerScore: { fontSize: 15, fontWeight: '600', width: 40, textAlign: 'right' },
});
