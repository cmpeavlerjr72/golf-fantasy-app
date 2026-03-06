import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

export default function LeaguesScreen({ navigation }) {
  const { logout } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLeagues();
    }, [])
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
    if (status === 'pre_draft') return '#f0ad4e';
    if (status === 'drafting') return '#d9534f';
    return '#5cb85c';
  }

  function statusLabel(status) {
    if (status === 'pre_draft') return 'Pre-Draft';
    if (status === 'drafting') return 'Drafting';
    return 'Active';
  }

  function handleLeaguePress(league) {
    if (league.status === 'drafting') {
      navigation.navigate('Draft', { leagueId: league.id, leagueType: league.leagueType });
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
        <Text style={styles.headerTitle}>My Leagues</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLeagues} tintColor="#fff" />}
        contentContainerStyle={leagues.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No leagues yet</Text>
            <Text style={styles.emptySubtext}>Create or join a league to get started</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleLeaguePress(item)}>
            <View style={styles.cardTop}>
              <Text style={styles.leagueName}>{item.name}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>
            <View style={styles.typeRow}>
              <View style={[styles.typeBadge, item.leagueType === 'season' && styles.typeBadgeSeason]}>
                <Text style={styles.typeBadgeText}>
                  {item.leagueType === 'season' ? 'Season' : 'Pool'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDetail}>Team: {item.myTeamName}</Text>
            <Text style={styles.cardDetail}>Members: {item.memberCount}/{item.maxTeams}</Text>
            <Text style={styles.inviteCode}>Code: {item.inviteCode}</Text>
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
  container: { flex: 1, backgroundColor: '#1a472a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  logoutText: { color: '#8a9a5b', fontSize: 15 },
  list: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: '#2d5a3d', borderRadius: 12, padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leagueName: { fontSize: 20, fontWeight: '600', color: '#fff', flex: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  typeRow: { marginBottom: 8 },
  typeBadge: {
    alignSelf: 'flex-start', backgroundColor: '#1a472a', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#4a8c5c',
  },
  typeBadgeSeason: { borderColor: '#f0ad4e', backgroundColor: '#2a3a1a' },
  typeBadgeText: { color: '#b0c4a8', fontSize: 11, fontWeight: '600' },
  cardDetail: { color: '#b0c4a8', fontSize: 14, marginBottom: 2 },
  inviteCode: { color: '#8a9a5b', fontSize: 13, marginTop: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#8a9a5b', fontSize: 15, textAlign: 'center' },
  bottomButtons: { flexDirection: 'row', padding: 16, gap: 12 },
  createButton: {
    flex: 1, backgroundColor: '#4a8c5c', borderRadius: 12, padding: 16, alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  joinButton: {
    flex: 1, backgroundColor: '#2d5a3d', borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#4a8c5c',
  },
  joinButtonText: { color: '#4a8c5c', fontSize: 16, fontWeight: '600' },
});
