import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { colorMetaMap, createLevelBoard, levels } from './levels'
import type { BoardMatrix, ClearSummary, ColorId, PlacementCell, PlacementRecord, ToolState } from './types'

const SECRET_WIN_CODE = 'olaolaola'
const ANIMATION_PREPARE_MS = 8
const ANIMATION_STEP_MS = 24
const ANIMATION_BUSY_MESSAGE = '拼豆正在移动，等它们落位后再继续操作。'

const createTray = (capacity: number): Array<ColorId | null> => Array.from({ length: capacity }, () => null)

const createTools = (): ToolState => ({
  magnet: 1,
  brush: 2,
  hourglass: 1
})

const boardIsSolved = (board: BoardMatrix): boolean =>
  board.every((row) =>
    row.every((cell) => {
      if (!cell) {
        return true
      }

      return cell.beadColor === cell.baseColor
    })
  )

const getConnectedRegion = (board: BoardMatrix, startRow: number, startCol: number, color: ColorId): PlacementCell[] => {
  const start = board[startRow]?.[startCol]
  if (!start || start.baseColor !== color) {
    return []
  }

  const queue: PlacementCell[] = [{ row: startRow, col: startCol }]
  const visited = new Set<string>([`${startRow}:${startCol}`])
  const region: PlacementCell[] = []
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      break
    }

    const cell = board[current.row]?.[current.col]
    if (!cell || cell.baseColor !== color) {
      continue
    }

    region.push(current)

    directions.forEach(([rowOffset, colOffset]) => {
      const nextRow = current.row + rowOffset
      const nextCol = current.col + colOffset
      const key = `${nextRow}:${nextCol}`

      if (visited.has(key)) {
        return
      }

      const nextCell = board[nextRow]?.[nextCol]
      if (!nextCell || nextCell.baseColor !== color) {
        return
      }

      visited.add(key)
      queue.push({ row: nextRow, col: nextCol })
    })
  }

  return region
}

const getMovableBoardCells = (board: BoardMatrix, color: ColorId): PlacementCell[] => {
  const movable: PlacementCell[] = []

  board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) {
        return
      }

      if (cell.beadColor === color && cell.baseColor !== color) {
        movable.push({ row: rowIndex, col: colIndex })
      }
    })
  })

  return movable
}

const sleep = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration))

const createCellKey = (row: number, col: number) => `${row}:${col}`

const appendUnique = <T>(list: T[], value: T) => (list.includes(value) ? list : [...list, value])

const removeValue = <T>(list: T[], value: T) => list.filter((item) => item !== value)

