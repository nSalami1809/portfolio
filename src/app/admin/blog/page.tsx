'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '@/providers/PortfolioContext'
import { useToast } from '@/components/admin/Toast'
import ImageUpload from '@/components/admin/ImageUpload'
import { compressImage, uploadFile } from '@/lib/upload'
import type { BlogPost } from '@/types'

const CATEGORIES = ['DevOps', 'Frontend', 'Backend', 'Architecture', 'Carrière', 'Autre']

const EMPTY: Omit<BlogPost, 'slug'> = {
  title: '',
  excerpt: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'DevOps',
  readTime: '5 min',
  content: '',
  published: false,
  externalUrl: '',
  author: '',
  coverImage: '',
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function EyeIcon({ off }: { off?: boolean }) {
  if (off) return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}

const F = ({ label, req }: { label: string; req?: boolean }) => (
  <label className="field-label">{label}{req && <span style={{ color: '#EF4444' }}> *</span>}</label>
)

const GRID = '1rem 1fr 7rem 5.5rem 7rem'

export default function AdminBlog() {
  const { data, updateBlogPosts } = usePortfolio()
  const toast = useToast()
  const [posts, setPosts] = useState<BlogPost[]>(data.blog)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<BlogPost, 'slug'>>({ ...EMPTY })
  const [customSlug, setCustomSlug] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'hidden'>('all')
  const [mediaUploading, setMediaUploading] = useState<'image' | 'video' | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Adopt the shared context's posts until this page makes its own edit
  const localOwned = useRef(false)
  useEffect(() => {
    if (!localOwned.current) setPosts(data.blog)
  }, [data.blog])

  const persist = (updated: BlogPost[]) => {
    localOwned.current = true
    setPosts(updated)
    updateBlogPosts(updated)
  }

  const startNew = () => {
    setEditingSlug('__new__')
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10), author: data.personal.name })
    setCustomSlug('')
    setCustomCategory('')
  }

  const startEdit = (p: BlogPost) => {
    setEditingSlug(p.slug)
    const { slug, ...rest } = p
    // If the stored category isn't a predefined one, treat it as custom
    if (CATEGORIES.includes(p.category) && p.category !== 'Autre') {
      setForm(rest)
      setCustomCategory('')
    } else {
      setForm({ ...rest, category: 'Autre' })
      setCustomCategory(p.category === 'Autre' ? '' : p.category)
    }
    setCustomSlug(slug)
  }

  const insertAtCursor = (snippet: string) => {
    const el = contentRef.current
    if (!el) {
      setForm((p) => ({ ...p, content: p.content ? `${p.content}\n\n${snippet}` : snippet }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.slice(0, start)
    const after = el.value.slice(end)
    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n')
    const insertion = `${needsNewlineBefore ? '\n\n' : ''}${snippet}\n\n`
    const next = `${before}${insertion}${after}`
    setForm((p) => ({ ...p, content: next }))
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setMediaUploading('image')
    try {
      const compressed = await compressImage(file, 1600)
      const url = await uploadFile(compressed, file.name.replace(/\.[^.]+$/, '.jpg'))
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, '')}](${url})`)
    } catch {
      toast("Échec de l'upload de l'image", 'error')
    } finally {
      setMediaUploading(null)
    }
  }

  const handleInsertVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('video/')) return
    if (file.size > 30 * 1024 * 1024) {
      toast('Vidéo trop lourde (max 30 Mo)', 'error')
      return
    }
    setMediaUploading('video')
    try {
      const url = await uploadFile(file, file.name)
      insertAtCursor(`[video](${url})`)
    } catch {
      toast("Échec de l'upload de la vidéo", 'error')
    } finally {
      setMediaUploading(null)
    }
  }

  const autoSlug = slugify(form.title)
  const effectiveSlug = customSlug || autoSlug

  const confirmEdit = () => {
    if (!form.title.trim()) return toast('Le titre est obligatoire', 'error')
    if (!effectiveSlug) return toast('Slug invalide', 'error')

    // Resolve actual category: if 'Autre', use the custom text
    const effectiveCategory =
      form.category === 'Autre' ? (customCategory.trim() || 'Autre') : form.category

    const entry: BlogPost = { slug: effectiveSlug, ...form, category: effectiveCategory }

    if (editingSlug === '__new__') {
      if (posts.some((p) => p.slug === effectiveSlug)) {
        return toast('Un article avec ce slug existe déjà', 'error')
      }
      persist([entry, ...posts])
      toast(entry.published ? 'Article créé et publié ✓' : 'Article créé en brouillon — cliquez sur « Publier » pour le rendre visible')
    } else {
      persist(posts.map((p) => p.slug === editingSlug ? entry : p))
      toast(entry.published ? 'Article mis à jour ✓' : 'Modifications enregistrées · Article toujours en brouillon')
    }
    setEditingSlug(null)
  }

  const remove = (slug: string, title: string) => {
    if (!confirm(`Supprimer « ${title} » ?`)) return
    persist(posts.filter((p) => p.slug !== slug))
    setSelected((s) => { const n = new Set(s); n.delete(slug); return n })
    toast('Article supprimé', 'error')
  }

  const togglePublish = (slug: string) => {
    const updated = posts.map((p) => p.slug === slug ? { ...p, published: !p.published } : p)
    persist(updated)
    const p = updated.find((x) => x.slug === slug)
    toast(p?.published ? 'Article publié' : 'Article masqué')
  }

  const bulkDelete = () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} article(s) ?`)) return
    const c = selected.size
    persist(posts.filter((p) => !selected.has(p.slug)))
    setSelected(new Set())
    toast(`${c} supprimé(s)`, 'error')
  }

  const toggleSelect = (slug: string) => setSelected((s) => { const n = new Set(s); if (n.has(slug)) { n.delete(slug) } else { n.add(slug) }; return n })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return posts.filter((p) => {
      if (filterStatus === 'published' && !p.published) return false
      if (filterStatus === 'hidden' && p.published) return false
      if (!q) return true
      return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q)
    })
  }, [posts, search, filterStatus])

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.slug))

  const published = posts.filter((p) => p.published).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: 'var(--text)' }}>Blog</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            {posts.length} article{posts.length !== 1 ? 's' : ''} · {published} publié{published !== 1 ? 's' : ''} · Sauvegarde automatique
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={bulkDelete} className="btn-danger btn-sm">
              <TrashIcon /> Supprimer ({selected.size})
            </button>
          )}
          <button onClick={startNew} className="btn-primary btn-sm">
            + Nouvel article
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }} aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="input pl-9 text-sm"
            style={{ height: '38px' }}
          />
        </div>
        <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          {(['all', 'published', 'hidden'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                fontFamily: 'var(--font-poppins)',
                background: filterStatus === s ? 'var(--accent)' : 'transparent',
                color: filterStatus === s ? '#fff' : 'var(--text-muted)',
              }}
            >
              {s === 'all' ? 'Tous' : s === 'published' ? 'Publiés' : 'Masqués'}
            </button>
          ))}
        </div>
      </div>

      {/* Form (new / edit) */}
      <AnimatePresence>
        {editingSlug !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="card no-lift p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>
                {editingSlug === '__new__' ? 'Nouvel article' : 'Modifier l\'article'}
              </h2>
              <button
                onClick={() => setEditingSlug(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Fermer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Row 1 : title + date + category */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <F label="Titre" req />
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="input"
                  placeholder="Mon article de blog…"
                />
              </div>
              <div className="space-y-2">
                <F label="Catégorie" req />
                <select
                  value={form.category}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, category: e.target.value }))
                    if (e.target.value !== 'Autre') setCustomCategory('')
                  }}
                  className="input"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <AnimatePresence>
                  {form.category === 'Autre' && (
                    <motion.div
                      key="customCategory"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="input"
                        placeholder="Précisez la catégorie (ex: IA / ML, Sécurité…)"
                        autoFocus
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Row 2 : slug + date + readTime */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <F label="Slug (URL)" />
                <input
                  type="text"
                  value={customSlug || autoSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="input"
                  placeholder={autoSlug || 'mon-article'}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  /blog/{effectiveSlug || '…'}
                </p>
              </div>
              <div>
                <F label="Date de publication" />
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <F label="Temps de lecture" />
                <input
                  type="text"
                  value={form.readTime}
                  onChange={(e) => setForm((p) => ({ ...p, readTime: e.target.value }))}
                  className="input"
                  placeholder="5 min"
                />
              </div>
            </div>

            {/* Cover image */}
            <div>
              <ImageUpload
                label="Image de couverture (optionnel)"
                value={form.coverImage}
                onChange={(url) => setForm((p) => ({ ...p, coverImage: url }))}
                size="lg"
                shape="square"
                placeholder="Image de couverture"
              />
            </div>

            {/* Author */}
            <div>
              <F label="Auteur" />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={form.author ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Nawaf Nemrod SALAMI"
                />
              </div>
            </div>

            {/* Excerpt */}
            <div>
              <F label="Extrait / résumé" req />
              <textarea
                value={form.excerpt}
                onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                rows={2}
                className="input resize-y"
                placeholder="Courte description affichée dans la liste du blog…"
              />
            </div>

            {/* External URL */}
            <div>
              <F label="Lien ressource / outil (optionnel)" />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </span>
                <input
                  type="url"
                  value={form.externalUrl ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, externalUrl: e.target.value }))}
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="https://medium.com/mon-article"
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                Lien vers l&apos;outil, la documentation ou la ressource mentionnée dans l&apos;article. Affiché comme un encart de découverte en bas du titre.
              </p>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <F label="Contenu (Markdown)" />
                <span className="text-xs" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                  # h1 &nbsp; ## h2 &nbsp; **gras** &nbsp; ---
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => mediaUploading === null && imageInputRef.current?.click()}
                  disabled={mediaUploading !== null}
                  className="btn-secondary btn-xs"
                >
                  {mediaUploading === 'image' ? (
                    <span className="w-3 h-3 rounded-full border-2 animate-spin inline-block" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  )}
                  Insérer une image
                </button>
                <button
                  type="button"
                  onClick={() => mediaUploading === null && videoInputRef.current?.click()}
                  disabled={mediaUploading !== null}
                  className="btn-secondary btn-xs"
                >
                  {mediaUploading === 'video' ? (
                    <span className="w-3 h-3 rounded-full border-2 animate-spin inline-block" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  )}
                  Insérer une vidéo
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleInsertImage} className="sr-only" tabIndex={-1} aria-label="Insérer une image dans le contenu" />
                <input ref={videoInputRef} type="file" accept="video/*" onChange={handleInsertVideo} className="sr-only" tabIndex={-1} aria-label="Insérer une vidéo dans le contenu" />
              </div>

              <textarea
                ref={contentRef}
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={14}
                className="input resize-y font-mono text-sm"
                placeholder="# Introduction&#10;&#10;Votre contenu en Markdown…"
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                Les images/vidéos insérées apparaissent dans l&apos;article à l&apos;endroit où le curseur se trouvait dans le texte. Vidéo : 30 Mo max.
              </p>
            </div>

            {/* Published + actions */}
            <div className="flex items-center justify-between gap-4 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
                  style={{ background: form.published ? 'var(--accent)' : 'var(--border)' }}
                  onClick={() => setForm((p) => ({ ...p, published: !p.published }))}
                  role="switch"
                  aria-checked={form.published}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === ' ' && setForm((p) => ({ ...p, published: !p.published }))}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: form.published ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </div>
                <div>
                  <span className="text-sm font-medium" style={{ color: form.published ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
                    {form.published ? 'Visible sur le site' : 'Brouillon (non visible)'}
                  </span>
                  {!form.published && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                      Activez ce bouton pour publier l&apos;article
                    </p>
                  )}
                </div>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setEditingSlug(null)} className="btn-secondary btn-sm">Annuler</button>
                <button onClick={confirmEdit} className="btn-primary btn-sm">
                  {editingSlug === '__new__' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="card no-lift p-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--accent-glow)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <p className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Aucun article pour l&apos;instant</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>Cliquez sur « Nouvel article » pour commencer à rédiger.</p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="card no-lift overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header */}
            <div
              className="hidden sm:grid items-center gap-4 px-5 py-3 text-xs font-medium"
              style={{
                gridTemplateColumns: GRID,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-poppins)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                minWidth: '560px',
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.slug)))}
                aria-label="Sélectionner tous"
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span>Titre</span>
              <span>Catégorie</span>
              <span className="text-center">Statut</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            <div style={{ minWidth: '560px' }}>
              {filtered.map((p, i) => (
                <div
                  key={p.slug}
                  className="admin-row grid items-center gap-4 px-5 py-3.5"
                  style={{
                    gridTemplateColumns: GRID,
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.slug)}
                    onChange={() => toggleSelect(p.slug)}
                    aria-label={`Sélectionner ${p.title}`}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />

                  {/* Title + date */}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-poppins)' }}>
                      {p.title}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-poppins)' }}>
                      {new Date(p.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })} · {p.readTime}
                    </p>
                  </div>

                  {/* Category */}
                  <span className="tag text-xs truncate">{p.category}</span>

                  {/* Status */}
                  <div className="flex justify-center">
                    {p.published ? (
                      <button
                        onClick={() => togglePublish(p.slug)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 hover:opacity-70"
                        style={{
                          fontFamily: 'var(--font-poppins)',
                          background: 'rgba(16,185,129,0.12)',
                          color: '#10B981',
                          border: '1px solid rgba(16,185,129,0.3)',
                        }}
                        title="Cliquer pour masquer"
                      >
                        <EyeIcon />
                        Publié
                      </button>
                    ) : (
                      <button
                        onClick={() => togglePublish(p.slug)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
                        style={{
                          fontFamily: 'var(--font-poppins)',
                          background: 'var(--accent)',
                          color: '#fff',
                          border: 'none',
                          boxShadow: '0 0 0 2px rgba(139,92,246,0.25)',
                        }}
                        title="Publier sur le site"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        Publier
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => startEdit(p)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label={`Modifier ${p.title}`}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => remove(p.slug, p.title)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: '#EF4444' }}
                      aria-label={`Supprimer ${p.title}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 && posts.length > 0 && (
        <div className="card no-lift p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)' }}>
            Aucun article ne correspond à votre recherche.
          </p>
        </div>
      )}
    </div>
  )
}
