<script setup lang="ts">
import { ref } from 'vue'
import type { ColorMeta, ColorId, ToolState } from '../game/types'

const props = defineProps<{
  capacity: number
  trayTotal: number
  traySlots: Array<{ index: number; color: ColorId | null }>
  selectedTrayColor: ColorId | null
  activeBoardColor: ColorId | null
  tools: ToolState
  palette: Record<ColorId, ColorMeta>
}>()

const emit = defineEmits<{
  (event: 'select-color', slotIndex: number): void
  (event: 'collect'): void
  (event: 'tool-magnet'): void
  (event: 'tool-brush'): void
  (event: 'tool-hourglass'): void
}>()

const isDragCollectHover = ref(false)

const handleSlotClick = (slotIndex: number) => {
  if (props.activeBoardColor) {
    emit('collect')
    return
  }

  emit('select-color', slotIndex)
}

const isCollectDrag = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('application/x-pingdou-active-color')

const handleTrayDragOver = (event: DragEvent) => {
  if (!isCollectDrag(event)) {
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
  if (!isCollectDrag(event)) {
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

      <button class="collect-button" type="button" @click="emit('collect')">
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
          { 'is-empty': !slot.color, 'is-selected': !!slot.color && selectedTrayColor === slot.color }
        ]"
        type="button"
        @click="handleSlotClick(slot.index)"
      >
        <span v-if="slot.color" class="tray-slot__bead" :class="`bead--${slot.color}`">
          <span class="bead__shine"></span>
        </span>
        <span v-else class="tray-slot__ghost"></span>
      </button>
    </div>

    <div class="tool-row">
      <button class="tool-button" type="button" @click="emit('tool-magnet')">
        <span class="tool-button__badge">磁</span>
        <span>自动激活</span>
        <strong>x{{ tools.magnet }}</strong>
      </button>

      <button class="tool-button" type="button" @click="emit('tool-brush')">
        <span class="tool-button__badge">刷</span>
        <span>回退一步</span>
        <strong>x{{ tools.brush }}</strong>
      </button>

      <button class="tool-button" type="button" @click="emit('tool-hourglass')">
        <span class="tool-button__badge">时</span>
        <span>加时沙漏</span>
        <strong>x{{ tools.hourglass }}</strong>
      </button>
    </div>
  </section>
</template>
