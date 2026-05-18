import cors from 'cors'
import express from 'express'
import { createClient } from 'redis'

const PORT = Number(process.env.PORT || 3001)
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const LEADERBOARD_KEY = 'leaderboard:global'
const BEST_SCORE_PREFIX = 'leaderboard:best:'
const PLAYER_PROFILE_PREFIX = 'player:profile:'

const app = express()
app.use(cors())
app.use(express.json())

const redis = createClient({
  url: REDIS_URL
})

redis.on('error', (error) => {
  console.error('[redis] error', error)
})

const getBestScoreKey = (playerId) => `${BEST_SCORE_PREFIX}${playerId}`
const getPlayerProfileKey = (playerId) => `${PLAYER_PROFILE_PREFIX}${playerId}`

const isValidNickname = (nickname) => typeof nickname === 'string' && nickname.trim().length >= 2 && nickname.trim().length <= 24
const isValidPlayerId = (playerId) => typeof playerId === 'string' && playerId.trim().length >= 6 && playerId.trim().length <= 80
const isValidElapsedMs = (elapsedMs) =>
  typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs > 0 && elapsedMs <= 24 * 60 * 60 * 1000

const normalizeProfile = (playerId, nickname) => ({
  playerId: playerId.trim(),
  nickname: nickname.trim()
})

const savePlayerProfile = async (playerId, nickname) => {
  const profileKey = getPlayerProfileKey(playerId)
  await redis.hSet(profileKey, {
    nickname,
    updatedAt: String(Date.now())
  })
}

const getNickname = async (playerId) => {
  const nickname = await redis.hGet(getPlayerProfileKey(playerId), 'nickname')
  return nickname || '匿名玩家'
}

const buildLeaderboardResponse = async (playerId, limit) => {
  const rows = await redis.zRangeWithScores(LEADERBOARD_KEY, 0, Math.max(limit - 1, 0))
  const items = await Promise.all(
    rows.map(async (row, index) => ({
      rank: index + 1,
      playerId: row.value,
      nickname: await getNickname(row.value),
      elapsedMs: Math.round(row.score)
    }))
  )

  let me = null
  if (playerId && isValidPlayerId(playerId)) {
    const rank = await redis.zRank(LEADERBOARD_KEY, playerId)
    if (rank !== null) {
      const bestScore = await redis.zScore(LEADERBOARD_KEY, playerId)
      me = {
        rank: rank + 1,
        playerId,
        nickname: await getNickname(playerId),
        elapsedMs: bestScore === null ? 0 : Math.round(bestScore)
      }
    }
  }

  return {
    items,
    me
  }
}

app.get('/api/health', async (_request, response) => {
  response.json({
    ok: true
  })
})

app.post('/api/guest/register', async (request, response) => {
  const { playerId, nickname } = request.body ?? {}
  if (!isValidPlayerId(playerId) || !isValidNickname(nickname)) {
    response.status(400).json({
      ok: false,
      message: 'Invalid player profile payload'
    })
    return
  }

  const profile = normalizeProfile(playerId, nickname)
  await savePlayerProfile(profile.playerId, profile.nickname)

  response.json({
    ok: true,
    profile
  })
})

app.post('/api/score/submit', async (request, response) => {
  const { playerId, nickname, elapsedMs, cheatUsed } = request.body ?? {}
  if (!isValidPlayerId(playerId) || !isValidNickname(nickname) || !isValidElapsedMs(elapsedMs) || typeof cheatUsed !== 'boolean') {
    response.status(400).json({
      accepted: false,
      improved: false,
      bestElapsedMs: null,
      rank: null,
      reason: 'invalid_payload'
    })
    return
  }

  const profile = normalizeProfile(playerId, nickname)
  await savePlayerProfile(profile.playerId, profile.nickname)

  const bestScoreKey = getBestScoreKey(profile.playerId)
  const currentBest = await redis.hGet(bestScoreKey, 'elapsedMs')
  const currentBestElapsedMs = currentBest ? Number(currentBest) : null

  if (currentBestElapsedMs !== null && elapsedMs >= currentBestElapsedMs) {
    const currentRank = await redis.zRank(LEADERBOARD_KEY, profile.playerId)
    response.json({
      accepted: true,
      improved: false,
      bestElapsedMs: currentBestElapsedMs,
      rank: currentRank === null ? null : currentRank + 1
    })
    return
  }

  await redis.hSet(bestScoreKey, {
    elapsedMs: String(Math.round(elapsedMs)),
    updatedAt: String(Date.now())
  })
  await redis.zAdd(LEADERBOARD_KEY, [
    {
      score: Math.round(elapsedMs),
      value: profile.playerId
    }
  ])

  const rank = await redis.zRank(LEADERBOARD_KEY, profile.playerId)
  response.json({
    accepted: true,
    improved: true,
    bestElapsedMs: Math.round(elapsedMs),
    rank: rank === null ? null : rank + 1
  })
})

app.get('/api/leaderboard/global', async (request, response) => {
  const playerId = typeof request.query.playerId === 'string' ? request.query.playerId : undefined
  const requestedLimit = Number(request.query.limit || 20)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.round(requestedLimit), 1), 100) : 20

  response.json(await buildLeaderboardResponse(playerId, limit))
})

const start = async () => {
  await redis.connect()
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leaderboard API listening on http://0.0.0.0:${PORT}`)
  })
}

start().catch((error) => {
  console.error('Failed to start leaderboard API', error)
  process.exit(1)
})
