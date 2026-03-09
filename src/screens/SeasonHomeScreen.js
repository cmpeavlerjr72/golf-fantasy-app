import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { colors } from '../theme';

const AUTO_REFRESH_MS = 60 * 1000; // Auto-refresh every 60s on This Week tab

export default function SeasonHomeScreen({ route, navigation }) {
  const { leagueId } = route.params;
  const [tab, setTab] = useState('week');
  const [standings, setStandings] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [league, setLeague] = useState(null);
  const [weeklyScores, setWeeklyScores] = useState(null);
  const [trades, setTrades] = useState([]);
  const [history, setHistory] = useState(null);
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
      } else if (activeTab === 'history') {
        const data = await api.getWeeklyHistory(leagueId);
        setHistory(data || []);
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
        <Text style={[styles.statRowPts, { color: color || (pts >= 0 ? colors.positive : colors.negative) }]}>
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

    const positionPts = p.position_points || 0;

    return (
      <View key={i} style={styles.playerCard}>
        <TouchableOpacity
          style={styles.playerCardHeader}
          onPress={() => setExpandedPlayer(isPlayerExpanded ? null : playerKey)}
        >
          <View style={styles.playerCardLeft}>
            <Text style={styles.playerCardName}>{p.playerName}</Text>
            <Text style={styles.playerCardThru}>
              {p.position ? `Pos: ${p.position}` : ''}{p.position ? '  |  ' : ''}{p.holes_played} holes
            </Text>
          </View>
          <Text style={[styles.playerCardTotal, p.points >= 0 ? styles.positive : styles.negative]}>
            {fmtPts(p.points)} pts
          </Text>
          <Text style={styles.playerExpandArrow}>{isPlayerExpanded ? '^' : 'v'}</Text>
        </TouchableOpacity>

        {isPlayerExpanded && (
          <View style={styles.playerCardBody}>
            {/* Position points section */}
            <View style={styles.statSection}>
              <Text style={styles.statSectionTitle}>Leaderboard Position</Text>
              {renderStatRow(
                p.position ? `Position: ${p.position}` : 'No position yet',
                '',
                positionPts,
                positionPts > 0 ? colors.gold : undefined
              )}
              <View style={styles.statTotalRow}>
                <Text style={styles.statTotalLabel}>Position Points</Text>
                <Text style={[styles.statTotalPts, positionPts >= 0 ? styles.positive : styles.negative]}>
                  {fmtPts(positionPts)}
                </Text>
              </View>
            </View>

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
                    Pos: {item.positionPoints || 0} | Hole: {item.holePoints} | Stat: {item.statPoints}
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
                {item.tournamentsPlayed} tournaments{item.avgPosition ? ` | Avg finish: ${item.avgPosition}` : ''}
              </Text>
            </View>
            <View style={styles.standingPointsCol}>
              <Text style={styles.points}>{item.totalPoints.toFixed(0)}</Text>
              <Text style={styles.weekPtsLabel}>season pts</Text>
            </View>
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

  function renderHistoryPlayerCard(p, i, teamKey) {
    const playerKey = `hist-${teamKey}-${p.playerName}`;
    const isPlayerExpanded = expandedPlayer === playerKey;
    const sb = p.stat_breakdown || {};
    const holeRows = [];
    if (p.eagles > 0) holeRows.push({ label: 'Eagles', value: p.eagles, pts: +(p.eagles * (league?.scoringConfig?.eagle || 5)).toFixed(2) });
    if (p.birdies > 0) holeRows.push({ label: 'Birdies', value: p.birdies, pts: +(p.birdies * (league?.scoringConfig?.birdie || 3)).toFixed(2) });
    if (p.pars > 0) holeRows.push({ label: 'Pars', value: p.pars, pts: +(p.pars * (league?.scoringConfig?.par || 0.5)).toFixed(2) });
    if (p.bogeys > 0) holeRows.push({ label: 'Bogeys', value: p.bogeys, pts: +(p.bogeys * (league?.scoringConfig?.bogey || -1)).toFixed(2) });
    if (p.doubles_or_worse > 0) holeRows.push({ label: 'Double+', value: p.doubles_or_worse, pts: +(p.doubles_or_worse * (league?.scoringConfig?.double_bogey || -3)).toFixed(2) });

    const positionPts = p.position_points || 0;

    return (
      <View key={i} style={styles.playerCard}>
        <TouchableOpacity
          style={styles.playerCardHeader}
          onPress={() => setExpandedPlayer(isPlayerExpanded ? null : playerKey)}
        >
          <View style={styles.playerCardLeft}>
            <Text style={styles.playerCardName}>{p.playerName}</Text>
            <Text style={styles.playerCardThru}>
              {p.position ? `Pos: ${p.position}` : ''}{p.position ? '  |  ' : ''}{p.holes_played} holes
            </Text>
          </View>
          <Text style={[styles.playerCardTotal, p.points >= 0 ? styles.positive : styles.negative]}>
            {fmtPts(p.points)} pts
          </Text>
          <Text style={styles.playerExpandArrow}>{isPlayerExpanded ? '^' : 'v'}</Text>
        </TouchableOpacity>

        {isPlayerExpanded && (
          <View style={styles.playerCardBody}>
            {/* Position points section */}
            <View style={styles.statSection}>
              <Text style={styles.statSectionTitle}>Leaderboard Position</Text>
              {renderStatRow(
                p.position ? `Position: ${p.position}` : 'No position data',
                '',
                positionPts,
                positionPts > 0 ? colors.gold : undefined
              )}
              <View style={styles.statTotalRow}>
                <Text style={styles.statTotalLabel}>Position Points</Text>
                <Text style={[styles.statTotalPts, positionPts >= 0 ? styles.positive : styles.negative]}>
                  {fmtPts(positionPts)}
                </Text>
              </View>
            </View>

            <View style={styles.statSection}>
              <Text style={styles.statSectionTitle}>Scoring</Text>
              {holeRows.map(r => renderStatRow(r.label, r.value, r.pts))}
              {holeRows.length === 0 && (
                <Text style={styles.noDataText}>No holes scored</Text>
              )}
              <View style={styles.statTotalRow}>
                <Text style={styles.statTotalLabel}>Hole Points</Text>
                <Text style={[styles.statTotalPts, p.hole_points >= 0 ? styles.positive : styles.negative]}>
                  {fmtPts(p.hole_points)}
                </Text>
              </View>
            </View>

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
                <Text style={styles.noDataText}>No stat data available</Text>
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

  function renderHistory() {
    if (!history) return null;

    // Flatten into a list: tournament headers + team rows
    const flatData = [];
    for (const week of history) {
      flatData.push({ type: 'header', tournamentName: week.tournamentName, key: `h-${week.tournamentId}` });
      for (const r of week.results) {
        flatData.push({ type: 'team', ...r, tournamentId: week.tournamentId, key: `t-${week.tournamentId}-${r.memberId}` });
      }
    }

    return (
      <FlatList
        data={flatData}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.title}>Previous Weeks</Text>
            <Text style={styles.subtitle}>Finalized tournament results</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.historyWeek}>
                <Text style={styles.historyTournamentName}>{item.tournamentName}</Text>
              </View>
            );
          }

          const teamKey = `${item.tournamentId}-${item.memberId}`;
          const isExpanded = expandedTeam === teamKey;

          return (
            <View style={[styles.weekCard, { marginHorizontal: 16, marginBottom: 6 }]}>
              <TouchableOpacity
                style={styles.weekCardHeader}
                onPress={() => setExpandedTeam(isExpanded ? null : teamKey)}
              >
                <Text style={styles.weekRank}>{item.position}</Text>
                <View style={styles.weekInfo}>
                  <Text style={styles.teamName}>{item.teamName}</Text>
                  <Text style={styles.meta}>{item.weeklyPoints.toFixed(1)} fantasy pts</Text>
                </View>
                <View style={styles.historyPointsCol}>
                  <Text style={styles.historySeasonPts}>{item.seasonPoints}</Text>
                  <Text style={styles.weekPtsLabel}>season pts</Text>
                </View>
                <Text style={styles.expandArrow}>{isExpanded ? '^' : 'v'}</Text>
              </TouchableOpacity>

              {isExpanded && item.players && item.players.length > 0 && (
                <View style={styles.playerBreakdown}>
                  {item.players.map((p, i) => renderHistoryPlayerCard(p, i, teamKey))}
                </View>
              )}

              {isExpanded && (!item.players || item.players.length === 0) && (
                <View style={styles.playerBreakdown}>
                  <Text style={styles.noDataText}>No lineup set for this tournament</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !refreshing && <Text style={styles.emptyText}>No finalized weeks yet</Text>
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
    { key: 'history', label: 'History' },
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
      {tab === 'history' && renderHistory()}
      {tab === 'roster' && renderRoster()}
      {tab === 'trades' && renderTrades()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Tabs
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8,
    backgroundColor: colors.bgCard, marginHorizontal: 3,
  },
  activeTab: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#fff' },

  // Common
  sectionHeader: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 15 },
  playerName: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  lockedPlayer: { color: colors.textMuted },
  lockedText: { color: colors.textMuted, fontSize: 12 },
  positive: { color: colors.positive },
  negative: { color: colors.negative },

  // This Week
  weekCard: {
    backgroundColor: colors.bgCard, marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  weekCardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
  },
  weekRank: { color: colors.textMuted, fontSize: 18, fontWeight: '800', width: 28, textAlign: 'center' },
  weekInfo: { flex: 1, marginLeft: 10 },
  teamName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  myTeam: { color: colors.accent },
  weekPointsCol: { alignItems: 'flex-end', marginRight: 8 },
  weekPoints: { color: colors.positive, fontSize: 20, fontWeight: '800' },
  weekPtsLabel: { color: colors.textMuted, fontSize: 10 },
  expandArrow: { color: colors.textMuted, fontSize: 14, width: 20, textAlign: 'center' },

  // Player breakdown
  playerBreakdown: {
    backgroundColor: colors.bgCardAlt, paddingHorizontal: 12, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  breakdownLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Player card
  playerCard: {
    backgroundColor: colors.bg, borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  playerCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgElevated, paddingHorizontal: 12, paddingVertical: 10,
  },
  playerCardLeft: { flex: 1 },
  playerCardName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  playerCardTotal: { fontSize: 16, fontWeight: '800', marginRight: 8 },
  playerCardThru: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  playerExpandArrow: { color: colors.textMuted, fontSize: 14, width: 18, textAlign: 'center' },
  playerCardBody: { backgroundColor: colors.bgCard },

  // Stat sections
  statSection: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  statSectionTitle: {
    color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statRowLabel: { flex: 1, color: colors.textSecondary, fontSize: 13 },
  statRowValue: { color: colors.textMuted, fontSize: 12, marginRight: 12, textAlign: 'right' },
  statRowPts: { fontSize: 13, fontWeight: '700', width: 48, textAlign: 'right' },
  statTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 6, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.border,
  },
  statTotalLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  statTotalPts: { fontSize: 14, fontWeight: '800', width: 48, textAlign: 'right' },
  noDataText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },

  // Bench in breakdown
  benchCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginBottom: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  benchName: { color: colors.textMuted, fontSize: 14 },
  benchPts: { color: colors.textMuted, fontSize: 12 },

  // Standings
  standingRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginHorizontal: 16, marginBottom: 6, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  rank: { color: colors.textMuted, fontSize: 18, fontWeight: '800', width: 30, textAlign: 'center' },
  standingInfo: { flex: 1, marginLeft: 12 },
  standingPointsCol: { alignItems: 'flex-end' },
  points: { color: colors.positive, fontSize: 22, fontWeight: '800' },

  // Roster
  rosterHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginHorizontal: 16, marginBottom: 4, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  rosterActions: { flexDirection: 'row', gap: 8 },
  freeAgentBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  freeAgentBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  moveBtn: {
    backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.gold,
  },
  startBtn: { borderColor: colors.accent },
  moveBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  dropBtn: {
    backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.negative + '88',
  },
  dropBtnText: { color: colors.negative, fontSize: 12, fontWeight: '600' },
  transactionsSection: { marginTop: 20, paddingBottom: 30 },
  transactionRow: {
    backgroundColor: colors.bgCard, marginHorizontal: 16, marginBottom: 4,
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border,
  },
  transactionText: { color: colors.textPrimary, fontSize: 13 },
  transactionType: { color: colors.gold, fontWeight: '700' },

  // Trades
  tradeRow: {
    backgroundColor: colors.bgCard, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  tradePlayers: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  tradeSide: { flex: 1 },
  tradeTeam: { color: colors.textMuted, fontSize: 12 },
  tradePlayer: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginTop: 2 },
  tradeArrow: { color: colors.textMuted, fontSize: 16, marginHorizontal: 8 },
  tradeActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, backgroundColor: colors.accent, borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  declineBtn: {
    flex: 1, backgroundColor: colors.negative, borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tradeStatus: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  statusAccepted: { color: colors.positive },
  statusDeclined: { color: colors.negative },

  // History
  historyWeek: {
    marginHorizontal: 16, marginBottom: 16,
  },
  historyTournamentName: {
    color: colors.accent, fontSize: 16, fontWeight: '700', marginBottom: 8,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginBottom: 4, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  historyRank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 28, textAlign: 'center' },
  historyInfo: { flex: 1, marginLeft: 10 },
  historyPointsCol: { alignItems: 'flex-end' },
  historySeasonPts: { color: colors.gold, fontSize: 18, fontWeight: '800' },
});
