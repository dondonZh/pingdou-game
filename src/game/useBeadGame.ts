import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { colorMetaMap, createLevelBoard, levels } from './levels'
import type { BoardMatrix, ColorId, PlacementCell, PlacementRecord, ToolState } from './types'

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
  const history = ref<PlacementRecord[]>([])
  let timerId: number | null = null

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

  const startTimer = () => {
    clearTimer()
    timerId = window.setInterval(() => {
      if (status.value !== 'playing') {
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
    board.value = createLevelBoard(currentLevel.value)
    tray.value = createTray(currentLevel.value.capacity)
    tools.value = createTools()
    activeBoardColor.value = null
    selectedTrayColor.value = null
    status.value = 'playing'
    secondsLeft.value = currentLevel.value.timeLimit
    history.value = []
    message.value = `第 ${currentLevel.value.badge} 关开始，先从棋盘里挑一种颜色激活。`
    startTimer()
  }

  const loadLevel = (nextIndex: number) => {
    levelIndex.value = nextIndex
    resetLevel()
  }

  const clearSelection = (reason?: 'outside' | 'empty') => {
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
    if (nextIndex + 1 > furthestUnlocked.value) {
      message.value = '先通关前一关，新的拼豆盘才会解锁。'
      return
    }

    loadLevel(nextIndex)
  }

  const activateBoardColor = (color: ColorId) => {
    if (status.value !== 'playing') {
      return
    }

    activeBoardColor.value = color
    selectedTrayColor.value = null
    message.value = `${colorMetaMap[color].name} 已悬浮激活，点击“收纳激活颜色”把它们收入收纳槽。`
  }

  const collectActiveColor = () => {
    if (status.value !== 'playing') {
      return
    }

    if (!activeBoardColor.value) {
      message.value = '还没有激活颜色，先点棋盘里任意一颗拼豆。'
      return
    }

    const targetColor = activeBoardColor.value
    const looseCells: Array<{ row: number; col: number }> = []

    board.value.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell && cell.beadColor === targetColor) {
          looseCells.push({ row: rowIndex, col: colIndex })
        }
      })
    })

    const freeSlots = currentLevel.value.capacity - trayTotal.value
    const collectCount = Math.min(looseCells.length, freeSlots)

    if (collectCount <= 0) {
      message.value = '收纳槽已经满了，先放回一些拼豆再继续收纳。'
      return
    }

    looseCells.slice(0, collectCount).forEach(({ row, col }) => {
      const cell = board.value[row]?.[col]
      if (cell) {
        cell.beadColor = null
      }
    })

    let inserted = 0
    for (let index = 0; index < tray.value.length; index += 1) {
      if (tray.value[index] === null) {
        tray.value[index] = targetColor
        inserted += 1
      }

      if (inserted >= collectCount) {
        break
      }
    }

    selectedTrayColor.value = targetColor
    activeBoardColor.value = null

    const leftOnBoard = looseCells.length - collectCount
    message.value =
      leftOnBoard > 0
        ? `已收纳 ${collectCount} 颗${colorMetaMap[targetColor].name}，还有 ${leftOnBoard} 颗留在棋盘里。`
        : `已收纳 ${collectCount} 颗${colorMetaMap[targetColor].name}，去填同色空位吧。`
  }

  const selectTrayColor = (slotIndex: number) => {
    const color = tray.value[slotIndex]
    if (!color) {
      message.value = '这个收纳格里还没有拼豆。'
      return
    }

    selectedTrayColor.value = color
    activeBoardColor.value = null
    message.value = `已选中${colorMetaMap[color].name}，点击棋盘里同色底格的空位进行摆放。`
  }

  const placeBead = (row: number, col: number) => {
    if (status.value !== 'playing') {
      return
    }

    const cell = board.value[row]?.[col]
    if (!cell) {
      clearSelection('empty')
      return
    }

    if (cell.beadColor !== null) {
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

      usedSourceCells.forEach((position) => {
        const sourceCell = board.value[position.row]?.[position.col]
        if (sourceCell) {
          sourceCell.beadColor = null
        }
      })

      filledCells.forEach((position) => {
        const targetCell = board.value[position.row]?.[position.col]
        if (targetCell) {
          targetCell.beadColor = activeBoardColor.value
        }
      })

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
        status.value = 'won'
        clearTimer()
        if (!completedLevelIds.value.includes(currentLevel.value.id)) {
          completedLevelIds.value.push(currentLevel.value.id)
        }

        furthestUnlocked.value = Math.min(levels.length, Math.max(furthestUnlocked.value, levelIndex.value + 2))
        message.value = `${currentLevel.value.name} 已完成，继续下一关吧。`
        return
      }

      const leftRegion = emptyCells.length - fillCount
      message.value =
        leftMovable > 0
          ? `自动填入 ${fillCount} 颗，还有 ${leftMovable} 颗保持激活状态。`
          : leftRegion > 0
            ? `自动填入 ${fillCount} 颗，这片区域还有 ${leftRegion} 个空位待补。`
            : `自动填入 ${fillCount} 颗，当前归位进度 ${progress.value}%。`
      return
    }

    if (!selectedTrayColor.value) {
      if (activeBoardColor.value) {
        clearSelection('empty')
        return
      }

      message.value = '先从收纳槽里选中一种颜色。'
      return
    }

    const trayIndex = tray.value.findIndex((item) => item === selectedTrayColor.value)
    if (trayIndex < 0) {
      message.value = '这个颜色已经放完了，再去棋盘里回收一批吧。'
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

    const fillCount = Math.min(availableTrayIndexes.length, emptyCells.length)
    const filledCells: PlacementCell[] = []

    for (let index = 0; index < fillCount; index += 1) {
      const position = emptyCells[index]
      const regionCell = board.value[position.row]?.[position.col]
      const currentTrayIndex = availableTrayIndexes[index]

      if (!regionCell) {
        continue
      }

      regionCell.beadColor = selectedTrayColor.value
      tray.value[currentTrayIndex] = null
      filledCells.push(position)
    }

    history.value.push({
      color: selectedTrayColor.value,
      cells: filledCells,
      source: 'tray'
    })

    if (!tray.value.some((item) => item === selectedTrayColor.value)) {
      selectedTrayColor.value = null
    }

    if (boardIsSolved(board.value) && trayTotal.value === 0) {
      status.value = 'won'
      clearTimer()
      if (!completedLevelIds.value.includes(currentLevel.value.id)) {
        completedLevelIds.value.push(currentLevel.value.id)
      }

      furthestUnlocked.value = Math.min(levels.length, Math.max(furthestUnlocked.value, levelIndex.value + 2))
      message.value = `${currentLevel.value.name} 已完成，继续下一关吧。`
      return
    }

    const leftCells = emptyCells.length - filledCells.length
    message.value =
      leftCells > 0
        ? `已向这片区域填入 ${filledCells.length} 颗，还有 ${leftCells} 个空位待补。`
        : `这片区域已填入 ${filledCells.length} 颗，当前归位进度 ${progress.value}%。`
  }

  const useMagnet = () => {
    if (tools.value.magnet <= 0 || status.value !== 'playing') {
      message.value = '磁力道具已经用完啦。'
      return
    }

    if (activeBoardColor.value) {
      tools.value.magnet -= 1
      collectActiveColor()
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
    message.value = `刷子帮你撤回了 ${lastPlacement.cells.length} 颗${colorMetaMap[lastPlacement.color].name}拼豆。`
  }

  const useHourglass = () => {
    if (tools.value.hourglass <= 0 || status.value !== 'playing') {
      message.value = '沙漏已经用完啦。'
      return
    }

    tools.value.hourglass -= 1
    secondsLeft.value += 30
    message.value = '沙漏生效，额外增加 30 秒。'
  }

  const goToNextLevel = () => {
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

  const handleDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const keepSelection = target.closest(
      '.board-cell, .tray-slot, .collect-button, .tool-button, .soft-button, .level-chip'
    )

    if (!keepSelection) {
      clearSelection('outside')
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
  })

  onBeforeUnmount(() => {
    clearTimer()
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
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
    formatTime,
    furthestUnlocked,
    goToNextLevel,
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
