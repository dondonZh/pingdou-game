<script setup lang="ts">
import type { BoardCell, ColorId } from '../game/types'

defineProps<{
  cells: (BoardCell | null)[][]
  columns: number
  activeBoardColor: ColorId | null
  selectedTrayColor: ColorId | null
  boardAccent: string | null
}>()

const emit = defineEmits<{
  (event: 'cell-click', row: number, col: number): void
  (event: 'clear-selection'): void
}>()

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
</script>

<template>
  <div
    class="board-shell"
    :style="{ '--board-accent': boardAccent ?? 'rgba(176, 164, 221, 0.55)' }"
    @click.self="emit('clear-selection')"
  >
    <div class="board-grid" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <template v-for="(row, rowIndex) in cells" :key="`row-${rowIndex}`">
        <template v-for="(cell, cellIndex) in row" :key="`cell-${rowIndex}-${cellIndex}`">
          <button
            v-if="!cell"
            class="board-gap"
            type="button"
            aria-label="取消激活状态"
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
                'is-misplaced': !!cell.beadColor && cell.beadColor !== cell.baseColor
              }
            ]"
            type="button"
            :draggable="!!cell.beadColor && activeBoardColor === cell.beadColor"
            @click="emit('cell-click', rowIndex, cellIndex)"
            @dragstart="handleDragStart($event, cell)"
          >
            <span
              v-if="cell.beadColor"
              class="board-cell__bead"
              :class="[`bead--${cell.beadColor}`]"
            >
              <span class="bead__shine"></span>
            </span>
            <span v-else class="board-cell__socket"></span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>
