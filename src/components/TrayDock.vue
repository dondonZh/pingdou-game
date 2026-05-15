<script setup lang="ts">
import { ref } from 'vue'
import type { ColorMeta, ColorId } from '../game/types'

const props = defineProps<{
  capacity: number
  trayTotal: number
  traySlots: Array<{ index: number; color: ColorId | null }>
  selectedTrayColor: ColorId | null
  activeBoardColor: ColorId | null
  palette: Record<ColorId, ColorMeta>
  enteringTrayIndexes: number[]
  leavingTrayIndexes: number[]
  interactionLocked: boolean
}>()

const emit = defineEmits<{
  (event: 'select-color', slotIndex: number): void
  (event: 'collect'): void
}>()

const isDragCollectHover = ref(false)

const handleSlotClick = (slotIndex: number) => {
  if (props.interactionLocked) {
    return
  }

  if (props.activeBoardColor) {
    emit('collect')
    return
  }

  emit('select-color', slotIndex)
}

const isCollectDrag = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('application/x-pingdou-active-color')

const handleTrayDragOver = (event: DragEvent) => {
  if (props.interactionLocked || !isCollectDrag(event)) {
    return
  }

  event.preventDefault()
  isDragCollectHover.value = true

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleTrayDragLeave = (event: DragEvent) => {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
    return
  }

  isDragCollectHover.value = false
}

const handleTrayDrop = (event: DragEvent) => {
  if (props.interactionLocked || !isCollectDrag(event)) {
    return
  }

  event.preventDefault()
  isDragCollectHover.value = false
  emit('collect')
}

const resetDragHover = () => {
  isDragCollectHover.value = false
}
</script>

<template>
  <section
    class="tray-panel"
    :class="{
      'is-collect-ready': !!activeBoardColor,
      'is-collect-hover': isDragCollectHover
    }"
    @dragover="handleTrayDragOver"
    @dragleave="handleTrayDragLeave"
    @drop="handleTrayDrop"
    @dragend="resetDragHover"
  >
    <div class="tray-topline">
      <div class="tray-capacity">
        <span>收纳槽</span>
        <strong>{{ trayTotal }}/{{ capacity }}</strong>
      </div>

      <button class="collect-button" type="button" :disabled="interactionLocked" @click="emit('collect')">
        <span class="collect-dot" :class="{ 'is-ready': !!activeBoardColor }"></span>
        收纳激活颜色
      </button>
    </div>

    <div class="tray-slots">
      <button
        v-for="slot in traySlots"
        :key="slot.index"
        class="tray-slot"
        :class="[
          slot.color ? `tray-slot--${slot.color}` : '',
          {
            'is-empty': !slot.color,
            'is-selected': !!slot.color && selectedTrayColor === slot.color,
            'is-active': !!slot.color && (selectedTrayColor === slot.color || activeBoardColor === slot.color),
            'is-entering': enteringTrayIndexes.includes(slot.index),
            'is-leaving': leavingTrayIndexes.includes(slot.index)
          }
        ]"
        type="button"
        :disabled="interactionLocked"
        @click="handleSlotClick(slot.index)"
      >
        <span v-if="slot.color" class="tray-slot__bead" :class="`bead--${slot.color}`">
          <span class="bead__shine"></span>
        </span>
        <span v-else class="tray-slot__ghost"></span>
      </button>
    </div>
  </section>
</template>
