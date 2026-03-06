const API_URL = 'https://golf-fantasy-backend.onrender.com/api';

let authToken = null;

export function setToken(token) {
  authToken = token;
}

export function getToken() {
  return authToken;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

// Auth
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const register = (email, password, displayName) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) });

export const getMe = () => request('/auth/me');

// Leagues
export const getLeagues = () => request('/leagues');

export const getLeague = (id) => request(`/leagues/${id}`);

export const createLeague = (params) =>
  request('/leagues', { method: 'POST', body: JSON.stringify(params) });

export const joinLeague = (inviteCode, teamName) =>
  request('/leagues/join', { method: 'POST', body: JSON.stringify({ inviteCode, teamName }) });

export const getStandings = (leagueId) => request(`/leagues/${leagueId}/standings`);

// Tournaments
export const getActiveTournament = () => request('/tournaments/active');

export const getTournaments = () => request('/tournaments/list');

export const getTournamentField = (tournamentId) => request(`/tournaments/${tournamentId}/field`);

export const getLeaderboard = () => request('/tournaments/leaderboard');

export const getPlayerStats = (tour) => request(`/tournaments/player-stats${tour ? `?tour=${tour}` : ''}`);

export const getHoleScores = (playerName) =>
  request(`/tournaments/hole-scores${playerName ? `?player=${encodeURIComponent(playerName)}` : ''}`);

// Lineups (season leagues)
export const getLineup = (leagueId) => request(`/lineups/${leagueId}`);

export const setLineup = (leagueId, starters, bench) =>
  request(`/lineups/${leagueId}`, { method: 'PUT', body: JSON.stringify({ starters, bench }) });

export const getSeasonStandings = (leagueId) => request(`/lineups/${leagueId}/season-standings`);

// Rosters (season leagues)
export const getRoster = (leagueId) => request(`/rosters/${leagueId}`);

export const getFreeAgents = (leagueId) => request(`/rosters/${leagueId}/free-agents`);

export const addPlayer = (leagueId, playerName) =>
  request(`/rosters/${leagueId}/add`, { method: 'POST', body: JSON.stringify({ playerName }) });

export const dropPlayer = (leagueId, playerName) =>
  request(`/rosters/${leagueId}/drop`, { method: 'POST', body: JSON.stringify({ playerName }) });

export const getTransactions = (leagueId) => request(`/rosters/${leagueId}/transactions`);

// Trades (season leagues)
export const getTrades = (leagueId) => request(`/trades/${leagueId}`);

export const proposeTrade = (leagueId, myPlayer, theirPlayer, theirMemberId) =>
  request(`/trades/${leagueId}`, { method: 'POST', body: JSON.stringify({ myPlayer, theirPlayer, theirMemberId }) });

export const acceptTrade = (leagueId, tradeId) =>
  request(`/trades/${leagueId}/${tradeId}/accept`, { method: 'POST' });

export const declineTrade = (leagueId, tradeId) =>
  request(`/trades/${leagueId}/${tradeId}/decline`, { method: 'POST' });
