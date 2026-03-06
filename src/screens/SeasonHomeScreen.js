import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  RefreshControl, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

export default function SeasonHomeScreen({ route, navigation }) {
  const { leagueId } = route.params;
  const [tab, setTab] = useState('standings');
  const [standings, setStandings] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [league, setLeague] = useState(null);
  const [roster, setRoster] = useState(null);
  const [trades, setTrades] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [leagueId, tab])
  );

  async function loadData() {
    setRefreshing(true);
    try {
      const promises = [api.getLeague(leagueId)];

      if (tab === 'standings') {
        promises.push(api.getSeasonStandings(leagueId));
      } else if (tab === 'lineup') {
        promises.push(api.getLineup(leagueId));
      } else if (tab === 'roster') {
        promises.push(api.getRoster(leagueId));
        promises.push(api.getTransactions(leagueId));
      } else if (tab === 'trades') {
        promises.push(api.getTrades(leagueId));
      }

      const results = await Promise.all(promises);
      setLeague(results[0]);

      if (tab === 'standings') setStandings(results[1]);
      else if (tab === 'lineup') setLineup(results[1]);
      else if (tab === 'roster') { setRoster(results[1]); setTransactions(results[2] || []); }
      else if (tab === 'trades') setTrades(results[1] || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }

  // --- Lineup actions ---
  async function movePlayer(playerName, toSlot) {
    if (!lineup) return;
    const starters = lineup.lineup.filter(l => l.slot === 'starter').map(l => l.playerName);
    const bench = lineup.lineup.filter(l => l.slot === 'bench').map(l => l.playerName);

    if (toSlot === 'starter') {
      const idx = bench.indexOf(playerName);
      if (idx !== -1) bench.splice(idx, 1);
      if (!starters.includes(playerName)) starters.push(playerName);
    } else {
      const idx = starters.indexOf(playerName);
      if (idx !== -1) starters.splice(idx, 1);
      if (!bench.includes(playerName)) bench.push(playerName);
    }

    try {
      await api.setLineup(leagueId, starters, bench);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  // --- Roster actions ---
  function handleDrop(playerName) {
    Alert.alert('Drop Player', `Drop ${playerName} from your roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Drop',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.dropPlayer(leagueId, playerName);
            Alert.alert('Done', `${playerName} dropped`);
            loadData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  // --- Trade actions ---
  function handleAcceptTrade(tradeId) {
    Alert.alert('Accept Trade', 'Accept this trade?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            await api.acceptTrade(leagueId, tradeId);
            Alert.alert('Done', 'Trade accepted!');
            loadData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  function handleDeclineTrade(tradeId) {
    Alert.alert('Decline Trade', 'Decline this trade?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.declineTrade(leagueId, tradeId);
            Alert.alert('Done', 'Trade declined');
            loadData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  // --- Renderers ---
  function renderStandings() {
    if (!standings) return null;
    return (
      <FlatList
        data={standings.standings}
        keyExtractor={(item) => item.memberId.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>{standings.leagueName}</Text>
            <Text style={styles.subtitle}>Season Standings</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.standingRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.standingInfo}>
              <Text style={styles.teamName}>{item.teamName}</Text>
              <Text style={styles.meta}>
                {item.tournamentsPlayed} tournaments | {item.totalBirdies} birdies | {item.totalEagles} eagles
              </Text>
            </View>
            <Text style={styles.points}>{item.totalPoints.toFixed(0)}</Text>
          </View>
        )}
      />
    );
  }

  function renderLineup() {
    if (!lineup || !league) return null;

    const starters = lineup.lineup.filter(l => l.slot === 'starter');
    const bench = lineup.lineup.filter(l => l.slot === 'bench');

    const inLineup = new Set(lineup.lineup.map(l => l.playerName.toLowerCase()));
    const unset = (lineup.roster || [])
      .filter(name => !inLineup.has(name.toLowerCase()));

    const sections = [
      { title: `Starters (${starters.length}/${league.startersCount})`, data: starters, type: 'starter' },
      { title: `Bench (${bench.length})`, data: bench, type: 'bench' },
    ];
    if (unset.length > 0) {
      sections.push({ title: 'Not Set', data: unset.map(n => ({ playerName: n, slot: 'unset' })), type: 'unset' });
    }

    return (
      <FlatList
        data={sections}
        keyExtractor={(item) => item.title}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>My Lineup</Text>
            <Text style={styles.subtitle}>
              {lineup.tournament ? lineup.tournament.name : 'No active tournament'}
            </Text>
          </View>
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((player, i) => {
              const name = typeof player === 'string' ? player : player.playerName;
              const locked = player.locked;
              return (
                <View key={i} style={styles.lineupRow}>
                  <Text style={[styles.playerName, locked && styles.lockedPlayer]}>{name}</Text>
                  {locked ? (
                    <Text style={styles.lockedText}>Locked</Text>
                  ) : section.type === 'starter' ? (
                    <TouchableOpacity style={styles.moveBtn} onPress={() => movePlayer(name, 'bench')}>
                      <Text style={styles.moveBtnText}>Bench</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.moveBtn, styles.startBtn]} onPress={() => movePlayer(name, 'starter')}>
                      <Text style={styles.moveBtnText}>Start</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {section.data.length === 0 && (
              <Text style={styles.emptyText}>No players</Text>
            )}
          </View>
        )}
      />
    );
  }

  function renderRoster() {
    const players = roster?.roster || [];
    return (
      <FlatList
        data={players}
        keyExtractor={(item, i) => `${item.playerName}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <View style={styles.rosterHeaderRow}>
              <View>
                <Text style={styles.title}>My Roster</Text>
                <Text style={styles.subtitle}>
                  {players.length}/{roster?.rosterSize || '?'} players
                </Text>
              </View>
              <TouchableOpacity
                style={styles.freeAgentBtn}
                onPress={() => navigation.navigate('FreeAgents', { leagueId })}
              >
                <Text style={styles.freeAgentBtnText}>+ Free Agents</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.rosterRow}>
            <View style={styles.rosterInfo}>
              <Text style={styles.playerName}>{item.playerName}</Text>
              <Text style={styles.meta}>
                {item.acquiredVia === 'draft' ? 'Drafted' :
                 item.acquiredVia === 'trade' ? 'Traded' :
                 item.acquiredVia === 'add' ? 'Free Agent' : item.acquiredVia}
              </Text>
            </View>
            {item.locked ? (
              <Text style={styles.lockedText}>Locked</Text>
            ) : (
              <TouchableOpacity style={styles.dropBtn} onPress={() => handleDrop(item.playerName)}>
                <Text style={styles.dropBtnText}>Drop</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListFooterComponent={
          transactions.length > 0 ? (
            <View style={styles.transactionsSection}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              {transactions.slice(0, 10).map((t, i) => (
                <View key={i} style={styles.transactionRow}>
                  <Text style={styles.transactionText}>
                    <Text style={styles.transactionType}>
                      {t.type.toUpperCase()}
                    </Text>
                    {'  '}{t.playerName}
                  </Text>
                  <Text style={styles.meta}>{t.teamName}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    );
  }

  function renderTrades() {
    return (
      <FlatList
        data={trades}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <View style={styles.rosterHeaderRow}>
              <Text style={styles.title}>Trades</Text>
              <TouchableOpacity
                style={styles.freeAgentBtn}
                onPress={() => navigation.navigate('ProposeTrade', { leagueId })}
              >
                <Text style={styles.freeAgentBtnText}>+ Propose</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.tradeRow}>
            <View style={styles.tradePlayers}>
              <View style={styles.tradeSide}>
                <Text style={styles.tradeTeam}>{item.proposerTeam}</Text>
                <Text style={styles.tradePlayer}>{item.proposerPlayer}</Text>
              </View>
              <Text style={styles.tradeArrow}>{'<->'}</Text>
              <View style={[styles.tradeSide, { alignItems: 'flex-end' }]}>
                <Text style={styles.tradeTeam}>{item.targetTeam}</Text>
                <Text style={styles.tradePlayer}>{item.targetPlayer}</Text>
              </View>
            </View>
            {item.status === 'pending' ? (
              <View style={styles.tradeActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAcceptTrade(item.id)}
                >
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDeclineTrade(item.id)}
                >
                  <Text style={styles.actionBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[
                styles.tradeStatus,
                item.status === 'accepted' && styles.statusAccepted,
                item.status === 'declined' && styles.statusDeclined,
              ]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          !refreshing && <Text style={styles.emptyText}>No trades yet</Text>
        }
      />
    );
  }

  const tabs = [
    { key: 'standings', label: 'Standings' },
    { key: 'lineup', label: 'Lineup' },
    { key: 'roster', label: 'Roster' },
    { key: 'trades', label: 'Trades' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.activeTab]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'standings' && renderStandings()}
      {tab === 'lineup' && renderLineup()}
      {tab === 'roster' && renderRoster()}
      {tab === 'trades' && renderTrades()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a472a' },

  // Tabs
  tabBar: { flexGrow: 0, paddingHorizontal: 12, paddingVertical: 8 },
  tab: {
    paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8,
    backgroundColor: '#2d5a3d', marginHorizontal: 4,
  },
  activeTab: { backgroundColor: '#4a8c5c' },
  tabText: { color: '#8a9a5b', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#fff' },

  // Common
  sectionHeader: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#8a9a5b', fontSize: 14, marginTop: 2 },
  meta: { color: '#8a9a5b', fontSize: 12, marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#b0c4a8', fontSize: 14, fontWeight: '600', marginHorizontal: 16, marginBottom: 8 },
  emptyText: { color: '#6a7a5b', textAlign: 'center', marginTop: 40, fontSize: 15 },
  playerName: { flex: 1, color: '#fff', fontSize: 15 },
  lockedPlayer: { color: '#8a9a5b' },
  lockedText: { color: '#6a7a5b', fontSize: 12 },

  // Standings
  standingRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 12, padding: 14,
  },
  rank: { color: '#8a9a5b', fontSize: 20, fontWeight: 'bold', width: 30, textAlign: 'center' },
  standingInfo: { flex: 1, marginLeft: 12 },
  teamName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  points: { color: '#5cb85c', fontSize: 22, fontWeight: 'bold' },

  // Lineup
  lineupRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 4, borderRadius: 10, padding: 14,
  },
  moveBtn: {
    backgroundColor: '#1a472a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: '#f0ad4e',
  },
  startBtn: { borderColor: '#4a8c5c' },
  moveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Roster
  rosterHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 14,
  },
  rosterInfo: { flex: 1 },
  freeAgentBtn: {
    backgroundColor: '#4a8c5c', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  freeAgentBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dropBtn: {
    backgroundColor: '#1a472a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: '#d9534f',
  },
  dropBtnText: { color: '#d9534f', fontSize: 13, fontWeight: '600' },
  transactionsSection: { marginTop: 20, paddingBottom: 30 },
  transactionRow: {
    backgroundColor: '#2d5a3d', marginHorizontal: 16, marginBottom: 4,
    borderRadius: 8, padding: 10,
  },
  transactionText: { color: '#fff', fontSize: 13 },
  transactionType: { color: '#f0ad4e', fontWeight: '600' },

  // Trades
  tradeRow: {
    backgroundColor: '#2d5a3d', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 14,
  },
  tradePlayers: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  tradeSide: { flex: 1 },
  tradeTeam: { color: '#8a9a5b', fontSize: 12 },
  tradePlayer: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  tradeArrow: { color: '#8a9a5b', fontSize: 16, marginHorizontal: 8 },
  tradeActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, backgroundColor: '#4a8c5c', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  declineBtn: {
    flex: 1, backgroundColor: '#d9534f', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tradeStatus: { color: '#8a9a5b', fontSize: 13, textAlign: 'center' },
  statusAccepted: { color: '#5cb85c' },
  statusDeclined: { color: '#d9534f' },
});
