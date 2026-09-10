import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { translateFields } from '@/lib/translate'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale'
import { defaultPersonalInfo, defaultExperiences, defaultEducations, defaultSkills } from '@/data/defaultData'
import ResumeView from './ResumeView'

// Regenerate at most once every 30s — same trade-off as the homepage and
// /offres: an admin publish can take up to 30s to show here instead of the
// old instant client-side refetch, but the page no longer renders default
// placeholder content first and swaps it for the real data after mount
// (the actual cause of this page's layout shift).
export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)
  return { title: t.resume.title, description: t.resume.subtitle }
}

export default async function ResumePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  const t = getDictionary(locale)

  const portfolio = await fetchPortfolio().catch(() => null)
  const personal = portfolio?.personal ?? defaultPersonalInfo
  const experiences = portfolio?.experiences ?? defaultExperiences
  const educations = portfolio?.educations ?? defaultEducations
  const skills = portfolio?.skills ?? defaultSkills

  const translatedExperiences = await Promise.all(
    experiences.map(async (exp) => {
      const fields = await translateFields(`experience:${exp.id}`, locale, { role: exp.role, description: exp.description })
      return { ...exp, role: fields.role, description: fields.description }
    }),
  )
  const translatedEducations = await Promise.all(
    educations.map(async (edu) => {
      const fields = await translateFields(`education:${edu.id}`, locale, { degree: edu.degree, detail: edu.detail ?? '' })
      return { ...edu, degree: fields.degree, detail: fields.detail }
    }),
  )

  return (
    <ResumeView
      personal={personal}
      experiences={translatedExperiences}
      educations={translatedEducations}
      skills={skills}
      t={t.resume}
    />
  )
}
