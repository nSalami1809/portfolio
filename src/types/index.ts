export interface PersonalInfo {
  name: string
  role: string
  bio: string
  email: string
  location: string
  photo: string
  cvUrl?: string
  whatsapp?: string // international format, e.g. "+24177000000"
  signatureUrl?: string // drawn or imported signature, shown on signed devis/contrats
  business?: BusinessSettings // legal identity + commercial terms printed on devis/contrats/factures/CGV
}

// Everything the business documents (devis, contrat, facture, reçu, PV, CGV)
// say about *who* the provider is and *on which terms* they work. Every field
// is optional: an empty identity field is simply left off the documents, and
// an unset term falls back to DEFAULT_BUSINESS (src/lib/business.ts).
export interface BusinessSettings {
  legalStatus?: string          // e.g. "Entrepreneur individuel", "SARL"
  registrationNumber?: string   // registre du commerce (RCCM) or equivalent
  taxId?: string                // numéro d'identification fiscale (NIF)
  address?: string              // full postal address
  vatEnabled?: boolean          // false = provider not subject to VAT
  vatRate?: number              // % — used when vatEnabled
  vatExemptionMention?: string  // printed instead of the VAT line when not subject
  paymentMethods?: string       // e.g. "Virement bancaire, Airtel Money, Moov Money"
  paymentDetails?: string       // account / mobile-money numbers shown on invoices
  depositPercent?: number       // % due at signature
  depositRefundable?: boolean   // is the deposit refundable if the client cancels
  paymentDueDays?: number       // days to pay an invoice
  latePenaltyRate?: number      // % per month of delay
  deliveryDays?: number         // working days between kick-off and delivery
  includedRevisions?: number    // revision rounds included per validation phase
  warrantyDays?: number         // free bug-fix period after delivery
  sourceCodeDelivery?: boolean  // source code handed over after full payment
  autoDepositInvoice?: boolean  // issue the deposit invoice automatically when the client signs
  requireSignatureOtp?: boolean // client confirms a code emailed to them before signing
  remindersEnabled?: boolean    // automatic reminders (expiring quote, overdue invoice…)
}

export interface SocialLinks {
  linkedin: string
  github: string
  facebook: string
  instagram: string
  [key: string]: string
}

export interface Project {
  slug: string
  title: string
  description: string
  longDescription: string
  category: string
  tags: string[]
  year: string
  status: 'completed' | 'in-progress' | 'concept'
  liveUrl?: string
  githubUrl?: string
  image?: string
  caseStudyContext?: string
  caseStudySolution?: string
  caseStudyResults?: string
}

export interface Experience {
  id: string
  period: string
  role: string
  company: string
  companyLogo?: string
  description: string
  tags: string[]
}

export interface Education {
  id: string
  year: string
  degree: string
  school: string
  schoolLogo?: string
  detail: string
}

export interface Skill {
  id: string
  category: string
  items: string[]
  icons?: Record<string, string>
}

export interface Testimonial {
  id: string
  name: string
  role: string
  company: string
  text: string
  avatar?: string
  rating?: number
  // Admin-only link to a real Project — when set, the public card shows a
  // "Vérifié" badge and links to that project as proof the review is real.
  projectSlug?: string
}

export interface Offer {
  id: string
  title: string
  description: string
  priceLabel: string
  features?: string[]
  featured?: boolean
  image?: string
  // Optional numeric HT price range backing the self-service quote builder
  // (/devis) — priceLabel stays the free-text display shown everywhere
  // else. The visitor picks a complexity tier (simple/standard/complexe)
  // that lands the unit price somewhere in [priceHTMin, priceHTMax],
  // mirroring the real range-based pricing instead of one fixed number.
  // An offer needs both bounds set to become selectable in that form.
  priceHTMin?: number
  priceHTMax?: number
}

export interface SiteSettings {
  accentColor: string
  favicon: string
  logo: string
}

export interface WeeklyHours {
  day: number // 0 = dimanche … 6 = samedi
  enabled: boolean
  start: string // "09:00"
  end: string   // "18:00"
}

export interface Availability {
  weeklyHours: WeeklyHours[]  // 7 entrées, une par jour
  slotMinutes: number         // durée d'un créneau réservable
  bufferMinutes: number       // battement gardé libre entre deux rendez-vous
  bookingWindowDays: number   // horizon de réservation (en jours)
  blackoutDates: string[]     // dates ISO ("YYYY-MM-DD") entièrement bloquées
}

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string
  category: string
  readTime: string
  content: string
  published: boolean
  externalUrl?: string
  author?: string
  coverImage?: string
}

export interface VisionData {
  quote: string
  philosophie: string[]
  approche: string[]
  valeurs: { title: string; text: string }[]
}

// ── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioData {
  personal: PersonalInfo
  socials: SocialLinks
  projects: Project[]
  experiences: Experience[]
  educations: Education[]
  skills: Skill[]
  testimonials: Testimonial[]
  settings: SiteSettings
  vision: VisionData
  blog: BlogPost[]
  offers: Offer[]
  availability: Availability
}
