import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPortfolio } from '@/actions/portfolio'
import { defaultBlogPosts } from '@/data/defaultData'
import BlogPostView from './BlogPostView'

async function getPost(slug: string) {
  const portfolio = await fetchPortfolio().catch(() => null)
  const posts = portfolio?.blog ?? defaultBlogPosts
  return posts.find((p) => p.slug === slug && p.published) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt,
    authors: post.author ? [{ name: post.author }] : undefined,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  return <BlogPostView post={post} />
}
