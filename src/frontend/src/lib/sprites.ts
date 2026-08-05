/**
 * The single place a sprite URL is built.
 *
 * The data file stores no image URLs — only `spriteId` — so switching to
 * bundled assets later (for offline use, or to drop the third-party
 * dependency) is a change to this one function. See prompts/context.md.
 *
 * Served through jsDelivr's mirror rather than raw.githubusercontent.com,
 * which is not a CDN and is not meant to serve production traffic.
 */
const SPRITE_CDN = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'

/** 96x96 pixel sprite. Rendered at 48px, an exact 2:1 downscale. */
export function spriteUrl(spriteId: number): string {
  return `${SPRITE_CDN}/${spriteId}.png`
}
