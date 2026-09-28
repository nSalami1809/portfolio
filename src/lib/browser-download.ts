// Hands a server-generated file (returned by a Server Action as base64) to
// the browser as a file download. Client-side only.
export function saveBase64File(base64: string, filename: string, mimeType: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function saveBase64Pdf(base64: string, filename: string): void {
  saveBase64File(base64, filename, 'application/pdf')
}
