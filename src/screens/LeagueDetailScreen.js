import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLeague} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{league.name}</Text>
            <Text style={styles.subtitle}>Status: {league.status === 'pre_draft' ? 'Waiting for Draft' : league.status}</Text>
            <Text style={styles.subtitle}>
              {league.members.length}/{league.maxTeams} teams | {league.draftRounds} rounds
            </Text>

            <TouchableOpacity style={styles.shareButton} onPress={shareInvite}>
              <Text style={styles.shareButtonText}>Share Invite Code: {league.inviteCode}</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Members</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.memberRow}>
            <Text style={styles.memberOrder}>{index + 1}</Text>
            <View>
              <Text style={styles.memberName}>{item.teamName}</Text>
              <Text style={styles.memberUser}>{item.displayName}</Text>
            </View>
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
  container: { flex: 1, backgroundColor: '#1a472a' },
  loadingText: { color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: { padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#b0c4a8', fontSize: 15, marginBottom: 2 },
  shareButton: {
    backgroundColor: '#2d5a3d', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#4a8c5c',
  },
  shareButtonText: { color: '#4a8c5c', fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14,
  },
  memberOrder: { color: '#8a9a5b', fontSize: 18, fontWeight: 'bold', marginRight: 14, width: 24, textAlign: 'center' },
  memberName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  memberUser: { color: '#8a9a5b', fontSize: 13 },
  draftButton: {
    backgroundColor: '#4a8c5c', borderRadius: 12, padding: 16, alignItems: 'center', margin: 16,
  },
  draftButtonDisabled: { backgroundColor: '#3a5a3d', opacity: 0.6 },
  draftButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  waitingText: { color: '#8a9a5b', textAlign: 'center', padding: 20, fontSize: 15 },
  deleteButton: {
    borderRadius: 12, padding: 14, alignItems: 'center', margin: 16, marginTop: 24,
    borderWidth: 1, borderColor: '#d9534f',
  },
  deleteButtonText: { color: '#d9534f', fontSize: 15, fontWeight: '600' },
});
