import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { colors } from '../theme';

export default function LeaguesScreen({ navigation, route }) {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLeagues();
      if (route.params?.joined) {
        Alert.alert('Joined!', `You have joined ${route.params.joined}.`);
        navigation.setParams({ joined: undefined });
      }
    }, [route.params?.joined])
  );

  async function loadLeagues() {
    setRefreshing(true);
    try {
      const data = await api.getLeagues();
      setLeagues(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function statusColor(status) {
    if (status === 'pre_draft') return colors.gold;
    if (status === 'drafting') return colors.negative;
    return colors.active;
  }

  function statusLabel(status) {
    if (status === 'pre_draft') return 'Pre-Draft';
    if (status === 'drafting') return 'Drafting';
    return 'Active';
  }

  function handleLeaguePress(league) {
    if (league.status === 'drafting') {
      navigation.navigate('Draft', { leagueId: league.id, leagueType: league.leagueType, tournamentId: league.tournamentId });
    } else if (league.status === 'active') {
      if (league.leagueType === 'season') {
        navigation.navigate('SeasonHome', { leagueId: league.id });
      } else {
        navigation.navigate('Standings', { leagueId: league.id });
      }
    } else {
      navigation.navigate('LeagueDetail', { leagueId: league.id });
    }
  }


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Leagues</Text>
          <Text style={styles.headerSub}>Fantasy Golf</Text>
        </View>
        <View style={styles.headerRight}>
        </View>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLeagues} tintColor={colors.accent} />}
        contentContainerStyle={leagues.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>&#9971;</Text>
            <Text style={styles.emptyText}>No leagues yet</Text>
            <Text style={styles.emptySubtext}>Create or join a league to get started</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleLeaguePress(item)} activeOpacity={0.7}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.leagueName}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22', borderColor: statusColor(item.status) }]}>
                  <View style={[styles.badgeDot, { backgroundColor: statusColor(item.status) }]} />
                  <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <View style={styles.typeRow}>
                <View style={[styles.typeBadge, item.leagueType === 'season' && styles.typeBadgeSeason]}>
                  <Text style={[styles.typeBadgeText, item.leagueType === 'season' && styles.typeBadgeTextSeason]}>
                    {item.leagueType === 'season' ? 'Season' : 'Pool'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <View style={styles.cardStat}>
                <Text style={styles.cardStatValue}>{item.myTeamName}</Text>
                <Text style={styles.cardStatLabel}>My Team</Text>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardStat}>
                <Text style={styles.cardStatValue}>{item.memberCount}/{item.maxTeams}</Text>
                <Text style={styles.cardStatLabel}>Teams</Text>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardStat}>
                <Text style={[styles.cardStatValue, styles.codeText]}>{item.inviteCode}</Text>
                <Text style={styles.cardStatLabel}>Code</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('CreateLeague')}>
          <Text style={styles.createButtonText}>Create League</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.joinButton} onPress={() => navigation.navigate('JoinLeague')}>
          <Text style={styles.joinButtonText}>Join League</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  logoutText: { color: colors.textMuted, fontSize: 14 },
  list: { padding: 16, paddingTop: 4 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  cardTop: { padding: 16, paddingBottom: 12 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leagueName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  typeRow: { marginTop: 2 },
  typeBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.bgElevated, borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  typeBadgeSeason: { backgroundColor: colors.goldDim },
  typeBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  typeBadgeTextSeason: { color: colors.gold },
  cardBottom: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  cardStatLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },
  cardDivider: { width: 1, backgroundColor: colors.border, marginVertical: -12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 6 },
  emptySubtext: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  bottomButtons: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.border },
  createButton: {
    flex: 1, backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  joinButton: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: 10, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.accent,
  },
  joinButtonText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
});
