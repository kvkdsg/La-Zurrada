export type CardSide = 'left' | 'right'

interface ParticipantSequenceConfig {
  poster: string
  manifest: string
}

export interface ParticipantRecord {
  id: string
  slug: string
  name: string
  opponent: string
  matchupId: string
  fightOrder: number
  fightLabel: string
  boutTier: string
  descriptor: string
  sourceNote: string
  accent: string
  sequence: ParticipantSequenceConfig
}

export interface HeroFighterRenderable {
  participantId: string
  slug: string
  name: string
  accent: string
  posterImage: string
  selectorPoster: string
  baseImage: string | null
  baseImageSrcSet: string | null
  gearImage: string | null
  gearImageSrcSet: string | null
  renderMode: 'main-event' | 'poster'
  revealAngle: string
  revealCore: string
  revealSoft: string
  revealDelay: string
}

interface HeroMatchupDefinition {
  matchupId: string
  fightOrder: number
  topParticipantId: string
  bottomParticipantId: string
  leftParticipantId: string
  rightParticipantId: string
}

export interface HeroMatchupRecord {
  matchupId: string
  fightOrder: number
  fightLabel: string
  boutTier: string
  topParticipantId: string
  bottomParticipantId: string
  leftParticipantId: string
  rightParticipantId: string
  participantIds: readonly [string, string]
  top: HeroFighterRenderable
  bottom: HeroFighterRenderable
  left: HeroFighterRenderable
  right: HeroFighterRenderable
}

const DEFAULT_HERO_REVEAL = {
  revealAngle: '90deg',
  revealCore: '18%',
  revealSoft: '10%',
  revealDelay: '0ms',
} as const

const HERO_EVENT_ASSET_WIDTHS = [768, 1024, 1280] as const
type HeroEventAssetWidth = (typeof HERO_EVENT_ASSET_WIDTHS)[number]

const DEFAULT_HERO_EVENT_ASSET_WIDTH: HeroEventAssetWidth = 1024

const createSequence = (slug: string): ParticipantSequenceConfig => ({
  poster: `/images/participants/${slug}/poster.webp`,
  manifest: `/sequences/participants/${slug}/manifest.json`,
})

const createHeroPosterPath = (slug: string): string => `/images/participants/${slug}/poster.webp`
const createSelectorPosterPath = (slug: string): string =>
  `/images/participants/${slug}/poster-thumb.avif`

const createHeroEventAssetPath = (
  slug: string,
  assetKind: 'base' | 'gear',
  width: HeroEventAssetWidth = DEFAULT_HERO_EVENT_ASSET_WIDTH,
): string => `/images/event/${slug}/${assetKind}-${width}.avif`

const createHeroEventSrcSet = (slug: string, assetKind: 'base' | 'gear'): string =>
  HERO_EVENT_ASSET_WIDTHS.map(
    (width) => `${createHeroEventAssetPath(slug, assetKind, width)} ${width}w`,
  ).join(', ')

const createHeroBasePath = (slug: string): string => createHeroEventAssetPath(slug, 'base')

const createHeroGearPath = (slug: string): string => createHeroEventAssetPath(slug, 'gear')

const createBaseSrcSet = (slug: string): string => createHeroEventSrcSet(slug, 'base')

const createGearSrcSet = (slug: string): string => createHeroEventSrcSet(slug, 'gear')

const assertUniqueValues = (
  values: readonly string[],
  errorFactory: (duplicates: string[]) => string,
): void => {
  const counts: Record<string, number> = {}

  values.forEach((value) => {
    counts[value] = (counts[value] ?? 0) + 1
  })

  const duplicates = Object.keys(counts)
    .filter((value) => (counts[value] ?? 0) > 1)
    .sort((a, b) => a.localeCompare(b))

  if (duplicates.length > 0) {
    throw new Error(errorFactory(duplicates))
  }
}

