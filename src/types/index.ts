export interface PersonalInfo {
  name: string
  role: string
  bio: string
  email: string
  location: string
  photo: string
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
}

export interface SiteSettings {
  accentColor: string
  favicon: string
  logo: string
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
}
