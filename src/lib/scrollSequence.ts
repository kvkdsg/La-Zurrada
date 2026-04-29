type FrameLike =
  | string
  | {
      src?: string
      url?: string
      x?: number
      y?: number
      width?: number
      height?: number
      w?: number
      h?: number
    }

interface RawManifest {
  width?: number
  height?: number
  frameWidth?: number
  frameHeight?: number
  canvasWidth?: number
  canvasHeight?: number
  frames?: FrameLike[]
}

interface NormalizedFrame {
  src: string
  x: number
  y: number
  width: number
  height: number
}

interface SequenceManifest {
  width: number
  height: number
  frames: NormalizedFrame[]
}

interface SceneState {
  root: HTMLElement
  track: HTMLElement
  sticky: HTMLElement
  card: HTMLElement
  frame: HTMLElement
  canvas: HTMLCanvasElement
  poster: HTMLImageElement | null
  context: CanvasRenderingContext2D | null
  manifestUrl: string
  desktopBreakpoint: number
  trackTop: number
  trackHeight: number
  trackDistance: number
  stickyOffsetTop: number
  stickyHeight: number
  exitFadeDistance: number
  currentFrameIndex: number
  targetFrameIndex: number
  lastFrameIndex: number
  isPreloadingAll: boolean
  isNearViewport: boolean
  hasMeasured: boolean
  manifestPromise: Promise<void> | null
  hasManifestFailed: boolean
  manifest: SequenceManifest | null
  imageCache: Map<number, HTMLImageElement>
  imagePromises: Map<number, Promise<HTMLImageElement | null>>
}

interface InitOptions {
  selector?: string
  nearViewportMargin?: string
  preloadRadius?: number
}

interface NaturalSize {
  width: number
  height: number
}

const DEFAULT_SELECTOR = '[data-participant-scene]'
const DEFAULT_MARGIN = '200% 0px 200% 0px'
const DEFAULT_PRELOAD_RADIUS = 1
const IS_DEV = import.meta.env.DEV

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const clampIndex = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)))

const mapRange = (value: number, start: number, end: number) => {
  if (end <= start) return value >= end ? 1 : 0
  return clamp((value - start) / (end - start))
}

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const resolveUrl = (baseUrl: string, src: string) => {
  const absoluteBase = new URL(baseUrl, window.location.href)
  return new URL(src, absoluteBase).toString()
}

const shouldDebugSequences = () => {
  if (typeof window === 'undefined') return IS_DEV

  return (
    IS_DEV ||
    window.location.search.includes('debugSequences=1') ||
    document.documentElement.hasAttribute('data-debug-sequences')
  )
}

const setSceneDebugState = (
  scene: SceneState,
  state: string,
  extra: Record<string, string> = {},
) => {
  scene.root.setAttribute('data-sequence-state', state)

  Object.entries(extra).forEach(([key, value]) => {
    scene.root.setAttribute(`data-sequence-${key}`, value)
  })
}

const clearSceneDebugState = (scene: SceneState) => {
  scene.root.removeAttribute('data-sequence-state')
  scene.root.removeAttribute('data-sequence-error-phase')
  scene.root.removeAttribute('data-sequence-error-detail')
  scene.root.removeAttribute('data-sequence-frames')
}

const reportSequenceInfo = (
  message: string,
  scene: SceneState,
  extra: Record<string, unknown> = {},
) => {
  if (!shouldDebugSequences()) return

  console.info('[scrollSequence]', {
    message,
    manifestUrl: scene.manifestUrl,
    currentFrameIndex: scene.currentFrameIndex,
    ...extra,
  })
}

const reportSequenceError = (
  phase: 'manifest' | 'frame' | 'init' | 'update',
  scene: SceneState,
  error: unknown,
  extra: Record<string, unknown> = {},
) => {
  const detail =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'

  setSceneDebugState(scene, 'error', {
    'error-phase': phase,
    'error-detail': detail,
  })

  console.error('[scrollSequence]', {
    phase,
    manifestUrl: scene.manifestUrl,
    currentFrameIndex: scene.currentFrameIndex,
    ...extra,
    error,
  })
}

