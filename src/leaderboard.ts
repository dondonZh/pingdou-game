import type { PlayerProfile } from './playerProfile'

export interface LeaderboardEntry {
  rank: number
  playerId: string
  nickname: string
  elapsedMs: number
}

export interface LeaderboardMe {
  rank: number
  playerId: string
  nickname: string
  elapsedMs: number
}

export interface LeaderboardResponse {
  items: LeaderboardEntry[]
  me: LeaderboardMe | null
}

export interface SubmitScoreResult {
  accepted: boolean
  improved: boolean
  bestElapsedMs: number | null
  rank: number | null
  reason?: string
}

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = rawApiBaseUrl.endsWith('/') ? rawApiBaseUrl.slice(0, -1) : rawApiBaseUrl

const requestJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export const registerGuestProfile = async (profile: PlayerProfile) =>
  requestJson<{ ok: true; profile: PlayerProfile }>(`${API_BASE_URL}/guest/register`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: profile.playerId,
      nickname: profile.nickname
    })
  })

export const submitGlobalScore = async (payload: {
  playerId: string
  nickname: string
  elapsedMs: number
  cheatUsed: boolean
}) =>
  requestJson<SubmitScoreResult>(`${API_BASE_URL}/score/submit`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

export const fetchGlobalLeaderboard = async (playerId?: string, limit = 20) => {
  const searchParams = new URLSearchParams({
    limit: String(limit)
  })

  if (playerId) {
    searchParams.set('playerId', playerId)
  }

  return requestJson<LeaderboardResponse>(`${API_BASE_URL}/leaderboard/global?${searchParams.toString()}`)
}
