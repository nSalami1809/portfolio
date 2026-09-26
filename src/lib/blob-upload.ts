import { put } from '@vercel/blob'

// Uploads a signature image to public blob storage and returns its URL.
// With E2E_DRY_RUN=1 (the end-to-end test harness) nothing leaves the machine:
// the image comes back as a data: URL, which the PDF generators can read too.
export async function uploadPublicImage(pathname: string, buffer: Buffer, contentType = 'image/png'): Promise<string> {
  if (process.env.E2E_DRY_RUN === '1') return `data:${contentType};base64,${buffer.toString('base64')}`
  const blob = await put(pathname, buffer, { access: 'public', contentType, addRandomSuffix: true })
  return blob.url
}
