import { useCallback, useEffect, useState } from 'react'

import { loadTheme, saveTheme } from '../storage/progress'
import type { Theme } from '../types'

/**
 * Which game's colour the page wears.
 *
 * The value lives on `<html data-theme>` rather than in React-rendered styles,
 * so the ground is set once and every component picks it up through the same
 * tokens it already uses. Nothing below this hook knows a theme exists.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    // Keeps the mobile browser chrome in step with the page, which is the one
    // piece of ground colour CSS cannot reach.
    const meta = document.querySelector('meta[name="theme-color"]')
    const ground = getComputedStyle(document.documentElement)
      .getPropertyValue('--ground')
      .trim()
    if (meta && ground) meta.setAttribute('content', ground)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    saveTheme(next)
  }, [])

  return { theme, setTheme }
}
