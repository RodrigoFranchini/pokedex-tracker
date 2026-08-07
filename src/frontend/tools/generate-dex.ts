/**
 * Generates the Paldea dex data file from PokeAPI.
 *
 * Run by hand, never during a build:
 *   npm run generate:dex
 *
 * The Paldea list was finalised at the game's release and does not change, so
 * this output is committed and the app never talks to PokeAPI at runtime.
 * See src/frontend/README.md.
 */

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const API = 'https://pokeapi.co/api/v2'
const PALDEA_POKEDEX_ID = 31
const OUTPUT = resolve(import.meta.dirname, '../src/data/paldea.ts')

/** Polite to PokeAPI, and fast enough for 800 requests. */
const CONCURRENCY = 8

/**
 * A species' *default* variety is not always the one that appears in Paldea:
 * default Wooper is Water/Ground (Johto) while Paldean Wooper is Poison/Ground,
 * and default Tauros is Normal while Paldean Tauros is Fighting. Preferring a
 * regional variety when one exists fixes both. See src/frontend/README.md.
 */
const REGIONAL_VARIETY_MARKER = '-paldea'

/**
 * Version exclusives, by national dex number. Hand-curated and reviewed.
 *
 * PokeAPI has no Scarlet/Violet availability data whatsoever — Lechonk, which
 * exists only in these games, returns zero encounter records; Larvitar's stop
 * at Sword/Shield; and Armarouge, a Scarlet exclusive, carries flavour text
 * under both versions because the *dex entry* exists in both. So this is the
 * one field that cannot be derived, and it lives here rather than in the
 * generated file so that regenerating preserves it instead of wiping it.
 *
 * Scope: standard wild version-exclusivity in the base game. Tera Raid and
 * mass-outbreak availability is deliberately ignored — the question this
 * answers is "can I find this in my copy", not "has it ever been obtainable".
 *
 * Anything absent is 'both', which is the safe default: a species missed here
 * reads as normally catchable rather than falsely telling you to go trade.
 */
const SCARLET_EXCLUSIVES = [
  246, 247, 248, // Larvitar line
  425, 426, // Drifloon line
  434, 435, // Stunky line
  633, 634, 635, // Deino line
  690, 691, // Skrelp line
  765, // Oranguru
  874, // Stonjourner
  936, // Armarouge
  984, 985, 986, 987, 988, 989, 1005, // past paradox
  1007, // Koraidon
]

const VIOLET_EXCLUSIVES = [
  200, 429, // Misdreavus line
  316, 317, // Gulpin line
  371, 372, 373, // Bagon line
  692, 693, // Clauncher line
  766, // Passimian
  875, // Eiscue
  885, 886, 887, // Dreepy line
  937, // Ceruledge
  990, 991, 992, 993, 994, 995, 1006, // future paradox
  1008, // Miraidon
]

const VERSION_EXCLUSIVES = new Map<number, VersionExclusive>([
  ...SCARLET_EXCLUSIVES.map((id) => [id, 'scarlet'] as const),
  ...VIOLET_EXCLUSIVES.map((id) => [id, 'violet'] as const),
])

type PokedexResponse = {
  pokemon_entries: {
    entry_number: number
    pokemon_species: { name: string; url: string }
  }[]
}

type SpeciesResponse = {
  id: number
  name: string
  names: { name: string; language: { name: string } }[]
  varieties: { is_default: boolean; pokemon: { name: string; url: string } }[]
}

type PokemonResponse = {
  id: number
  types: { slot: number; type: { name: string } }[]
}

type VersionExclusive = 'both' | 'scarlet' | 'violet'

export type DexEntry = {
  dexNumber: number
  nationalNumber: number
  name: string
  slug: string
  spriteId: number
  types: string[]
  versionExclusive: VersionExclusive
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url)
  if (response.ok) return response.json() as Promise<T>

  // PokeAPI is occasionally flaky under sustained load; a short backoff is
  // enough. Anything past the third try is a real failure worth surfacing.
  if (attempt < 3) {
    await new Promise((r) => setTimeout(r, attempt * 500))
    return getJson<T>(url, attempt + 1)
  }
  throw new Error(`${response.status} ${response.statusText} for ${url}`)
}

