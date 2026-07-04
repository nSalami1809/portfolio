'use client'

import Link from 'next/link'
import FadeIn from '@/components/animations/FadeIn'
import type { BlogPost } from '@/types'

const IMAGE_RE = /^!\[(.*?)\]\((.+?)\)$/
const VIDEO_RE = /^\[video\]\((.+?)\)$/

function renderContent(content: string) {
  return content.split('\n').map((line, i) => {
    const trimmed = line.trim()

    const imageMatch = trimmed.match(IMAGE_RE)
    if (imageMatch) {
      const [, alt, src] = imageMatch
      return (
        <img
          key={i}
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full rounded-xl my-6"
          style={{ border: '1px solid var(--border)' }}
        />
      )
    }

    const videoMatch = trimmed.match(VIDEO_RE)
    if (videoMatch) {
      const [, src] = videoMatch
      return (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={i}
          src={src}
          controls
          className="w-full rounded-xl my-6"
          style={{ border: '1px solid var(--border)' }}
        />
      )
    }

    if (line.startsWith('# '))
      return <h2 key={i} className="font-display font-bold text-3xl mt-10 mb-4" style={{ color: 'var(--text)' }}>{line.slice(2)}</h2>
    if (line.startsWith('## '))
      return <h3 key={i} className="font-display font-semibold text-2xl mt-8 mb-3" style={{ color: 'var(--text)' }}>{line.slice(3)}</h3>
    if (line.startsWith('### '))
      return <h4 key={i} className="font-display font-semibold text-xl mt-6 mb-2" style={{ color: 'var(--text)' }}>{line.slice(4)}</h4>
    if (line.startsWith('---'))
      return <hr key={i} className="my-8" style={{ borderColor: 'var(--border)' }} />
    if (line.trim() === '')
      return <div key={i} className="h-3" />
    return (
      <p key={i} className="text-base leading-loose" style={{ color: 'var(--text-muted)' }}>
        {line.split(/(\*\*.+?\*\*)/).map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} style={{ color: 'var(--text)' }}>{part.slice(2, -2)}</strong>
          ) : part
        )}
      </p>
    )
  })
}

export default function BlogPostView({ post }: { post: BlogPost }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
      <FadeIn>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium mb-16 transition-colors duration-200 hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Blog
        </Link>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="tag">{post.category}</span>
          <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            {post.readTime} de lecture
          </span>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <h1
          className="font-display font-bold mb-4 leading-tight"
          style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', color: 'var(--text)' }}
        >
          {post.title}
        </h1>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="flex flex-wrap items-center gap-3 mb-12">
          {post.author && (
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-xs"
                style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
                aria-hidden="true"
              >
                {post.author.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                {post.author}
              </span>
            </div>
          )}
          {post.author && (
            <span style={{ color: 'var(--border)' }}>·</span>
          )}
          <p className="text-sm" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
            {new Date(post.date).toLocaleDateString('fr-FR', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
      </FadeIn>

      {post.coverImage && (
        <FadeIn delay={0.18}>
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full rounded-2xl mb-12 object-cover"
            style={{ border: '1px solid var(--border)', maxHeight: 480 }}
          />
        </FadeIn>
      )}

      <div style={{ height: 1, background: 'var(--border)', marginBottom: '3rem' }} />

      {/* Resource / tool link */}
      {post.externalUrl && (
        <FadeIn delay={0.18}>
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 rounded-xl px-5 py-4 mb-10 transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(91,33,182,0.03) 100%)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.12)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--accent)' }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  Ressource mentionnée
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--accent)', fontFamily: 'var(--font-space-grotesk)' }}>
                  {(() => { try { return new URL(post.externalUrl).hostname.replace('www.', '') } catch { return post.externalUrl } })()}
                </p>
              </div>
            </div>
            <span
              className="text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all duration-200 group-hover:scale-105"
              style={{
                fontFamily: 'var(--font-poppins)',
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              Découvrir
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </span>
          </a>
        </FadeIn>
      )}

      <FadeIn delay={0.2}>
        <p
          className="text-lg leading-loose mb-8 pl-4"
          style={{ color: 'var(--text-muted)', borderLeft: '3px solid var(--accent)' }}
        >
          {post.excerpt}
        </p>
      </FadeIn>

      <FadeIn delay={0.25}>
        <article className="space-y-2">
          {renderContent(post.content)}
        </article>
      </FadeIn>

      <div style={{ height: 1, background: 'var(--border)', marginTop: '4rem', marginBottom: '3rem' }} />
      <FadeIn delay={0.3}>
        <div className="flex items-center justify-between">
          <Link href="/blog" className="btn-secondary text-sm px-4 py-2">← Tous les articles</Link>
          <Link href="/contact" className="btn-primary text-sm px-4 py-2">Me contacter</Link>
        </div>
      </FadeIn>
    </div>
  )
}
