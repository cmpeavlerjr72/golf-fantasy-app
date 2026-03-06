import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { colors } from '../theme';

export default function LeagueDetailScreen({ route, navigation }) {
  const { leagueId } = route.params;
  const [league, setLeague] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLeague();
    }, [leagueId])
  );

  async function loadLeague() {
    setRefreshing(true);
    try {
      const data = await api.getLeague(leagueId);
      setLeague(data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete League',
      `Are you sure you want to delete "${league?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteLeague(leagueId);
              Alert.alert('Deleted', 'League has been deleted.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  async function shareInvite() {
    if (!league) return;
    try {
      await Share.share({
        message: `Join my Fantasy Golf league "${league.name}"!\n\nInvite code: ${league.inviteCode}`,
      });
    } catch (err) {
      // user cancelled
    }
  }

  if (!league) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={league.members}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLeague} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{league.name}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.statusBadge, { borderColor: league.status === 'pre_draft' ? colors.gold : colors.active }]}>
                <Text style={[styles.statusText, { color: league.status === 'pre_draft' ? colors.gold : colors.active }]}>
                  {league.status === 'pre_draft' ? 'Waiting for Draft' : league.status}
                </Text>
              </View>
              <Text style={styles.meta}>{league.members.length}/{league.maxTeams} teams</Text>
              <Text style={styles.meta}>{league.draftRounds} rounds</Text>
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={shareInvite} activeOpacity={0.7}>
              <Text style={styles.shareLabel}>Invite Code</Text>
              <Text style={styles.shareCode}>{league.inviteCode}</Text>
              <Text style={styles.shareTap}>Tap to share</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Members</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{item.teamName.charAt(0)}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.teamName}</Text>
              <Text style={styles.memberUser}>{item.displayName}</Text>
            </View>
            <Text style={styles.memberOrder}>#{index + 1}</Text>
          </View>
        )}
        ListFooterComponent={
          <>
            {league.isOwner && league.status === 'pre_draft' ? (
              <TouchableOpacity
                style={[styles.draftButton, league.members.length < 2 && styles.draftButtonDisabled]}
                onPress={() => navigation.navigate('Draft', { leagueId, leagueType: league.leagueType, tournamentId: league.tournamentId })}
                disabled={league.members.length < 2}
              >
                <Text style={styles.draftButtonText}>
                  {league.members.length < 2 ? 'Need at least 2 teams' : 'Go to Draft'}
                </Text>
              </TouchableOpacity>
            ) : league.status === 'pre_draft' ? (
              <Text style={styles.waitingText}>Waiting for the league owner to start the draft...</Text>
            ) : null}

            {league.isOwner && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete League</Text>
              </TouchableOpacity>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingText: { color: colors.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: { padding: 16 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  statusBadge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 13 },
  shareButton: {
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, alignItems: 'center',
    marginBottom: 24, borderWidth: 1, borderColor: colors.accent + '44',
  },
  shareLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  shareCode: { color: colors.accent, fontSize: 28, fontWeight: '800', letterSpacing: 3, marginVertical: 4 },
  shareTap: { color: colors.textMuted, fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  memberAvatarText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  memberUser: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  memberOrder: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  draftButton: {
    backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center', margin: 16,
  },
  draftButtonDisabled: { backgroundColor: colors.bgElevated, opacity: 0.5 },
  draftButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  waitingText: { color: colors.textSecondary, textAlign: 'center', padding: 20, fontSize: 15 },
  deleteButton: {
    borderRadius: 10, padding: 14, alignItems: 'center', margin: 16, marginTop: 8,
    borderWidth: 1, borderColor: colors.negative + '66',
  },
  deleteButtonText: { color: colors.negative, fontSize: 15, fontWeight: '600' },
});