const validateParticipantsCollection = (records: readonly ParticipantRecord[]): void => {
  if (records.length === 0) {
    throw new Error('[participants.ts] Participants collection cannot be empty.')
  }

  assertUniqueValues(
    records.map((participant) => participant.id),
    (duplicates) =>
      `[participants.ts] Duplicate participant ids detected: ${duplicates.join(', ')}.`,
  )

  assertUniqueValues(
    records.map((participant) => participant.slug),
    (duplicates) =>
      `[participants.ts] Duplicate participant slugs detected: ${duplicates.join(', ')}.`,
  )

  records.forEach((participant) => {
    if (!participant.id) throw new Error('[participants.ts] Participant id cannot be empty.')
    if (!participant.slug)
      throw new Error(`[participants.ts] Participant "${participant.id}" has an empty slug.`)
    if (!participant.matchupId)
      throw new Error(`[participants.ts] Participant "${participant.id}" has an empty matchupId.`)
    if (!participant.fightLabel)
      throw new Error(`[participants.ts] Participant "${participant.id}" has an empty fightLabel.`)
    if (!participant.boutTier)
      throw new Error(`[participants.ts] Participant "${participant.id}" has an empty boutTier.`)
    if (!participant.sequence.poster || !participant.sequence.manifest) {
      throw new Error(
        `[participants.ts] Participant "${participant.id}" has an invalid sequence configuration.`,
      )
    }
  })
}

const validateParticipantsByFight = (
  groupedParticipants: Readonly<Record<string, ParticipantRecord[]>>,
): void => {
  Object.entries(groupedParticipants).forEach(([matchupId, group]) => {
    if (group.length !== 2) {
      throw new Error(
        `[participants.ts] Matchup "${matchupId}" must contain exactly 2 participants, received ${group.length}.`,
      )
    }

    const [firstParticipant, secondParticipant] = group

    if (!firstParticipant || !secondParticipant) {
      throw new Error(
        `[participants.ts] Matchup "${matchupId}" is incomplete after grouping participants.`,
      )
    }

    if (firstParticipant.fightOrder !== secondParticipant.fightOrder) {
      throw new Error(
        `[participants.ts] Matchup "${matchupId}" participants do not share the same fightOrder.`,
      )
    }

    if (firstParticipant.fightLabel !== secondParticipant.fightLabel) {
      throw new Error(
        `[participants.ts] Matchup "${matchupId}" participants do not share the same fightLabel.`,
      )
    }

    if (firstParticipant.boutTier !== secondParticipant.boutTier) {
      throw new Error(
        `[participants.ts] Matchup "${matchupId}" participants do not share the same boutTier.`,
      )
    }
  })
}

const validateHeroPairMap = (
  pairs: Readonly<Record<string, readonly [string, string]>>,
  groupedParticipants: Readonly<Record<string, ParticipantRecord[]>>,
): void => {
  const participantMatchupIds = Object.keys(groupedParticipants).sort((a, b) => a.localeCompare(b))
  const pairMatchupIds = Object.keys(pairs).sort((a, b) => a.localeCompare(b))

  if (participantMatchupIds.length !== pairMatchupIds.length) {
    throw new Error(`[participants.ts] heroOrderedPairByMatchupId size mismatch.`)
  }

  participantMatchupIds.forEach((matchupId) => {
    if (!pairs[matchupId]) {
      throw new Error(
        `[participants.ts] Missing heroOrderedPairByMatchupId entry for matchup "${matchupId}".`,
      )
    }
  })
}

