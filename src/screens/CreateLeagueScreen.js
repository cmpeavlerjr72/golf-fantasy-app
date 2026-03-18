import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as api from '../services/api';
import { colors } from '../theme';

const PRESETS = {
  standard: {
    label: 'Standard',
    desc: 'Balanced mix of scoring, stats, and position bonuses. Birdies and ball-striking both matter.',
    scoring: {
      eagle: 5, birdie: 3, par: 0.5, bogey: -1, double_bogey: -3,
      fir_points: 20, gir_points: 25, dist_per_yard: 0.1,
      great_shot_bonus: 2, poor_shot_penalty: -2,
    },
  },
  birdie_bonanza: {
    label: 'Birdie Bonanza',
    desc: 'Big rewards for birdies and eagles. The guy atop the real leaderboard usually wins fantasy too.',
    scoring: {
      eagle: 8, birdie: 5, par: 0.5, bogey: -2, double_bogey: -5,
      fir_points: 10, gir_points: 12, dist_per_yard: 0.05,
      great_shot_bonus: 1, poor_shot_penalty: -1,
    },
  },
  ball_striker: {
    label: 'Ball Striker',
    desc: 'Fairways, greens, and distance drive the scores. Precision and power are king.',
    scoring: {
      eagle: 4, birdie: 2, par: 0.5, bogey: -0.5, double_bogey: -2,
      fir_points: 35, gir_points: 45, dist_per_yard: 0.15,
      great_shot_bonus: 3, poor_shot_penalty: -3,
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
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [scoringTopN, setScoringTopN] = useState('4');

  // Season-specific
  const [rosterSize, setRosterSize] = useState('6');
  const [startersCount, setStartersCount] = useState('4');
  const [scoring, setScoring] = useState(PRESETS.standard.scoring);
  const [activePreset, setActivePreset] = useState('standard');
  const [showCustom, setShowCustom] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (leagueType === 'pool' && tournaments.length === 0) {
      loadTournaments();
    }
  }, [leagueType]);

  async function loadTournaments() {
    setLoadingTournaments(true);
    try {
      const data = await api.getTournaments();
      setTournaments(data || []);
      // Auto-select the active tournament
      const active = data?.find(t => t.is_active);
      if (active) setSelectedTournament(active);
    } catch (err) {
      console.warn('Could not load tournaments:', err.message);
    } finally {
      setLoadingTournaments(false);
    }
  }

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
    if (leagueType === 'pool' && !selectedTournament) return Alert.alert('Error', 'Select a tournament');

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
        params.tournamentId = selectedTournament.id;
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
      <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => setLeagueType(null)}>
        <Text style={styles.backText}>{'< Back to league type'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        {leagueType === 'pool' ? 'Tournament Pool' : 'Season-Long Fantasy'}
      </Text>
      <Text style={styles.subtitle}>Configure your league settings</Text>

      <Text style={styles.label}>League Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName}
        placeholder="e.g. Masters 2026" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Your Team Name</Text>
      <TextInput style={styles.input} value={teamName} onChangeText={setTeamName}
        placeholder="e.g. Eagle Squad" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Max Teams</Text>
      <TextInput style={styles.input} value={maxTeams} onChangeText={setMaxTeams}
        keyboardType="number-pad" placeholderTextColor={colors.textMuted} />

      {leagueType === 'pool' ? (
        <>
          <Text style={styles.sectionHeader}>Tournament</Text>
          {loadingTournaments ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
          ) : tournaments.length === 0 ? (
            <Text style={styles.hint}>No tournaments available. Sync data first.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {tournaments.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tournamentChip, selectedTournament?.id === t.id && styles.tournamentChipActive]}
                  onPress={() => setSelectedTournament(t)}
                >
                  <Text style={[styles.tournamentChipText, selectedTournament?.id === t.id && styles.tournamentChipTextActive]}>
                    {t.name}
                  </Text>
                  {t.is_active && <Text style={styles.liveTag}>LIVE</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.label}>Draft Rounds (players per team)</Text>
          <TextInput style={styles.input} value={draftRounds} onChangeText={setDraftRounds}
            keyboardType="number-pad" placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>Counting Scores Per Team</Text>
          <Text style={styles.hint}>How many of each team's best players count toward the total</Text>
          <TextInput style={styles.input} value={scoringTopN} onChangeText={setScoringTopN}
            keyboardType="number-pad" placeholderTextColor={colors.textMuted} />
        </>
      ) : (
        <>
          <Text style={styles.sectionHeader}>Roster Settings</Text>

          <Text style={styles.label}>Roster Size (= draft rounds)</Text>
          <Text style={styles.hint}>Each team drafts this many players</Text>
          <TextInput style={styles.input} value={rosterSize} onChangeText={setRosterSize}
            keyboardType="number-pad" placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>Weekly Starters</Text>
          <Text style={styles.hint}>How many players score points each week</Text>
          <TextInput style={styles.input} value={startersCount} onChangeText={setStartersCount}
            keyboardType="number-pad" placeholderTextColor={colors.textMuted} />

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
                { key: 'double_bogey', label: 'Double Bogey+', icon: '+2' },
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
                Flat points based on your player's stats for the week.
              </Text>

              {[
                { key: 'fir_points', label: 'Fairways Hit', desc: 'Points multiplied by FIR % (e.g. 65% = 13 pts)' },
                { key: 'gir_points', label: 'Greens in Reg', desc: 'Points multiplied by GIR % (e.g. 70% = 17.5 pts)' },
                { key: 'dist_per_yard', label: 'Driving Distance', desc: 'Points per yard of avg distance (e.g. 310 = 31 pts)' },
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 15, marginBottom: 20 },
  backText: { color: colors.accent, fontSize: 15, marginBottom: 16 },

  // Type selection cards
  typeCard: {
    backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  typeTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  typeDesc: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  typeBullets: { gap: 4 },
  bullet: { color: colors.textMuted, fontSize: 13, paddingLeft: 8 },

  // Form
  label: { color: colors.textSecondary, fontSize: 14, marginBottom: 6, marginTop: 14 },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgElevated, borderRadius: 12, padding: 16, fontSize: 16,
    color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: {
    fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 24, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20,
  },

  // Scoring presets
  presetCard: {
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: colors.border,
  },
  presetCardActive: {
    borderColor: colors.accent, backgroundColor: colors.accentDim,
  },
  presetHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  presetRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: colors.textMuted, marginRight: 10, alignItems: 'center', justifyContent: 'center',
  },
  presetRadioActive: { borderColor: colors.accent },
  presetRadioDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent,
  },
  presetTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  presetTitleActive: { color: colors.textPrimary },
  presetDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginLeft: 30 },

  // Custom toggle
  customToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  customToggleText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  customToggleArrow: { color: colors.accent, fontSize: 16 },

  // Hole scoring config
  scoringRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 12,
  },
  scoringLabel: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  scoringIcon: { color: colors.accent, fontWeight: 'bold', fontSize: 14, width: 32, textAlign: 'center' },
  scoringName: { color: colors.textPrimary, fontSize: 15 },
  scoringInput: {
    backgroundColor: colors.bgElevated, borderRadius: 8, width: 60, padding: 8,
    textAlign: 'center', color: colors.textPrimary, fontSize: 16, fontWeight: '600',
    borderWidth: 1, borderColor: colors.border,
  },
  scoringPts: { color: colors.textMuted, fontSize: 13, marginLeft: 6, width: 24 },

  // Stat bonus config
  statRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 12,
  },
  statLabel: { flex: 1 },
  statDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // Tournament chips
  tournamentChip: {
    backgroundColor: colors.bgCard, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
    marginRight: 8, borderWidth: 1.5, borderColor: colors.border, flexDirection: 'row', alignItems: 'center',
  },
  tournamentChipActive: {
    borderColor: colors.accent, backgroundColor: colors.accentDim,
  },
  tournamentChipText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  tournamentChipTextActive: { color: colors.textPrimary },
  liveTag: {
    color: colors.live, fontSize: 10, fontWeight: 'bold', marginLeft: 6,
    backgroundColor: 'rgba(248,81,73,0.15)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },

  button: {
    backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
