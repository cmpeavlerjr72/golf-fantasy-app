import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

export default function ProposeTradeScreen({ route, navigation }) {
  const { leagueId } = route.params;
  const [myRoster, setMyRoster] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMyPlayer, setSelectedMyPlayer] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [theirRoster, setTheirRoster] = useState([]);
  const [selectedTheirPlayer, setSelectedTheirPlayer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: pick my player, 2: pick their team, 3: pick their player

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [leagueId])
  );

  async function loadData() {
    setRefreshing(true);
    try {
      const [rosterData, leagueData] = await Promise.all([
        api.getRoster(leagueId),
        api.getLeague(leagueId),
      ]);
      setMyRoster(rosterData.roster || []);
      // Filter out current user from members list
      const otherMembers = (leagueData.members || []).filter(m => !m.isMe);
      setMembers(otherMembers);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadTheirRoster(memberId) {
    try {
      // We need to get all rosters for the league to find their players
      // The backend roster endpoint returns the current user's roster,
      // so we'll use the league standings which shows all members
      const leagueData = await api.getLeague(leagueId);
      const member = (leagueData.members || []).find(m => m.id === memberId);
      if (member && member.roster) {
        setTheirRoster(member.roster);
      } else {
        // Fallback: we may not have roster data on league endpoint
        // For now show an empty state - the user can still propose
        setTheirRoster([]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  function selectMyPlayer(player) {
    setSelectedMyPlayer(player);
    setStep(2);
  }

  function selectMember(member) {
    setSelectedMember(member);
    setStep(3);
    // Try to load their roster info
    loadTheirRoster(member.id);
  }

  function selectTheirPlayer(player) {
    setSelectedTheirPlayer(player);
  }

  async function submitTrade() {
    if (!selectedMyPlayer || !selectedMember || !selectedTheirPlayer) return;

    setSubmitting(true);
    try {
      await api.proposeTrade(
        leagueId,
        selectedMyPlayer.playerName,
        selectedTheirPlayer.playerName || selectedTheirPlayer,
        selectedMember.id,
      );
      Alert.alert('Success', 'Trade proposed!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderStep1() {
    return (
      <FlatList
        data={myRoster.filter(p => !p.locked)}
        keyExtractor={(item, i) => `my-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Select Your Player to Trade</Text>
            <Text style={styles.subtitle}>Locked players cannot be traded</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, selectedMyPlayer?.playerName === item.playerName && styles.selectedRow]}
            onPress={() => selectMyPlayer(item)}
          >
            <Text style={styles.name}>{item.playerName}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !refreshing && <Text style={styles.empty}>No tradeable players</Text>
        }
      />
    );
  }

  function renderStep2() {
    return (
      <FlatList
        data={members}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Select Trade Partner</Text>
            <Text style={styles.subtitle}>Trading: {selectedMyPlayer?.playerName}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, selectedMember?.id === item.id && styles.selectedRow]}
            onPress={() => selectMember(item)}
          >
            <Text style={styles.name}>{item.teamName}</Text>
            <Text style={styles.meta}>{item.displayName}</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  function renderStep3() {
    // If we have their roster from API, show it. Otherwise let user type a name.
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Their Player</Text>
          <Text style={styles.subtitle}>
            Your {selectedMyPlayer?.playerName} for {selectedMember?.teamName}'s player
          </Text>
        </View>
        {theirRoster.length > 0 ? (
          <FlatList
            data={theirRoster.filter(p => !p.locked)}
            keyExtractor={(item, i) => `their-${i}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, selectedTheirPlayer?.playerName === item.playerName && styles.selectedRow]}
                onPress={() => selectTheirPlayer(item)}
              >
                <Text style={styles.name}>{item.playerName}</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text style={styles.empty}>Loading their roster...</Text>
        )}

        {selectedTheirPlayer && (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={submitTrade}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Proposing...' : `Propose: Your ${selectedMyPlayer?.playerName} for their ${selectedTheirPlayer?.playerName || selectedTheirPlayer}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.steps}>
        {[1, 2, 3].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.stepDot, step >= s && styles.stepActive]}
            onPress={() => { if (s < step) setStep(s); }}
          >
            <Text style={[styles.stepText, step >= s && styles.stepTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a472a' },
  steps: {
    flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, gap: 12,
  },
  stepDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#2d5a3d',
    alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: '#4a8c5c' },
  stepText: { color: '#6a7a5b', fontWeight: '600' },
  stepTextActive: { color: '#fff' },
  header: { padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#8a9a5b', fontSize: 14, marginTop: 4 },
  row: {
    backgroundColor: '#2d5a3d', marginHorizontal: 16, marginBottom: 6,
    borderRadius: 10, padding: 14,
  },
  selectedRow: { borderWidth: 2, borderColor: '#4a8c5c' },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#8a9a5b', fontSize: 13, marginTop: 2 },
  empty: { color: '#6a7a5b', textAlign: 'center', marginTop: 40, fontSize: 15 },
  submitBtn: {
    backgroundColor: '#4a8c5c', margin: 16, padding: 16,
    borderRadius: 12, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
