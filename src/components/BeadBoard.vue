<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { BoardCell, ColorId } from '../game/types'

const props = defineProps<{
  cells: (BoardCell | null)[][]
  columns: number
  activeBoardColor: ColorId | null
  selectedTrayColor: ColorId | null
  boardAccent: string | null
  enteringBoardKeys: string[]
  leavingBoardKeys: string[]
  interactionLocked: boolean
}>()

const emit = defineEmits<{
  (event: 'cell-click', row: number, col: number): void
  (event: 'clear-selection'): void
}>()

const boardShellRef = ref<HTMLElement | null>(null)
const boardGridRef = ref<HTMLElement | null>(null)
const boardGridWidth = ref(0)
const boardGridHeight = ref(0)

let resizeObserver: ResizeObserver | null = null
let layoutFrame: number | null = null

const cellKey = (row: number, col: number) => `${row}:${col}`

const handleDragStart = (event: DragEvent, cell: BoardCell | null) => {
  if (!cell?.beadColor) {
    event.preventDefault()
    return
  }

  event.dataTransfer?.setData('application/x-pingdou-active-color', cell.beadColor)
  event.dataTransfer?.setData('text/plain', cell.beadColor)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const syncBoardSize = () => {
  const shell = boardShellRef.value
  const grid = boardGridRef.value
  if (!shell || !grid) {
    return
  }

  const rows = props.cells.length
  const columns = props.columns
  if (!rows || !columns) {
    return
  }

  const shellStyle = window.getComputedStyle(shell)
  const gridStyle = window.getComputedStyle(grid)
  const shellPaddingX = parseFloat(shellStyle.paddingLeft) + parseFloat(shellStyle.paddingRight)
  const shellPaddingY = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom)
  const availableWidth = Math.max(shell.clientWidth - shellPaddingX, 0)
  const availableHeight = Math.max(shell.clientHeight - shellPaddingY, 0)
  const gap = parseFloat(gridStyle.getPropertyValue('--board-gap')) || parseFloat(gridStyle.gap) || 0

  if (!availableWidth || !availableHeight) {
    return
  }

  const isMobileLikeViewport = window.matchMedia('(max-width: 1120px)').matches
  const cellWidth = (availableWidth - gap * (columns - 1)) / columns
  if (isMobileLikeViewport) {
    const mobileCellSize = Math.max(cellWidth, 0)
    boardGridWidth.value = mobileCellSize * columns + gap * (columns - 1)
    boardGridHeight.value = 0
    return
  }

  const cellHeight = (availableHeight - gap * (rows - 1)) / rows
  const cellSize = Math.max(Math.min(cellWidth, cellHeight), 0)

  boardGridWidth.value = cellSize * columns + gap * (columns - 1)
  boardGridHeight.value = cellSize * rows + gap * (rows - 1)
}

const scheduleBoardSizeSync = () => {
  if (layoutFrame !== null) {
    window.cancelAnimationFrame(layoutFrame)
  }

  layoutFrame = window.requestAnimationFrame(() => {
    layoutFrame = null
    syncBoardSize()
  })
}

onMounted(async () => {
  await nextTick()
  scheduleBoardSizeSync()

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      scheduleBoardSizeSync()
    })

    if (boardShellRef.value) {
      resizeObserver.observe(boardShellRef.value)
    }
  } else {
    window.addEventListener('resize', scheduleBoardSizeSync)
  }
})

watch(
  () => [props.columns, props.cells.length, props.cells[0]?.length ?? 0],
  async () => {
    await nextTick()
    scheduleBoardSizeSync()
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  if (layoutFrame !== null) {
    window.cancelAnimationFrame(layoutFrame)
  }

  resizeObserver?.disconnect()
  window.removeEventListener('resize', scheduleBoardSizeSync)
})
</script>

<template>
  <div
    ref="boardShellRef"
    class="board-shell"
    data-tutorial-id="board-area"
    :style="{ '--board-accent': boardAccent ?? 'rgba(176, 164, 221, 0.55)' }"
    @click.self="emit('clear-selection')"
  >
    <div
      ref="boardGridRef"
      class="board-grid"
      :style="{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        width: boardGridWidth ? `${boardGridWidth}px` : undefined,
        height: boardGridHeight ? `${boardGridHeight}px` : undefined
      }"
    >
      <template v-for="(row, rowIndex) in cells" :key="`row-${rowIndex}`">
        <template v-for="(cell, cellIndex) in row" :key="`cell-${rowIndex}-${cellIndex}`">
          <button
            v-if="!cell"
            class="board-gap"
            type="button"
            aria-label="取消激活状态"
            :disabled="interactionLocked"
            @click="emit('clear-selection')"
          ></button>

          <button
            v-else
            class="board-cell"
            :class="[
              `base--${cell.baseColor}`,
              {
                'has-bead': !!cell.beadColor,
                'is-active': !!cell.beadColor && activeBoardColor === cell.beadColor,
                'is-draggable': !!cell.beadColor && activeBoardColor === cell.beadColor,
                'is-drop-target': !cell.beadColor && !!selectedTrayColor,
                'is-correct': !!cell.beadColor && cell.beadColor === cell.baseColor,
                'is-misplaced': !!cell.beadColor && cell.beadColor !== cell.baseColor,
                'is-entering': enteringBoardKeys.includes(cellKey(rowIndex, cellIndex)),
                'is-leaving': leavingBoardKeys.includes(cellKey(rowIndex, cellIndex))
              }
            ]"
            type="button"
            :data-tutorial-id="`board-cell-${rowIndex}-${cellIndex}`"
            :disabled="interactionLocked"
            :draggable="!!cell.beadColor && activeBoardColor === cell.beadColor"
            @click="emit('cell-click', rowIndex, cellIndex)"
            @dragstart="handleDragStart($event, cell)"
          >
            <span v-if="cell.beadColor" class="board-cell__bead" :class="[`bead--${cell.beadColor}`]">
              <span class="bead__shine"></span>
            </span>
            <span v-else class="board-cell__socket"></span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>
