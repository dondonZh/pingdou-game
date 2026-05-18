export interface PlayerProfile {
  playerId: string
  nickname: string
  createdAt: number
}

export const PLAYER_PROFILE_STORAGE_KEY = 'pingdou-game-player-profile-v1'
export const NICKNAME_GENERATION_LIMIT = 3

const nicknameLeftParts = [
  '春岚',
  '星禾',
  '云栀',
  '月桃',
  '朝露',
  '晴川',
  '青柚',
  '秋棠',
  '听雨',
  '知夏',
  '明溪',
  '晚枫',
  '小满',
  '木槿',
  '南枝',
  '初雪',
  '安禾',
  '禾月',
  '铃兰',
  '暖橙',
  '白露',
  '若芽',
  '知秋',
  '望舒'
] as const

const nicknameRightParts = [
  '豆宝',
  '团子',
  '糯糯',
  '果酱',
  '小贝',
  '阿团',
  '桃桃',
  '芽芽',
  '米糕',
  '星宝',
  '豆芽',
  '软糖',
  '小杏',
  '花卷',
  '奶芙',
  '柚子',
  '糖豆',
  '松果',
  '小梨',
  '云朵',
  '可可',
  '绵绵',
  '小荷',
  '栗子'
] as const

const blockedFragments = [
  '死',
  '尸',
  '血',
  '杀',
  '屎',
  '尿',
  '粪',
  '毒',
  '赌',
  '黄',
  '裸',
  '奸',
  '妓',
  '嫖',
  '妈',
  '爹',
  '娘炮',
  '傻',
  '笨',
  '猪',
  '狗',
  '贱',
  '鬼'
]

const isValidNickname = (nickname: string, excluded: Set<string>) => {
  if (!nickname || excluded.has(nickname)) {
    return false
  }

  return !blockedFragments.some((fragment) => nickname.includes(fragment))
}

const getRandomItem = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const createPlayerId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const generateRandomNickname = (excludedNicknames: string[] = []): string => {
  const excluded = new Set(excludedNicknames)

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const nickname = `${getRandomItem(nicknameLeftParts)}${getRandomItem(nicknameRightParts)}`

    if (isValidNickname(nickname, excluded)) {
      return nickname
    }
  }

  for (const left of nicknameLeftParts) {
    for (const right of nicknameRightParts) {
      const nickname = `${left}${right}`

      if (isValidNickname(nickname, excluded)) {
        return nickname
      }
    }
  }

  return '星禾团子'
}

const persistPlayerProfile = (profile: PlayerProfile) => {
  window.localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

export const loadPlayerProfile = (): PlayerProfile | null => {
  try {
    const rawValue = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as Partial<PlayerProfile>
    if (typeof parsed.nickname !== 'string' || !parsed.nickname.trim()) {
      return null
    }

    const profile: PlayerProfile = {
      playerId: typeof parsed.playerId === 'string' && parsed.playerId.trim() ? parsed.playerId : createPlayerId(),
      nickname: parsed.nickname.trim(),
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now()
    }

    if (profile.playerId !== parsed.playerId || profile.createdAt !== parsed.createdAt) {
      persistPlayerProfile(profile)
    }

    return profile
  } catch {
    return null
  }
}

export const savePlayerProfile = (nickname: string, existingProfile: PlayerProfile | null = null): PlayerProfile => {
  const profile: PlayerProfile = {
    playerId: existingProfile?.playerId ?? createPlayerId(),
    nickname,
    createdAt: existingProfile?.createdAt ?? Date.now()
  }

  persistPlayerProfile(profile)
  return profile
}
