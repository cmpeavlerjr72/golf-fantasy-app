import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as api from '../services/api';

const DEFAULT_SCORING = {
  eagle: 4,
  birdie: 3,
  par: 1,
  bogey: -1,
  double_bogey: -2,
  worse: -3,
};

export default function CreateLeagueScreen({ navigation }) {
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [leagueType, setLeagueType] = useState(null); // null = not selected yet
  const [maxTeams, setMaxTeams] = useState('8');
  const [draftRounds, setDraftRounds] = useState('4');

  // Pool-specific
  const [scoringTopN, setScoringTopN] = useState('4');

  // Season-specific
  const [rosterSize, setRosterSize] = useState('6');
  const [startersCount, setStartersCount] = useState('4');
  const [scoring, setScoring] = useState(DEFAULT_SCORING);

  const [loading, setLoading] = useState(false);

  function updateScoring(key, value) {
    setScoring(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
  }

  async function handleCreate() {
    if (!name || !teamName) return Alert.alert('Error', 'League name and team name are required');
    if (!leagueType) return Alert.alert('Error', 'Select a league type');

    setLoading(true);
    try {
      const params = {
        name,
        teamName,
        maxTeams: parseInt(maxTeams),
        draftRounds: parseInt(draftRounds),
        leagueType,
      };

      if (leagueType === 'pool') {
        params.scoringTopN = parseInt(scoringTopN);
      } else {
        params.rosterSize = parseInt(rosterSize);
        params.startersCount = parseInt(startersCount);
        params.scoringConfig = scoring;
      }

      const league = await api.createLeague(params);
      Alert.alert('League Created!', `Share this invite code with friends:\n\n${league.inviteCode}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 1: Type selection
  if (!leagueType) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Choose League Type</Text>

        <TouchableOpacity style={styles.typeCard} onPress={() => setLeagueType('pool')}>
          <Text style={styles.typeTitle}>Tournament Pool</Text>
          <Text style={styles.typeDesc}>
            Draft golfers for a single tournament. Best scores from your roster count toward your team total. Lowest cumulative score wins.
          </Text>
          <View style={styles.typeBullets}>
            <Text style={styles.bullet}>Draft once per tournament</Text>
            <Text style={styles.bullet}>Best N player scores count</Text>
            <Text style={styles.bullet}>Stroke-based scoring</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.typeCard} onPress={() => setLeagueType('season')}>
          <Text style={styles.typeTitle}>Season-Long Fantasy</Text>
          <Text style={styles.typeDesc}>
            Like fantasy football — draft a roster, set weekly lineups, earn points based on birdies, eagles, pars, and more across the entire season.
          </Text>
          <View style={styles.typeBullets}>
            <Text style={styles.bullet}>Set lineups each week</Text>
            <Text style={styles.bullet}>Points per hole outcome</Text>
            <Text style={styles.bullet}>Season-long standings</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Step 2: League settings
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <TouchableOpacity onPress={() => setLeagueType(null)}>
        <Text style={styles.backText}>Back to league type</Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {leagueType === 'pool' ? 'Tournament Pool' : 'Season-Long Fantasy'}
      </Text>
      <Text style={styles.subtitle}>Configure your league settings</Text>

      <Text style={styles.label}>League Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName}
        placeholder="e.g. Masters 2026" placeholderTextColor="#8a9a5b" />

      <Text style={styles.label}>Your Team Name</Text>
      <TextInput style={styles.input} value={teamName} onChangeText={setTeamName}
        placeholder="e.g. Eagle Squad" placeholderTextColor="#8a9a5b" />

      <Text style={styles.label}>Max Teams</Text>
      <TextInput style={styles.input} value={maxTeams} onChangeText={setMaxTeams}
        keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

      <Text style={styles.label}>Draft Rounds (players per team)</Text>
      <TextInput style={styles.input} value={draftRounds} onChangeText={setDraftRounds}
        keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

      {leagueType === 'pool' ? (
        <>
          <Text style={styles.label}>Counting Scores Per Team</Text>
          <Text style={styles.hint}>How many of each team's best players count toward the total</Text>
          <TextInput style={styles.input} value={scoringTopN} onChangeText={setScoringTopN}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />
        </>
      ) : (
        <>
          <Text style={styles.sectionHeader}>Roster Settings</Text>

          <Text style={styles.label}>Roster Size</Text>
          <Text style={styles.hint}>Total players each team drafts</Text>
          <TextInput style={styles.input} value={rosterSize} onChangeText={setRosterSize}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

          <Text style={styles.label}>Weekly Starters</Text>
          <Text style={styles.hint}>How many players score points each week</Text>
          <TextInput style={styles.input} value={startersCount} onChangeText={setStartersCount}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

          <Text style={styles.sectionHeader}>Points Per Hole</Text>
          <Text style={styles.hint}>Set point values for each hole outcome</Text>

          {[
            { key: 'eagle', label: 'Eagle or Better', icon: '-2+' },
            { key: 'birdie', label: 'Birdie', icon: '-1' },
            { key: 'par', label: 'Par', icon: 'E' },
            { key: 'bogey', label: 'Bogey', icon: '+1' },
            { key: 'double_bogey', label: 'Double Bogey', icon: '+2' },
            { key: 'worse', label: 'Triple+', icon: '+3' },
          ].map(item => (
            <View key={item.key} style={styles.scoringRow}>
              <View style={styles.scoringLabel}>
                <Text style={styles.scoringIcon}>{item.icon}</Text>
                <Text style={styles.scoringName}>{item.label}</Text>
              </View>
              <TextInput
                style={styles.scoringInput}
                value={String(scoring[item.key])}
                onChangeText={v => updateScoring(item.key, v)}
                keyboardType="number-pad"
              />
              <Text style={styles.scoringPts}>pts</Text>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create League</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a472a' },
  inner: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#8a9a5b', fontSize: 15, marginBottom: 20 },
  backText: { color: '#4a8c5c', fontSize: 15, marginBottom: 16 },

  // Type selection cards
  typeCard: {
    backgroundColor: '#2d5a3d', borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#4a8c5c',
  },
  typeTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  typeDesc: { color: '#b0c4a8', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  typeBullets: { gap: 4 },
  bullet: { color: '#8a9a5b', fontSize: 13, paddingLeft: 8 },

  // Form
  label: { color: '#b0c4a8', fontSize: 14, marginBottom: 6, marginTop: 14 },
  hint: { color: '#6a7a5b', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#2d5a3d', borderRadius: 12, padding: 16, fontSize: 16, color: '#fff',
  },
  sectionHeader: {
    fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 24, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: '#2d5a3d', paddingTop: 20,
  },

  // Scoring config
  scoringRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: '#2d5a3d', borderRadius: 10, padding: 12,
  },
  scoringLabel: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  scoringIcon: { color: '#4a8c5c', fontWeight: 'bold', fontSize: 14, width: 32, textAlign: 'center' },
  scoringName: { color: '#fff', fontSize: 15 },
  scoringInput: {
    backgroundColor: '#1a472a', borderRadius: 8, width: 56, padding: 8,
    textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '600',
  },
  scoringPts: { color: '#8a9a5b', fontSize: 13, marginLeft: 6, width: 24 },

  button: {
    backgroundColor: '#4a8c5c', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
