<script setup lang="ts">
import type { ColorMeta, ColorId, ToolState } from '../game/types'

defineProps<{
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
</script>

<template>
  <section class="tray-panel">
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
        @click="emit('select-color', slot.index)"
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
