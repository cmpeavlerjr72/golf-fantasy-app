import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as api from '../services/api';
import { colors } from '../theme';

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.inner}>
        <Text style={styles.title}>Join a League</Text>
        <Text style={styles.subtitle}>Enter the invite code from your commissioner</Text>

        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.input}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="e.g. A1B2C3D4"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Your Team Name</Text>
        <TextInput
          style={styles.input}
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g. Birdie Bunch"
          placeholderTextColor={colors.textMuted}
        />

        <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join League</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: 24 },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: 10, padding: 16, fontSize: 16,
    color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
