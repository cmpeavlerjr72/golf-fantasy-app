import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import * as api from '../services/api';

export default function JoinLeagueScreen({ navigation }) {
  const [inviteCode, setInviteCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!inviteCode || !teamName) return Alert.alert('Error', 'Invite code and team name are required');
    setLoading(true);
    try {
      await api.joinLeague(inviteCode.trim(), teamName.trim());
      Alert.alert('Joined!', 'You have joined the league.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Join a League</Text>

        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.input}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="e.g. A1B2C3D4"
          placeholderTextColor="#8a9a5b"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Your Team Name</Text>
        <TextInput
          style={styles.input}
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g. Birdie Bunch"
          placeholderTextColor="#8a9a5b"
        />

        <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join League</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a472a' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  label: { color: '#b0c4a8', fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#2d5a3d', borderRadius: 12, padding: 16, fontSize: 16, color: '#fff',
  },
  button: {
    backgroundColor: '#4a8c5c', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
