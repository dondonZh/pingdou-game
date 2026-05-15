import type { BoardMatrix, BoardToken, ColorId, ColorMeta, LevelDefinition } from './types'

export const colorMetaMap: Record<ColorId, ColorMeta> = {
  plum: {
    id: 'plum',
    name: '葡萄紫',
    beadClass: 'is-plum',
    glowClass: 'glow-plum',
    accent: '#9f6cf8'
  },
  lime: {
    id: 'lime',
    name: '青柠绿',
    beadClass: 'is-lime',
    glowClass: 'glow-lime',
    accent: '#b3e53d'
  },
  bubblegum: {
    id: 'bubblegum',
    name: '蜜桃橙',
    beadClass: 'is-bubblegum',
    glowClass: 'glow-bubblegum',
    accent: '#ff9b73'
  },
  mint: {
    id: 'mint',
    name: '薄荷青',
    beadClass: 'is-mint',
    glowClass: 'glow-mint',
    accent: '#8ce2d4'
  },
  pearl: {
    id: 'pearl',
    name: '奶油白',
    beadClass: 'is-pearl',
    glowClass: 'glow-pearl',
    accent: '#f3e8d5'
  }
}

const toRows = (rows: string[]): BoardToken[][] => rows.map((row) => row.split('') as BoardToken[])

export const levels: LevelDefinition[] = [
  {
    id: 1,
    name: '小试牛刀',
    badge: '01',
    story: '先用一块大色区热热手，熟悉激活、收纳和回填的节奏，把这关当成开场练习最合适。',
    hint: '优先处理中间的大块连通区域，能很快把归位节奏带起来。',
    capacity: 16,
    timeLimit: 160,
    board: toRows([
      '...llll...',
      '..llllll..',
      '.llppppll.',
      '.llppppll.',
      '.llmmmmll.',
      '.llmmmmll.',
      '.llbbbbll.',
      '.llbbbbll.',
      '..llllll..',
      '...llll...'
    ])
  },
  {
    id: 2,
    name: '小猫',
    badge: '02',
    story: '第二关换成小猫表情梗，耳朵、眼睛和脸颊会拆成更细的块面，辨识度会更强。',
    hint: '先归位脸外圈，再补眼睛和嘴部的小块，整体会顺很多。',
    capacity: 16,
    timeLimit: 210,
    board: toRows([
      '...pp...pp...',
      '..ppll.llpp..',
      '..lllllllll..',
      '.llwwwwwbbll.',
      '.lwwmwwwmwwl.',
      '.lwmmmmmmmwl.',
      '.lwmbbbbmmwl.',
      '.lwwmwwwmwwl.',
      '.llwwwwwbbll.',
      '..llpppppll..',
      '...lllllll...'
    ])
  },
  {
    id: 3,
    name: '写轮眼开',
    badge: '03',
    story: '最后一关做成动漫名场面的眼睛轮廓，外圈、瞳孔和高光会形成更明显的层次。',
    hint: '先清外圈，再处理中心区域，整盘会更容易控节奏。',
    capacity: 16,
    timeLimit: 260,
    board: toRows([
      '....ppppp....',
      '..ppppppppp..',
      '.ppwwwwwwwpp.',
      'ppwwlllllwwpp',
      'ppwllmmmllwpp',
      '.pwlmmbmllwp.',
      'ppwllmmmllwpp',
      'ppwwlllllwwpp',
      '.ppwwwwwwwpp.',
      '..ppppppppp..',
      '....ppppp....'
    ])
  }
]

const tokenToColor: Record<Exclude<BoardToken, '.'>, ColorId> = {
  p: 'plum',
  l: 'lime',
  b: 'bubblegum',
  m: 'mint',
  w: 'pearl'
}

const shuffle = <T>(items: T[]): T[] => {
  const copied = [...items]

  for (let index = copied.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = copied[index]
    copied[index] = copied[swapIndex]
    copied[swapIndex] = current
  }

  return copied
}

const createShape = (tokens: BoardToken[][]): BoardMatrix =>
  tokens.map((row) =>
    row.map((token) => {
      if (token === '.') {
        return null
      }

      return {
        baseColor: tokenToColor[token],
        beadColor: null
      }
    })
  )

const countCorrect = (board: BoardMatrix): number => {
  let total = 0

  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell && cell.beadColor === cell.baseColor) {
        total += 1
      }
    })
  })

  return total
}

export const createLevelBoard = (level: LevelDefinition): BoardMatrix => {
  const shape = createShape(level.board)
  const bag: ColorId[] = []

  shape.forEach((row) => {
    row.forEach((cell) => {
      if (cell) {
        bag.push(cell.baseColor)
      }
    })
  })

  let populated = shape
  let safety = 0

  while (safety < 12) {
    const shuffled = shuffle(bag)
    let pointer = 0
    populated = shape.map((row) =>
      row.map((cell) => {
        if (!cell) {
          return null
        }

        return {
          baseColor: cell.baseColor,
          beadColor: shuffled[pointer++]
        }
      })
    )

    const correct = countCorrect(populated)
    if (correct > 0 && correct < bag.length * 0.55) {
      return populated
    }

    safety += 1
  }

  return populated
}