const clearSceneFlags = (scene: SceneState) => {
  scene.root.removeAttribute('data-sequence-ready')
  scene.root.removeAttribute('data-sequence-fallback')
  clearSceneDebugState(scene)
}

const markSceneReady = (scene: SceneState) => {
  scene.root.removeAttribute('data-sequence-fallback')
  scene.root.setAttribute('data-sequence-ready', '')
  setSceneDebugState(scene, 'ready')
}

const markSceneFallback = (scene: SceneState) => {
  scene.root.removeAttribute('data-sequence-ready')
  scene.root.setAttribute('data-sequence-fallback', '')
  setSceneDebugState(scene, 'fallback')
}

const getPosterNaturalSize = async (
  poster: HTMLImageElement | null,
): Promise<NaturalSize | null> => {
  if (!poster) return null

  try {
    if (!poster.complete) {
      await poster.decode()
    }
  } catch {}

  const width = poster.naturalWidth || 0
  const height = poster.naturalHeight || 0

  if (width <= 0 || height <= 0) return null
  return { width, height }
}

const normalizeManifest = (
  raw: RawManifest,
  baseUrl: string,
  fallbackPoster = '',
  fallbackSize: NaturalSize | null = null,
): SequenceManifest => {
  const width =
    toPositiveNumber(raw.width ?? raw.frameWidth ?? raw.canvasWidth) ?? fallbackSize?.width ?? 1080

  const height =
    toPositiveNumber(raw.height ?? raw.frameHeight ?? raw.canvasHeight) ??
    fallbackSize?.height ??
    width

  const frames = (Array.isArray(raw.frames) ? raw.frames : [])
    .map<NormalizedFrame | null>((entry) => {
      if (typeof entry === 'string') {
        const src = entry.trim()
        if (!src) return null

        return {
          src: resolveUrl(baseUrl, src),
          x: 0,
          y: 0,
          width,
          height,
        }
      }

      const src = (entry.src ?? entry.url ?? '').trim()
      if (!src) return null

      return {
        src: resolveUrl(baseUrl, src),
        x: toNumber(entry.x, 0),
        y: toNumber(entry.y, 0),
        width: toPositiveNumber(entry.width ?? entry.w) ?? width,
        height: toPositiveNumber(entry.height ?? entry.h) ?? height,
      }
    })
    .filter((frame): frame is NormalizedFrame => Boolean(frame))

  if (frames.length > 0) {
    return { width, height, frames }
  }

  if (fallbackPoster) {
    return {
      width,
      height,
      frames: [
        {
          src: fallbackPoster,
          x: 0,
          y: 0,
          width,
          height,
        },
      ],
    }
  }

  return { width, height, frames: [] }
}

const createImageLoader = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      reject(new Error(`Unable to load image: ${src}`))
    }
    image.src = src
  })

