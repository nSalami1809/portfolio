// What the PUBLIC client tree needs from the portfolio — and nothing else.
//
// The root layout used to hand the whole portfolio (every project, every blog
// post body, every experience, the vision text…) to a client context, which
// serializes all of it into the HTML of every single page. The public client
// components only ever read the profile (chat widget, quote/contract views)
// — and DevisView, which now receives its offers as a prop from its own page.
// Everything the server components render is already in their own markup.
import type { PortfolioData } from '@/types'

// No defaultData import on purpose: this is also the client context's default,
// and pulling the sample data in would ship it to every visitor.
export const emptyPublicPortfolio: PortfolioData = {
  personal: { name: '', role: '', bio: '', email: '', location: '', photo: '' },
  socials: { linkedin: '', github: '', facebook: '', instagram: '' },
  projects: [],
  experiences: [],
  educations: [],
  skills: [],
  testimonials: [],
  settings: { accentColor: '', favicon: '', logo: '' },
  vision: { quote: '', philosophie: [], approche: [], valeurs: [] },
  blog: [],
  offers: [],
  availability: { weeklyHours: [], slotMinutes: 30, bufferMinutes: 0, bookingWindowDays: 30, blackoutDates: [] },
}

export function slimPublicPortfolio(data: PortfolioData): PortfolioData {
  const { business, ...personal } = data.personal
  return {
    ...emptyPublicPortfolio,
    socials: data.socials,
    settings: data.settings,
    personal: {
      ...personal,
      // Payment coordinates belong on invoices, not in every visitor's page.
      ...(business ? { business: { ...business, paymentDetails: '' } } : {}),
    },
  }
}
