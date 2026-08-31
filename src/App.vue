<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { artworks, type Artwork, type Lang } from './data/artworks'

type ViewerPhase = 'closed' | 'preloading' | 'opening' | 'open' | 'closing'
type ViewerTransform = {
  x: number
  y: number
  scale: number
}

type ViewerSnapshot = {
  element: HTMLElement
  parent: HTMLElement
  placeholder: HTMLSpanElement
  sourceElement: HTMLElement
  firstRect: DOMRect
  targetRect: DOMRect
  originalClassName: string
  originalStyle: string
  image: HTMLImageElement | null
  originalImageSrc: string | null
  transform: ViewerTransform
  dragStart: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null
  wheelHandler: (event: WheelEvent) => void
  pointerDownHandler: (event: PointerEvent) => void
  pointerMoveHandler: (event: PointerEvent) => void
  pointerUpHandler: (event: PointerEvent) => void
}

const language = ref<Lang>('ru')
const view = ref<'works' | 'news'>('works')
const current = ref(0)
const isInfoOpen = ref(false)
const viewerPhase = ref<ViewerPhase>('closed')
const viewerLayerRef = ref<HTMLElement | null>(null)
const activeTileKey = ref<string | null>(null)
const cameraX = ref(0)
const cameraY = ref(0)
const isDragging = ref(false)
let pointerX = 0
let pointerY = 0
let autoTour: number | undefined
let holdFrame: number | undefined
let holdStarted = 0
let holdX = 0
let holdY = 0
let heldTile: { row: number; column: number; artIndex: number } | null = null
const holdingTile = ref<string | null>(null)
const holdProgress = ref(0)
const isFocusing = ref(false)
let viewerSnapshot: ViewerSnapshot | null = null
let activeAnimation: Animation | null = null
let openAnimationFrame: number | undefined
let preloadPromise: Promise<HTMLImageElement | null> | null = null
let driftX = (Math.random() - .5) * 1.2
let driftY = (Math.random() - .5) * .7

const tileWidth = 235
const tileHeight = 290
const tileGapX = 22
const tileGapY = 12
const tileStrideX = tileWidth + tileGapX
const tileStrideY = tileHeight + tileGapY
const galleryColumns = 11
const galleryRows = 9
const artworkColumnStride = 19
const artworkSizes = ref<Record<number, { width: number; height: number }>>({})

function handleArtworkLoad(event: Event, artIndex: number) {
  const image = event.target as HTMLImageElement
  const naturalWidth = image.naturalWidth || image.width || 180
  const naturalHeight = image.naturalHeight || image.height || 220
  const maxWidth = 220
  const maxHeight = 280
  let width = naturalWidth
  let height = naturalHeight
  const ratio = naturalWidth / naturalHeight

  if (width > maxWidth) {
    width = maxWidth
    height = width / ratio
  }

  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }

  artworkSizes.value[artIndex] = {
    width: Math.max(90, Math.round(width)),
    height: Math.max(110, Math.round(height)),
  }
}

function getArtworkTileSize(artIndex: number) {
  return artworkSizes.value[artIndex] ?? { width: 180, height: 220 }
}

function positiveModulo(value: number, modulo: number) {
  return ((value % modulo) + modulo) % modulo
}

function getProceduralArtworkIndex(column: number, row: number) {
  // 19 * column + row has no collision modulo 88 inside a 16:9 desktop viewport.
  return positiveModulo(column * artworkColumnStride + row, artworks.length)
}

const galleryTiles = computed(() => {
  const centerColumn = Math.floor(cameraX.value / tileStrideX)
  const centerRow = Math.floor(cameraY.value / tileStrideY)
  const columnOffset = Math.floor(galleryColumns / 2)
  const rowOffset = Math.floor(galleryRows / 2)

  return Array.from({ length: galleryColumns * galleryRows }, (_, index) => {
    const column = centerColumn + (index % galleryColumns) - columnOffset
    const row = centerRow + Math.floor(index / galleryColumns) - rowOffset
    const artIndex = getProceduralArtworkIndex(column, row)
    const size = getArtworkTileSize(artIndex)
    return { row, column, artIndex, width: size.width, height: size.height }
  })
})

