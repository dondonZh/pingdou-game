<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import supportQrCode from './assets/support-qr-code.png'
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
const status = game.status
const progress = game.progress
const formatTime = game.formatTime
const levelIndex = game.levelIndex
const furthestUnlocked = game.furthestUnlocked
const clearSummary = game.lastClearSummary
const isAnimating = game.isAnimating
const enteringBoardKeys = game.enteringBoardKeys
const leavingBoardKeys = game.leavingBoardKeys
const enteringTrayIndexes = game.enteringTrayIndexes
const leavingTrayIndexes = game.leavingTrayIndexes

const isSupportModalOpen = ref(false)
const isResultModalOpen = ref(false)
const shareCopyStatus = ref('')

let autoAdvanceTimer: number | null = null

const targetStats = computed(() => game.colorStats.value.filter((entry) => entry.targets > 0))
const boardAccent = computed(() => {
  const active = game.activeVisualColor.value
  return active ? game.colorMetaMap[active].accent : null
})

const isCompleted = (levelId: number) => game.completedLevelIds.value.includes(levelId)

const formatElapsed = (seconds: number) => {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

const openSupportModal = () => {
  isSupportModalOpen.value = true
}

const closeSupportModal = () => {
  isSupportModalOpen.value = false
}

const closeResultModal = () => {
  isResultModalOpen.value = false
  shareCopyStatus.value = ''
}

const clearAutoAdvanceTimer = () => {
  if (autoAdvanceTimer !== null) {
    window.clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = null
  }
}

const goNextFromResult = () => {
  closeResultModal()
  game.goToNextLevel()
}

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return
  }

  if (isSupportModalOpen.value) {
    closeSupportModal()
    return
  }

  if (isResultModalOpen.value) {
    closeResultModal()
  }
}

const createRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

const drawWrappedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
) => {
  const words = text.split('')
  let line = ''
  let y = startY

  words.forEach((word) => {
    const testLine = `${line}${word}`
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y)
      line = word
      y += lineHeight
      return
    }

    line = testLine
  })

  if (line) {
    context.fillText(line, x, y)
    y += lineHeight
  }

  return y
}

const renderShareCanvas = () => {
  if (!clearSummary.value) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1440
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  const summary = clearSummary.value

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#efe2d1')
  gradient.addColorStop(1, '#dcc5ae')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.globalAlpha = 0.6
  context.fillStyle = '#fff6ed'
  context.beginPath()
  context.arc(180, 170, 140, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.arc(910, 1160, 170, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1

  createRoundedRect(context, 100, 86, 262, 54, 27)
  context.fillStyle = 'rgba(255,255,255,0.74)'
  context.fill()
  context.fillStyle = '#9b77d8'
  context.font = '700 24px Trebuchet MS'
  context.fillText('PERLER PUZZLE DRAFT', 130, 121)

  context.fillStyle = '#7f6fb6'
  context.font = '700 88px Microsoft YaHei'
  context.fillText('拼豆大闯关', 106, 238)

  context.fillStyle = '#8d82b4'
  context.font = '30px Microsoft YaHei'
  context.fillText('全部关卡通关结算', 110, 288)

  createRoundedRect(context, 96, 340, 888, 860, 42)
  context.fillStyle = 'rgba(255, 252, 247, 0.96)'
  context.fill()
  context.strokeStyle = 'rgba(198, 179, 228, 0.7)'
  context.lineWidth = 2
  context.stroke()

  context.fillStyle = '#a08fd0'
  context.font = '700 28px Trebuchet MS'
  context.fillText('STAGE CLEAR', 138, 408)

  context.fillStyle = '#755fba'
  context.font = '700 58px Microsoft YaHei'
  context.fillText(summary.levelName, 138, 490)

  context.fillStyle = '#8e82b4'
  context.font = '32px Microsoft YaHei'
  context.fillText(`全部通关总用时 ${formatElapsed(summary.elapsedSeconds)}`, 138, 548)

  createRoundedRect(context, 138, 612, 804, 242, 34)
  context.fillStyle = 'rgba(247, 239, 255, 0.96)'
  context.fill()

  context.fillStyle = '#a08fd0'
  context.font = '700 24px Microsoft YaHei'
  context.fillText('获得称号', 178, 678)

  context.fillStyle = '#6c56b4'
  context.font = '700 82px Microsoft YaHei'
  context.fillText(summary.title, 178, 778)

  context.fillStyle = '#736688'
  context.font = '30px Microsoft YaHei'
  drawWrappedText(context, summary.tagline, 178, 914, 724, 46)

  if (summary.cheatUsed) {
    createRoundedRect(context, 138, 1004, 286, 62, 31)
    context.fillStyle = 'rgba(255, 228, 196, 0.88)'
    context.fill()
    context.fillStyle = '#bb7245'
    context.font = '700 24px Microsoft YaHei'
    context.fillText('官方外挂已启用', 186, 1045)
  }

  context.fillStyle = '#8d82b4'
  context.font = '26px Microsoft YaHei'
  context.fillText('秘籍 perlerwin 可直接通关当前关卡', 138, 1128)

  context.fillStyle = '#c5b39f'
  context.font = '24px Microsoft YaHei'
  context.fillText('分享这张结算图，晒出你的拼豆称号', 138, 1176)

  return canvas
}

const copyResultShare = async () => {
  if (!clearSummary.value) {
    return
  }

  shareCopyStatus.value = ''

  const canvas = renderShareCanvas()
  if (!canvas) {
    shareCopyStatus.value = '分享图生成失败，请稍后再试。'
    return
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png')
  })

  if (blob && navigator.clipboard && 'ClipboardItem' in window) {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      shareCopyStatus.value = '当前结算图已复制到剪贴板'
      return
    } catch {
      // fall through to text copy
    }
  }

  try {
    await navigator.clipboard.writeText(
      `我在拼豆大闯关全部通关，总用时 ${formatElapsed(clearSummary.value.elapsedSeconds)}，获得称号：${clearSummary.value.title}。`
    )
    shareCopyStatus.value = '已复制分享文案'
  } catch {
    shareCopyStatus.value = '当前环境不支持复制，请手动截图分享'
  }
}

