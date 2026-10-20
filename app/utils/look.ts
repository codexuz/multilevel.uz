/**
 * The colour and illustration a thing wears, in the manner of SmallTalk2Me's course tiles: chosen
 * from its name so the same test always looks the same, and different tests look different.
 */
export const TILE_GRADIENTS = [
  'from-[#8f87ec] to-[#6a62d6]', // violet
  'from-[#4f5f8f] to-[#7484b6]', // slate blue
  'from-[#6e4a3d] to-[#a8735a]', // cocoa
  'from-[#2f7477] to-[#4fa3a0]', // teal
  'from-[#5870f5] to-[#8b9cff]', // indigo
  'from-[#9a4f7a] to-[#c87aa2]' // plum
]
const TILE_ART = ['books', 'headphones', 'rocket', 'tv', 'chat', 'trophy']

function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

export const tileGradient = (key: string) => TILE_GRADIENTS[hash(key) % TILE_GRADIENTS.length]!
export const tileArt = (key: string) => `/illustrations/${TILE_ART[hash(`${key}#art`) % TILE_ART.length]}.svg`

/** Each skill's illustration. */
export const SKILL_ART: Record<string, string> = {
  LISTENING: '/illustrations/headphones.svg',
  READING: '/illustrations/book.svg',
  WRITING: '/illustrations/writing.svg',
  SPEAKING: '/illustrations/microphone.svg'
}