const buildScene = (root: HTMLElement): SceneState | null => {
  const track = root.querySelector<HTMLElement>('[data-scene-track]')
  const sticky = root.querySelector<HTMLElement>('[data-scene-sticky]')
  const card = root.querySelector<HTMLElement>('[data-scene-card]')
  const frame = root.querySelector<HTMLElement>('[data-scene-frame]')
  const canvas = root.querySelector<HTMLCanvasElement>('[data-scene-canvas]')
  const poster = root.querySelector<HTMLImageElement>('[data-scene-poster]')

  if (!track || !sticky || !card || !frame || !canvas) {
    root.setAttribute('data-sequence-state', 'invalid-dom')

    console.error('[scrollSequence]', {
      phase: 'init',
      reason: 'Missing required scene nodes',
      hasTrack: Boolean(track),
      hasSticky: Boolean(sticky),
      hasCard: Boolean(card),
      hasFrame: Boolean(frame),
      hasCanvas: Boolean(canvas),
      hasPoster: Boolean(poster),
    })

    return null
  }

  const context = canvas.getContext('2d', {
    alpha: true,
  })

  return {
    root,
    track,
    sticky,
    card,
    frame,
    canvas,
    poster,
    context,
    manifestUrl: (root.dataset['manifest'] ?? '').trim(),
    desktopBreakpoint: toNumber(root.dataset['desktopBreakpoint'], 960),
    trackTop: 0,
    trackHeight: 0,
    trackDistance: 1,
    stickyOffsetTop: 0,
    stickyHeight: 0,
    exitFadeDistance: 100,
    currentFrameIndex: -1,
    targetFrameIndex: -1,
    lastFrameIndex: -1,
    isPreloadingAll: false,
    isNearViewport: false,
    hasMeasured: false,
    manifestPromise: null,
    hasManifestFailed: false,
    manifest: null,
    imageCache: new Map(),
    imagePromises: new Map(),
  }
}

const setSceneMetric = (scene: SceneState, name: string, value: string) => {
  scene.root.style.setProperty(name, value)
}

const resizeCanvas = (scene: SceneState) => {
  const rect = scene.frame.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

  const targetWidth = Math.max(1, Math.round(width * dpr))
  const targetHeight = Math.max(1, Math.round(height * dpr))

  if (scene.canvas.width !== targetWidth) scene.canvas.width = targetWidth
  if (scene.canvas.height !== targetHeight) scene.canvas.height = targetHeight

  scene.canvas.style.width = `${width}px`
  scene.canvas.style.height = `${height}px`
}

const measureScene = (scene: SceneState) => {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1
  const scrollY = window.scrollY || 0
  const trackRect = scene.track.getBoundingClientRect()
  scene.trackTop = trackRect.top + scrollY
  scene.trackHeight = scene.track.offsetHeight
  scene.trackDistance = Math.max(scene.trackHeight - viewportHeight, 1)
  scene.stickyHeight = scene.sticky.offsetHeight
  const computedStickyTop = Number.parseFloat(window.getComputedStyle(scene.sticky).top)
  scene.stickyOffsetTop = Number.isFinite(computedStickyTop) ? computedStickyTop : 0
  const frameRect = scene.frame.getBoundingClientRect()
  scene.exitFadeDistance = Math.max(
    96,
    Math.round(Math.min(viewportHeight, Math.max(1, frameRect.height)) * 0.22),
  )

  resizeCanvas(scene)
  scene.hasMeasured = true
}

const clearCanvas = (scene: SceneState) => {
  if (!scene.context) return
  scene.context.clearRect(0, 0, scene.canvas.width, scene.canvas.height)
}

const drawFrame = (scene: SceneState, frameIndex: number) => {
  if (!scene.context || !scene.manifest) return

  const image = scene.imageCache.get(frameIndex)
  const frame = scene.manifest.frames[frameIndex]

  if (!image || !frame) return

  const canvasWidth = scene.canvas.width
  const canvasHeight = scene.canvas.height

  if (canvasWidth <= 0 || canvasHeight <= 0) return

  const scale = Math.max(canvasWidth / scene.manifest.width, canvasHeight / scene.manifest.height)

  const drawWidth = scene.manifest.width * scale
  const drawHeight = scene.manifest.height * scale
  const offsetX = (canvasWidth - drawWidth) / 2
  const offsetY = (canvasHeight - drawHeight) / 2

  clearCanvas(scene)

  scene.context.drawImage(
    image,
    offsetX + frame.x * scale,
    offsetY + frame.y * scale,
    frame.width * scale,
    frame.height * scale,
  )

  scene.currentFrameIndex = frameIndex
  markSceneReady(scene)
}