const t = computed(() => language.value === 'ru' ? {
  artist: 'АЛЕНА\nПАСХИНА', works: 'Работы', news: 'Новости', exhibition: 'Виртуальная выставка', select: 'Откройте работу', navigate: 'листайте / перетаскивайте', work: 'Работа', contact: 'написать художнице ↗', about: 'об авторе', close: 'Закрыть', next: 'Следующая работа', previous: 'Предыдущая работа', newsTitle: 'Новости', newsText: 'Здесь будут анонсы выставок, новые серии и заметки из мастерской.', allWorks: 'Вернуться к работам', latest: 'Новая серия — 2025', newsNote: 'Скоро: фотографии работ и календарь выставок.'
} : {
  artist: 'ALENA\nPASKHINA', works: 'Works', news: 'News', exhibition: 'Virtual exhibition', select: 'Open an artwork', navigate: 'scroll / drag to explore', work: 'Work', contact: 'contact the artist ↗', about: 'about', close: 'Close', next: 'Next artwork', previous: 'Previous artwork', newsTitle: 'News', newsText: 'This is where exhibition announcements, new series and notes from the studio will appear.', allWorks: 'Back to works', latest: 'New series — 2025', newsNote: 'Coming soon: artwork photography and exhibition calendar.'
})
const artwork = computed(() => artworks[current.value])
const isViewerActive = computed(() => viewerPhase.value !== 'closed')

