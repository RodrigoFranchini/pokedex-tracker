import { useCallback, useMemo, useState } from 'react'

import type { CaughtFilter, DexEntry, VersionFilter } from '../types'

/**
 * Accent-insensitive so that searching "nidoran" finds "Nidoran♀" and typing
 * without diacritics never hides a match.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function useFilters(entries: readonly DexEntry[], caught: Set<number>) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CaughtFilter>('all')
  const [version, setVersion] = useState<VersionFilter>('all')
  const [types, setTypes] = useState<Set<string>>(new Set())

  const toggleType = useCallback((type: string) => {
    setTypes((previous) => {
      const next = new Set(previous)
      if (!next.delete(type)) next.add(type)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setStatus('all')
    setVersion('all')
    setTypes(new Set())
  }, [])

  const isFiltered =
    query !== '' || status !== 'all' || version !== 'all' || types.size > 0

  const visible = useMemo(() => {
    const needle = normalise(query.trim())

    return entries.filter((entry) => {
      if (status === 'caught' && !caught.has(entry.nationalNumber)) return false
      if (status === 'missing' && caught.has(entry.nationalNumber)) return false

      // Picking a version narrows to that version's exclusives only — the
      // shared majority of the dex drops out, because the question being asked
      // is "what is different about this game", not "what can I catch".
      if (version !== 'all' && entry.versionExclusive !== version) return false

      // Types are AND: picking Fairy and Fighting means "show me Pokemon that
      // are *both*", not "either". Narrowing is what a filter is for, and OR
      // made adding a second type widen the results instead of tightening them.
      //
      // A Pokemon has at most two types, so selecting three can never match.
      // The empty state says so rather than leaving it a mystery.
      for (const type of types) {
        if (!entry.types.includes(type)) return false
      }

      if (needle === '') return true
      return (
        normalise(entry.name).includes(needle) ||
        String(entry.dexNumber).includes(needle)
      )
    })
  }, [entries, caught, query, status, version, types])

  return {
    query,
    setQuery,
    status,
    setStatus,
    version,
    setVersion,
    types,
    toggleType,
    clear,
    isFiltered,
    visible,
  }
}