export const participants: ParticipantRecord[] = [
  {
    id: 'edu-salseo',
    slug: 'edu-salseo',
    name: 'Edu Salseo',
    opponent: 'Gastón Gol',
    matchupId: 'edu-salseo-vs-gaston-gol',
    fightOrder: 1,
    fightLabel: 'Edu Salseo vs Gastón Gol',
    boutTier: 'Combate 01',
    descriptor: 'Periodismo deportivo',
    sourceNote: 'Llega al ring dispuesto a convertir foco mediático en combate real.',
    accent: '#d6b06e',
    sequence: createSequence('edu-salseo'),
  },
  {
    id: 'gaston-gol',
    slug: 'gaston-gol',
    name: 'Gastón Gol',
    opponent: 'Edu Salseo',
    matchupId: 'edu-salseo-vs-gaston-gol',
    fightOrder: 1,
    fightLabel: 'Edu Salseo vs Gastón Gol',
    boutTier: 'Combate 01',
    descriptor: 'Periodismo deportivo',
    sourceNote: 'Cambia la cobertura por los guantes en un cruce con tensión periodística.',
    accent: '#6fb5ff',
    sequence: createSequence('gaston-gol'),
  },
  {
    id: 'fabi-sevilla',
    slug: 'fabi-sevilla',
    name: 'Fabi Sevilla',
    opponent: 'La Parse',
    matchupId: 'fabi-sevilla-vs-la-parse',
    fightOrder: 2,
    fightLabel: 'Fabi Sevilla vs La Parse',
    boutTier: 'Combate 02',
    descriptor: 'Influencer española',
    sourceNote: 'Quiere dejar huella en uno de los duelos con más conversación previa.',
    accent: '#f5a3c7',
    sequence: createSequence('fabi-sevilla'),
  },
  {
    id: 'la-parse',
    slug: 'la-parse',
    name: 'La Parse',
    opponent: 'Fabi Sevilla',
    matchupId: 'fabi-sevilla-vs-la-parse',
    fightOrder: 2,
    fightLabel: 'Fabi Sevilla vs La Parse',
    boutTier: 'Combate 02',
    descriptor: 'Queens League',
    sourceNote: 'Entra al show con presencia fuerte y ambición de robarse el foco.',
    accent: '#83c9a7',
    sequence: createSequence('la-parse'),
  },
  {
    id: 'clarsss',
    slug: 'clarsss',
    name: 'Clarsss',
    opponent: 'Nati MX',
    matchupId: 'clarsss-vs-nati-mx',
    fightOrder: 3,
    fightLabel: 'Clarsss vs Nati MX',
    boutTier: 'Combate 03',
    descriptor: 'Creadora de contenido',
    sourceNote: 'Busca convertir la expectación en una actuación con personalidad propia.',
    accent: '#c8a7ff',
    sequence: createSequence('clarsss'),
  },
  {
    id: 'nati-mx',
    slug: 'nati-mx',
    name: 'Nati MX',
    opponent: 'Clarsss',
    matchupId: 'clarsss-vs-nati-mx',
    fightOrder: 3,
    fightLabel: 'Clarsss vs Nati MX',
    boutTier: 'Combate 03',
    descriptor: 'Streamer',
    sourceNote: 'Llega con energía competitiva y ganas de responder al ruido del cruce.',
    accent: '#84b8ff',
    sequence: createSequence('nati-mx'),
  },
  {
    id: 'kid-killah',
    slug: 'kid-killah',
    name: 'Kid Killah',
    opponent: 'Kidd K.O.',
    matchupId: 'kid-killah-vs-kidd-k-o',
    fightOrder: 4,
    fightLabel: 'Kid Killah vs Kidd K.O.',
    boutTier: 'Combate 04',
    descriptor: 'Cantante',
    sourceNote: 'Da el salto al ring en uno de los enfrentamientos más virales del cartel.',
    accent: '#7ec8ff',
    sequence: createSequence('kid-killah'),
  },
  {
    id: 'kidd-k-o',
    slug: 'kidd-k-o',
    name: 'Kidd K.O.',
    opponent: 'Kid Killah',
    matchupId: 'kid-killah-vs-kidd-k-o',
    fightOrder: 4,
    fightLabel: 'Kid Killah vs Kidd K.O.',
    boutTier: 'Combate 04',
    descriptor: 'Artista',
    sourceNote: 'Apuesta por el espectáculo en un duelo de alto perfil mediático.',
    accent: '#f0ab72',
    sequence: createSequence('kidd-k-o'),
  },
  {
    id: 'alondra',
    slug: 'alondra',
    name: 'Alondra',
    opponent: 'Angie Veloz',
    matchupId: 'alondra-vs-angie-veloz',
    fightOrder: 5,
    fightLabel: 'Alondra vs Angie Veloz',
    boutTier: 'Combate 05',
    descriptor: 'Creadora de contenido',
    sourceNote: 'Quiere aprovechar el escaparate para firmar una de las sorpresas de la noche.',
    accent: '#f4b0d8',
    sequence: createSequence('alondra'),
  },
  {
    id: 'angie-veloz',
    slug: 'angie-veloz',
    name: 'Angie Veloz',
    opponent: 'Alondra',
    matchupId: 'alondra-vs-angie-veloz',
    fightOrder: 5,
    fightLabel: 'Alondra vs Angie Veloz',
    boutTier: 'Combate 05',
    descriptor: 'Creadora de contenido',
    sourceNote: 'Llega con hambre de foco y narrativa clara de revelación.',
    accent: '#9ed8ff',
    sequence: createSequence('angie-veloz'),
  },
  {
    id: 'el-trojano',
    slug: 'el-trojano',
    name: 'El Trojano',
    opponent: 'Gero Aires',
    matchupId: 'el-trojano-vs-gero-aires',
    fightOrder: 6,
    fightLabel: 'El Trojano vs Gero Aires',
    boutTier: 'Combate 06',
    descriptor: 'Veterano del ring',
    sourceNote: 'Regresa con cuentas pendientes y experiencia de sobra sobre este escenario.',
    accent: '#d0b26f',
    sequence: createSequence('el-trojano'),
  },
  {
    id: 'gero-aires',
    slug: 'gero-aires',
    name: 'Gero Aires',
    opponent: 'El Trojano',
    matchupId: 'el-trojano-vs-gero-aires',
    fightOrder: 6,
    fightLabel: 'El Trojano vs Gero Aires',
    boutTier: 'Combate 06',
    descriptor: 'Creador argentino',
    sourceNote: 'Provocó el cruce y ahora tiene que sostenerlo cuando suene la campana.',
    accent: '#7fb7ff',
    sequence: createSequence('gero-aires'),
  },
  {
    id: 'streams',
    slug: 'streams',
    name: 'Streams',
    opponent: 'Riri',
    matchupId: 'streams-vs-riri',
    fightOrder: 7,
    fightLabel: 'Streams vs Riri',
    boutTier: 'Main event femenino',
    descriptor: 'Repite en el evento',
    sourceNote: 'Vuelve a escena dispuesta a adueñarse de uno de los grandes focos del show.',
    accent: '#ff93be',
    sequence: createSequence('streams'),
  },
  {
    id: 'riri',
    slug: 'riri',
    name: 'Riri',
    opponent: 'Streams',
    matchupId: 'streams-vs-riri',
    fightOrder: 7,
    fightLabel: 'Streams vs Riri',
    boutTier: 'Main event femenino',
    descriptor: 'Repite en el evento',
    sourceNote: 'Retoma el reto con la espina de demostrarlo esta vez.',
    accent: '#ffc370',
    sequence: createSequence('riri'),
  },
  {
    id: 'marta-dias',
    slug: 'marta-dias',
    name: 'Marta Días',
    opponent: 'Tati Kaos',
    matchupId: 'marta-dias-vs-tati-kaos',
    fightOrder: 8,
    fightLabel: 'Marta Días vs Tati Kaos',
    boutTier: 'Cartelera principal',
    descriptor: 'Influencer',
    sourceNote: 'Encuentra por fin su oportunidad para subirse a la cartelera.',
    accent: '#f8a4c9',
    sequence: createSequence('marta-dias'),
  },
  {
    id: 'tati-kaos',
    slug: 'tati-kaos',
    name: 'Tati Kaos',
    opponent: 'Marta Días',
    matchupId: 'marta-dias-vs-tati-kaos',
    fightOrder: 8,
    fightLabel: 'Marta Días vs Tati Kaos',
    boutTier: 'Cartelera principal',
    descriptor: 'Influencer',
    sourceNote: 'Convierte la espera en una ocasión real para debutar a lo grande.',
    accent: '#8fbcff',
    sequence: createSequence('tati-kaos'),
  },
  {
    id: 'yosoyflex',
    slug: 'yosoyflex',
    name: 'YoSoyFlex',
    opponent: 'Fernan Flow',
    matchupId: 'yosoyflex-vs-fernan-flow',
    fightOrder: 9,
    fightLabel: 'YoSoyFlex vs Fernan Flow',
    boutTier: 'Main event',
    descriptor: 'Repite en La Zurrada',
    sourceNote: 'Quiere consolidarse en el foco estelar con una pelea de máxima exposición.',
    accent: '#c6a66e',
    sequence: createSequence('yosoyflex'),
  },
  {
    id: 'fernan-flow',
    slug: 'fernan-flow',
    name: 'Fernan Flow',
    opponent: 'YoSoyFlex',
    matchupId: 'yosoyflex-vs-fernan-flow',
    fightOrder: 9,
    fightLabel: 'YoSoyFlex vs Fernan Flow',
    boutTier: 'Main event',
    descriptor: 'Repite en La Zurrada',
    sourceNote: 'Acepta el desafío después del ruido generado por su rival.',
    accent: '#95d0a6',
    sequence: createSequence('fernan-flow'),
  },
  {
    id: 'killojuan',
    slug: 'killojuan',
    name: 'KilloJuan',
    opponent: 'El Grefus',
    matchupId: 'killojuan-vs-elgrefus',
    fightOrder: 10,
    fightLabel: 'KilloJuan vs El Grefus',
    boutTier: 'Main event',
    descriptor: 'Streamer',
    sourceNote: 'Aporta el factor sorpresa a una de las peleas más esperadas del evento.',
    accent: '#8ea7ff',
    sequence: createSequence('killojuan'),
  },
  {
    id: 'elgrefus',
    slug: 'elgrefus',
    name: 'El Grefus',
    opponent: 'KilloJuan',
    matchupId: 'killojuan-vs-elgrefus',
    fightOrder: 10,
    fightLabel: 'KilloJuan vs El Grefus',
    boutTier: 'Main event',
    descriptor: 'Con experiencia previa',
    sourceNote: 'Llega con bagaje previo y la presión mediática de quien ya conoce el escenario.',
    accent: '#c8a96c',
    sequence: createSequence('elgrefus'),
  },
]

