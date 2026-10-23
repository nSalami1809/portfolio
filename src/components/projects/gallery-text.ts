// Kept apart from ProjectLightbox so the gallery can use them without importing the
// lightbox (which is loaded only when a visitor opens it).

export interface GalleryLabels {
  label: string
  previous: string
  next: string
  open: string
  close: string
  imageOf: string
  showImage: string
  views: string
  desktop: string
  mobile: string
}

export const fill = (template: string, n: number, total: number) => template.replace('{n}', String(n)).replace('{total}', String(total))
