interface Props {
  items: string[]
  /** Accessible name of the ribbon (e.g. "Technologies maîtrisées") */
  label: string
}

// A slow ribbon of the technologies, pure CSS: a transform animation (no JavaScript, no layout work) that pauses on
// hover and becomes a plain wrapped list when the visitor asks for less motion. The list is written twice so the loop
// has no seam; the second copy is hidden from assistive technology so each name is read once.
export default function TechMarquee({ items, label }: Props) {
  const names = [...new Set(items.map((s) => s.trim()).filter(Boolean))]
  if (names.length < 4) return null

  const group = (hidden: boolean) => (
    <ul className="tech-marquee-group" aria-hidden={hidden || undefined}>
      {names.map((name) => (
        <li key={name} className="tech-marquee-item">
          <span className="tech-marquee-dot" aria-hidden="true" />
          {name}
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