validateParticipantsCollection(participants)

const participantsByFight = participants.reduce<Record<string, ParticipantRecord[]>>(
  (accumulator, participant) => {
    const group = accumulator[participant.matchupId] ?? []
    group.push(participant)
    accumulator[participant.matchupId] = group
    return accumulator
  },
  {},
)

validateParticipantsByFight(participantsByFight)

const participantsById = participants.reduce<Record<string, ParticipantRecord>>(
  (accumulator, participant) => {
    accumulator[participant.id] = participant
    return accumulator
  },
  {},
)

export const defaultHeroMatchupId = 'killojuan-vs-elgrefus'

const heroOrderedPairByMatchupId: Record<string, readonly [string, string]> = {
  'edu-salseo-vs-gaston-gol': ['edu-salseo', 'gaston-gol'],
  'fabi-sevilla-vs-la-parse': ['fabi-sevilla', 'la-parse'],
  'clarsss-vs-nati-mx': ['clarsss', 'nati-mx'],
  'kid-killah-vs-kidd-k-o': ['kid-killah', 'kidd-k-o'],
  'alondra-vs-angie-veloz': ['alondra', 'angie-veloz'],
  'el-trojano-vs-gero-aires': ['el-trojano', 'gero-aires'],
  'streams-vs-riri': ['streams', 'riri'],
  'marta-dias-vs-tati-kaos': ['marta-dias', 'tati-kaos'],
  'yosoyflex-vs-fernan-flow': ['yosoyflex', 'fernan-flow'],
  'killojuan-vs-elgrefus': ['elgrefus', 'killojuan'],
}

