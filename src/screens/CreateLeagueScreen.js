import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as api from '../services/api';

const PRESETS = {
  balanced: {
    label: 'Balanced',
    desc: 'Even mix of scoring and stats. Like a fantasy WR — birdies matter, but ball-striking separates the field.',
    scoring: {
      eagle: 5, birdie: 3, par: 0.5, bogey: -1, double_bogey: -3, worse: -5,
      fir_multiplier: 15, gir_multiplier: 20, distance_multiplier: 0.15,
      great_shot_bonus: 0.75, poor_shot_penalty: -0.75,
    },
  },
  scoring: {
    label: 'Score Heavy',
    desc: 'Birdies and eagles are king. Stats are a tiebreaker. The guy at the top of the real leaderboard usually wins.',
    scoring: {
      eagle: 8, birdie: 4, par: 0.5, bogey: -2, double_bogey: -4, worse: -6,
      fir_multiplier: 8, gir_multiplier: 10, distance_multiplier: 0.05,
      great_shot_bonus: 0.5, poor_shot_penalty: -0.5,
    },
  },
  stats: {
    label: 'Stat Heavy',
    desc: 'Ball-striking and shot quality drive the scores. A player hitting every fairway and green can compete even without many birdies.',
    scoring: {
      eagle: 4, birdie: 2, par: 0.5, bogey: -0.5, double_bogey: -2, worse: -3,
      fir_multiplier: 20, gir_multiplier: 25, distance_multiplier: 0.2,
      great_shot_bonus: 1.0, poor_shot_penalty: -1.0,
    },
  },
};