const ensureFrame = async (
  scene: SceneState,
  frameIndex: number,
): Promise<HTMLImageElement | null> => {
  if (!scene.manifest) return null

  const frame = scene.manifest.frames[frameIndex]
  if (!frame) return null

  const cached = scene.imageCache.get(frameIndex)
  if (cached) return cached

  const pending = scene.imagePromises.get(frameIndex)
  if (pending !== undefined) return pending

  const promise = createImageLoader(frame.src)
    .then((image) => {
      scene.imageCache.set(frameIndex, image)
      scene.imagePromises.delete(frameIndex)
      return image
    })
    .catch((error: unknown) => {
      if (shouldDebugSequences()) {
        console.warn(
          `[scrollSequence] Network error locked for frame ${frameIndex}:`,
          error instanceof Error ? error.message : String(error),
        )
      }
      return null
    })

  scene.imagePromises.set(frameIndex, promise)
  return promise
}

const preloadDirectional = (scene: SceneState, frameIndex: number, radius: number) => {
  if (!scene.manifest || radius <= 0) return

  const goingForward = scene.lastFrameIndex === -1 || frameIndex >= scene.lastFrameIndex
  scene.lastFrameIndex = frameIndex

  const ahead = goingForward ? radius + 2 : 1
  const behind = goingForward ? 1 : radius + 2

  for (let offset = 1; offset <= ahead; offset++) {
    const nextIndex = frameIndex + offset
    if (nextIndex < scene.manifest.frames.length) {
      void ensureFrame(scene, nextIndex)
    }
  }

  for (let offset = 1; offset <= behind; offset++) {
    const prevIndex = frameIndex - offset
    if (prevIndex >= 0) {
      void ensureFrame(scene, prevIndex)
    }
  }
}

const preloadAllFrames = async (scene: SceneState, concurrency = 8) => {
  if (!scene.manifest || scene.isPreloadingAll) return
  scene.isPreloadingAll = true

  const total = scene.manifest.frames.length
  let nextIndex = 1

  const worker = async () => {
    while (nextIndex < total) {
      const current = nextIndex
      nextIndex += 1
      await ensureFrame(scene, current)
      await new Promise((resolve) => setTimeout(resolve, 3))
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total - 1) }, () => worker())
  await Promise.all(workers)

  if (shouldDebugSequences()) {
    console.info(`[scrollSequence] Preload All finished for ${scene.manifestUrl}`)
  }
}

const loadManifest = async (scene: SceneState) => {
  if (scene.manifest || !scene.manifestUrl || scene.hasManifestFailed) return
  if (scene.manifestPromise) return scene.manifestPromise

  setSceneDebugState(scene, 'loading-manifest')
  reportSequenceInfo('manifest:load:start', scene)

  scene.manifestPromise = (async () => {
    const posterSize = await getPosterNaturalSize(scene.poster)

    try {
      const response = await fetch(scene.manifestUrl, { credentials: 'same-origin' })

      if (!response.ok) {
        throw new Error(`Unable to fetch manifest: ${scene.manifestUrl} (${response.status})`)
      }

      const raw = (await response.json()) as RawManifest
      const normalizedManifest = normalizeManifest(
        raw,
        scene.manifestUrl,
        scene.poster?.src ?? '',
        posterSize,
      )

      if (normalizedManifest.frames.length === 0) {
        scene.manifest = null
        clearCanvas(scene)
        scene.currentFrameIndex = -1
        scene.targetFrameIndex = -1
        scene.hasManifestFailed = true
        markSceneFallback(scene)
        setSceneDebugState(scene, 'empty-manifest')
        return
      }

      scene.manifest = normalizedManifest
      scene.root.setAttribute('data-sequence-frames', String(normalizedManifest.frames.length))

      reportSequenceInfo('manifest:load:success', scene, {
        frames: normalizedManifest.frames.length,
        width: normalizedManifest.width,
        height: normalizedManifest.height,
      })
    } catch (error) {
      scene.manifest = null
      clearCanvas(scene)
      scene.currentFrameIndex = -1
      scene.targetFrameIndex = -1
      scene.hasManifestFailed = true
      markSceneFallback(scene)
      reportSequenceError('manifest', scene, error)
      return
    }

    try {
      setSceneDebugState(scene, 'loading-frame-0')
      scene.targetFrameIndex = 0
      const image = await ensureFrame(scene, 0)

      if (image && scene.targetFrameIndex === 0) {
        drawFrame(scene, 0)
      } else if (!image) {
        throw new Error('Frame 0 failed to load (resolved to null)')
      }

      reportSequenceInfo('frame:0:draw:success', scene)
      void preloadAllFrames(scene, 8)
    } catch (error) {
      if (scene.targetFrameIndex === 0) {
        clearCanvas(scene)
        scene.currentFrameIndex = -1
        scene.targetFrameIndex = -1
        markSceneFallback(scene)
        reportSequenceError('frame', scene, error, { frameIndex: 0 })
      }
    }
  })().finally(() => {
    scene.manifestPromise = null
  })

  return scene.manifestPromise
}

