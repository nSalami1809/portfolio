'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FadeIn from '@/components/animations/FadeIn'
import { usePortfolio } from '@/providers/PortfolioContext'
import ParticleWaveClient from '@/components/scene/ParticleWaveClient'
import { useLocale, useDictionary } from '@/lib/i18n/useLocale'
import { translateText } from '@/actions/translate'

type Translated = Record<string, { title: string; excerpt: string }>

export default function BlogPage() {
  const { data } = usePortfolio()
  const posts = data.blog.filter((p) => p.published)
  const locale = useLocale()
  const t = useDictionary()
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const [translated, setTranslated] = useState<Translated>({})

  useEffect(() => {
    if (locale !== 'en' || posts.length === 0) { setTranslated({}); return } // eslint-disable-line react-hooks/set-state-in-effect
    let cancelled = false
    Promise.all(
      posts.map(async (p) => {
        const fields = await translateText(`blog:${p.slug}`, 'en', { title: p.title, excerpt: p.excerpt })
        return [p.slug, { title: fields.title ?? p.title, excerpt: fields.excerpt ?? p.excerpt }] as const
      }),
    ).then((entries) => { if (!cancelled) setTranslated(Object.fromEntries(entries)) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, posts.length])

  return (
    <div className="relative">
      <ParticleWaveClient />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <FadeIn>
          <p className="section-label mb-3">{t.blog.label}</p>
          <h1 className="section-title mb-4" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)' }}>
            {t.blog.title}
          </h1>
          <p className="text-lg mb-16" style={{ color: 'var(--text-muted)', maxWidth: 500 }}>
            {t.blog.subtitle}
          </p>
        </FadeIn>

        {posts.length === 0 ? (
          <FadeIn delay={0.1}>
            <div className="card p-16 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'var(--accent-glow)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <p className="font-display font-semibold text-xl mb-2" style={{ color: 'var(--text)' }}>
                {t.blog.emptyTitle}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                {t.blog.emptyText}
              </p>
            </div>
          </FadeIn>
        ) : (
          <div>
            {posts.map((post, i) => {
              const tp = translated[post.slug]
              return (
              <FadeIn key={post.slug} delay={i * 0.07}>
                <Link
                  href={`/${locale}/blog/${post.slug}`}
                  className="group flex flex-col sm:flex-row gap-6 py-8 transition-colors duration-200"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="sm:w-32 shrink-0 flex sm:flex-col items-start sm:items-end gap-3">
                    {post.coverImage && (
                      <div
                        className="relative w-20 h-20 sm:w-full sm:h-20 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ border: '1px solid var(--border)' }}
                      >
                        <Image
                          src={post.coverImage}
                          alt=""
                          aria-hidden="true"
                          fill
                          loading="lazy"
                          sizes="128px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <span className="tag text-xs">{post.category}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2
                      className="font-display font-semibold text-xl mb-2 transition-colors duration-200 group-hover:text-[var(--accent)]"
                      style={{ color: 'var(--text)' }}
                    >
                      {tp?.title ?? post.title}
                    </h2>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                      {tp?.excerpt ?? post.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                      <span>
                        {new Date(post.date).toLocaleDateString(dateLocale, {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </span>
                      <span>·</span>
                      <span>{post.readTime} {t.blog.readTime}</span>
                    </div>
                  </div>
                  <div className="self-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)' }}>
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                </Link>
              </FadeIn>
              )
            })}
            <div style={{ borderTop: '1px solid var(--border)' }} />
          </div>
        )}
      </div>
    </div>
  )
}
