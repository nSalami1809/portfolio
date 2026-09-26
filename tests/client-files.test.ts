import { describe, expect, it } from 'vitest'
import { checkClientFile, cleanFileName, MAX_CLIENT_FILE_BYTES } from '@/lib/client-files'

describe('client files', () => {
  it('accepts documents and images, whatever the browser says about the type', () => {
    expect(checkClientFile({ name: 'logo.PNG', type: 'image/png', size: 1000 })).toEqual({ ok: true, contentType: 'image/png' })
    expect(checkClientFile({ name: 'brief.pdf', type: '', size: 1000 })).toEqual({ ok: true, contentType: 'application/pdf' })
    expect(checkClientFile({ name: 'brief.pdf', type: 'application/octet-stream', size: 1000 })).toMatchObject({ ok: true })
  })

  it('refuses risky or unknown types, and a type that contradicts the extension', () => {
    for (const name of ['x.svg', 'x.html', 'x.exe', 'x.js', 'x.php', 'noextension']) {
      expect(checkClientFile({ name, type: '', size: 10 })).toEqual({ ok: false, error: 'type' })
    }
    expect(checkClientFile({ name: 'photo.png', type: 'text/html', size: 10 })).toEqual({ ok: false, error: 'type' })
  })

  it('enforces the size limits', () => {
    expect(checkClientFile({ name: 'a.png', type: 'image/png', size: 0 })).toEqual({ ok: false, error: 'empty' })
    expect(checkClientFile({ name: 'a.png', type: 'image/png', size: MAX_CLIENT_FILE_BYTES + 1 })).toEqual({ ok: false, error: 'toolarge' })
  })

  it('cleans file names', () => {
    expect(cleanFileName('../../etc/passwd')).toBe('passwd')
    expect(cleanFileName('C:\\Users\\me\\Logo final (v2).png')).toBe('Logo final _v2_.png')
    expect(cleanFileName('.htaccess')).toBe('htaccess')
    expect(cleanFileName('')).toBe('fichier')
    expect(cleanFileName('é-Présentation.pdf')).toBe('é-Présentation.pdf')
  })
})
