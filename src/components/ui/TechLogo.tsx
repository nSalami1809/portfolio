import { techLogo } from '@/lib/tech-logos'

/**
 * A technology's logo as a flat, single-colour shape in the colour of the surrounding text, always the same size.
 * Draws nothing when the technology has no logo (never a placeholder picture). Decorative: the name is written next to it.
 */
export default function TechLogo({ name, size = 18 }: { name: string; size?: number }) {
  const src = techLogo(name)
  if (!src) return null
  return <span aria-hidden="true" className="tech-logo" style={{ width: size, height: size, ['--tech-logo' as string]: `url(${src})` }} />
}
