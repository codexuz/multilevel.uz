import incomingUrl from '~/assets/sounds/call.mp3'
import connectedUrl from '~/assets/sounds/connected.mp3'
import noConnectionUrl from '~/assets/sounds/no_connection.mp3'
import connectingUrl from '~/assets/sounds/voip_connecting.mp3'
import endUrl from '~/assets/sounds/voip_end.mp3'
import failedUrl from '~/assets/sounds/voip_failed.mp3'
import allowTalkUrl from '~/assets/sounds/voip_onallowtalk.mp3'
import ringbackUrl from '~/assets/sounds/voip_ringback.mp3'

type SoundName = 'incoming' | 'outgoing' | 'connecting' | 'connected' | 'ended' | 'failed' | 'noConnection' | 'allowTalk'

const SOUND_URLS: Record<SoundName, string> = {
  incoming: incomingUrl,
  outgoing: ringbackUrl,
  connecting: connectingUrl,
  connected: connectedUrl,
  ended: endUrl,
  failed: failedUrl,
  noConnection: noConnectionUrl,
  allowTalk: allowTalkUrl
}

const LOOPING = new Set<SoundName>(['incoming', 'outgoing'])
const players = new Map<SoundName, HTMLAudioElement>()

function getPlayer(name: SoundName) {
  let player = players.get(name)
  if (!player) {
    player = new Audio(SOUND_URLS[name])
    player.preload = 'auto'
    player.loop = LOOPING.has(name)
    players.set(name, player)
  }
  return player
}

function play(name: SoundName) {
  if (!import.meta.client) return
  const player = getPlayer(name)
  player.currentTime = 0
  player.play().catch(() => {})
}

function stop(name: SoundName) {
  const player = players.get(name)
  if (!player) return
  player.pause()
  player.currentTime = 0
}

function stopLoops() {
  for (const name of LOOPING) stop(name)
}

export function useCallSounds() {
  return {
    play,
    stop,
    stopLoops,
    stopAll() {
      for (const name of players.keys()) stop(name)
    }
  }
}
