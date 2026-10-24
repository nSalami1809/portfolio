import Icon from '@/components/ui/Icon'

// A link that opens WhatsApp with a message already written (see lib/whatsapp.ts).
// Shows nothing when there is no usable number: a page never offers a dead button.
export default function WhatsAppButton({ href, label, variant = 'secondary', fullWidth = false, size = 'md', className = '' }: {
  href: string
  label: string
  variant?: 'primary' | 'secondary'
  fullWidth?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-button"
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${size === 'sm' ? 'btn-sm' : ''} ${fullWidth ? 'w-full justify-center' : ''} ${className}`.trim()}
    >
      <Icon name="whatsapp" size={size === 'sm' ? 14 : 16} />
      {label}
    </a>
  )
}