validateHeroPairMap(heroOrderedPairByMatchupId, participantsByFight)

const createHeroRenderable = (participant: ParticipantRecord): HeroFighterRenderable => {
  return {
    participantId: participant.id,
    slug: participant.slug,
    name: participant.name,
    accent: participant.accent,
    posterImage: createHeroPosterPath(participant.slug),
    selectorPoster: createSelectorPosterPath(participant.slug),
    baseImage: createHeroBasePath(participant.slug),
    baseImageSrcSet: createBaseSrcSet(participant.slug),
    gearImage: createHeroGearPath(participant.slug),
    gearImageSrcSet: createGearSrcSet(participant.slug),
    renderMode: 'main-event',
    revealAngle: DEFAULT_HERO_REVEAL.revealAngle,
    revealCore: DEFAULT_HERO_REVEAL.revealCore,
    revealSoft: DEFAULT_HERO_REVEAL.revealSoft,
    revealDelay: DEFAULT_HERO_REVEAL.revealDelay,
  }
}

const heroRenderableByParticipantId = participants.reduce<Record<string, HeroFighterRenderable>>(
  (accumulator, participant) => {
    accumulator[participant.id] = createHeroRenderable(participant)
    return accumulator
  },
  {},
)

const heroMatchupDefinitions: HeroMatchupDefinition[] = Object.entries(heroOrderedPairByMatchupId)
  .map(([matchupId, [topParticipantId, bottomParticipantId]]) => {
    const topParticipant = participantsById[topParticipantId]
    const bottomParticipant = participantsById[bottomParticipantId]

    if (!topParticipant || !bottomParticipant) {
      throw new Error(
        `[participants.ts] Invalid hero matchup definition "${matchupId}": participant not found.`,
      )
    }

    return {
      matchupId,
      fightOrder: topParticipant.fightOrder,
      topParticipantId,
      bottomParticipantId,
      leftParticipantId: topParticipantId,
      rightParticipantId: bottomParticipantId,
    }
  })
  .sort((a, b) => a.fightOrder - b.fightOrder)

