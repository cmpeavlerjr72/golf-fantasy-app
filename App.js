import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LeaguesScreen from './src/screens/LeaguesScreen';
import CreateLeagueScreen from './src/screens/CreateLeagueScreen';
import JoinLeagueScreen from './src/screens/JoinLeagueScreen';
import LeagueDetailScreen from './src/screens/LeagueDetailScreen';
import DraftScreen from './src/screens/DraftScreen';
import StandingsScreen from './src/screens/StandingsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import SeasonHomeScreen from './src/screens/SeasonHomeScreen';
import FreeAgentsScreen from './src/screens/FreeAgentsScreen';
import ProposeTradeScreen from './src/screens/ProposeTradeScreen';
import ScoringRulesScreen from './src/screens/ScoringRulesScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#1a472a' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' },
};

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0f2e1a',
          borderTopColor: '#2d5a3d',
        },
        tabBarActiveTintColor: '#4a8c5c',
        tabBarInactiveTintColor: '#8a9a5b',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#1a472a' },
        headerTintColor: '#fff',
      }}
    >
      <Tab.Screen
        name="Leagues"
        component={LeaguesScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a472a' }}>
        <ActivityIndicator size="large" color="#4a8c5c" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Sign Up' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
          <Stack.Screen name="CreateLeague" component={CreateLeagueScreen} options={{ title: 'Create League' }} />
          <Stack.Screen name="JoinLeague" component={JoinLeagueScreen} options={{ title: 'Join League' }} />
          <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} options={{ title: 'League' }} />
          <Stack.Screen name="Draft" component={DraftScreen} options={{ title: 'Draft Room' }} />
          <Stack.Screen name="Standings" component={StandingsScreen} options={{ title: 'Standings' }} />
          <Stack.Screen name="SeasonHome" component={SeasonHomeScreen} options={{ title: 'Season League' }} />
          <Stack.Screen name="FreeAgents" component={FreeAgentsScreen} options={{ title: 'Free Agents' }} />
          <Stack.Screen name="ProposeTrade" component={ProposeTradeScreen} options={{ title: 'Propose Trade' }} />
          <Stack.Screen name="ScoringRules" component={ScoringRulesScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
