// Minimal RFC 5545 (.ics) builder — no dependency needed, the format is a
// handful of plain text lines. Attached to booking confirmation emails so
// the meeting drops straight into whatever calendar app the recipient uses.
function foldEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function buildICS(event: {
  uid: string
  start: Date
  end: Date
  summary: string
  description?: string
  organizerEmail: string
  attendeeEmail: string
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Portfolio NS//Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${foldEscape(event.summary)}`,
    event.description ? `DESCRIPTION:${foldEscape(event.description)}` : '',
    `ORGANIZER:mailto:${event.organizerEmail}`,
    `ATTENDEE:mailto:${event.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n')
}
