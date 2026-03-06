import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  TextInput,
} from 'react-native';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/api';
import * as api from '../services/api';

const SOCKET_URL = 'https://golf-fantasy-backend.onrender.com';

export default function DraftScreen({ route }) {
  const { leagueId, leagueType } = route.params;
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [draftState, setDraftState] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('available'); // 'available' | 'teams'
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
      // Season leagues only show PGA Tour players
      const stats = await api.getPlayerStats(isSeason ? 'pga' : undefined);
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
      setDraftState(state);
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
        <ActivityIndicator size="large" color="#4a8c5c" />
        <Text style={styles.loadingText}>Connecting to draft...</Text>
      </View>
    );
  }

  const draftedNames = new Set(draftState.picks.map(p => p.playerName.toLowerCase()));
  let availablePlayers = playerStats.filter(p => !draftedNames.has(p.playerName.toLowerCase()));

  // Search filter
  if (search.trim()) {
    const lower = search.toLowerCase();
    availablePlayers = availablePlayers.filter(p => p.playerName.toLowerCase().includes(lower));
  }

  const isMyTurn = draftState.members.find(m => m.id === draftState.currentMemberId)?.userId === user.id;
  const currentTeam = draftState.members.find(m => m.id === draftState.currentMemberId);

  const myMember = draftState.members.find(m => m.userId === user.id);

  function formatSg(val) {
    if (val == null || isNaN(val)) return '-';
    const num = parseFloat(val);
    return (num >= 0 ? '+' : '') + num.toFixed(2);
  }

  function sgColor(val) {
    if (val == null || isNaN(val)) return '#8a9a5b';
    return parseFloat(val) >= 0 ? '#5cb85c' : '#d9534f';
  }

  function renderPlayerRow({ item }) {
    return (
      <TouchableOpacity
        style={styles.playerRow}
        onPress={() => isMyTurn && handlePick(item.playerName)}
        disabled={!isMyTurn}
      >
        <View style={styles.playerInfo}>
          <Text style={styles.playerRank}>#{item.dgRank || item.owgrRank || '-'}</Text>
          <Text style={styles.playerName} numberOfLines={1}>{item.playerName}</Text>
        </View>
        {isSeason ? (
          <View style={styles.sgRow}>
            <View style={styles.sgCell}>
              <Text style={styles.sgLabel}>Total</Text>
              <Text style={[styles.sgValue, { color: sgColor(item.sgTotal) }]}>{formatSg(item.sgTotal)}</Text>
            </View>
            <View style={styles.sgCell}>
              <Text style={styles.sgLabel}>OTT</Text>
              <Text style={[styles.sgValue, { color: sgColor(item.sgOtt) }]}>{formatSg(item.sgOtt)}</Text>
            </View>
            <View style={styles.sgCell}>
              <Text style={styles.sgLabel}>APP</Text>
              <Text style={[styles.sgValue, { color: sgColor(item.sgApp) }]}>{formatSg(item.sgApp)}</Text>
            </View>
            <View style={styles.sgCell}>
              <Text style={styles.sgLabel}>ARG</Text>
              <Text style={[styles.sgValue, { color: sgColor(item.sgArg) }]}>{formatSg(item.sgArg)}</Text>
            </View>
            <View style={styles.sgCell}>
              <Text style={styles.sgLabel}>Putt</Text>
              <Text style={[styles.sgValue, { color: sgColor(item.sgPutt) }]}>{formatSg(item.sgPutt)}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.playerStats}>
              <Text style={styles.statLabel}>SG Total</Text>
              <Text style={[styles.statValue, { color: sgColor(item.sgTotal) }]}>
                {formatSg(item.sgTotal)}
              </Text>
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
          <Text style={styles.statusText}>YOUR PICK!</Text>
        ) : (
          <Text style={styles.statusText}>{currentTeam?.teamName}'s turn (Pick {draftState.currentPick + 1}/{draftState.totalPicks})</Text>
        )}
      </View>

      {/* Start button for owner */}
      {draftState.status === 'pre_draft' && draftState.members.find(m => m.userId === user.id) && (
        <TouchableOpacity style={styles.startButton} onPress={handleStartDraft}>
          <Text style={styles.startButtonText}>Start Draft</Text>
        </TouchableOpacity>
      )}

      {/* Tab toggle */}
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

      {/* Search bar (available tab only) */}
      {tab === 'available' && draftState.status === 'drafting' && (
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor="#6a7a5b"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      )}

      {/* Available players */}
      {tab === 'available' && draftState.status === 'drafting' && (
        <FlatList
          data={availablePlayers}
          keyExtractor={(item) => item.playerName}
          renderItem={renderPlayerRow}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Teams view */}
      {tab === 'teams' && (
        <FlatList
          data={draftState.members}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item: member }) => {
            const memberPicks = draftState.picks.filter(p => p.memberId === member.id);
            const isCurrent = member.id === draftState.currentMemberId;
            return (
              <View style={[styles.teamCard, isCurrent && styles.currentTeamCard]}>
                <Text style={styles.teamName}>
                  {member.teamName} {member.userId === user.id ? '(You)' : ''}
                </Text>
                {memberPicks.length === 0 ? (
                  <Text style={styles.noPicks}>No picks yet</Text>
                ) : (
                  memberPicks.map((pick, i) => (
                    <Text key={i} style={styles.pickText}>
                      R{pick.round} #{pick.pickNumber}: {pick.playerName}
                    </Text>
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
  container: { flex: 1, backgroundColor: '#1a472a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a472a' },
  loadingText: { color: '#8a9a5b', marginTop: 12, fontSize: 16 },
  statusBar: {
    backgroundColor: '#2d5a3d', padding: 14, alignItems: 'center',
  },
  myTurnBar: { backgroundColor: '#4a8c5c' },
  statusText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  startButton: {
    backgroundColor: '#4a8c5c', margin: 16, borderRadius: 12, padding: 16, alignItems: 'center',
  },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 8 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#2d5a3d',
    marginHorizontal: 4,
  },
  activeTab: { backgroundColor: '#4a8c5c' },
  tabText: { color: '#8a9a5b', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#fff' },
  searchInput: {
    backgroundColor: '#2d5a3d', color: '#fff', fontSize: 15,
    marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 12,
  },
  playerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  playerRank: { color: '#8a9a5b', fontSize: 13, width: 36 },
  playerName: { color: '#fff', fontSize: 14, fontWeight: '500', flexShrink: 1 },
  playerStats: { alignItems: 'center', marginLeft: 12 },
  statLabel: { color: '#8a9a5b', fontSize: 10 },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sgRow: { flexDirection: 'row', gap: 6 },
  sgCell: { alignItems: 'center', width: 42 },
  sgLabel: { color: '#8a9a5b', fontSize: 9 },
  sgValue: { fontSize: 12, fontWeight: '600' },
  teamCard: {
    backgroundColor: '#2d5a3d', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14,
  },
  currentTeamCard: { borderWidth: 2, borderColor: '#4a8c5c' },
  teamName: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 6 },
  noPicks: { color: '#8a9a5b', fontSize: 13 },
  pickText: { color: '#b0c4a8', fontSize: 14, marginBottom: 2 },
});
