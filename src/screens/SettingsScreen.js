import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

export default function SettingsScreen() {
  const { user, logout, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all your leagues, rosters, and game data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(),
        },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Are you sure?',
      'Type DELETE to confirm. All your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete My Account',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  }

  async function performDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to delete account');
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Display Name</Text>
            <Text style={styles.value}>{user?.displayName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDescription}>
          Permanently delete your account and all associated data including leagues you own, rosters, lineups, and trade history.
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 16, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  label: { color: colors.textSecondary, fontSize: 15 },
  value: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border },
  logoutButton: {
    backgroundColor: colors.bgCard, borderRadius: 10, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  logoutButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  dangerSection: {
    marginTop: 'auto', padding: 16, paddingBottom: 32,
  },
  dangerTitle: { color: colors.negative, fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  dangerDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  deleteButton: {
    backgroundColor: colors.negative, borderRadius: 10, padding: 14, alignItems: 'center',
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
