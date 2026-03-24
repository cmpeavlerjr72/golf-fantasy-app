import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

const API_URL = 'https://golf-fantasy-backend.onrender.com/api';
// Store URLs are returned by the /push/version endpoint from the backend

/**
 * Compare two semver strings: returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

/**
 * Check if the app needs to be updated
 * Shows an alert that sends the user to the appropriate store
 */
export async function checkForUpdate() {
  try {
    const res = await fetch(`${API_URL}/push/version`);
    if (!res.ok) return;

    const data = await res.json();
    const currentVersion = Constants.expoConfig?.version || '0.0.0';

    if (compareSemver(currentVersion, data.minVersion) < 0) {
      // Current version is below minimum — force update
      const storeUrl = Platform.OS === 'ios'
        ? data.storeUrls?.ios
        : data.storeUrls?.android;

      Alert.alert(
        'Update Required',
        'A new version of Fairway Fantasy is available. Please update to continue.',
        [
          {
            text: 'Update Now',
            onPress: () => {
              if (storeUrl) Linking.openURL(storeUrl);
            },
          },
        ],
        { cancelable: false }
      );
    }
  } catch (err) {
    // Silently fail — don't block the app if version check fails
    console.warn('Version check failed:', err.message);
  }
}
