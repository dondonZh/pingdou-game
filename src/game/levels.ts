import type { BoardCell, BoardMatrix, BoardToken, ColorId, ColorMeta, LevelDefinition } from './types'

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
    name: '糖霜花篮',
    badge: '01',
    story: '棋盘一开始会随机散落拼豆，先点场内豆子激活同色，再回收进收纳槽。',
    hint: '优先清理数量多的颜色，给中间大块同色底格腾位置。',
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
    name: '奶霜海螺',
    badge: '02',
    story: '随机散落会更乱一些，收纳槽不够时要先把对的颜色放回棋盘。',
    hint: '白色和青色可以先做轮廓，粉色适合中段集中归位。',
    capacity: 18,
    timeLimit: 210,
    board: toRows([
      '...www...bb',
      '..wwww..bbb',
      '.wwwwww.bbb',
      'wwlllpppbbb',
      'wlllpppppbb',
      '.llmmmmmbb.',
      '.llmmmmmbb.',
      '.llbbbbbll.',
      '..llbbbll..',
      '...mlllmm..',
      '....mmmm....'
    ])
  },
  {
    id: 3,
    name: '夜空小鲸',
    badge: '03',
    story: '最后一关会频繁切色，悬浮激活和棋盘边框提示会更重要。',
    hint: '先抓紫色和绿色的大块错位，后面左右两翼会轻松很多。',
    capacity: 22,
    timeLimit: 260,
    board: toRows([
      '..pppp..wwww..',
      '.ppppp..wwww..',
      'pppppplllwww..',
      '.pppllllllww..',
      '..llllppppbb..',
      '.llllpppppbbb.',
      '.lllmmmmmbbbb.',
      '.lllmmmmmbbbb.',
      '..llbbbbllbb..',
      '...mmbbbbmm...',
      '....mmllmm....',
      '.....mmmm.....'
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