function preloadArtwork(item: Artwork): Promise<HTMLImageElement | null> {
  const fullSrc = item.fullSrc
  if (!fullSrc) return Promise.resolve(null)
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = async () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      try { await image.decode?.() } catch { /* onload already confirms the resource */ }
      resolve(image.naturalWidth > 0 ? image : null)
    }
    const timeout = window.setTimeout(() => { if (!settled) { settled = true; resolve(null) } }, 4000)
    image.decoding = 'async'
    image.onload = () => { void finish() }
    image.onerror = () => { if (!settled) { settled = true; window.clearTimeout(timeout); resolve(null) } }
    image.src = fullSrc
    if (image.complete && image.naturalWidth > 0) void finish()
  })
}
function getViewerTarget(firstRect: DOMRect, sourceAspect?: number) {
  const isMobile = window.innerWidth <= 700
  const panelWidth = isMobile ? 0 : Math.min(360, window.innerWidth - 48)
  const availableWidth = isMobile ? window.innerWidth - 32 : window.innerWidth - panelWidth - 72
  const maxWidth = isMobile ? Math.min(window.innerWidth * .72, 390) : Math.min(390, availableWidth)
  const aspect = sourceAspect ?? firstRect.width / firstRect.height
  let width = Math.max(1, maxWidth)
  let height = width / aspect
  const maxHeight = isMobile ? window.innerHeight * .48 : window.innerHeight - 120
  if (height > maxHeight) { height = maxHeight; width = height * aspect }
  const left = isMobile ? (window.innerWidth - width) / 2 : (window.innerWidth - panelWidth - width) / 2
  const top = isMobile ? 24 : (window.innerHeight - height) / 2
  return new DOMRect(left, top, width, height)
}
function applyViewerTransform(snapshot: ViewerSnapshot) {
  const { x, y, scale } = snapshot.transform
  snapshot.element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
}
async function openTile(tile: { row: number; column: number; artIndex: number }, element: HTMLElement, preparedImage?: Promise<HTMLImageElement | null> | null) {
  if (isViewerActive.value || !element.isConnected) return
  viewerPhase.value = 'preloading'
  isFocusing.value = true
  const fullImage = await (preparedImage ?? preloadArtwork(artworks[tile.artIndex]))
  if (!element.isConnected || viewerPhase.value !== 'preloading') { isFocusing.value = false; return }
  const parent = element.parentElement
  const viewerLayer = viewerLayerRef.value
  if (!parent || !viewerLayer) { viewerPhase.value = 'closed'; isFocusing.value = false; return }
  const firstRect = element.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(element)
  const placeholder = document.createElement('span')
  placeholder.className = 'artwork-placeholder'
  placeholder.setAttribute('aria-hidden', 'true')
  placeholder.style.cssText = `position:absolute;left:${computedStyle.left};top:${computedStyle.top};width:${firstRect.width}px;height:${firstRect.height}px;transform:${computedStyle.transform};`
  parent.insertBefore(placeholder, element)
  const sourceImage = element.querySelector<HTMLImageElement>('.art-image')
  const viewerElement = element.cloneNode(true) as HTMLElement
  const image = viewerElement.querySelector<HTMLImageElement>('.art-image')
  const fullSrc = artworks[tile.artIndex].fullSrc
  const fullAspect = fullImage && fullImage.naturalWidth && fullImage.naturalHeight
    ? fullImage.naturalWidth / fullImage.naturalHeight
    : undefined
  const snapshot: ViewerSnapshot = {
    element: viewerElement,
    parent: viewerLayer,
    placeholder,
    sourceElement: element,
    firstRect,
    targetRect: getViewerTarget(firstRect, fullAspect),
    originalClassName: element.className,
    originalStyle: element.getAttribute('style') ?? '',
    image,
    originalImageSrc: sourceImage?.getAttribute('src') ?? null,
    transform: { x: 0, y: 0, scale: 1 },
    dragStart: null,
    wheelHandler: (event: WheelEvent) => {
      if (!viewerSnapshot || viewerPhase.value === 'closing' || viewerPhase.value === 'closed') return
      event.preventDefault()
      const nextScale = Math.min(3, Math.max(1, viewerSnapshot.transform.scale * (event.deltaY < 0 ? 1.12 : 0.88)))
      viewerSnapshot.transform.scale = nextScale
      applyViewerTransform(viewerSnapshot)
    },
    pointerDownHandler: (event: PointerEvent) => {
      if (viewerPhase.value !== 'open' || !viewerSnapshot || event.button !== 0) return
      const target = event.currentTarget as HTMLElement
      viewerSnapshot.dragStart = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: viewerSnapshot.transform.x,
        originY: viewerSnapshot.transform.y,
      }
      target.setPointerCapture(event.pointerId)
      target.style.cursor = 'grabbing'
    },
    pointerMoveHandler: (event: PointerEvent) => {
      if (!viewerSnapshot || viewerSnapshot.dragStart === null || event.pointerId !== viewerSnapshot.dragStart.pointerId) return
      const nextX = viewerSnapshot.dragStart.originX + (event.clientX - viewerSnapshot.dragStart.startX)
      const nextY = viewerSnapshot.dragStart.originY + (event.clientY - viewerSnapshot.dragStart.startY)
      viewerSnapshot.transform.x = nextX
      viewerSnapshot.transform.y = nextY
      applyViewerTransform(viewerSnapshot)
    },
    pointerUpHandler: (event: PointerEvent) => {
      if (!viewerSnapshot || viewerSnapshot.dragStart === null || event.pointerId !== viewerSnapshot.dragStart.pointerId) return
      const target = event.currentTarget as HTMLElement
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
      target.style.cursor = 'grab'
      viewerSnapshot.dragStart = null
    },
  }
  viewerSnapshot = snapshot
  activeTileKey.value = element.dataset.tileKey ?? null
  current.value = tile.artIndex
  if (image && fullSrc) {
    image.src = fullSrc
    image.loading = 'eager'
    image.decoding = 'async'
    image.style.objectFit = 'contain'
    image.style.objectPosition = 'center'
  }
  viewerLayer.appendChild(viewerElement)
  viewerElement.classList.add('is-viewer')
  viewerElement.style.position = 'fixed'
  viewerElement.style.left = `${firstRect.left}px`
  viewerElement.style.top = `${firstRect.top}px`
  viewerElement.style.width = `${firstRect.width}px`
  viewerElement.style.height = `${firstRect.height}px`
  viewerElement.style.transform = 'translate3d(0, 0, 0) scale(1, 1)'
  viewerElement.style.zIndex = '11'
  viewerElement.style.cursor = 'grab'
  viewerElement.style.touchAction = 'none'
  viewerElement.addEventListener('wheel', snapshot.wheelHandler, { passive: false })
  viewerElement.addEventListener('pointerdown', snapshot.pointerDownHandler)
  viewerElement.addEventListener('pointermove', snapshot.pointerMoveHandler)
  viewerElement.addEventListener('pointerup', snapshot.pointerUpHandler)
  viewerElement.addEventListener('pointercancel', snapshot.pointerUpHandler)
  element.style.visibility = 'hidden'
  viewerPhase.value = 'opening'
  isInfoOpen.value = true
  await nextTick()
  const target = snapshot.targetRect
  const deltaX = target.left - firstRect.left
  const deltaY = target.top - firstRect.top
  const scaleX = target.width / firstRect.width
  const scaleY = target.height / firstRect.height
  openAnimationFrame = requestAnimationFrame(() => {
    openAnimationFrame = undefined
    if (viewerSnapshot !== snapshot || viewerPhase.value !== 'opening') return
    activeAnimation = snapshot.element.animate(
      [{ transform: 'translate3d(0, 0, 0) scale(1, 1)' }, { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})` }],
      { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 620, easing: 'cubic-bezier(.18,.75,.23,1)', fill: 'forwards' },
    )
    activeAnimation.addEventListener('finish', () => {
      if (viewerSnapshot !== snapshot || viewerPhase.value !== 'opening') return
      activeAnimation?.commitStyles()
      activeAnimation?.cancel()
      snapshot.element.style.left = `${target.left}px`
      snapshot.element.style.top = `${target.top}px`
      snapshot.element.style.width = `${target.width}px`
      snapshot.element.style.height = `${target.height}px`
      snapshot.transform = { x: 0, y: 0, scale: 1 }
      applyViewerTransform(snapshot)
      viewerPhase.value = 'open'
      isFocusing.value = false
    }, { once: true })
  })
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || isViewerActive.value) return
  isDragging.value = true; pointerX = event.clientX; pointerY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function drag(event: PointerEvent) {
  if (!isDragging.value || isViewerActive.value) return
  cameraX.value -= (event.clientX - pointerX) * 1.05
  cameraY.value -= (event.clientY - pointerY) * 1.05
  pointerX = event.clientX; pointerY = event.clientY
}
function movePointer(event: PointerEvent) {
  if (heldTile) moveOnTile(event)
  else drag(event)
}
function endDrag() { isDragging.value = false }
function endPointer(event: PointerEvent) {
  endDrag()
  endHold()
  const room = event.currentTarget as HTMLElement
  if (room.hasPointerCapture(event.pointerId)) room.releasePointerCapture(event.pointerId)
}
function tileKey(tile: { row: number; column: number }) { return `${tile.row}-${tile.column}` }
function startHold(event: PointerEvent, tile: { row: number; column: number; artIndex: number }) {
  if (event.button !== 0 || isViewerActive.value) return
  const trigger = event.currentTarget as HTMLElement
  trigger.closest<HTMLElement>('.room')?.setPointerCapture(event.pointerId)
  isFocusing.value = true
  heldTile = tile; holdStarted = performance.now(); holdX = event.clientX; holdY = event.clientY; holdingTile.value = tileKey(tile); holdProgress.value = 0
  preloadPromise = preloadArtwork(artworks[tile.artIndex])
  const tick = (now: number) => {
    holdProgress.value = Math.min(1, (now - holdStarted) / 700)
    if (holdProgress.value >= 1 && heldTile) { const tileToOpen = heldTile; const prepared = preloadPromise; cancelHold(); void openTile(tileToOpen, trigger, prepared); return }
    holdFrame = requestAnimationFrame(tick)
  }
  holdFrame = requestAnimationFrame(tick)
}
function cancelHold() { if (holdFrame) cancelAnimationFrame(holdFrame); holdFrame = undefined; heldTile = null; holdingTile.value = null; holdProgress.value = 0; preloadPromise = null }
function endHold() {
  const wasHolding = heldTile !== null
  cancelHold()
  if (wasHolding) isFocusing.value = false
}
function moveOnTile(event: PointerEvent) {
  if (heldTile && Math.hypot(event.clientX - holdX, event.clientY - holdY) > 7) {
    endHold()
    isDragging.value = true
    pointerX = holdX
    pointerY = holdY
    drag(event)
    return
  }
  if (isDragging.value) drag(event)
}
async function closeArtwork() {
  if (viewerPhase.value === 'preloading') {
    viewerPhase.value = 'closed'
    isFocusing.value = false
    preloadPromise = null
    return
  }
  const snapshot = viewerSnapshot
  if (!snapshot || viewerPhase.value === 'closing') return
  viewerPhase.value = 'closing'
  isInfoOpen.value = false
  if (openAnimationFrame) cancelAnimationFrame(openAnimationFrame)
  const element = snapshot.element
  const sourceElement = snapshot.sourceElement
  const sourceParent = sourceElement.parentElement ?? snapshot.parent
  const currentRect = element.getBoundingClientRect()
  activeAnimation?.cancel()
  const deltaX = snapshot.firstRect.left - currentRect.left
  const deltaY = snapshot.firstRect.top - currentRect.top
  const scaleX = snapshot.firstRect.width / currentRect.width
  const scaleY = snapshot.firstRect.height / currentRect.height
  const motionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 620
  const currentTransform = `translate3d(${snapshot.transform.x}px, ${snapshot.transform.y}px, 0) scale(${snapshot.transform.scale})`
  activeAnimation = element.animate(
    [{ transform: currentTransform }, { transform: `translate3d(${deltaX + snapshot.transform.x}px, ${deltaY + snapshot.transform.y}px, 0) scale(${scaleX * snapshot.transform.scale}, ${scaleY * snapshot.transform.scale})` }],
    { duration: motionDuration, easing: 'cubic-bezier(.18,.75,.23,1)', fill: 'forwards' },
  )
  try { await activeAnimation.finished } catch { /* cleanup still restores the original DOM slot */ }
  activeAnimation.cancel()
  element.removeEventListener('wheel', snapshot.wheelHandler)
  element.removeEventListener('pointerdown', snapshot.pointerDownHandler)
  element.removeEventListener('pointermove', snapshot.pointerMoveHandler)
  element.removeEventListener('pointerup', snapshot.pointerUpHandler)
  element.removeEventListener('pointercancel', snapshot.pointerUpHandler)
  sourceElement.style.visibility = ''
  sourceElement.className = snapshot.originalClassName
  sourceElement.setAttribute('style', snapshot.originalStyle)
  if (sourceElement.querySelector('img') && snapshot.originalImageSrc !== null) sourceElement.querySelector<HTMLImageElement>('img')!.src = snapshot.originalImageSrc
  sourceParent.insertBefore(sourceElement, snapshot.placeholder)
  snapshot.placeholder.remove()
  element.remove()
  viewerSnapshot = null
  activeTileKey.value = null
  activeAnimation = null
  viewerPhase.value = 'closed'
  isFocusing.value = false
  sourceElement.focus({ preventScroll: true })
}
function handleKeydown(event: KeyboardEvent) { if (event.key === 'Escape' && isViewerActive.value) void closeArtwork() }
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  autoTour = window.setInterval(() => { if (!isDragging.value && !isFocusing.value && view.value === 'works' && !isViewerActive.value) { cameraX.value += driftX; cameraY.value += driftY } }, 32)
})
onBeforeUnmount(() => { window.removeEventListener('keydown', handleKeydown); if (autoTour) window.clearInterval(autoTour); if (openAnimationFrame) cancelAnimationFrame(openAnimationFrame); activeAnimation?.cancel(); cancelHold() })
</script>

<template>
  <main class="gallery-shell" :class="{ 'info-open': isInfoOpen, 'viewer-active': isViewerActive, 'viewer-closing': viewerPhase === 'closing', 'news-open': view === 'news' }">
    <header class="topbar">
      <button class="wordmark" type="button" @click="view = 'works'">{{ t.artist }}</button>
      <nav class="main-nav" :aria-label="language === 'ru' ? 'Навигация' : 'Navigation'">
        <button :class="{ active: view === 'works' }" type="button" @click="view = 'works'">{{ t.works }}</button>
        <button :class="{ active: view === 'news' }" type="button" @click="view = 'news'">{{ t.news }}</button>
      </nav>
      <div class="language-switch" aria-label="Language"><button :class="{ active: language === 'ru' }" type="button" @click="language = 'ru'">RU</button><span>/</span><button :class="{ active: language === 'en' }" type="button" @click="language = 'en'">EN</button></div>
    </header>

    <section class="room" :class="{ dragging: isDragging }" :aria-label="t.exhibition" @pointerdown="startDrag" @pointermove="movePointer" @pointerup="endPointer" @pointercancel="endPointer">
      <div class="ceiling-light" /><div class="gallery-surface" />
      <div class="art-orbit">
        <div class="camera-plane" :style="{ transform: `translate3d(${-cameraX}px, ${-cameraY}px, 0)` }">
          <button v-for="tile in galleryTiles" :key="tileKey(tile)" class="artwork" :class="[artworks[tile.artIndex].className, { holding: holdingTile === tileKey(tile) }]" :data-art-index="tile.artIndex" :data-tile-key="tileKey(tile)" :style="{ width: `${tile.width}px`, height: `${tile.height}px`, transform: activeTileKey === tileKey(tile) ? 'none' : `translate3d(${tile.column * tileStrideX}px, ${tile.row * tileStrideY}px, 0)`, '--hold-progress': holdProgress }" type="button" :aria-label="`${t.select}: ${artworks[tile.artIndex].title[language]}`" @pointerdown.stop="startHold($event, tile)" @pointermove.stop="movePointer" @pointerup.stop="endPointer($event)" @pointercancel.stop="endPointer($event)"><img v-if="artworks[tile.artIndex].thumbSrc" class="art-image" :src="artworks[tile.artIndex].thumbSrc" :alt="artworks[tile.artIndex].alt[language]" :style="{ objectPosition: artworks[tile.artIndex].objectPosition ?? 'center' }" loading="lazy" decoding="async" @load="handleArtworkLoad($event, tile.artIndex)" /><span v-else class="canvas" /><span class="hold-indicator" /></button>
        </div>
      </div>
      <div class="mist" />
      <p class="room-hint">{{ t.select }} · {{ t.navigate }}</p>
    </section>

    <div ref="viewerLayerRef" class="artwork-viewer-layer" aria-hidden="true" />


    <aside class="art-info" role="dialog" :aria-modal="isInfoOpen ? 'true' : undefined" :aria-hidden="!isInfoOpen"><button class="close" type="button" :aria-label="t.close" @click="closeArtwork">×</button><p class="eyebrow">{{ t.work }} {{ String(current + 1).padStart(2, '0') }} / {{ String(artworks.length).padStart(2, '0') }}</p><h1>{{ artwork.title[language] }}</h1><p class="details">{{ artwork.year }} · {{ artwork.medium[language] }}</p><p class="description">{{ artwork.description[language] }}</p></aside>

    <section class="news-panel" :aria-hidden="view !== 'news'"><p class="eyebrow">{{ t.latest }}</p><h1>{{ t.newsTitle }}</h1><p>{{ t.newsText }}</p><p class="news-note">{{ t.newsNote }}</p><button type="button" @click="view = 'works'">{{ t.allWorks }} →</button></section>
    <footer class="footer"><a href="mailto:hello@example.com">{{ t.contact }}</a><p>{{ t.exhibition }} · 2024—2026</p><a href="#about">{{ t.about }}</a></footer>
  </main>
</template>