export const heroMatchups: HeroMatchupRecord[] = heroMatchupDefinitions.map((definition) => {
  const topParticipant = participantsById[definition.topParticipantId]
  const bottomParticipant = participantsById[definition.bottomParticipantId]

  if (!topParticipant || !bottomParticipant) {
    throw new Error(
      `[participants.ts] Invalid hero matchup "${definition.matchupId}": missing participant data.`,
    )
  }

  const topRenderable = heroRenderableByParticipantId[definition.topParticipantId]
  const bottomRenderable = heroRenderableByParticipantId[definition.bottomParticipantId]
  const leftRenderable = heroRenderableByParticipantId[definition.leftParticipantId]
  const rightRenderable = heroRenderableByParticipantId[definition.rightParticipantId]

  if (!topRenderable || !bottomRenderable || !leftRenderable || !rightRenderable) {
    throw new Error(
      `[participants.ts] Invalid hero matchup "${definition.matchupId}": missing renderable participant data.`,
    )
  }

  return {
    matchupId: definition.matchupId,
    fightOrder: definition.fightOrder,
    fightLabel: topParticipant.fightLabel,
    boutTier: topParticipant.boutTier,
    topParticipantId: definition.topParticipantId,
    bottomParticipantId: definition.bottomParticipantId,
    leftParticipantId: definition.leftParticipantId,
    rightParticipantId: definition.rightParticipantId,
    participantIds: [definition.topParticipantId, definition.bottomParticipantId] as const,
    top: topRenderable,
    bottom: bottomRenderable,
    left: leftRenderable,
    right: rightRenderable,
  }
})

const heroMatchupsById = heroMatchups.reduce<Record<string, HeroMatchupRecord>>(
  (accumulator, matchup) => {
    accumulator[matchup.matchupId] = matchup
    return accumulator
  },
  {},
)

if (!heroMatchupsById[defaultHeroMatchupId]) {
  throw new Error(
    `[participants.ts] defaultHeroMatchupId "${defaultHeroMatchupId}" does not exist in heroMatchupsById.`,
  )
}
