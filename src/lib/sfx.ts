let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      ctx = new AC()
    }
    return ctx
  } catch {
    return null
  }
}

function tone(
  audio: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gainPeak: number,
) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

/** 짧은 승리 징글 */
export function playWinSound() {
  const audio = getCtx()
  if (!audio) return
  void audio.resume()
  const t = audio.currentTime
  tone(audio, 523.25, t, 0.12, 'triangle', 0.08)
  tone(audio, 659.25, t + 0.1, 0.12, 'triangle', 0.08)
  tone(audio, 783.99, t + 0.2, 0.18, 'triangle', 0.1)
}

/** 가벼운 실패음 */
export function playLoseSound() {
  const audio = getCtx()
  if (!audio) return
  void audio.resume()
  const t = audio.currentTime
  tone(audio, 311.13, t, 0.16, 'sine', 0.06)
  tone(audio, 233.08, t + 0.12, 0.22, 'sine', 0.05)
}
