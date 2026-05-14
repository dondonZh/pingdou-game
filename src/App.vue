<script setup lang="ts">
import { computed } from 'vue'
import BeadBoard from './components/BeadBoard.vue'
import TrayDock from './components/TrayDock.vue'
import { useBeadGame } from './game/useBeadGame'

const game = useBeadGame()
const currentLevel = game.currentLevel
const board = game.board
const boardSize = game.boardSize
const activeBoardColor = game.activeBoardColor
const selectedTrayColor = game.selectedTrayColor
const traySlots = game.traySlots
const trayTotal = game.trayTotal
const tools = game.tools
const status = game.status
const progress = game.progress
const formatTime = game.formatTime
const message = game.message
const levelIndex = game.levelIndex
const furthestUnlocked = game.furthestUnlocked
const targetStats = computed(() => game.colorStats.value.filter((entry) => entry.targets > 0))
const boardAccent = computed(() => {
  const active = game.activeVisualColor.value
  return active ? game.colorMetaMap[active].accent : null
})
const isCompleted = (levelId: number) => game.completedLevelIds.value.includes(levelId)
</script>

<template>
  <div class="page-shell">
    <div class="page-glow page-glow--one"></div>
    <div class="page-glow page-glow--two"></div>

    <header class="hero">
      <div class="hero-copy">
        <span class="hero-copy__eyebrow">Perler Puzzle Draft</span>
        <h1>拼豆冒险屋</h1>
        <p>棋盘内随机散落拼豆，点击场内豆子即可整色激活；同色空底格可直接自动补位，收纳后也能批量回填。</p>
      </div>

      <div class="hero-hud">
        <div class="timer-pill">
          <span class="timer-pill__coin"></span>
          <strong>{{ formatTime }}</strong>
        </div>

        <div class="progress-card">
          <span>归位进度</span>
          <strong>{{ progress }}%</strong>
        </div>
      </div>
    </header>

    <section class="level-strip">
      <button
        v-for="(level, index) in game.levels"
        :key="level.id"
        class="level-chip"
        :class="{
          'is-current': levelIndex === index,
          'is-locked': index + 1 > furthestUnlocked,
          'is-done': isCompleted(level.id)
        }"
        type="button"
        @click="game.selectLevel(index)"
      >
        <span>第{{ level.badge }}关</span>
        <strong>{{ level.name }}</strong>
      </button>
    </section>

    <main class="play-layout">
      <aside class="side-card">
        <div class="side-card__header">
          <span>关卡目标</span>
          <strong>{{ currentLevel.name }}</strong>
        </div>

        <p class="side-card__story">{{ currentLevel.story }}</p>

        <div class="objective-list">
          <div v-for="item in targetStats" :key="item.id" class="objective-item">
            <span class="objective-item__badge" :class="item.beadClass"></span>
            <div>
              <strong>{{ item.name }}</strong>
              <p>已归位 {{ item.correct }} / {{ item.targets }}</p>
            </div>
          </div>
        </div>

        <div class="hint-card">
          <span>通关提示</span>
          <p>{{ currentLevel.hint }}</p>
        </div>
      </aside>

      <section class="playfield-card">
        <div class="playfield-card__top">
          <div>
            <span class="playfield-card__label">当前状态</span>
            <strong v-if="status === 'playing'">闯关中</strong>
            <strong v-else-if="status === 'won'">过关成功</strong>
            <strong v-else>时间用尽</strong>
          </div>

          <div class="action-row">
            <button class="soft-button" type="button" @click="game.resetLevel">重置本关</button>
            <button class="soft-button soft-button--primary" type="button" @click="game.goToNextLevel">下一关</button>
          </div>
        </div>

        <BeadBoard
          :cells="board"
          :columns="boardSize.columns"
          :active-board-color="activeBoardColor"
          :selected-tray-color="selectedTrayColor"
          :board-accent="boardAccent"
          @cell-click="game.placeBead"
          @clear-selection="game.clearSelection('empty')"
        />

        <p class="message-bubble">{{ message }}</p>
      </section>

      <aside class="side-card side-card--compact">
        <div class="side-card__header">
          <span>颜色速览</span>
          <strong>策略面板</strong>
        </div>

        <div class="inventory-grid">
          <div v-for="item in targetStats" :key="item.id" class="inventory-item">
            <span class="inventory-item__dot" :class="item.beadClass"></span>
            <div>
              <strong>{{ item.name }}</strong>
              <p>场上 {{ item.onBoard }} · 空位 {{ item.empty }} · 槽内 {{ item.tray }}</p>
            </div>
          </div>
        </div>

        <div class="rules-snippet">
          <span>玩法节奏</span>
          <ol>
            <li>点棋盘内任意豆子，整场同色一起悬浮。</li>
            <li>激活后点击同色空底格，会从场上自动补进去，剩下的继续保持激活。</li>
            <li>收纳槽只有 16 格，装不下的豆子会继续留在棋盘里。</li>
            <li>点底部任意已收纳的豆子，再点任意底块区域批量补位。</li>
            <li>所有底色格都归位正确颜色即可过关。</li>
          </ol>
        </div>
      </aside>
    </main>

    <TrayDock
      :capacity="currentLevel.capacity"
      :tray-total="trayTotal"
      :tray-slots="traySlots"
      :selected-tray-color="selectedTrayColor"
      :active-board-color="activeBoardColor"
      :tools="tools"
      :palette="game.colorMetaMap"
      @collect="game.collectActiveColor"
      @select-color="game.selectTrayColor"
      @tool-magnet="game.useMagnet"
      @tool-brush="game.useBrush"
      @tool-hourglass="game.useHourglass"
    />

    <section class="rules-section">
      <article class="rule-card">
        <span>核心玩法</span>
        <h2>棋盘内选色激活</h2>
        <p>直接点击棋盘内部的散落拼豆，整场同色一起浮起高亮；再点同色空底格会自动批量补位。</p>
      </article>

      <article class="rule-card">
        <span>收纳规则</span>
        <h2>16 格单排收纳槽</h2>
        <p>收纳槽不再按颜色分组，只按格子容量存放，收不下的同色豆子会继续留在棋盘上。</p>
      </article>

      <article class="rule-card">
        <span>补位方式</span>
        <h2>点击区域尽可能填入</h2>
        <p>不再是一格一格补豆，点击任意底块连通区域后，会按你当前槽内数量尽可能批量填满空位。</p>
      </article>
    </section>
  </div>
</template>
