import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
  RefreshControl, Image, ScrollView, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line, Circle } from 'react-native-svg';
import * as api from '../services/api';
import { colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVERLAY_WIDTH = SCREEN_WIDTH - 32;

function getScoreClass(score, par) {
  const diff = parseInt(score) - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double';
}

function getScoreLabel(score, par) {
  const diff = parseInt(score) - par;
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Dbl Bogey';
  return `+${diff}`;
}

const scoreColors = {
  eagle: colors.gold,
  birdie: colors.positive,
  par: colors.textSecondary,
  bogey: colors.negative,
  double: '#d32f2f',
};

function getShotTypeColor(stroke) {
  if (stroke.strokeType === 'PENALTY') return colors.negative;
  if (stroke.fromLocation?.toLowerCase().includes('tee')) return colors.gold;
  if (stroke.fromLocation?.toLowerCase().includes('green')) return '#60a5fa';
  return '#a78bfa';
}

export default function ShotTrackerScreen({ route, navigation }) {
  const { playerName } = route.params;
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [data, setData] = useState(null);
  const [selectedHoleIdx, setSelectedHoleIdx] = useState(0);
  const [activeStroke, setActiveStroke] = useState(null);
  const [greenView, setGreenView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageSize, setImageSize] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadRounds();
    }, [playerName])
  );

  async function loadRounds() {
    try {
      const result = await api.getShotRounds(playerName);
      if (!result.available || result.rounds.length === 0) {
        setRounds([]);
        setLoading(false);
        return;
      }
      setRounds(result.rounds);
      // Auto-select latest round
      const latest = result.rounds[result.rounds.length - 1];
      setSelectedRound(latest.round);
      await loadRound(latest.round);
    } catch (err) {
      Alert.alert('Error', err.message);
      setLoading(false);
    }
  }

  async function loadRound(round) {
    setLoading(true);
    setSelectedHoleIdx(0);
    setActiveStroke(null);
    setGreenView(false);
    try {
      const result = await api.getShotDetails(playerName, round);
      setData(result);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function onImageLayout(e) {
    const { width, height } = e.nativeEvent.layout;
    setImageSize({ width, height });
  }

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Loading shot data...</Text>
      </View>
    );
  }

  if (!data?.available) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.noDataTitle}>No Shot Data Available</Text>
        <Text style={styles.noDataText}>
          Shot tracking data is not available for {playerName} this week.
          {'\n\n'}This player may be on a different tour (LIV) or hasn't started their round yet.
        </Text>
      </View>
    );
  }

  const hole = data.holes[selectedHoleIdx];
  const cls = getScoreClass(hole.score, hole.par);

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Player header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.playerName}>{data.player}</Text>
            <Text style={styles.tournInfo}>{data.tournament}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{data.totalScore} ({data.scoreToPar})</Text>
          </View>
        </View>

        {/* Round selector */}
        {rounds.length > 1 && (
          <View style={styles.roundPills}>
            {rounds.map(r => (
              <TouchableOpacity
                key={r.round}
                style={[styles.roundPill, selectedRound === r.round && styles.roundPillActive]}
                onPress={() => { setSelectedRound(r.round); loadRound(r.round); }}
              >
                <Text style={[styles.roundPillText, selectedRound === r.round && styles.roundPillTextActive]}>
                  R{r.round}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Hole selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.holePills}>
          {data.holes.map((h, i) => {
            const hcls = getScoreClass(h.score, h.par);
            const isActive = i === selectedHoleIdx;
            return (
              <TouchableOpacity
                key={h.holeNumber}
                style={[styles.holePill, isActive && styles.holePillActive]}
                onPress={() => { setSelectedHoleIdx(i); setActiveStroke(null); setGreenView(false); }}
              >
                <Text style={[styles.holePillNum, isActive && styles.holePillNumActive]}>
                  {h.holeNumber}
                </Text>
                <Text style={[styles.holePillScore, { color: scoreColors[hcls] }]}>
                  {h.score}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Hole header */}
        <View style={styles.holeHeader}>
          <Text style={styles.holeTitle}>Hole {hole.holeNumber}</Text>
          <Text style={styles.holeDetails}>Par {hole.par} | {hole.yardage} yds</Text>
          <View style={[styles.holeResultBadge, { backgroundColor: scoreColors[cls] + '22', borderColor: scoreColors[cls] }]}>
            <Text style={[styles.holeResultText, { color: scoreColors[cls] }]}>
              {getScoreLabel(hole.score, hole.par)}
            </Text>
          </View>
        </View>

        {/* Course overlay */}
        {(greenView ? hole.overlayGreenUrl : hole.overlayFullUrl) && (
          <View style={styles.overlayContainer}>
            <Image
              source={{ uri: greenView ? hole.overlayGreenUrl : hole.overlayFullUrl }}
              style={styles.overlayImage}
              resizeMode="contain"
              onLayout={onImageLayout}
            />
            {imageSize && (
              <Svg
                style={[StyleSheet.absoluteFill, { width: imageSize.width, height: imageSize.height }]}
                viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              >
                {hole.strokes.map((s, si) => {
                  const from = greenView ? s.greenFrom : s.from;
                  const to = greenView ? s.greenTo : s.to;
                  if (!from || !to) return null;
                  // Skip off-image shots in green view
                  if (greenView && from.x < -0.5 && to.x < -0.5) return null;

                  const x1 = from.x * imageSize.width;
                  const y1 = from.y * imageSize.height;
                  const x2 = to.x * imageSize.width;
                  const y2 = to.y * imageSize.height;
                  const isActive = activeStroke === si;

                  return (
                    <React.Fragment key={si}>
                      <Line
                        x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={isActive ? '#00ff88' : 'rgba(255,255,255,0.5)'}
                        strokeWidth={isActive ? 3 : 1.5}
                        strokeDasharray={isActive ? '' : '6,4'}
                      />
                      {si === 0 && (
                        <Circle cx={x1} cy={y1} r={isActive ? 6 : 4}
                          fill={colors.gold} stroke="#000" strokeWidth={1} />
                      )}
                      <Circle cx={x2} cy={y2} r={isActive ? 6 : 4}
                        fill={s.finalStroke ? colors.negative : (isActive ? '#00ff88' : 'rgba(255,255,255,0.7)')}
                        stroke="#000" strokeWidth={1} />
                    </React.Fragment>
                  );
                })}
                {/* Pin */}
                {(() => {
                  const pin = greenView ? hole.pinGreen : hole.pin;
                  if (!pin) return null;
                  return (
                    <Circle cx={pin.x * imageSize.width} cy={pin.y * imageSize.height}
                      r={4} fill={colors.negative} stroke="#fff" strokeWidth={1.5} />
                  );
                })()}
              </Svg>
            )}
            {hole.overlayGreenUrl && (
              <TouchableOpacity
                style={styles.greenToggle}
                onPress={() => { setGreenView(!greenView); setImageSize(null); }}
              >
                <Text style={styles.greenToggleText}>{greenView ? 'Full Hole' : 'Green View'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Shot cards */}
        {hole.strokes.map((s, si) => (
          <TouchableOpacity
            key={si}
            style={[
              styles.shotCard,
              activeStroke === si && styles.shotCardActive,
              { borderLeftColor: getShotTypeColor(s), borderLeftWidth: 3 },
            ]}
            onPress={() => setActiveStroke(activeStroke === si ? null : si)}
          >
            <View style={styles.shotHeader}>
              <View style={styles.shotBadge}>
                <Text style={styles.shotBadgeText}>{s.strokeNumber}</Text>
              </View>
              <Text style={styles.shotPlayByPlay} numberOfLines={2}>{s.playByPlay}</Text>
              <Text style={styles.shotDistance}>{s.distance}</Text>
            </View>

            <View style={styles.shotLocations}>
              <Text style={styles.shotLoc}>{s.fromLocation}</Text>
              <Text style={styles.shotArrow}>→</Text>
              <Text style={styles.shotLoc}>{s.toLocation}</Text>
              {s.distanceRemaining ? (
                <Text style={styles.shotRemaining}>{s.distanceRemaining}</Text>
              ) : null}
            </View>

            {/* TrackMan radar */}
            {s.radar && (
              <View style={styles.radarGrid}>
                {s.radar.clubSpeed && (
                  <View style={styles.radarItem}>
                    <Text style={styles.radarValue}>{s.radar.clubSpeed}</Text>
                    <Text style={styles.radarLabel}>Club (mph)</Text>
                  </View>
                )}
                {s.radar.ballSpeed && (
                  <View style={styles.radarItem}>
                    <Text style={styles.radarValue}>{s.radar.ballSpeed}</Text>
                    <Text style={styles.radarLabel}>Ball (mph)</Text>
                  </View>
                )}
                {s.radar.launchAngle && (
                  <View style={styles.radarItem}>
                    <Text style={styles.radarValue}>{s.radar.launchAngle.toFixed(1)}°</Text>
                    <Text style={styles.radarLabel}>Launch</Text>
                  </View>
                )}
                {s.radar.apexHeight && (
                  <View style={styles.radarItem}>
                    <Text style={styles.radarValue}>{s.radar.apexHeight.toFixed(0)}ft</Text>
                    <Text style={styles.radarLabel}>Apex</Text>
                  </View>
                )}
              </View>
            )}

            {/* AI Commentary */}
            {activeStroke === si && s.commentary && (
              <View style={styles.commentaryBox}>
                <Text style={styles.commentaryText}>{s.commentary}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: colors.textSecondary, fontSize: 16 },
  noDataTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  noDataText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  playerName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  tournInfo: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  scoreBadge: {
    backgroundColor: colors.accentDark + '44', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  scoreText: { color: colors.accent, fontSize: 16, fontWeight: '700' },

  // Round pills
  roundPills: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8,
  },
  roundPill: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
  },
  roundPillActive: { backgroundColor: colors.accentDark, borderColor: colors.accent },
  roundPillText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  roundPillTextActive: { color: '#fff' },

  // Hole pills
  holePills: { paddingHorizontal: 12, paddingVertical: 12 },
  holePill: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    marginHorizontal: 4, borderRadius: 10,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  holePillActive: { borderColor: colors.accent, backgroundColor: colors.accentDark + '33' },
  holePillNum: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  holePillNumActive: { color: colors.textPrimary },
  holePillScore: { fontSize: 16, fontWeight: '800', marginTop: 2 },

  // Hole header
  holeHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingBottom: 12, gap: 12,
  },
  holeTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  holeDetails: { color: colors.textSecondary, fontSize: 13 },
  holeResultBadge: {
    marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  holeResultText: { fontSize: 13, fontWeight: '700' },

  // Course overlay
  overlayContainer: {
    marginHorizontal: 16, marginBottom: 16, borderRadius: 12,
    overflow: 'hidden', backgroundColor: '#0d1a12',
    borderWidth: 1, borderColor: colors.border,
  },
  overlayImage: { width: '100%', aspectRatio: 2.34 },
  greenToggle: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(15,25,20,0.85)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.accentDark,
  },
  greenToggleText: { color: colors.accent, fontSize: 11, fontWeight: '600' },

  // Shot cards
  shotCard: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.bgCard,
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  shotCardActive: { borderColor: colors.accent, backgroundColor: '#0f2018' },
  shotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  shotBadge: {
    backgroundColor: colors.bgElevated, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  shotBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  shotPlayByPlay: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  shotDistance: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  shotLocations: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shotLoc: { color: colors.textSecondary, fontSize: 12 },
  shotArrow: { color: colors.accent, fontSize: 12 },
  shotRemaining: { color: '#a06040', fontSize: 11, marginLeft: 'auto' },

  // Radar
  radarGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  radarItem: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 6, padding: 6,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  radarValue: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  radarLabel: { color: colors.textMuted, fontSize: 9, marginTop: 2 },

  // Commentary
  commentaryBox: {
    marginTop: 8, padding: 10, backgroundColor: colors.bg,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border,
  },
  commentaryText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
});
