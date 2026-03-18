import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  RefreshControl, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { colors } from '../theme';

export default function FreeAgentsScreen({ route, navigation }) {
  const { leagueId } = route.params;
  const [agents, setAgents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAgents();
    }, [leagueId])
  );

  async function loadAgents() {
    setRefreshing(true);
    try {
      const data = await api.getFreeAgents(leagueId);
      // Sort in-field players first
      const sorted = (data.freeAgents || []).sort((a, b) => (b.inField ? 1 : 0) - (a.inField ? 1 : 0));
      setAgents(sorted);
      applySearch(sorted, search);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function applySearch(list, term) {
    if (!term.trim()) {
      setFiltered(list);
    } else {
      const lower = term.toLowerCase();
      setFiltered(list.filter(p => p.playerName.toLowerCase().includes(lower)));
    }
  }

  function onSearch(text) {
    setSearch(text);
    applySearch(agents, text);
  }

  async function handleAdd(playerName) {
    Alert.alert('Add Player', `Add ${playerName} to your roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add',
        onPress: async () => {
          setAdding(playerName);
          try {
            await api.addPlayer(leagueId, playerName);
            Alert.alert('Success', `${playerName} added to your roster`);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err.message);
          } finally {
            setAdding(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search players..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={onSearch}
        autoCapitalize="none"
      />
      <FlatList
        data={filtered}
        keyExtractor={(item, i) => `${item.playerName}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAgents} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.name}>{item.playerName}</Text>
                {item.inField && (
                  <Text style={{ fontSize: 9, color: '#3fb950', backgroundColor: '#1a3a2a', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden', fontWeight: '700' }}>IN FIELD</Text>
                )}
              </View>
              <Text style={styles.meta}>
                {item.dgRank ? `DG #${item.dgRank}` : ''}
                {item.owgrRank ? `  OWGR #${item.owgrRank}` : ''}
                {item.sgTotal != null ? `  SG: ${item.sgTotal.toFixed(2)}` : ''}
              </Text>
            </View>
            {item.locked ? (
              <Text style={styles.lockedText}>Locked</Text>
            ) : (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => handleAdd(item.playerName)}
                disabled={adding === item.playerName}
              >
                <Text style={styles.addBtnText}>
                  {adding === item.playerName ? '...' : 'Add'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          !refreshing && <Text style={styles.empty}>No free agents available</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchInput: {
    backgroundColor: colors.bgElevated, color: colors.textPrimary, fontSize: 15,
    margin: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  info: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  lockedText: { color: colors.textMuted, fontSize: 12 },
  addBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 15 },
});