watch(
  clearSummary,
  (summary, previous) => {
    if (summary && summary !== previous) {
      isResultModalOpen.value = true
      shareCopyStatus.value = ''
    }
  },
  { flush: 'post' }
)

watch(
  [status, clearSummary, levelIndex],
  ([nextStatus, summary, currentIndex]) => {
    clearAutoAdvanceTimer()

    if (nextStatus !== 'won' || summary || currentIndex >= game.levels.length - 1) {
      return
    }

    autoAdvanceTimer = window.setTimeout(() => {
      autoAdvanceTimer = null
      game.goToNextLevel()
    }, 680)
  },
  { flush: 'post' }
)

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  clearAutoAdvanceTimer()
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div class="page-shell">
    <div class="page-glow page-glow--one"></div>
    <div class="page-glow page-glow--two"></div>

    <div class="main-shell">
      <header class="hero">
        <div class="hero-copy">
          <span class="hero-copy__eyebrow">Perler Puzzle Draft</span>
          <h1>拼豆大闯关</h1>
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
          :disabled="isAnimating"
          @click="game.selectLevel(index)"
        >
          <span>第{{ level.badge }}关</span>
          <strong>{{ level.name }}</strong>
        </button>
      </section>

      <div class="content-row">
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
          </aside>

          <section class="playfield-card">
            <div class="playfield-card__top">
              <div>
                <span class="playfield-card__label">当前状态</span>
                <strong v-if="status === 'playing'">
                  {{ isAnimating ? '豆子移动中' : '闯关中' }}
                </strong>
                <strong v-else-if="status === 'won'">过关成功</strong>
                <strong v-else>时间用尽</strong>
              </div>

              <div class="action-row">
                <button class="soft-button" type="button" :disabled="isAnimating" @click="game.resetLevel">重置本关</button>
                <button class="soft-button soft-button--primary" type="button" :disabled="isAnimating" @click="game.goToNextLevel">
                  下一关
                </button>
              </div>
            </div>

            <BeadBoard
              :cells="board"
              :columns="boardSize.columns"
              :active-board-color="activeBoardColor"
              :selected-tray-color="selectedTrayColor"
              :board-accent="boardAccent"
              :entering-board-keys="enteringBoardKeys"
              :leaving-board-keys="leavingBoardKeys"
              :interaction-locked="isAnimating"
              @cell-click="game.placeBead"
              @clear-selection="game.clearSelection('empty')"
            />
          </section>
        </main>

        <aside class="info-rail">
          <section class="info-card">
            <div class="info-card__title">
              <span class="info-card__icon info-card__icon--warm">★</span>
              <strong>留言板</strong>
            </div>
            <p>hello 大家，欢迎来试玩这版拼豆小游戏。</p>
            <p>现在已经把随机散豆、激活、收纳和批量补位串起来了，后面还会继续补更多主题关卡和细节动画。</p>
          </section>

          <section class="info-card info-card--mint">
            <div class="info-card__title">
              <span class="info-card__icon info-card__icon--mint">◎</span>
              <strong>玩法小贴士</strong>
            </div>
            <p>先在棋盘里点豆子激活同色，再决定直接回填，还是先收进 16 格收纳槽备用。</p>
            <p>如果一片区域填不完，剩下的豆子会继续保持激活状态，方便你接着补下一块。</p>
          </section>

          <section class="info-card">
            <div class="info-card__title">
              <span class="info-card__icon info-card__icon--soft">♥</span>
              <strong>社区与支持</strong>
            </div>
            <button class="info-card__cta" type="button" :disabled="isAnimating" @click="openSupportModal">请作者喝一杯奶茶</button>
            <p>这里先作为展示位，后面可以替换成公告、活动入口或者帮助说明。</p>
          </section>
        </aside>
      </div>

      <TrayDock
        :capacity="currentLevel.capacity"
        :tray-total="trayTotal"
        :tray-slots="traySlots"
        :selected-tray-color="selectedTrayColor"
        :active-board-color="activeBoardColor"
        :palette="game.colorMetaMap"
        :entering-tray-indexes="enteringTrayIndexes"
        :leaving-tray-indexes="leavingTrayIndexes"
        :interaction-locked="isAnimating"
        @collect="game.collectActiveColor"
        @select-color="game.selectTrayColor"
      />
    </div>

    <div v-if="isSupportModalOpen" class="support-modal-backdrop" @click="closeSupportModal">
      <div class="support-modal" @click.stop>
        <div class="support-modal__head">
          <div class="support-modal__brand">
            <span class="support-modal__brand-badge">奶</span>
            <strong>Buy Me A Milk Tea</strong>
          </div>
          <button class="support-modal__close" type="button" aria-label="关闭弹窗" @click="closeSupportModal">×</button>
        </div>

        <div class="support-modal__body">
          <p>如果您希望这个项目继续发展，可以请作者喝一杯奶茶。</p>
          <p>您的支持是作者把项目继续下去的动力。</p>
        </div>

        <div class="support-modal__qr-frame">
          <img class="support-modal__qr-image" :src="supportQrCode" alt="微信赞赏码" />
        </div>

        <div class="support-modal__foot">微信扫描上方赞赏码，请作者喝奶茶 q(≧▽≦q)</div>
      </div>
    </div>

    <div v-if="isResultModalOpen && clearSummary" class="result-modal-backdrop" @click="closeResultModal">
      <div class="result-modal" @click.stop>
        <div class="result-modal__head">
          <span class="result-modal__eyebrow">Stage Clear</span>
          <button class="result-modal__close" type="button" aria-label="关闭结算弹窗" @click="closeResultModal">×</button>
        </div>

        <strong class="result-modal__title">{{ clearSummary.levelName }}</strong>
        <p class="result-modal__time">全部通关总用时 {{ formatElapsed(clearSummary.elapsedSeconds) }}</p>

        <div class="result-modal__badge-box">
          <span class="result-modal__badge-label">获得称号</span>
          <strong class="result-modal__badge">{{ clearSummary.title }}</strong>
        </div>

        <p class="result-modal__tagline">{{ clearSummary.tagline }}</p>
        <span v-if="clearSummary.cheatUsed" class="result-modal__cheat-chip">官方外挂已启用</span>

        <div class="result-modal__actions">
          <button class="soft-button" type="button" @click="copyResultShare">复制分享图</button>
          <button class="soft-button" type="button" @click="closeResultModal">稍后再看</button>
          <button class="soft-button soft-button--primary" type="button" @click="goNextFromResult">继续下一关</button>
        </div>
        <p v-if="shareCopyStatus" class="result-modal__share-status">{{ shareCopyStatus }}</p>
      </div>
    </div>
  </div>
</template>
