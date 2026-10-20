// Voice dictation in the message box. The browser's own speech recognition does the listening
// (it is the browser, not this site, that sends the audio to its speech service); this only
// decides how the recognised words are added to what is already typed.

/** Adds a dictated sentence after the current text, with one space between, never doubled. */
export function appendDictation(current: string, transcript: string): string {
  const heard = transcript.replace(/\s+/g, ' ').trim()
  if (!heard) return current
  const base = current.replace(/\s+$/, '')
  return base ? `${base} ${heard}` : heard
}

/** The words of a recognition result, whatever the browser's list type. */
export function transcriptOf(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  return Array.from(results).map((r) => r[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim()
}
