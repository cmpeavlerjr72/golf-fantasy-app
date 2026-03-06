import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { colors } from '../theme';

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
    if (score === null || score === undefined) return colors.textMuted;
    if (score < 0) return colors.negative;
    if (score > 0) return colors.textSecondary;
    return colors.textPrimary;
  }

  if (!standings) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading standings...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={standings.standings}
        keyExtractor={(item) => item.memberId.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadStandings} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{standings.leagueName}</Text>
            {standings.tournament && (
              <Text style={styles.subtitle}>{standings.tournament.name}</Text>
            )}
            <Text style={styles.meta}>Best {standings.scoringTopN} of each team count</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <TouchableOpacity
              style={[styles.teamRow, expandedTeam === item.memberId && styles.teamRowExpanded]}
              onPress={() => setExpandedTeam(expandedTeam === item.memberId ? null : item.memberId)}
              activeOpacity={0.7}
            >
              <View style={[styles.rankCircle, index === 0 && styles.rankFirst]}>
                <Text style={[styles.rank, index === 0 && styles.rankFirstText]}>{index + 1}</Text>
              </View>
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
                  const isCounting = player.scoreToPar !== null &&
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
  container: { flex: 1, backgroundColor: colors.bg },
  loadingText: { color: colors.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: 2 },
  meta: { color: colors.textMuted, fontSize: 13 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginHorizontal: 16, marginBottom: 6, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  teamRowExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  rankCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rankFirst: { backgroundColor: colors.gold + '33' },
  rank: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  rankFirstText: { color: colors.gold },
  teamInfo: { flex: 1, marginLeft: 12 },
  teamName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  ownerName: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  teamScore: { fontSize: 22, fontWeight: '800' },
  playersContainer: {
    backgroundColor: colors.bgCardAlt, marginHorizontal: 16, marginBottom: 6,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 8,
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  countingPlayer: { backgroundColor: colors.bgHighlight, borderRadius: 6 },
  playerPosition: { color: colors.textMuted, width: 30, fontSize: 13, textAlign: 'center' },
  playerName: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  playerThru: { color: colors.textMuted, fontSize: 13, width: 36, textAlign: 'center' },
  playerScore: { fontSize: 15, fontWeight: '700', width: 40, textAlign: 'right' },
});
