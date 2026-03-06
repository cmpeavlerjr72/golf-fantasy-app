import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  RefreshControl, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';

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
      setAgents(data.freeAgents || []);
      applySearch(data.freeAgents || [], search);
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
        placeholderTextColor="#6a7a5b"
        value={search}
        onChangeText={onSearch}
        autoCapitalize="none"
      />
      <FlatList
        data={filtered}
        keyExtractor={(item, i) => `${item.playerName}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAgents} tintColor="#fff" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name}>{item.playerName}</Text>
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
  container: { flex: 1, backgroundColor: '#1a472a' },
  searchInput: {
    backgroundColor: '#2d5a3d', color: '#fff', fontSize: 15,
    margin: 16, padding: 12, borderRadius: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d5a3d',
    marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 14,
  },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#8a9a5b', fontSize: 12, marginTop: 2 },
  lockedText: { color: '#6a7a5b', fontSize: 12 },
  addBtn: {
    backgroundColor: '#4a8c5c', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { color: '#6a7a5b', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