export default function CreateLeagueScreen({ navigation }) {
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [leagueType, setLeagueType] = useState(null);
  const [maxTeams, setMaxTeams] = useState('8');
  const [draftRounds, setDraftRounds] = useState('4');

  // Pool-specific
  const [scoringTopN, setScoringTopN] = useState('4');

  // Season-specific
  const [rosterSize, setRosterSize] = useState('6');
  const [startersCount, setStartersCount] = useState('4');
  const [scoring, setScoring] = useState(PRESETS.balanced.scoring);
  const [activePreset, setActivePreset] = useState('balanced');
  const [showCustom, setShowCustom] = useState(false);

  const [loading, setLoading] = useState(false);

  function selectPreset(key) {
    setActivePreset(key);
    setScoring({ ...PRESETS[key].scoring });
    setShowCustom(false);
  }

  function updateScoring(key, value) {
    setActivePreset(null);
    setScoring(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
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
        leagueType,
      };

      if (leagueType === 'pool') {
        params.draftRounds = parseInt(draftRounds);
        params.scoringTopN = parseInt(scoringTopN);
      } else {
        params.rosterSize = parseInt(rosterSize);
        params.draftRounds = parseInt(rosterSize);
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
            Draft a roster, set weekly lineups, earn points from birdies, eagles, fairways hit, greens in regulation, and more across the entire season.
          </Text>
          <View style={styles.typeBullets}>
            <Text style={styles.bullet}>Set lineups each week</Text>
            <Text style={styles.bullet}>Hole scoring + stat bonuses</Text>
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
        <Text style={styles.backText}>{'< Back to league type'}</Text>
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

      {leagueType === 'pool' ? (
        <>
          <Text style={styles.label}>Draft Rounds (players per team)</Text>
          <TextInput style={styles.input} value={draftRounds} onChangeText={setDraftRounds}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

          <Text style={styles.label}>Counting Scores Per Team</Text>
          <Text style={styles.hint}>How many of each team's best players count toward the total</Text>
          <TextInput style={styles.input} value={scoringTopN} onChangeText={setScoringTopN}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />
        </>
      ) : (
        <>
          <Text style={styles.sectionHeader}>Roster Settings</Text>

          <Text style={styles.label}>Roster Size (= draft rounds)</Text>
          <Text style={styles.hint}>Each team drafts this many players</Text>
          <TextInput style={styles.input} value={rosterSize} onChangeText={setRosterSize}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

          <Text style={styles.label}>Weekly Starters</Text>
          <Text style={styles.hint}>How many players score points each week</Text>
          <TextInput style={styles.input} value={startersCount} onChangeText={setStartersCount}
            keyboardType="number-pad" placeholderTextColor="#8a9a5b" />

          {/* Scoring Presets */}
          <Text style={styles.sectionHeader}>Scoring Preset</Text>
          <Text style={styles.hint}>Choose a preset or customize every value below</Text>

          {Object.entries(PRESETS).map(([key, preset]) => (
            <TouchableOpacity
              key={key}
              style={[styles.presetCard, activePreset === key && styles.presetCardActive]}
              onPress={() => selectPreset(key)}
            >
              <View style={styles.presetHeader}>
                <View style={[styles.presetRadio, activePreset === key && styles.presetRadioActive]}>
                  {activePreset === key && <View style={styles.presetRadioDot} />}
                </View>
                <Text style={[styles.presetTitle, activePreset === key && styles.presetTitleActive]}>
                  {preset.label}
                </Text>
              </View>
              <Text style={styles.presetDesc}>{preset.desc}</Text>
            </TouchableOpacity>
          ))}

          {/* Custom toggle */}
          <TouchableOpacity
            style={styles.customToggle}
            onPress={() => setShowCustom(!showCustom)}
          >
            <Text style={styles.customToggleText}>
              {showCustom ? 'Hide Custom Settings' : 'Customize Individual Values'}
            </Text>
            <Text style={styles.customToggleArrow}>{showCustom ? '^' : 'v'}</Text>
          </TouchableOpacity>

          {showCustom && (
            <>
              <Text style={styles.sectionHeader}>Hole Scoring</Text>
              <Text style={styles.hint}>Points awarded per hole outcome</Text>

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
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.scoringPts}>pts</Text>
                </View>
              ))}

              <Text style={styles.sectionHeader}>Stat Bonuses</Text>
              <Text style={styles.hint}>
                Relative to field average — above avg = positive, below = negative. Updates live during tournaments.
              </Text>

              {[
                { key: 'fir_multiplier', label: 'Fairways Hit', desc: 'Multiplier per % above/below field avg' },
                { key: 'gir_multiplier', label: 'Greens in Reg', desc: 'Multiplier per % above/below field avg' },
                { key: 'distance_multiplier', label: 'Driving Distance', desc: 'Points per yard above/below field avg' },
              ].map(item => (
                <View key={item.key} style={styles.statRow}>
                  <View style={styles.statLabel}>
                    <Text style={styles.scoringName}>{item.label}</Text>
                    <Text style={styles.statDesc}>{item.desc}</Text>
                  </View>
                  <TextInput
                    style={styles.scoringInput}
                    value={String(scoring[item.key])}
                    onChangeText={v => updateScoring(item.key, v)}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              ))}

              <Text style={styles.sectionHeader}>Shot Quality</Text>
              <Text style={styles.hint}>
                Bonus/penalty per great or poor shot (shots gaining/losing 1+ strokes vs field)
              </Text>

              {[
                { key: 'great_shot_bonus', label: 'Great Shot Bonus', desc: 'Per great shot' },
                { key: 'poor_shot_penalty', label: 'Poor Shot Penalty', desc: 'Per poor shot' },
              ].map(item => (
                <View key={item.key} style={styles.statRow}>
                  <View style={styles.statLabel}>
                    <Text style={styles.scoringName}>{item.label}</Text>
                    <Text style={styles.statDesc}>{item.desc}</Text>
                  </View>
                  <TextInput
                    style={styles.scoringInput}
                    value={String(scoring[item.key])}
                    onChangeText={v => updateScoring(item.key, v)}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              ))}
            </>
          )}
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

  // Scoring presets
  presetCard: {
    backgroundColor: '#2d5a3d', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#2d5a3d',
  },
  presetCardActive: {
    borderColor: '#4a8c5c', backgroundColor: '#1f3d28',
  },
  presetHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  presetRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#6a7a5b', marginRight: 10, alignItems: 'center', justifyContent: 'center',
  },
  presetRadioActive: { borderColor: '#4a8c5c' },
  presetRadioDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#4a8c5c',
  },
  presetTitle: { color: '#b0c4a8', fontSize: 16, fontWeight: '600' },
  presetTitleActive: { color: '#fff' },
  presetDesc: { color: '#6a7a5b', fontSize: 12, lineHeight: 17, marginLeft: 30 },

  // Custom toggle
  customToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#2d5a3d', borderRadius: 10, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: '#3d6a4d',
  },
  customToggleText: { color: '#4a8c5c', fontSize: 14, fontWeight: '600' },
  customToggleArrow: { color: '#4a8c5c', fontSize: 16 },

  // Hole scoring config
  scoringRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: '#2d5a3d', borderRadius: 10, padding: 12,
  },
  scoringLabel: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  scoringIcon: { color: '#4a8c5c', fontWeight: 'bold', fontSize: 14, width: 32, textAlign: 'center' },
  scoringName: { color: '#fff', fontSize: 15 },
  scoringInput: {
    backgroundColor: '#1a472a', borderRadius: 8, width: 60, padding: 8,
    textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '600',
  },
  scoringPts: { color: '#8a9a5b', fontSize: 13, marginLeft: 6, width: 24 },

  // Stat bonus config
  statRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: '#2d5a3d', borderRadius: 10, padding: 12,
  },
  statLabel: { flex: 1 },
  statDesc: { color: '#6a7a5b', fontSize: 11, marginTop: 2 },

  button: {
    backgroundColor: '#4a8c5c', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