export const useBeadGame = () => {
  const levelIndex = ref(0)
  const board = ref<BoardMatrix>([])
  const tray = ref<Array<ColorId | null>>(createTray(levels[0].capacity))
  const tools = ref<ToolState>(createTools())
  const activeBoardColor = ref<ColorId | null>(null)
  const selectedTrayColor = ref<ColorId | null>(null)
  const completedLevelIds = ref<number[]>([])
  const furthestUnlocked = ref(1)
  const status = ref<'playing' | 'won' | 'lost'>('playing')
  const secondsLeft = ref(levels[0].timeLimit)
  const message = ref('先点棋盘里的任意一颗拼豆，激活整场同色豆子。')
  const lastClearSummary = ref<ClearSummary | null>(null)
  const history = ref<PlacementRecord[]>([])
  const levelClearTimes = ref<Record<number, number>>({})
  const levelCheatUsage = ref<Record<number, boolean>>({})
  const isAnimating = ref(false)
  const enteringBoardKeys = ref<string[]>([])
  const leavingBoardKeys = ref<string[]>([])
  const enteringTrayIndexes = ref<number[]>([])
  const leavingTrayIndexes = ref<number[]>([])

  let timerId: number | null = null
  let cheatUsedForCurrentRun = false
  let secretKeyBuffer = ''

  const currentLevel = computed(() => levels[levelIndex.value])
  const boardSize = computed(() => ({
    rows: board.value.length,
    columns: board.value[0]?.length ?? 0
  }))
  const trayTotal = computed(() => tray.value.filter((item) => item !== null).length)
  const traySlots = computed(() =>
    tray.value.map((color, index) => ({
      index,
      color
    }))
  )
  const activeVisualColor = computed(() => selectedTrayColor.value ?? activeBoardColor.value)

  const colorStats = computed(() =>
    Object.values(colorMetaMap).map((meta) => {
      let onBoard = 0
      let targets = 0
      let correct = 0
      let empty = 0

      board.value.forEach((row) => {
        row.forEach((cell) => {
          if (!cell) {
            return
          }

          if (cell.baseColor === meta.id) {
            targets += 1
            if (cell.beadColor === meta.id) {
              correct += 1
            }
            if (cell.beadColor === null) {
              empty += 1
            }
          }

          if (cell.beadColor === meta.id) {
            onBoard += 1
          }
        })
      })

      return {
        ...meta,
        onBoard,
        targets,
        correct,
        empty,
        remaining: Math.max(targets - correct, 0),
        tray: tray.value.filter((item) => item === meta.id).length
      }
    })
  )

  const progress = computed(() => {
    const totals = colorStats.value.reduce(
      (accumulator, item) => {
        accumulator.targets += item.targets
        accumulator.correct += item.correct
        return accumulator
      },
      { targets: 0, correct: 0 }
    )

    if (!totals.targets) {
      return 0
    }

    return Math.round((totals.correct / totals.targets) * 100)
  })

  const formatTime = computed(() => {
    const minutes = String(Math.floor(secondsLeft.value / 60)).padStart(2, '0')
    const seconds = String(secondsLeft.value % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  })

  const clearTimer = () => {
    if (timerId !== null) {
      window.clearInterval(timerId)
      timerId = null
    }
  }

  const clearAnimationMarkers = () => {
    enteringBoardKeys.value = []
    leavingBoardKeys.value = []
    enteringTrayIndexes.value = []
    leavingTrayIndexes.value = []
  }

  const guardAnimation = (): boolean => {
    if (!isAnimating.value) {
      return false
    }

    message.value = ANIMATION_BUSY_MESSAGE
    return true
  }

  const markBoardEntering = (row: number, col: number) => {
    enteringBoardKeys.value = appendUnique(enteringBoardKeys.value, createCellKey(row, col))
  }

  const unmarkBoardEntering = (row: number, col: number) => {
    enteringBoardKeys.value = removeValue(enteringBoardKeys.value, createCellKey(row, col))
  }

  const markBoardLeaving = (row: number, col: number) => {
    leavingBoardKeys.value = appendUnique(leavingBoardKeys.value, createCellKey(row, col))
  }

  const unmarkBoardLeaving = (row: number, col: number) => {
    leavingBoardKeys.value = removeValue(leavingBoardKeys.value, createCellKey(row, col))
  }

  const markTrayEntering = (index: number) => {
    enteringTrayIndexes.value = appendUnique(enteringTrayIndexes.value, index)
  }

  const unmarkTrayEntering = (index: number) => {
    enteringTrayIndexes.value = removeValue(enteringTrayIndexes.value, index)
  }

  const markTrayLeaving = (index: number) => {
    leavingTrayIndexes.value = appendUnique(leavingTrayIndexes.value, index)
  }

  const unmarkTrayLeaving = (index: number) => {
    leavingTrayIndexes.value = removeValue(leavingTrayIndexes.value, index)
  }

  const runAnimatedSteps = async (runner: () => Promise<void>) => {
    isAnimating.value = true
    clearAnimationMarkers()

    try {
      await runner()
    } finally {
      clearAnimationMarkers()
      isAnimating.value = false
    }
  }

  const animateBoardToTray = async (color: ColorId, sourceCells: PlacementCell[], targetTrayIndexes: number[]) => {
    await runAnimatedSteps(async () => {
      for (let index = 0; index < sourceCells.length; index += 1) {
        const source = sourceCells[index]
        const trayIndex = targetTrayIndexes[index]
        const sourceCell = board.value[source.row]?.[source.col]

        if (!sourceCell || sourceCell.beadColor !== color) {
          continue
        }

        markBoardLeaving(source.row, source.col)
        await sleep(ANIMATION_PREPARE_MS)

        sourceCell.beadColor = null
        unmarkBoardLeaving(source.row, source.col)

        tray.value[trayIndex] = color
        markTrayEntering(trayIndex)
        await sleep(ANIMATION_STEP_MS)
        unmarkTrayEntering(trayIndex)
      }
    })
  }

  const animateBoardToBoard = async (color: ColorId, sourceCells: PlacementCell[], targetCells: PlacementCell[]) => {
    await runAnimatedSteps(async () => {
      for (let index = 0; index < targetCells.length; index += 1) {
        const source = sourceCells[index]
        const target = targetCells[index]
        const sourceCell = board.value[source.row]?.[source.col]
        const targetCell = board.value[target.row]?.[target.col]

        if (!sourceCell || !targetCell || sourceCell.beadColor !== color || targetCell.beadColor !== null) {
          continue
        }

        markBoardLeaving(source.row, source.col)
        await sleep(ANIMATION_PREPARE_MS)

        sourceCell.beadColor = null
        unmarkBoardLeaving(source.row, source.col)

        targetCell.beadColor = color
        markBoardEntering(target.row, target.col)
        await sleep(ANIMATION_STEP_MS)
        unmarkBoardEntering(target.row, target.col)
      }
    })
  }

  const animateTrayToBoard = async (color: ColorId, sourceTrayIndexes: number[], targetCells: PlacementCell[]) => {
    await runAnimatedSteps(async () => {
      for (let index = 0; index < targetCells.length; index += 1) {
        const trayIndex = sourceTrayIndexes[index]
        const target = targetCells[index]
        const targetCell = board.value[target.row]?.[target.col]

        if (tray.value[trayIndex] !== color || !targetCell || targetCell.beadColor !== null) {
          continue
        }

        markTrayLeaving(trayIndex)
        await sleep(ANIMATION_PREPARE_MS)

        tray.value[trayIndex] = null
        unmarkTrayLeaving(trayIndex)

        targetCell.beadColor = color
        markBoardEntering(target.row, target.col)
        await sleep(ANIMATION_STEP_MS)
        unmarkBoardEntering(target.row, target.col)
      }
    })
  }

  const buildClearSummary = (): ClearSummary => {
    const elapsedSeconds = levels.reduce((total, level) => total + (levelClearTimes.value[level.id] ?? 0), 0)
    const anyCheatUsed = levels.some((level) => !!levelCheatUsage.value[level.id])

    if (anyCheatUsed) {
      return {
        levelId: currentLevel.value.id,
        levelName: '全部通关',
        elapsedSeconds,
        title: '官方外挂体验官',
        tagline: '彩蛋通道已开启，这次通关按内部测试记录结算。',
        cheatUsed: true
      }
    }

    if (elapsedSeconds <= 180) {
      return {
        levelId: currentLevel.value.id,
        levelName: '全部通关',
        elapsedSeconds,
        title: '大魔王',
        tagline: '三分钟内强势清盘，这局已经是碾压节奏。',
        cheatUsed: false
      }
    }

    if (elapsedSeconds <= 300) {
      return {
        levelId: currentLevel.value.id,
        levelName: '全部通关',
        elapsedSeconds,
        title: '拼豆统帅',
        tagline: '节奏又稳又快，整盘归位几乎没有浪费动作。',
        cheatUsed: false
      }
    }

    if (elapsedSeconds <= 480) {
      return {
        levelId: currentLevel.value.id,
        levelName: '全部通关',
        elapsedSeconds,
        title: '归位宗师',
        tagline: '布局判断很扎实，整体推进感已经很成熟了。',
        cheatUsed: false
      }
    }

    if (elapsedSeconds <= 720) {
      return {
        levelId: currentLevel.value.id,
        levelName: '全部通关',
        elapsedSeconds,
        title: '收纳大师',
        tagline: '稳稳推进也很强，属于不冒进但很可靠的通关型选手。',
        cheatUsed: false
      }
    }

    return {
      levelId: currentLevel.value.id,
      levelName: '全部通关',
      elapsedSeconds,
      title: '耐心匠人',
      tagline: '慢工出细活，把每一步都处理得很认真。',
      cheatUsed: false
    }
  }

  const finalizeWin = () => {
    const elapsedSeconds = Math.max(currentLevel.value.timeLimit - secondsLeft.value, 0)

    status.value = 'won'
    clearTimer()

    if (!completedLevelIds.value.includes(currentLevel.value.id)) {
      completedLevelIds.value.push(currentLevel.value.id)
    }

    levelClearTimes.value = {
      ...levelClearTimes.value,
      [currentLevel.value.id]: elapsedSeconds
    }
    levelCheatUsage.value = {
      ...levelCheatUsage.value,
      [currentLevel.value.id]: cheatUsedForCurrentRun
    }

    furthestUnlocked.value = Math.min(levels.length, Math.max(furthestUnlocked.value, levelIndex.value + 2))
    lastClearSummary.value = Object.keys(levelClearTimes.value).length === levels.length ? buildClearSummary() : null
  }

  const startTimer = () => {
    clearTimer()
    timerId = window.setInterval(() => {
      if (status.value !== 'playing' || isAnimating.value) {
        return
      }

      if (secondsLeft.value <= 1) {
        secondsLeft.value = 0
        status.value = 'lost'
        message.value = '时间到啦，重置这一关再重新整理一遍吧。'
        clearTimer()
        return
      }

      secondsLeft.value -= 1
    }, 1000)
  }

  const resetLevel = () => {
    if (guardAnimation()) {
      return
    }

    board.value = createLevelBoard(currentLevel.value)
    tray.value = createTray(currentLevel.value.capacity)
    tools.value = createTools()
    activeBoardColor.value = null
    selectedTrayColor.value = null
    status.value = 'playing'
    secondsLeft.value = currentLevel.value.timeLimit
    history.value = []
    lastClearSummary.value = null
    cheatUsedForCurrentRun = false
    secretKeyBuffer = ''
    clearAnimationMarkers()

    if (levelIndex.value === 0) {
      levelClearTimes.value = {}
      levelCheatUsage.value = {}
    }

    message.value = `第 ${currentLevel.value.badge} 关开始，先从棋盘里挑一种颜色激活。`
    startTimer()
  }

  const loadLevel = (nextIndex: number) => {
    levelIndex.value = nextIndex
    resetLevel()
  }

  const clearSelection = (reason?: 'outside' | 'empty') => {
    if (isAnimating.value) {
      return
    }

    const hadBoardActive = !!activeBoardColor.value
    const hadTraySelected = !!selectedTrayColor.value

    activeBoardColor.value = null
    selectedTrayColor.value = null

    if (!hadBoardActive && !hadTraySelected) {
      return
    }

    if (reason === 'outside') {
      message.value = '已取消当前激活状态，你可以重新选择颜色。'
      return
    }

    if (reason === 'empty') {
      message.value = '已取消当前激活状态。'
      return
    }

    message.value = '已清空当前选择。'
  }

  const selectLevel = (nextIndex: number) => {
    if (guardAnimation()) {
      return
    }

    if (nextIndex + 1 > furthestUnlocked.value) {
      message.value = '先通关前一关，新的拼豆盘才会解锁。'
      return
    }

    loadLevel(nextIndex)
  }

  const activateBoardColor = (color: ColorId) => {
    if (status.value !== 'playing' || guardAnimation()) {
      return
    }

    activeBoardColor.value = color
    selectedTrayColor.value = null
    message.value = `${colorMetaMap[color].name} 已激活，点底色相同的空格可自动补位，也可以先收进收纳槽。`
  }

  const collectActiveColor = async () => {
    if (status.value !== 'playing' || guardAnimation()) {
      return
    }

    if (!activeBoardColor.value) {
      message.value = '还没有激活颜色，先点棋盘里的任意一颗拼豆。'
      return
    }

    const targetColor = activeBoardColor.value
    const looseCells: PlacementCell[] = []

    board.value.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell && cell.beadColor === targetColor) {
          looseCells.push({ row: rowIndex, col: colIndex })
        }
      })
    })

    const freeTrayIndexes = tray.value
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item === null)
      .map((entry) => entry.index)

    const collectCount = Math.min(looseCells.length, freeTrayIndexes.length)

    if (collectCount <= 0) {
      message.value = '收纳槽已经满了，先放回一些拼豆再继续收纳。'
      return
    }

    await animateBoardToTray(targetColor, looseCells.slice(0, collectCount), freeTrayIndexes.slice(0, collectCount))

    selectedTrayColor.value = targetColor
    activeBoardColor.value = null

    const leftOnBoard = looseCells.length - collectCount
    message.value =
      leftOnBoard > 0
        ? `已收纳 ${collectCount} 颗${colorMetaMap[targetColor].name}，还有 ${leftOnBoard} 颗留在棋盘里。`
        : `已收纳 ${collectCount} 颗${colorMetaMap[targetColor].name}，去填空位吧。`
  }

  const selectTrayColor = (slotIndex: number) => {
    if (guardAnimation()) {
      return
    }

    const color = tray.value[slotIndex]
    if (!color) {
      message.value = '这个收纳格里还没有拼豆。'
      return
    }

    selectedTrayColor.value = color
    activeBoardColor.value = null
    message.value = `已选中${colorMetaMap[color].name}，点击棋盘底色区域就会按连通块批量摆放。`
  }

  const placeBead = async (row: number, col: number) => {
    if (status.value !== 'playing' || guardAnimation()) {
      return
    }

    const cell = board.value[row]?.[col]
    if (!cell) {
      clearSelection('empty')
      return
    }

    if (cell.beadColor !== null) {
      if (activeBoardColor.value === cell.beadColor && !selectedTrayColor.value) {
        clearSelection('empty')
        return
      }

      activateBoardColor(cell.beadColor)
      return
    }

    if (activeBoardColor.value && !selectedTrayColor.value) {
      if (cell.baseColor !== activeBoardColor.value) {
        message.value = `当前激活的是${colorMetaMap[activeBoardColor.value].name}，请点击同色底格自动补位。`
        return
      }

      const region = getConnectedRegion(board.value, row, col, activeBoardColor.value)
      const emptyCells = region.filter((position) => {
        const regionCell = board.value[position.row]?.[position.col]
        return regionCell?.beadColor === null
      })

      if (emptyCells.length <= 0) {
        message.value = '这片同色区域已经填满了。'
        return
      }

      const movableCells = getMovableBoardCells(board.value, activeBoardColor.value)
      if (movableCells.length <= 0) {
        message.value = '当前激活颜色已经没有可自动移动的豆子了。'
        return
      }

      const fillCount = Math.min(emptyCells.length, movableCells.length)
      const filledCells = emptyCells.slice(0, fillCount)
      const usedSourceCells = movableCells.slice(0, fillCount)

      await animateBoardToBoard(activeBoardColor.value, usedSourceCells, filledCells)

      history.value.push({
        color: activeBoardColor.value,
        cells: filledCells,
        source: 'board',
        sourceCells: usedSourceCells
      })

      const leftMovable = movableCells.length - fillCount
      if (leftMovable <= 0) {
        activeBoardColor.value = null
      }

      if (boardIsSolved(board.value) && trayTotal.value === 0) {
        finalizeWin()
        message.value = `${currentLevel.value.name} 已完成，继续下一关吧。`
        return
      }

      const leftRegion = emptyCells.length - fillCount
      message.value =
        leftMovable > 0
          ? `自动填入 ${fillCount} 颗，剩下的激活豆子还会继续悬浮。`
          : leftRegion > 0
            ? `自动填入 ${fillCount} 颗，这片区域还有 ${leftRegion} 个空位待补。`
            : `自动填入 ${fillCount} 颗，当前归位进度 ${progress.value}%。`
      return
    }

    if (!selectedTrayColor.value) {
      message.value = '先从收纳槽里选中一种颜色。'
      return
    }

    const region = getConnectedRegion(board.value, row, col, cell.baseColor)
    const emptyCells = region.filter((position) => {
      const regionCell = board.value[position.row]?.[position.col]
      return regionCell?.beadColor === null
    })

    if (emptyCells.length <= 0) {
      message.value = '这片区域已经填满了。'
      return
    }

    const availableTrayIndexes = tray.value
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item === selectedTrayColor.value)
      .map((entry) => entry.index)

    if (availableTrayIndexes.length <= 0) {
      message.value = '这个颜色已经放完了，再去棋盘里回收一批吧。'
      return
    }

    const fillCount = Math.min(availableTrayIndexes.length, emptyCells.length)
    const filledCells = emptyCells.slice(0, fillCount)

    await animateTrayToBoard(selectedTrayColor.value, availableTrayIndexes.slice(0, fillCount), filledCells)

    history.value.push({
      color: selectedTrayColor.value,
      cells: filledCells,
      source: 'tray'
    })

    if (!tray.value.some((item) => item === selectedTrayColor.value)) {
      selectedTrayColor.value = null
    }

    if (boardIsSolved(board.value) && trayTotal.value === 0) {
      finalizeWin()
      message.value = `${currentLevel.value.name} 已完成，继续下一关吧。`
      return
    }

    const leftCells = emptyCells.length - filledCells.length
    message.value =
      leftCells > 0
        ? `已向这片区域填入 ${filledCells.length} 颗，还有 ${leftCells} 个空位待补。`
        : `这片区域已填入 ${filledCells.length} 颗，当前归位进度 ${progress.value}%。`
  }

  const useMagnet = async () => {
    if (tools.value.magnet <= 0 || status.value !== 'playing' || guardAnimation()) {
      message.value = tools.value.magnet <= 0 ? '磁力道具已经用完啦。' : ANIMATION_BUSY_MESSAGE
      return
    }

    if (activeBoardColor.value) {
      tools.value.magnet -= 1
      await collectActiveColor()
      return
    }

    const bestBoardColor = colorStats.value
      .filter((item) => item.onBoard > 0 && item.remaining > 0)
      .sort((left, right) => right.onBoard - left.onBoard)[0]

    if (!bestBoardColor) {
      message.value = '磁力道具会优先帮你锁定棋盘上数量最多的有效颜色。'
      return
    }

    tools.value.magnet -= 1
    activateBoardColor(bestBoardColor.id)
  }

  const useBrush = () => {
    if (guardAnimation()) {
      return
    }

    if (tools.value.brush <= 0 || status.value !== 'playing') {
      message.value = '刷子次数已经没有了。'
      return
    }

    const lastPlacement = history.value.pop()
    if (!lastPlacement) {
      message.value = '当前还没有可撤回的摆放。'
      return
    }

    lastPlacement.cells.forEach((position) => {
      const targetCell = board.value[position.row]?.[position.col]
      if (targetCell && targetCell.beadColor === lastPlacement.color) {
        targetCell.beadColor = null
      }
    })

    if (lastPlacement.source === 'tray') {
      lastPlacement.cells.forEach(() => {
        const freeIndex = tray.value.findIndex((item) => item === null)
        if (freeIndex >= 0) {
          tray.value[freeIndex] = lastPlacement.color
        }
      })
    } else {
      lastPlacement.sourceCells?.forEach((position) => {
        const sourceCell = board.value[position.row]?.[position.col]
        if (sourceCell && sourceCell.beadColor === null) {
          sourceCell.beadColor = lastPlacement.color
        }
      })
      activeBoardColor.value = lastPlacement.color
    }

    tools.value.brush -= 1

    if (lastPlacement.source === 'tray') {
      selectedTrayColor.value = lastPlacement.color
      activeBoardColor.value = null
    } else {
      selectedTrayColor.value = null
    }

    message.value = `刷子帮你撤回了 ${lastPlacement.cells.length} 颗${colorMetaMap[lastPlacement.color].name} 拼豆。`
  }

  const useHourglass = () => {
    if (guardAnimation()) {
      return
    }

    if (tools.value.hourglass <= 0 || status.value !== 'playing') {
      message.value = '沙漏已经用完啦。'
      return
    }

    tools.value.hourglass -= 1
    secondsLeft.value += 30
    message.value = '沙漏生效，额外增加 30 秒。'
  }

  const goToNextLevel = () => {
    if (guardAnimation()) {
      return
    }

    if (levelIndex.value >= levels.length - 1) {
      message.value = '已经是最后一关了，这版原型你已经全通。'
      return
    }

    if (levelIndex.value + 2 > furthestUnlocked.value) {
      message.value = '需要先完成当前关卡，才能继续前进。'
      return
    }

    loadLevel(levelIndex.value + 1)
  }

  const forceWin = () => {
    if (status.value !== 'playing' || guardAnimation()) {
      return
    }

    board.value.forEach((row) => {
      row.forEach((cell) => {
        if (!cell) {
          return
        }

        cell.beadColor = cell.baseColor
      })
    })

    tray.value = createTray(currentLevel.value.capacity)
    activeBoardColor.value = null
    selectedTrayColor.value = null
    history.value = []
    cheatUsedForCurrentRun = true
    finalizeWin()
    message.value = '官方秘籍已生效，本关直接结算通关。'
  }

  const handleDocumentPointerDown = (event: PointerEvent) => {
    if (isAnimating.value) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const keepSelection = target.closest('.board-cell, .tray-panel, .tray-slot, .collect-button, .soft-button, .level-chip')

    if (!keepSelection) {
      clearSelection('outside')
    }
  }

  const handleSecretKeydown = (event: KeyboardEvent) => {
    if (status.value !== 'playing') {
      return
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    secretKeyBuffer = `${secretKeyBuffer}${event.key.toLowerCase()}`.slice(-SECRET_WIN_CODE.length)

    if (secretKeyBuffer === SECRET_WIN_CODE) {
      secretKeyBuffer = ''
      forceWin()
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    window.addEventListener('keydown', handleSecretKeydown)
  })

  onBeforeUnmount(() => {
    clearTimer()
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    window.removeEventListener('keydown', handleSecretKeydown)
  })

  loadLevel(0)

  return {
    activeBoardColor,
    activeVisualColor,
    board,
    boardSize,
    clearSelection,
    colorMetaMap,
    colorStats,
    collectActiveColor,
    completedLevelIds,
    currentLevel,
    enteringBoardKeys,
    enteringTrayIndexes,
    formatTime,
    furthestUnlocked,
    goToNextLevel,
    isAnimating,
    lastClearSummary,
    leavingBoardKeys,
    leavingTrayIndexes,
    levelIndex,
    levels,
    message,
    placeBead,
    progress,
    resetLevel,
    selectLevel,
    selectTrayColor,
    selectedTrayColor,
    status,
    tools,
    tray,
    traySlots,
    trayTotal,
    useBrush,
    useHourglass,
    useMagnet
  }
}