const updateSceneProgress = async (
  scene: SceneState,
  scrollY: number,
  preloadRadius: number,
  _reducedMotion: boolean,
): Promise<boolean> => {
  if (!scene.hasMeasured) {
    measureScene(scene)
  }

  const trackTopRelative = scene.trackTop - scrollY
  const progress = clamp(-trackTopRelative / scene.trackDistance)
  const enterProgress = mapRange(progress, 0.02, 0.18)
  const virtualStickyTop = Math.min(
    scene.stickyOffsetTop,
    trackTopRelative + scene.trackHeight - scene.stickyHeight,
  )

  const postStickyTravel = Math.max(0, scene.stickyOffsetTop - virtualStickyTop)
  const exitProgress = clamp(postStickyTravel / scene.exitFadeDistance)

  setSceneMetric(scene, '--scene-progress', progress.toFixed(5))
  setSceneMetric(scene, '--scene-enter-progress', enterProgress.toFixed(5))
  setSceneMetric(scene, '--scene-exit-progress', exitProgress.toFixed(5))

  if (!scene.isNearViewport) return false

  await loadManifest(scene)

  if (!scene.manifest || scene.manifest.frames.length === 0) return false

  const rawTargetFrame = progress * (scene.manifest.frames.length - 1)
  const rawSafeFrame = clampIndex(rawTargetFrame, 0, scene.manifest.frames.length - 1)

  let safeFrame = rawSafeFrame
  let needsCatchUp = false
  const maxStep = 4

  if (scene.currentFrameIndex >= 0) {
    if (rawSafeFrame > scene.currentFrameIndex + maxStep) {
      safeFrame = scene.currentFrameIndex + maxStep
      needsCatchUp = true
    } else if (rawSafeFrame < scene.currentFrameIndex - maxStep) {
      safeFrame = scene.currentFrameIndex - maxStep
      needsCatchUp = true
    }
  }

  scene.targetFrameIndex = safeFrame

  const cachedImage = scene.imageCache.get(safeFrame)

  if (cachedImage) {
    drawFrame(scene, safeFrame)
    preloadDirectional(scene, safeFrame, preloadRadius)
  } else {
    ensureFrame(scene, safeFrame)
      .then((image) => {
        if (image && scene.targetFrameIndex === safeFrame) {
          drawFrame(scene, safeFrame)
        }
      })
      .catch((error: unknown) => {
        if (scene.targetFrameIndex === safeFrame) {
          clearCanvas(scene)
          scene.currentFrameIndex = -1
          markSceneFallback(scene)
          reportSequenceError('frame', scene, error, { frameIndex: safeFrame })
        }
      })
    preloadDirectional(scene, safeFrame, preloadRadius)
  }

  return needsCatchUp
}

