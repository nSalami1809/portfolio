// Personal data is removed from visitors' chatbot conversations BEFORE they go to
// the model. On the free Gemini tier Google may use what it receives to improve
// its products, so a visitor's email, phone number or private quote code must
// never be part of what is sent. Pure, and deliberately aggressive: a false
// positive only hides a harmless word from the analysis.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g
// A run of 8+ digits that may contain spaces, dots, dashes or parentheses, with an
// optional leading +.
const PHONE = /(?<![\w])\+?\d[\d\s().-]{6,}\d(?![\w])/g
const QUOTE_NUMBER = /\b(?:DEV|AVE|FAC|REC)-\d{4}-\d{2,}\b/gi
// "code d'accès : AB12CD", "access code XK9P2M", "code de suivi ABC123" …
const CODE_AFTER_LABEL = /((?:code|access code|tracking code)[^\n]{0,24}?[:\s]\s*)([A-Z0-9]{5,10})\b/gi
const URL = /\bhttps?:\/\/[^\s)>\]]+/gi
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g

export function redactPersonalData(text: string): string {
  return text
    .replace(URL, (u) => (/[?#]/.test(u) ? '[lien]' : u))
    .replace(EMAIL, '[email]')
    .replace(IBAN, '[iban]')
    .replace(QUOTE_NUMBER, '[devis]')
    .replace(CODE_AFTER_LABEL, (_m, label: string) => `${label}[code]`)
    .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[téléphone]' : m))
}