/** Runs `worker` over `items`, at most CONCURRENCY at a time, preserving order. */
async function mapWithLimit<In, Out>(
  items: In[],
  worker: (item: In, index: number) => Promise<Out>,
): Promise<Out[]> {
  const results = new Array<Out>(items.length)
  let cursor = 0
  let done = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
      done++
      if (done % 50 === 0) process.stdout.write(`  ${done}/${items.length}\n`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, run))
  return results
}

function englishName(species: SpeciesResponse): string {
  const localised = species.names.find((n) => n.language.name === 'en')
  return localised?.name ?? species.name
}

type VarietyChoice = {
  url: string
  slug: string
  /** Set when the species has more than one variety, for the review log. */
  note?: string
}

function chooseVariety(species: SpeciesResponse): VarietyChoice {
  const { varieties } = species

  const regional = varieties.find((v) =>
    v.pokemon.name.includes(REGIONAL_VARIETY_MARKER),
  )
  if (regional) {
    return {
      url: regional.pokemon.url,
      slug: regional.pokemon.name,
      note: `regional form chosen: ${regional.pokemon.name}`,
    }
  }

  const fallback = varieties.find((v) => v.is_default) ?? varieties[0]
  return {
    url: fallback.pokemon.url,
    slug: fallback.pokemon.name,
    note:
      varieties.length > 1
        ? `${varieties.length} varieties, using default: ${fallback.pokemon.name}`
        : undefined,
  }
}

function serialise(entries: DexEntry[]): string {
  const rows = entries
    .map((e) => {
      const types = e.types.map((t) => `'${t}'`).join(', ')
      return `  { dexNumber: ${e.dexNumber}, nationalNumber: ${e.nationalNumber}, name: '${e.name.replace(/'/g, "\\'")}', slug: '${e.slug}', spriteId: ${e.spriteId}, types: [${types}], versionExclusive: '${e.versionExclusive}' },`
    })
    .join('\n')

  return `// Generated by tools/generate-dex.ts. Do not edit by hand.
// Source: ${API}/pokedex/${PALDEA_POKEDEX_ID}/ (Paldea, Pokemon Scarlet & Violet)
// Regenerate with: npm run generate:dex

import type { DexEntry } from '../types'

export const PALDEA_DEX: readonly DexEntry[] = [
${rows}
]
`
}

async function main(): Promise<void> {
  console.log('Fetching the Paldea dex...')
  const dex = await getJson<PokedexResponse>(
    `${API}/pokedex/${PALDEA_POKEDEX_ID}/`,
  )
  console.log(`  ${dex.pokemon_entries.length} entries`)

  console.log('Fetching species and types...')
  const notes: string[] = []

  const entries = await mapWithLimit(dex.pokemon_entries, async (entry) => {
    const species = await getJson<SpeciesResponse>(entry.pokemon_species.url)
    const variety = chooseVariety(species)
    const pokemon = await getJson<PokemonResponse>(variety.url)

    if (variety.note) {
      notes.push(`  #${entry.entry_number} ${species.name}: ${variety.note}`)
    }

    return {
      dexNumber: entry.entry_number,
      nationalNumber: species.id,
      name: englishName(species),
      slug: variety.slug,
      spriteId: pokemon.id,
      types: pokemon.types
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.type.name),
      versionExclusive: VERSION_EXCLUSIVES.get(species.id) ?? 'both',
    } satisfies DexEntry
  })

  entries.sort((a, b) => a.dexNumber - b.dexNumber)

  // A curated number that matches nothing would sit there silently doing
  // nothing, so a typo has to be loud.
  const inDex = new Set(entries.map((e) => e.nationalNumber))
  const orphans = [...VERSION_EXCLUSIVES.keys()].filter((id) => !inDex.has(id))
  if (orphans.length > 0) {
    throw new Error(
      `VERSION_EXCLUSIVES has national numbers that are not in this dex: ${orphans.join(', ')}`,
    )
  }

  await writeFile(OUTPUT, serialise(entries), 'utf8')
  console.log(`\nWrote ${entries.length} entries to ${OUTPUT}`)

  const counts = { scarlet: 0, violet: 0 }
  for (const entry of entries) {
    if (entry.versionExclusive !== 'both') counts[entry.versionExclusive]++
  }
  console.log(`Version exclusives: ${counts.scarlet} scarlet, ${counts.violet} violet`)

  if (notes.length > 0) {
    console.log(`\nSpecies with multiple varieties (${notes.length}) — review:`)
    console.log(notes.sort().join('\n'))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
