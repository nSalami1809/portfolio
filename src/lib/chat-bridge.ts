// Lightweight cross-component bridge so any page can open the floating chat
// widget with a pre-filled message, without lifting its state into a context.
const OPEN_CHAT_EVENT = 'portfolio:open-chat'

export function openChatWithMessage(text: string) {
  window.dispatchEvent(new CustomEvent<{ text: string }>(OPEN_CHAT_EVENT, { detail: { text } }))
}

export function onOpenChatRequest(handler: (text: string) => void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ text: string }>).detail
    if (detail?.text) handler(detail.text)
  }
  window.addEventListener(OPEN_CHAT_EVENT, listener)
  return () => window.removeEventListener(OPEN_CHAT_EVENT, listener)
}
