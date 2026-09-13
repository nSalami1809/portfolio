import { getMonthSlots } from '@/actions/bookings'
import CalendarView from './CalendarView'

// The slot computation behind getMonthSlots is itself cached for 60s and
// invalidated on any booking change, so this page can be regenerated on the
// same cadence as its siblings instead of rendered per request.
export const revalidate = 30

export default async function CalendarPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthSlots = await getMonthSlots(year, month).catch(() => ({}))

  return (
    <CalendarView
      initialYear={year}
      initialMonth={month}
      initialMonthSlots={monthSlots}
    />
  )
}
