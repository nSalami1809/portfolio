import Image from 'next/image'

export interface TechItem {
  name: string
  /** The technology's logo, as saved with the skill in the back-office */
  icon?: string
}

interface Props {
  items: TechItem[]
  /** Accessible name of the ribbon (e.g. "Technologies maîtrisées") */
  label: string
}

// A slow ribbon of the technologies with their logos, pure CSS: a transform animation (no JavaScript, no layout work)
// that pauses on hover and becomes a plain wrapped list when the visitor asks for less motion. The list is written
// twice so the loop has no seam; the second copy is hidden from assistive technology so each name is read once.
// Logos are the same files, at the same size, as the "Technologies maîtrisées" cards below, so the browser fetches each once.
export default function TechMarquee({ items, label }: Props) {
  const seen = new Set<string>()
  const techs = items
    .map((t) => ({ ...t, name: t.name.trim() }))
    .filter((t) => t.name && !seen.has(t.name) && seen.add(t.name))
  if (techs.length < 4) return null

  const group = (hidden: boolean) => (
    <ul className="tech-marquee-group" aria-hidden={hidden || undefined}>
      {techs.map((tech) => (
        <li key={tech.name} className="tech-marquee-item">
          {tech.icon && (
            <span className="tech-marquee-logo" aria-hidden="true">
              <Image src={tech.icon} alt="" width={20} height={20} loading="lazy" className="w-5 h-5 object-contain" />
            </span>
          )}
          {tech.name}
        </li>
      ))}
    </ul>
  )

  return (
    <section className="tech-marquee" aria-label={label}>
      <div className="tech-marquee-track">
        {group(false)}
        {group(true)}
      </div>
    </section>
  )
}