export const initScrollSequences = (options: InitOptions = {}) => {
  const selector = options.selector ?? DEFAULT_SELECTOR
  const nearViewportMargin = options.nearViewportMargin ?? DEFAULT_MARGIN
  const preloadRadius = options.preloadRadius ?? DEFAULT_PRELOAD_RADIUS

  const sceneRoots = Array.from(document.querySelectorAll<HTMLElement>(selector))
  const scenes = sceneRoots.map(buildScene).filter((scene): scene is SceneState => Boolean(scene))
  const sceneByRoot = new Map(scenes.map((scene) => [scene.root, scene] as const))

  if (shouldDebugSequences()) {
    console.info('[scrollSequence]', {
      phase: 'init',
      selector,
      sceneRoots: sceneRoots.length,
      scenes: scenes.length,
      nearViewportMargin,
      preloadRadius,
    })
  }

  if (scenes.length === 0) {
    return () => {
      /* noop */
    }
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let prefersReducedMotion = reducedMotionQuery.matches
  let rafId = 0

  const requestTick = () => {
    if (rafId) return
    rafId = window.requestAnimationFrame(runUpdate)
  }

  const runUpdate = () => {
    rafId = 0
    const currentScrollY = window.scrollY || 0

    void Promise.all(
      scenes.map((scene) =>
        updateSceneProgress(scene, currentScrollY, preloadRadius, prefersReducedMotion),
      ),
    )
      .then((results) => {
        const needsAnotherTick = results.some((needsCatchUp) => needsCatchUp)
        if (needsAnotherTick) {
          requestTick()
        }
      })
      .catch((error: unknown) => {
        console.error('[scrollSequence]', {
          phase: 'update',
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const nearObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const scene = sceneByRoot.get(entry.target as HTMLElement)
              if (!scene) return

              scene.isNearViewport = entry.isIntersecting

              if (entry.isIntersecting) {
                reportSequenceInfo('scene:entered-near-viewport', scene)
                void loadManifest(scene)
              }
            })

            requestTick()
          },
          {
            rootMargin: nearViewportMargin,
            threshold: 0,
          },
        )
      : null

  const resizeObserver =
    'ResizeObserver' in window
      ? new ResizeObserver(() => {
          scenes.forEach(measureScene)
          requestTick()
        })
      : null

  const handleResize = () => {
    scenes.forEach(measureScene)
    requestTick()
  }

  const handleReducedMotionChange = (event: MediaQueryListEvent) => {
    prefersReducedMotion = event.matches

    scenes.forEach((scene) => {
      if (scene.isNearViewport) {
        void loadManifest(scene)
      }
    })

    requestTick()
  }

  scenes.forEach((scene) => {
    measureScene(scene)
    clearSceneFlags(scene)
    setSceneDebugState(scene, 'initialized')

    if (!nearObserver) {
      scene.isNearViewport = true
      void loadManifest(scene)
    }

    nearObserver?.observe(scene.root)
    resizeObserver?.observe(scene.root)
    resizeObserver?.observe(scene.card)
    resizeObserver?.observe(scene.frame)
  })

  window.addEventListener('scroll', requestTick, { passive: true })
  window.addEventListener('resize', handleResize)
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange)

  requestTick()

  return () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    }

    window.removeEventListener('scroll', requestTick)
    window.removeEventListener('resize', handleResize)
    reducedMotionQuery.removeEventListener('change', handleReducedMotionChange)

    nearObserver?.disconnect()
    resizeObserver?.disconnect()

    scenes.forEach((scene) => {
      scene.root.style.removeProperty('--participant-sticky-top')
      scene.root.style.removeProperty('--scene-progress')
      scene.root.style.removeProperty('--scene-enter-progress')
      scene.root.style.removeProperty('--scene-exit-progress')
      clearSceneFlags(scene)
      clearCanvas(scene)
      scene.imageCache.clear()
      scene.imagePromises.clear()
      scene.currentFrameIndex = -1
      scene.targetFrameIndex = -1
      scene.lastFrameIndex = -1
      scene.isPreloadingAll = false
      scene.hasManifestFailed = false
      scene.manifest = null
      scene.manifestPromise = null
      scene.hasMeasured = false
    })
  }
}
