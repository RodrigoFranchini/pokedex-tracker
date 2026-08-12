# 0007 — No component library, state manager or CSS framework

**Status:** Accepted
**Date:** 2026-08

## Context

The app is one screen: a list of 400 rows, a toolbar, a meter, a dock on
phones, and one dialog. Its state is a set of caught numbers, some filter
values, a cursor position, and who is signed in.

The reflex is to reach for a component library, a state manager and a CSS
framework before writing anything. This is also a portfolio project, where what
is being demonstrated is judgement about the platform, not the ability to wire
libraries together.

## Decision

**Plain React, plain CSS. No component library, no state manager, no CSS
framework.**

- Styling is **CSS Modules plus custom properties**. Theming is
  `<html data-theme>` and a token file; nothing below `useTheme` knows a theme
  exists.
- State is `useState` and `useEffect` in purpose-built hooks — `useProgress`,
  `useAuth`, `useFilters`, `useCursor`, `useSound`, `useTheme`. There is no
  global store, because there is no state that needs one.
- Data fetching is `fetch` behind `lib/api.ts`. No query library.
- Accessibility is built directly: a roving tabindex for the list, a native
  `<dialog>` for the modal, real buttons everywhere.

Dependencies are React, two fonts, and build tooling.

## Consequences

**What it buys**

- The bundle is small and the app starts instantly, which is what makes
  [0001](0001-local-first.md) feel the way it should.
- Nothing is fought. A 400-row keyboard-navigable list with a roving tabindex is
  straightforward to write and awkward to retrofit into someone else's row
  component.
- Upgrades are a React version, not a dependency graph. Nothing here rots on
  someone else's schedule.
- The platform gets used properly: `<dialog>` for the modal, `visualViewport`
  for the mobile dock, `pagehide` and `keepalive` for the flush, CSS custom
  properties for theming.

**What it costs**

- Common components are written by hand — the segmented control, the type
  dropdown, the meter. Each is small; together they are real work.
- Accessibility is entirely on us. The roving tabindex, focus management and
  the dialog's behaviour are hand-built and hand-verified.
- Some of the hardest bugs in the project are platform details a library would
  have absorbed: iOS zooming on sub-16px fields, `position: fixed` not meaning
  the bottom of the screen, focus and blur fighting each other in the dock.
  These are catalogued in `AGENTS.md`, which is the price of this decision made
  visible.

**When to revisit**

If a second screen with genuinely shared server state appears, revisit the data
layer specifically. The absence of a component library is not the thing to
change first.
