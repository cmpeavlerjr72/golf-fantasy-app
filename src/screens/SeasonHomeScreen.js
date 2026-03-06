import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

const AUTO_REFRESH_MS = 60 * 1000; // Auto-refresh every 60s on This Week tab

export default function SeasonHomeScreen({ route, navigation }) {
  const { leagueId } = route.params;
  const [tab, setTab] = useState('week');
  const [standings, setStandings] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [league, setLeague] = useState(null);
  const [weeklyScores, setWeeklyScores] = useState(null);
  const [trades, setTrades] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const autoRefreshTimer = useRef(null);
  const isFocused = useRef(true);

  // Load league data once on mount
  useEffect(() => {
    api.getLeague(leagueId).then(setLeague).catch(() => {});
  }, [leagueId]);

  // Load tab-specific data when tab changes, but only if we don't already have it
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      loadTabData(tab, false);

      return () => {
        isFocused.current = false;
        if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current);
      };
    }, [leagueId, tab])
  );

  // Auto-refresh for This Week tab
  useEffect(() => {
    if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current);
    if (tab === 'week') {
      autoRefreshTimer.current = setInterval(() => {
        if (isFocused.current) loadTabData('week', true);
      }, AUTO_REFRESH_MS);
    }
    return () => { if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current); };
  }, [tab, leagueId]);

  async function loadTabData(activeTab, silent) {
    if (!silent) setRefreshing(true);
    try {
      if (activeTab === 'standings') {
        const data = await api.getSeasonStandings(leagueId);
        setStandings(data);
      } else if (activeTab === 'week') {
        const data = await api.getWeeklyScores(leagueId);
        setWeeklyScores(data);
      } else if (activeTab === 'roster') {
        const [lineupData, , txData] = await Promise.all([
          api.getLineup(leagueId),
          api.getRoster(leagueId),
          api.getTransactions(leagueId),
        ]);
        setLineup(lineupData);
        setTransactions(txData || []);
      } else if (activeTab === 'trades') {
        const data = await api.getTrades(leagueId);
        setTrades(data || []);
      }
      if (initialLoad) setInitialLoad(false);
    } catch (err) {
      if (!silent) Alert.alert('Error', err.message);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  function handleTabChange(newTab) {
    setTab(newTab);
  }

  async function loadData() {
    await loadTabData(tab, false);
  }

  // --- Roster/Lineup actions ---
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

  function fmtPts(v) {
    if (v == null || v === 0) return '0';
    return (v > 0 ? '+' : '') + v;
  }

  function renderStatRow(label, value, pts, color) {
    return (
      <View style={styles.statRow} key={label}>
        <Text style={styles.statRowLabel}>{label}</Text>
        <Text style={styles.statRowValue}>{value}</Text>
        <Text style={[styles.statRowPts, { color: color || (pts >= 0 ? '#5cb85c' : '#d9534f') }]}>
          {fmtPts(pts)}
        </Text>
      </View>
    );
  }

  function renderPlayerCard(p, i, teamId) {
    const playerKey = `${teamId}-${p.playerName}`;
    const isPlayerExpanded = expandedPlayer === playerKey;
    const sb = p.stat_breakdown || {};
    const holeRows = [];
    if (p.eagles > 0) holeRows.push({ label: 'Eagles', value: p.eagles, pts: +(p.eagles * (league?.scoringConfig?.eagle || 5)).toFixed(2) });
    if (p.birdies > 0) holeRows.push({ label: 'Birdies', value: p.birdies, pts: +(p.birdies * (league?.scoringConfig?.birdie || 3)).toFixed(2) });
    if (p.pars > 0) holeRows.push({ label: 'Pars', value: p.pars, pts: +(p.pars * (league?.scoringConfig?.par || 0.5)).toFixed(2) });
    if (p.bogeys > 0) holeRows.push({ label: 'Bogeys', value: p.bogeys, pts: +(p.bogeys * (league?.scoringConfig?.bogey || -1)).toFixed(2) });
    if (p.doubles_or_worse > 0) holeRows.push({ label: 'Double+', value: p.doubles_or_worse, pts: +(p.doubles_or_worse * (league?.scoringConfig?.double_bogey || -3)).toFixed(2) });

    return (
      <View key={i} style={styles.playerCard}>
        <TouchableOpacity
          style={styles.playerCardHeader}
          onPress={() => setExpandedPlayer(isPlayerExpanded ? null : playerKey)}
        >
          <View style={styles.playerCardLeft}>
            <Text style={styles.playerCardName}>{p.playerName}</Text>
            <Text style={styles.playerCardThru}>{p.holes_played} holes</Text>
          </View>
          <Text style={[styles.playerCardTotal, p.points >= 0 ? styles.positive : styles.negative]}>
            {fmtPts(p.points)} pts
          </Text>
          <Text style={styles.playerExpandArrow}>{isPlayerExpanded ? '^' : 'v'}</Text>
        </TouchableOpacity>

        {isPlayerExpanded && (
          <View style={styles.playerCardBody}>
            {/* Hole scoring section */}
            <View style={styles.statSection}>
              <Text style={styles.statSectionTitle}>Scoring</Text>
              {holeRows.map(r => renderStatRow(r.label, r.value, r.pts))}
              {holeRows.length === 0 && (
                <Text style={styles.noDataText}>No holes scored yet</Text>
              )}
              <View style={styles.statTotalRow}>
                <Text style={styles.statTotalLabel}>Hole Points</Text>
                <Text style={[styles.statTotalPts, p.hole_points >= 0 ? styles.positive : styles.negative]}>
                  {fmtPts(p.hole_points)}
                </Text>
              </View>
            </View>

            {/* Stat bonuses section */}
            <View style={styles.statSection}>
              <Text style={styles.statSectionTitle}>Stat Bonuses</Text>
              {sb.fir && renderStatRow(
                'Fairways Hit',
                `${(sb.fir.value * 100).toFixed(1)}% (avg ${(sb.fir.avg * 100).toFixed(1)}%)`,
                sb.fir.pts
              )}
              {sb.gir && renderStatRow(
                'Greens in Reg',
                `${(sb.gir.value * 100).toFixed(1)}% (avg ${(sb.gir.avg * 100).toFixed(1)}%)`,
                sb.gir.pts
              )}
              {sb.distance && renderStatRow(
                'Driving Dist',
                `${sb.distance.value?.toFixed(1)} yds (avg ${sb.distance.avg?.toFixed(1)})`,
                sb.distance.pts
              )}
              {sb.great_shots && renderStatRow(
                'Great Shots',
                `${sb.great_shots.count}`,
                sb.great_shots.pts
              )}
              {sb.poor_shots && renderStatRow(
                'Poor Shots',
                `${sb.poor_shots.count}`,
                sb.poor_shots.pts
              )}
              {Object.keys(sb).length === 0 && (
                <Text style={styles.noDataText}>No stat data yet</Text>
              )}
              <View style={styles.statTotalRow}>
                <Text style={styles.statTotalLabel}>Stat Points</Text>
                <Text style={[styles.statTotalPts, p.stat_points >= 0 ? styles.positive : styles.negative]}>
                  {fmtPts(p.stat_points)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  function renderWeeklyScores() {
    if (!weeklyScores) return null;

    return (
      <FlatList
        data={weeklyScores.teams}
        keyExtractor={(item) => item.memberId.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>This Week</Text>
            <Text style={styles.subtitle}>
              {weeklyScores.tournament ? weeklyScores.tournament.name : 'No active tournament'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isExpanded = expandedTeam === item.memberId;
          const starters = item.players.filter(p => p.slot === 'starter');
          const benchPlayers = item.players.filter(p => p.slot === 'bench');

          return (
            <View style={styles.weekCard}>
              <TouchableOpacity
                style={styles.weekCardHeader}
                onPress={() => setExpandedTeam(isExpanded ? null : item.memberId)}
              >
                <Text style={styles.weekRank}>{index + 1}</Text>
                <View style={styles.weekInfo}>
                  <Text style={[styles.teamName, item.isMe && styles.myTeam]}>
                    {item.teamName} {item.isMe ? '(You)' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    Hole: {item.holePoints} | Stat: {item.statPoints}
                  </Text>
                </View>
                <View style={styles.weekPointsCol}>
                  <Text style={styles.weekPoints}>{item.totalPoints}</Text>
                  <Text style={styles.weekPtsLabel}>pts</Text>
                </View>
                <Text style={styles.expandArrow}>{isExpanded ? '^' : 'v'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.playerBreakdown}>
                  {starters.map((p, i) => renderPlayerCard(p, i, item.memberId))}

                  {benchPlayers.length > 0 && (
                    <>
                      <Text style={[styles.breakdownLabel, { marginTop: 10 }]}>Bench</Text>
                      {benchPlayers.map((p, i) => (
                        <View key={`bench-${i}`} style={styles.benchCard}>
                          <Text style={styles.benchName}>{p.playerName}</Text>
                          <Text style={styles.benchPts}>Not scoring</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !refreshing && <Text style={styles.emptyText}>No scores yet</Text>
        }
      />
    );
  }

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

  function renderRoster() {
    if (!lineup || !league) return null;

    const starters = lineup.lineup.filter(l => l.slot === 'starter');
    const bench = lineup.lineup.filter(l => l.slot === 'bench');
    const inLineup = new Set(lineup.lineup.map(l => l.playerName.toLowerCase()));
    const unset = (lineup.roster || []).filter(name => !inLineup.has(name.toLowerCase()));

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
            <View style={styles.rosterHeaderRow}>
              <View>
                <Text style={styles.title}>My Roster</Text>
                <Text style={styles.subtitle}>
                  {lineup.tournament ? lineup.tournament.name : 'No active tournament'}
                  {'  |  '}{(lineup.roster || []).length}/{league.rosterSize || '?'} players
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
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((player, i) => {
              const name = typeof player === 'string' ? player : player.playerName;
              const locked = player.locked;
              return (
                <View key={i} style={styles.rosterRow}>
                  <Text style={[styles.playerName, locked && styles.lockedPlayer]}>{name}</Text>
                  {locked ? (
                    <Text style={styles.lockedText}>Locked</Text>
                  ) : (
                    <View style={styles.rosterActions}>
                      {section.type === 'starter' ? (
                        <TouchableOpacity style={styles.moveBtn} onPress={() => movePlayer(name, 'bench')}>
                          <Text style={styles.moveBtnText}>Bench</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.moveBtn, styles.startBtn]} onPress={() => movePlayer(name, 'starter')}>
                          <Text style={styles.moveBtnText}>Start</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.dropBtn} onPress={() => handleDrop(name)}>
                        <Text style={styles.dropBtnText}>Drop</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
            {section.data.length === 0 && (
              <Text style={styles.emptyText}>No players</Text>
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
                    <Text style={styles.transactionType}>{t.type.toUpperCase()}</Text>
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
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptTrade(item.id)}>
                  <Text style={styles.actionBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleDeclineTrade(item.id)}>
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
    { key: 'week', label: 'This Week' },
    { key: 'standings', label: 'Standings' },
    { key: 'roster', label: 'Roster' },
    { key: 'trades', label: 'Trades' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.activeTab]}
            onPress={() => handleTabChange(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.activeTabText]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'week' && renderWeeklyScores()}
      {tab === 'standings' && renderStandings()}
      {tab === 'roster' && renderRoster()}
      {tab === 'trades' && renderTrades()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a472a' },

  // Tabs
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  tab: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8,
    backgroundColor: '#2d5a3d', marginHorizontal: 3,
  },
  activeTab: { backgroundColor: '#4a8c5c' },
  tabText: { color: '#8a9a5b', fontSize: 13, fontWeight: '600' },
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
  positive: { color: '#5cb85c' },
  negative: { color: '#d9534f' },

  // This Week
  weekCard: {
    backgroundColor: '#2d5a3d', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden',
  },
  weekCardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
  },
  weekRank: { color: '#8a9a5b', fontSize: 20, fontWeight: 'bold', width: 30, textAlign: 'center' },
  weekInfo: { flex: 1, marginLeft: 10 },
  teamName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  myTeam: { color: '#5cb85c' },
  weekPointsCol: { alignItems: 'center', marginRight: 8 },
  weekPoints: { color: '#5cb85c', fontSize: 22, fontWeight: 'bold' },
  weekPtsLabel: { color: '#8a9a5b', fontSize: 10 },
  expandArrow: { color: '#8a9a5b', fontSize: 16, width: 20, textAlign: 'center' },

  // Player breakdown
  playerBreakdown: {
    backgroundColor: '#1f3d28', paddingHorizontal: 12, paddingBottom: 14,
  },
  breakdownLabel: { color: '#8a9a5b', fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 4 },

  // Player card (fantasy football style)
  playerCard: {
    backgroundColor: '#1a472a', borderRadius: 10, marginBottom: 8, overflow: 'hidden',
  },
  playerCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2d5a3d', paddingHorizontal: 12, paddingVertical: 10,
  },
  playerCardLeft: { flex: 1 },
  playerCardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  playerCardTotal: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  playerCardThru: { color: '#6a7a5b', fontSize: 11, marginTop: 1 },
  playerExpandArrow: { color: '#8a9a5b', fontSize: 14, width: 18, textAlign: 'center' },
  playerCardBody: {},

  // Stat sections
  statSection: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  statSectionTitle: {
    color: '#8a9a5b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: '#1f3d28',
  },
  statRowLabel: { flex: 1, color: '#b0c4a8', fontSize: 13 },
  statRowValue: { color: '#8a9a5b', fontSize: 12, marginRight: 12, textAlign: 'right' },
  statRowPts: { fontSize: 13, fontWeight: '700', width: 48, textAlign: 'right' },
  statTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 6, marginTop: 2,
  },
  statTotalLabel: { color: '#8a9a5b', fontSize: 12, fontWeight: '600' },
  statTotalPts: { fontSize: 14, fontWeight: 'bold', width: 48, textAlign: 'right' },
  noDataText: { color: '#4a5a3b', fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },

  // Bench in breakdown
  benchCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a472a', borderRadius: 8, padding: 10, marginBottom: 4,
  },
  benchName: { color: '#6a7a5b', fontSize: 14 },
  benchPts: { color: '#6a7a5b', fontSize: 12 },

  // Standings
  standingRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 12, padding: 14,
  },
  rank: { color: '#8a9a5b', fontSize: 20, fontWeight: 'bold', width: 30, textAlign: 'center' },
  standingInfo: { flex: 1, marginLeft: 12 },
  points: { color: '#5cb85c', fontSize: 22, fontWeight: 'bold' },

  // Roster (merged with lineup)
  rosterHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 4, borderRadius: 10, padding: 14,
  },
  rosterActions: { flexDirection: 'row', gap: 8 },
  freeAgentBtn: {
    backgroundColor: '#4a8c5c', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  freeAgentBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  moveBtn: {
    backgroundColor: '#1a472a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#f0ad4e',
  },
  startBtn: { borderColor: '#4a8c5c' },
  moveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dropBtn: {
    backgroundColor: '#1a472a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#d9534f',
  },
  dropBtnText: { color: '#d9534f', fontSize: 12, fontWeight: '600' },
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
