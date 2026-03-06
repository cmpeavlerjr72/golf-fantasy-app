import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        api.setToken(token);
        const userData = await api.getMe();
        setUser(userData);
      }
    } catch (err) {
      await SecureStore.deleteItemAsync('authToken');
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await api.login(email, password);
    api.setToken(data.token);
    await SecureStore.setItemAsync('authToken', data.token);
    setUser(data.user);
  }

  async function register(email, password, displayName) {
    const data = await api.register(email, password, displayName);
    api.setToken(data.token);
    await SecureStore.setItemAsync('authToken', data.token);
    setUser(data.user);
  }

  async function logout() {
    api.setToken(null);
    await SecureStore.deleteItemAsync('authToken');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
