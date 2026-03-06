import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  TextInput,
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
  const [playerStats, setPlayerStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('available');
  const [search, setSearch] = useState('');

  const isSeason = leagueType === 'season';

  useEffect(() => {
    loadPlayerStats();
    connectSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  async function loadPlayerStats() {
    try {
      let stats;
      const tId = routeTournamentId || draftState?.tournamentId;
      if (!isSeason && tId) {
        stats = await api.getTournamentField(tId);
      } else if (isSeason) {
        stats = await api.getPlayerStats('pga');
      } else {
        stats = await api.getPlayerStats();
      }
      setPlayerStats(stats);
    } catch (err) {
      console.warn('Could not load player stats:', err.message);
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
    Alert.alert('Confirm Pick', `Draft ${playerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Draft',
        onPress: () => socketRef.current?.emit('draft-pick', { leagueId, playerName }),
      },
    ]);
  }

  if (loading || !draftState) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Connecting to draft...</Text>
      </View>
    );
  }

  const draftedNames = new Set(draftState.picks.map(p => p.playerName.toLowerCase()));
  let availablePlayers = playerStats.filter(p => !draftedNames.has(p.playerName.toLowerCase()));

  if (search.trim()) {
    const lower = search.toLowerCase();
    availablePlayers = availablePlayers.filter(p => p.playerName.toLowerCase().includes(lower));
  }

  const isMyTurn = draftState.members.find(m => m.id === draftState.currentMemberId)?.userId === user.id;
  const currentTeam = draftState.members.find(m => m.id === draftState.currentMemberId);

  function formatSg(val) {
    if (val == null || isNaN(val)) return '-';
    const num = parseFloat(val);
    return (num >= 0 ? '+' : '') + num.toFixed(2);
  }

  function sgColor(val) {
    if (val == null || isNaN(val)) return colors.textMuted;
    return parseFloat(val) >= 0 ? colors.positive : colors.negative;
  }

  function renderPlayerRow({ item }) {
    return (
      <TouchableOpacity
        style={[styles.playerRow, isMyTurn && styles.playerRowActive]}
        onPress={() => isMyTurn && handlePick(item.playerName)}
        disabled={!isMyTurn}
        activeOpacity={isMyTurn ? 0.6 : 1}
      >
        <View style={styles.playerInfo}>
          <View style={styles.rankBadge}>
            <Text style={styles.playerRank}>{item.dgRank || item.owgrRank || '-'}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>{item.playerName}</Text>
        </View>
        {isSeason ? (
          <View style={styles.sgRow}>
            {[
              { label: 'Total', val: item.sgTotal },
              { label: 'OTT', val: item.sgOtt },
              { label: 'APP', val: item.sgApp },
              { label: 'ARG', val: item.sgArg },
              { label: 'Putt', val: item.sgPutt },
            ].map(sg => (
              <View style={styles.sgCell} key={sg.label}>
                <Text style={styles.sgLabel}>{sg.label}</Text>
                <Text style={[styles.sgValue, { color: sgColor(sg.val) }]}>{formatSg(sg.val)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.playerStats}>
              <Text style={styles.statLabel}>SG Total</Text>
              <Text style={[styles.statValue, { color: sgColor(item.sgTotal) }]}>{formatSg(item.sgTotal)}</Text>
            </View>
            <View style={styles.playerStats}>
              <Text style={styles.statLabel}>Win%</Text>
              <Text style={styles.statValue}>{item.winPct?.toFixed(1) || '-'}%</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  }

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
              Available ({availablePlayers.length})
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

      {tab === 'available' && draftState.status === 'drafting' && (
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      )}

      {tab === 'available' && draftState.status === 'drafting' && (
        <FlatList
          data={availablePlayers}
          keyExtractor={(item) => item.playerName}
          renderItem={renderPlayerRow}
          keyboardShouldPersistTaps="handled"
        />
      )}

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
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8,
    backgroundColor: colors.bgCard, marginHorizontal: 4, borderWidth: 1, borderColor: colors.border,
  },
  activeTab: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#fff' },
  searchInput: {
    backgroundColor: colors.bgElevated, color: colors.textPrimary, fontSize: 15,
    marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  playerRow: {
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
  playerName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  playerStats: { alignItems: 'center', marginLeft: 12 },
  statLabel: { color: colors.textMuted, fontSize: 10 },
  statValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  sgRow: { flexDirection: 'row', gap: 4 },
  sgCell: { alignItems: 'center', width: 42 },
  sgLabel: { color: colors.textMuted, fontSize: 9 },
  sgValue: { fontSize: 12, fontWeight: '700' },
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
