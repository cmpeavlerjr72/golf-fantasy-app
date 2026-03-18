import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

export default function ScoringRulesScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>How Scoring Works</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hole Scoring</Text>
          <Text style={styles.sectionDesc}>Points awarded for each hole your player completes.</Text>
          {[
            { label: 'Eagle (2+ under par)', pts: '+5', color: colors.gold },
            { label: 'Birdie (1 under par)', pts: '+3', color: colors.accent },
            { label: 'Par', pts: '+0.5', color: colors.textSecondary },
            { label: 'Bogey (1 over par)', pts: '-1', color: colors.negative },
            { label: 'Double Bogey+ (2+ over)', pts: '-3', color: colors.negative },
          ].map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={[styles.rowPts, { color: r.color }]}>{r.pts}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stat Bonuses</Text>
          <Text style={styles.sectionDesc}>Flat points based on your player's weekly stats.</Text>
          <View style={styles.statExample}>
            <Text style={styles.statName}>Fairways Hit (FIR)</Text>
            <Text style={styles.statFormula}>FIR% x 20 pts</Text>
            <Text style={styles.statExText}>65% accuracy = 13 pts</Text>
          </View>
          <View style={styles.statExample}>
            <Text style={styles.statName}>Greens in Regulation (GIR)</Text>
            <Text style={styles.statFormula}>GIR% x 25 pts</Text>
            <Text style={styles.statExText}>70% GIR = 17.5 pts</Text>
          </View>
          <View style={styles.statExample}>
            <Text style={styles.statName}>Driving Distance</Text>
            <Text style={styles.statFormula}>Avg yards x 0.1 pts</Text>
            <Text style={styles.statExText}>310 yards = 31 pts</Text>
          </View>
          <View style={styles.divider} />
          {[
            { label: 'Great Shot', pts: '+2 each', color: colors.accent },
            { label: 'Poor Shot', pts: '-2 each', color: colors.negative },
          ].map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={[styles.rowPts, { color: r.color }]}>{r.pts}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Finish Position</Text>
          <Text style={styles.sectionDesc}>Bonus points for where your player finishes on the leaderboard.</Text>
          <View style={styles.posGrid}>
            {[
              ['1st', '+10'], ['2nd', '+7'], ['3rd', '+5'],
              ['4th', '+4'], ['5th', '+3'], ['6th', '+2'],
              ['7th', '+1.5'], ['8th', '+1'], ['9-10th', '+0.5'],
            ].map(([pos, pts], i) => (
              <View key={i} style={styles.posItem}>
                <Text style={styles.posLabel}>{pos}</Text>
                <Text style={styles.posPts}>{pts}</Text>
              </View>
            ))}
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Missed Cut</Text>
            <Text style={[styles.rowPts, { color: colors.negative }]}>-5</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Season Points</Text>
          <Text style={styles.sectionDesc}>How the season-long standings work.</Text>
          <Text style={styles.bodyText}>
            Each week, all teams are ranked by total fantasy points. Season points are awarded based on your weekly finish:
          </Text>
          <View style={styles.posGrid}>
            {[
              ['1st', '500'], ['2nd', '300'], ['3rd', '200'],
              ['4th', '150'], ['5th', '100'],
            ].map(([pos, pts], i) => (
              <View key={i} style={styles.posItem}>
                <Text style={styles.posLabel}>{pos}</Text>
                <Text style={styles.posPts}>{pts}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.bodyText}>
            If teams are tied, they split the combined season points evenly — just like prize money in a real golf tournament.
          </Text>
        </View>

        <Text style={styles.footnote}>
          These are default values. League commissioners can customize scoring when creating a league.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 12, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  rowLabel: { color: colors.textPrimary, fontSize: 14 },
  rowPts: { fontSize: 15, fontWeight: '700' },
  statExample: {
    backgroundColor: colors.bgElevated, borderRadius: 8, padding: 10, marginBottom: 8,
  },
  statName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  statFormula: { color: colors.accent, fontSize: 13, marginTop: 2 },
  statExText: { color: colors.textSecondary, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  posGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10,
  },
  posItem: {
    backgroundColor: colors.bgElevated, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 6, alignItems: 'center', minWidth: 70,
  },
  posLabel: { color: colors.textSecondary, fontSize: 11 },
  posPts: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  bodyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginVertical: 6 },
  footnote: {
    color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic',
  },
});
