import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Pressable, StyleSheet, Alert, ActivityIndicator,
  TextInput, ScrollView, Platform,
} from 'react-native';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/api';
import * as api from '../services/api';
import { colors } from '../theme';

const SOCKET_URL = 'https://golf-fantasy-backend.onrender.com';

export default function DraftScreen({ route }) {
  const { leagueId, leagueType, tournamentId: routeTournamentId } = route.params;
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [draftState, setDraftState] = useState(null);
  const [allPlayersData, setAllPlayersData] = useState(null);
  // Fallback stats for pool leagues or if allPlayers fails
  const [playerStats, setPlayerStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('available');
  const [search, setSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState('all'); // 'all' | 'available' | 'drafted'
  const [playerSort, setPlayerSort] = useState('dg'); // 'dg' | 'owgr' | 'avgPts'
  const [expandedPlayerRow, setExpandedPlayerRow] = useState(null);

  const isSeason = leagueType === 'season';

  useEffect(() => {
    loadPlayerData();
    connectSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  async function loadPlayerData() {
    try {
      // For season leagues, load the full research data with history
      if (isSeason) {
        const data = await api.getAllPlayers(leagueId);
        setAllPlayersData(data);
      }
      // Also load basic stats as fallback / for pool leagues
      let stats;
      const tId = routeTournamentId;
      if (!isSeason && tId) {
        stats = await api.getTournamentField(tId);
      } else if (isSeason) {
        stats = await api.getPlayerStats('pga');
      } else {
        stats = await api.getPlayerStats();
      }
      setPlayerStats(stats);
    } catch (err) {
      console.warn('Could not load player data:', err.message);
    }
  }

  function connectSocket() {
    const socket = io(SOCKET_URL, { auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-draft', { leagueId });
    });

    socket.on('draft-state', (state) => {
      setDraftState(prev => {
        if (!prev && state.tournamentId && !routeTournamentId && !isSeason) {
          api.getTournamentField(state.tournamentId).then(setPlayerStats).catch(() => {});
        }
        return state;
      });
      setLoading(false);
    });

    socket.on('draft-error', ({ message }) => {
      Alert.alert('Draft Error', message);
    });
  }

  function handleStartDraft() {
    socketRef.current?.emit('start-draft', { leagueId });
  }

  function handlePick(playerName) {
    if (Platform.OS === 'web') {
      if (window.confirm(`Draft ${playerName}?`)) {
        socketRef.current?.emit('draft-pick', { leagueId, playerName });
      }
    } else {
      Alert.alert('Confirm Pick', `Draft ${playerName}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Draft',
          onPress: () => socketRef.current?.emit('draft-pick', { leagueId, playerName }),
        },
      ]);
    }
  }

  // --- Player research data (season leagues) ---
  const draftedNames = useMemo(() => {
    if (!draftState?.picks) return new Set();
    return new Set(draftState.picks.map(p => p.playerName.toLowerCase()));
  }, [draftState?.picks]);

  // Map drafted player -> team name
  const draftedByMap = useMemo(() => {
    if (!draftState?.picks || !draftState?.members) return {};
    const memberMap = {};
    for (const m of draftState.members) memberMap[m.id] = m;
    const map = {};
    for (const pick of draftState.picks) {
      const member = memberMap[pick.memberId];
      if (member) {
        map[pick.playerName.toLowerCase()] = {
          teamName: member.teamName,
          isMe: member.userId === user.id,
        };
      }
    }
    return map;
  }, [draftState?.picks, draftState?.members, user.id]);

  const filteredPlayers = useMemo(() => {
    if (!isSeason || !allPlayersData?.players) {
      // Pool league fallback — use simple playerStats
      let list = playerStats.filter(p => !draftedNames.has(p.playerName.toLowerCase()));
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(p => p.playerName.toLowerCase().includes(q));
      }
      return list;
    }

    let list = [...allPlayersData.players];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.playerName.toLowerCase().includes(q));
    }
    if (playerFilter === 'available') list = list.filter(p => !draftedNames.has(p.playerName.toLowerCase()));
    else if (playerFilter === 'drafted') list = list.filter(p => draftedNames.has(p.playerName.toLowerCase()));

    if (playerSort === 'owgr') {
      list.sort((a, b) => (a.owgrRank || 9999) - (b.owgrRank || 9999));
    } else if (playerSort === 'avgPts') {
      const avg = (p) => {
        const h = p.history || [];
        return h.length > 0 ? h.reduce((s, e) => s + e.points, 0) / h.length : -9999;
      };
      list.sort((a, b) => avg(b) - avg(a));
    } else {
      list.sort((a, b) => (a.dgRank || 9999) - (b.dgRank || 9999));
    }
    return list;
  }, [isSeason, allPlayersData, playerStats, search, playerFilter, playerSort, draftedNames]);

  // Color gradient for stat cells
  function getCellColor(value, allValues) {
    if (value == null || allValues.length === 0) return 'transparent';
    const sorted = [...allValues].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;
    if (range === 0) return colors.bgElevated;
    const ratio = (value - min) / range;
    if (ratio < 0.3) {
      const t = ratio / 0.3;
      return `rgba(248,81,73,${0.45 - t * 0.25})`;
    }
    if (ratio < 0.6) return 'transparent';
    const t = (ratio - 0.6) / 0.4;
    return `rgba(63,185,80,${0.15 + t * 0.4})`;
  }

  if (loading || !draftState) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Connecting to draft...</Text>
      </View>
    );
  }

  const isMyTurn = draftState.status === 'drafting' &&
    draftState.members.find(m => m.id === draftState.currentMemberId)?.userId === user.id;
  const currentTeam = draftState.members.find(m => m.id === draftState.currentMemberId);
  const tournaments = allPlayersData?.tournaments || [];

  // Pool league helpers
  function formatSg(val) {
    if (val == null || isNaN(val)) return '-';
    const num = parseFloat(val);
    return (num >= 0 ? '+' : '') + num.toFixed(2);
  }
  function sgColor(val) {
    if (val == null || isNaN(val)) return colors.textMuted;
    return parseFloat(val) >= 0 ? colors.positive : colors.negative;
  }

  function renderPoolPlayerRow({ item }) {
    return (
      <TouchableOpacity
        style={[styles.poolPlayerRow, isMyTurn && styles.playerRowActive]}
        onPress={() => isMyTurn && handlePick(item.playerName)}
        disabled={!isMyTurn}
        activeOpacity={isMyTurn ? 0.6 : 1}
      >
        <View style={styles.playerInfo}>
          <View style={styles.rankBadge}>
            <Text style={styles.playerRank}>{item.dgRank || item.owgrRank || '-'}</Text>
          </View>
          <Text style={styles.poolPlayerName} numberOfLines={1}>{item.playerName}</Text>
        </View>
        <View style={styles.poolPlayerStats}>
          <Text style={styles.statLabel}>SG Total</Text>
          <Text style={[styles.statValue, { color: sgColor(item.sgTotal) }]}>{formatSg(item.sgTotal)}</Text>
        </View>
        <View style={styles.poolPlayerStats}>
          <Text style={styles.statLabel}>Win%</Text>
          <Text style={styles.statValue}>{item.winPct?.toFixed(1) || '-'}%</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderSeasonPlayerCard({ item }) {
    const isExpanded = expandedPlayerRow === item.playerName;
    const isDrafted = draftedNames.has(item.playerName.toLowerCase());
    const draftedBy = draftedByMap[item.playerName.toLowerCase()];
    const hist = item.history || [];

    const vals = (key) => hist.map(h => h[key]).filter(v => v != null);
    const vFpts = vals('points');
    const vPosPts = vals('posPoints');
    const vHolePts = vals('holePoints');
    const vEagles = vals('eagles');
    const vBirdies = vals('birdies');
    const vPars = vals('pars');
    const vBogeys = hist.map(h => h.bogeys != null ? -h.bogeys : null).filter(v => v != null);
    const vDoubles = hist.map(h => h.doubles != null ? -h.doubles : null).filter(v => v != null);
    const vStatPts = vals('statPoints');
    const vFir = vals('firPts');
    const vGir = vals('girPts');
    const vDist = vals('distPts');
    const vGreat = vals('greatPts');
    const vPoor = vals('poorPts');

    const totalPts = hist.reduce((s, h) => s + h.points, 0);
    const avgPts = hist.length > 0 ? totalPts / hist.length : 0;
    const sum = (key) => hist.reduce((s, h) => s + (h[key] || 0), 0);

    return (
      <TouchableOpacity
        style={[styles.playerListCard, isDrafted && styles.playerListCardDrafted]}
        onPress={() => setExpandedPlayerRow(isExpanded ? null : item.playerName)}
        activeOpacity={0.7}
      >
        {/* Collapsed row */}
        <View style={styles.playerListHeader}>
          <View style={styles.playerListRankCol}>
            <Text style={styles.playerListRank}>
              {playerSort === 'owgr' ? (item.owgrRank || '-')
                : playerSort === 'avgPts' ? (avgPts > -9000 ? avgPts.toFixed(0) : '-')
                : (item.dgRank || '-')}
            </Text>
          </View>
          <View style={styles.playerListInfo}>
            <Text style={[styles.playerListName, isDrafted && styles.playerListNameDrafted]}>
              {item.playerName}
            </Text>
            <View style={styles.playerListMeta}>
              {isDrafted && draftedBy ? (
                <View style={[styles.ownerBadge, draftedBy.isMe && styles.ownerBadgeMe]}>
                  <Text style={[styles.ownerBadgeText, draftedBy.isMe && styles.ownerBadgeTextMe]}>
                    {draftedBy.isMe ? 'My Pick' : draftedBy.teamName}
                  </Text>
                </View>
              ) : (
                <Text style={styles.freeAgentLabel}>Available</Text>
              )}
              {item.sgTotal != null && (
                <Text style={styles.playerListSg}>SG: {item.sgTotal.toFixed(2)}</Text>
              )}
            </View>
          </View>
          {/* Draft button */}
          {isMyTurn && !isDrafted && (
            <Pressable
              style={styles.draftBtn}
              onPress={() => handlePick(item.playerName)}
              {...(Platform.OS === 'web' ? {
                onStartShouldSetResponder: () => true,
                onTouchEnd: (e) => { e.stopPropagation(); },
                onClick: (e) => { e.stopPropagation(); handlePick(item.playerName); },
              } : {})}
            >
              <Text style={styles.draftBtnText}>Draft</Text>
            </Pressable>
          )}
          <Text style={styles.playerExpandArrow}>{isExpanded ? '^' : 'v'}</Text>
        </View>

        {/* Expanded player card */}
        {isExpanded && (
          <View style={styles.pcExpanded}>
            {/* Player rankings header */}
            <View style={styles.pcRankingsRow}>
              <View style={styles.pcRankItem}>
                <Text style={styles.pcRankValue}>#{item.dgRank || '-'}</Text>
                <Text style={styles.pcRankLabel}>DG RANK</Text>
              </View>
              <View style={styles.pcRankItem}>
                <Text style={styles.pcRankValue}>#{item.owgrRank || '-'}</Text>
                <Text style={styles.pcRankLabel}>OWGR</Text>
              </View>
              <View style={styles.pcRankItem}>
                <Text style={[styles.pcRankValue, { color: colors.accent }]}>
                  {item.sgTotal != null ? item.sgTotal.toFixed(2) : '-'}
                </Text>
                <Text style={styles.pcRankLabel}>SG TOTAL</Text>
              </View>
              <View style={styles.pcRankItem}>
                <Text style={[styles.pcRankValue, { color: colors.gold }]}>
                  {avgPts.toFixed(1)}
                </Text>
                <Text style={styles.pcRankLabel}>AVG PTS</Text>
              </View>
            </View>

            {/* Tournament log table */}
            {hist.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  <View style={styles.pcTableHeader}>
                    <Text style={[styles.pcColHeader, styles.pcColEvent]}>EVENT</Text>
                    <Text style={[styles.pcColHeader, styles.pcColTotal]}>FPTS</Text>
                    <Text style={[styles.pcColHeader, styles.pcColStat]}>POS</Text>
                    <Text style={[styles.pcColHeader, styles.pcColTotal]}>POS PT</Text>
                    <View style={styles.pcGroupDivider} />
                    <Text style={[styles.pcColHeader, styles.pcColTotal]}>HOLE</Text>
                    <Text style={[styles.pcColHeader, styles.pcColNarrow]}>EGL</Text>
                    <Text style={[styles.pcColHeader, styles.pcColNarrow]}>BRD</Text>
                    <Text style={[styles.pcColHeader, styles.pcColNarrow]}>PAR</Text>
                    <Text style={[styles.pcColHeader, styles.pcColNarrow]}>BOG</Text>
                    <Text style={[styles.pcColHeader, styles.pcColNarrow]}>DBL+</Text>
                    <View style={styles.pcGroupDivider} />
                    <Text style={[styles.pcColHeader, styles.pcColTotal]}>STAT</Text>
                    <Text style={[styles.pcColHeader, styles.pcColStat]}>FIR</Text>
                    <Text style={[styles.pcColHeader, styles.pcColStat]}>GIR</Text>
                    <Text style={[styles.pcColHeader, styles.pcColStat]}>DIST</Text>
                    <Text style={[styles.pcColHeader, styles.pcColStat]}>GREAT</Text>
                    <Text style={[styles.pcColHeader, styles.pcColStat]}>POOR</Text>
                  </View>

                  {hist.slice().reverse().map((h, i) => {
                    const shortName = h.tournamentName
                      .replace(/^(The |the )/, '')
                      .replace(/ presented by.*$/i, '')
                      .replace(/ in .*$/i, '')
                      .substring(0, 16);

                    return (
                      <View key={i} style={[styles.pcTableRow, i % 2 === 0 && styles.pcTableRowAlt]}>
                        <Text style={[styles.pcCellText, styles.pcColEvent]} numberOfLines={1}>{shortName}</Text>
                        <View style={[styles.pcColTotal, { backgroundColor: getCellColor(h.points, vFpts) }]}>
                          <Text style={styles.pcCellBold}>{h.points.toFixed(1)}</Text>
                        </View>
                        <View style={styles.pcColStat}>
                          <Text style={styles.pcCellMuted}>{h.position || '-'}</Text>
                        </View>
                        <View style={[styles.pcColTotal, { backgroundColor: getCellColor(h.posPoints, vPosPts) }]}>
                          <Text style={styles.pcCellBold}>{h.posPoints ?? '-'}</Text>
                        </View>
                        <View style={styles.pcGroupDivider} />
                        <View style={[styles.pcColTotal, { backgroundColor: getCellColor(h.holePoints, vHolePts) }]}>
                          <Text style={styles.pcCellBold}>{h.holePoints != null ? h.holePoints.toFixed(1) : '-'}</Text>
                        </View>
                        <View style={[styles.pcColNarrow, { backgroundColor: getCellColor(h.eagles, vEagles) }]}>
                          <Text style={styles.pcCellValue}>{h.eagles ?? '-'}</Text>
                        </View>
                        <View style={[styles.pcColNarrow, { backgroundColor: getCellColor(h.birdies, vBirdies) }]}>
                          <Text style={styles.pcCellValue}>{h.birdies ?? '-'}</Text>
                        </View>
                        <View style={styles.pcColNarrow}>
                          <Text style={styles.pcCellMuted}>{h.pars ?? '-'}</Text>
                        </View>
                        <View style={[styles.pcColNarrow, { backgroundColor: getCellColor(h.bogeys != null ? -h.bogeys : null, vBogeys) }]}>
                          <Text style={styles.pcCellValue}>{h.bogeys ?? '-'}</Text>
                        </View>
                        <View style={[styles.pcColNarrow, { backgroundColor: getCellColor(h.doubles != null ? -h.doubles : null, vDoubles) }]}>
                          <Text style={styles.pcCellValue}>{h.doubles ?? '-'}</Text>
                        </View>
                        <View style={styles.pcGroupDivider} />
                        <View style={[styles.pcColTotal, { backgroundColor: getCellColor(h.statPoints, vStatPts) }]}>
                          <Text style={styles.pcCellBold}>{h.statPoints != null ? h.statPoints.toFixed(1) : '-'}</Text>
                        </View>
                        <View style={[styles.pcColStat, { backgroundColor: getCellColor(h.firPts, vFir) }]}>
                          <Text style={styles.pcCellValue}>{h.firPts != null ? h.firPts.toFixed(1) : '-'}</Text>
                        </View>
                        <View style={[styles.pcColStat, { backgroundColor: getCellColor(h.girPts, vGir) }]}>
                          <Text style={styles.pcCellValue}>{h.girPts != null ? h.girPts.toFixed(1) : '-'}</Text>
                        </View>
                        <View style={[styles.pcColStat, { backgroundColor: getCellColor(h.distPts, vDist) }]}>
                          <Text style={styles.pcCellValue}>{h.distPts != null ? h.distPts.toFixed(1) : '-'}</Text>
                        </View>
                        <View style={[styles.pcColStat, { backgroundColor: getCellColor(h.greatPts, vGreat) }]}>
                          <Text style={styles.pcCellValue}>{h.greatPts != null ? h.greatPts.toFixed(1) : '-'}</Text>
                        </View>
                        <View style={[styles.pcColStat, { backgroundColor: getCellColor(h.poorPts, vPoor) }]}>
                          <Text style={styles.pcCellValue}>{h.poorPts != null ? h.poorPts.toFixed(1) : '-'}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Season totals row */}
                  <View style={styles.pcTotalsRow}>
                    <Text style={[styles.pcTotalLabel, styles.pcColEvent]}>
                      {hist.length} EVENT{hist.length !== 1 ? 'S' : ''}
                    </Text>
                    <View style={styles.pcColTotal}><Text style={styles.pcTotalValue}>{totalPts.toFixed(1)}</Text></View>
                    <View style={styles.pcColStat}><Text style={styles.pcTotalMuted}>--</Text></View>
                    <View style={styles.pcColTotal}><Text style={styles.pcTotalValue}>{sum('posPoints')}</Text></View>
                    <View style={styles.pcGroupDivider} />
                    <View style={styles.pcColTotal}><Text style={styles.pcTotalValue}>{sum('holePoints').toFixed(1)}</Text></View>
                    <View style={styles.pcColNarrow}><Text style={styles.pcTotalValue}>{sum('eagles')}</Text></View>
                    <View style={styles.pcColNarrow}><Text style={styles.pcTotalValue}>{sum('birdies')}</Text></View>
                    <View style={styles.pcColNarrow}><Text style={styles.pcTotalMuted}>{sum('pars')}</Text></View>
                    <View style={styles.pcColNarrow}><Text style={styles.pcTotalValue}>{sum('bogeys')}</Text></View>
                    <View style={styles.pcColNarrow}><Text style={styles.pcTotalValue}>{sum('doubles')}</Text></View>
                    <View style={styles.pcGroupDivider} />
                    <View style={styles.pcColTotal}><Text style={styles.pcTotalValue}>{sum('statPoints').toFixed(1)}</Text></View>
                    <View style={styles.pcColStat}><Text style={styles.pcTotalValue}>{sum('firPts').toFixed(1)}</Text></View>
                    <View style={styles.pcColStat}><Text style={styles.pcTotalValue}>{sum('girPts').toFixed(1)}</Text></View>
                    <View style={styles.pcColStat}><Text style={styles.pcTotalValue}>{sum('distPts').toFixed(1)}</Text></View>
                    <View style={styles.pcColStat}><Text style={styles.pcTotalValue}>{sum('greatPts').toFixed(1)}</Text></View>
                    <View style={styles.pcColStat}><Text style={styles.pcTotalValue}>{sum('poorPts').toFixed(1)}</Text></View>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.noDataText}>No tournament history yet</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const availableCount = isSeason && allPlayersData?.players
    ? allPlayersData.players.filter(p => !draftedNames.has(p.playerName.toLowerCase())).length
    : playerStats.filter(p => !draftedNames.has(p.playerName.toLowerCase())).length;

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={[styles.statusBar, isMyTurn && styles.myTurnBar]}>
        {draftState.status === 'pre_draft' ? (
          <Text style={styles.statusText}>Waiting to start draft...</Text>
        ) : draftState.status === 'active' ? (
          <Text style={styles.statusText}>Draft complete!</Text>
        ) : isMyTurn ? (
          <Text style={styles.statusTextBold}>YOUR PICK!</Text>
        ) : (
          <Text style={styles.statusText}>
            {currentTeam?.teamName}'s turn
            <Text style={styles.statusMuted}> (Pick {draftState.currentPick + 1}/{draftState.totalPicks})</Text>
          </Text>
        )}
      </View>

      {draftState.status === 'pre_draft' && draftState.members.find(m => m.userId === user.id) && (
        <TouchableOpacity style={styles.startButton} onPress={handleStartDraft}>
          <Text style={styles.startButtonText}>Start Draft</Text>
        </TouchableOpacity>
      )}

      {draftState.status !== 'pre_draft' && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'available' && styles.activeTab]}
            onPress={() => setTab('available')}
          >
            <Text style={[styles.tabText, tab === 'available' && styles.activeTabText]}>
              Players ({availableCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'teams' && styles.activeTab]}
            onPress={() => setTab('teams')}
          >
            <Text style={[styles.tabText, tab === 'teams' && styles.activeTabText]}>Teams</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Players tab — season league research view */}
      {tab === 'available' && draftState.status === 'drafting' && isSeason && allPlayersData && (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => item.playerName}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search players..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              <View style={styles.filterRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'available', label: 'Available' },
                  { key: 'drafted', label: 'Drafted' },
                ].map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterBtn, playerFilter === f.key && styles.filterBtnActive]}
                    onPress={() => setPlayerFilter(f.key)}
                  >
                    <Text style={[styles.filterBtnText, playerFilter === f.key && styles.filterBtnTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort:</Text>
                {[
                  { key: 'dg', label: 'DG Rank' },
                  { key: 'owgr', label: 'OWGR' },
                  { key: 'avgPts', label: 'Avg FPTS' },
                ].map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.sortBtn, playerSort === s.key && styles.sortBtnActive]}
                    onPress={() => setPlayerSort(s.key)}
                  >
                    <Text style={[styles.sortBtnText, playerSort === s.key && styles.sortBtnTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={renderSeasonPlayerCard}
        />
      )}

      {/* Players tab — pool league simple view */}
      {tab === 'available' && draftState.status === 'drafting' && (!isSeason || !allPlayersData) && (
        <>
          <TextInput
            style={[styles.searchInput, { marginHorizontal: 16, marginBottom: 8 }]}
            placeholder="Search players..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          <FlatList
            data={filteredPlayers}
            keyExtractor={(item) => item.playerName}
            renderItem={renderPoolPlayerRow}
            keyboardShouldPersistTaps="handled"
          />
        </>
      )}

      {/* Teams tab */}
      {tab === 'teams' && (
        <FlatList
          data={draftState.members}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item: member }) => {
            const memberPicks = draftState.picks.filter(p => p.memberId === member.id);
            const isCurrent = member.id === draftState.currentMemberId;
            return (
              <View style={[styles.teamCard, isCurrent && styles.currentTeamCard]}>
                <View style={styles.teamCardHeader}>
                  <Text style={styles.teamName}>
                    {member.teamName} {member.userId === user.id ? '(You)' : ''}
                  </Text>
                  <Text style={styles.pickCount}>{memberPicks.length} picks</Text>
                </View>
                {memberPicks.length === 0 ? (
                  <Text style={styles.noPicks}>No picks yet</Text>
                ) : (
                  memberPicks.map((pick, i) => (
                    <View key={i} style={styles.pickRow}>
                      <Text style={styles.pickRound}>R{pick.round}</Text>
                      <Text style={styles.pickText}>{pick.playerName}</Text>
                      <Text style={styles.pickNum}>#{pick.pickNumber}</Text>
                    </View>
                  ))
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 16 },

  // Status bar
  statusBar: {
    backgroundColor: colors.bgCard, padding: 14, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  myTurnBar: { backgroundColor: colors.accentDark },
  statusText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  statusTextBold: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  statusMuted: { color: colors.textSecondary, fontWeight: '400' },
  startButton: {
    backgroundColor: colors.accent, margin: 16, borderRadius: 10, padding: 16, alignItems: 'center',
  },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Tabs
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8,
    backgroundColor: colors.bgCard, marginHorizontal: 4, borderWidth: 1, borderColor: colors.border,
  },
  activeTab: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#fff' },

  // List header
  listHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: colors.bgElevated, color: colors.textPrimary, fontSize: 15,
    marginBottom: 8, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  filterBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterBtnTextActive: { color: colors.accent },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginRight: 2 },
  sortBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  sortBtnActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  sortBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  sortBtnTextActive: { color: colors.gold },

  // Pool league player row
  poolPlayerRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginHorizontal: 16, marginBottom: 4, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  playerRowActive: { borderColor: colors.accentDark },
  playerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  rankBadge: {
    width: 32, height: 24, borderRadius: 4, backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  playerRank: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  poolPlayerName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  poolPlayerStats: { alignItems: 'center', marginLeft: 12 },
  statLabel: { color: colors.textMuted, fontSize: 10 },
  statValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // Season league player card (matches Players tab)
  playerListCard: {
    backgroundColor: colors.bgCard, marginHorizontal: 16, marginBottom: 6,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  playerListCardDrafted: { opacity: 0.6 },
  playerListHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
  },
  playerListRankCol: { width: 36, alignItems: 'center' },
  playerListRank: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  playerListInfo: { flex: 1, marginLeft: 8 },
  playerListName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  playerListNameDrafted: { color: colors.textSecondary },
  playerListMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  ownerBadge: {
    backgroundColor: colors.bgElevated, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  ownerBadgeMe: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  ownerBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  ownerBadgeTextMe: { color: colors.accent },
  freeAgentLabel: { color: colors.textMuted, fontSize: 11 },
  playerListSg: { color: colors.textMuted, fontSize: 11 },
  playerExpandArrow: { color: colors.textMuted, fontSize: 14, width: 18, textAlign: 'center' },

  // Draft button
  draftBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 6,
  },
  draftBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Player card expanded
  pcExpanded: {
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bgCardAlt, paddingBottom: 6,
  },
  pcRankingsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pcRankItem: { alignItems: 'center' },
  pcRankValue: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  pcRankLabel: {
    color: colors.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.5, marginTop: 2,
  },
  pcTableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pcColHeader: {
    color: colors.textMuted, fontSize: 9, fontWeight: '700',
    textAlign: 'center', letterSpacing: 0.3,
  },
  pcColEvent: { width: 110, textAlign: 'left', paddingLeft: 4 },
  pcColTotal: {
    width: 54, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 3, marginHorizontal: 1,
    borderLeftWidth: 0.5, borderLeftColor: colors.border,
  },
  pcColStat: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 3, marginHorizontal: 1,
  },
  pcColNarrow: {
    width: 38, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, borderRadius: 3, marginHorizontal: 1,
  },
  pcGroupDivider: {
    width: 2, backgroundColor: colors.border, marginHorizontal: 3,
    alignSelf: 'stretch',
  },
  pcTableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, minHeight: 34,
  },
  pcTableRowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  pcCellText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  pcCellBold: { color: colors.textPrimary, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  pcCellValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  pcCellMuted: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  pcTotalsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2,
  },
  pcTotalLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  pcTotalValue: { color: colors.gold, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  pcTotalMuted: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  noDataText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', padding: 12 },

  // Teams tab
  teamCard: {
    backgroundColor: colors.bgCard, marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  currentTeamCard: { borderColor: colors.accent },
  teamCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  teamName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  pickCount: { color: colors.textMuted, fontSize: 12 },
  noPicks: { color: colors.textMuted, fontSize: 13 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  pickRound: { color: colors.accent, fontSize: 12, fontWeight: '700', width: 28 },
  pickText: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  pickNum: { color: colors.textMuted, fontSize: 12 },
});
