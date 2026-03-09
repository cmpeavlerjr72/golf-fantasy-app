import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as api from '../services/api';

const TOKEN_KEY = 'authToken';

async function getStoredToken() {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setStoredToken(token) {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function removeStoredToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await getStoredToken();
      if (token) {
        api.setToken(token);
        const userData = await api.getMe();
        setUser(userData);
      }
    } catch (err) {
      await removeStoredToken();
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await api.login(email, password);
    api.setToken(data.token);
    await setStoredToken(data.token);
    setUser(data.user);
  }

  async function register(email, password, displayName) {
    const data = await api.register(email, password, displayName);
    api.setToken(data.token);
    await setStoredToken(data.token);
    setUser(data.user);
  }

  async function logout() {
    api.setToken(null);
    await removeStoredToken();
    setUser(null);
  }

  async function deleteAccount() {
    await api.deleteAccount();
    api.setToken(null);
    await removeStoredToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
