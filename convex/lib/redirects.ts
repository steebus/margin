const LOCAL = new Set(['localhost', '127.0.0.1'])

/** Where sign-in may send someone back to: the deployed site, or this machine while developing. Anything else throws. */
export function allowedRedirect(redirectTo: string, siteUrl: string): string {
  const site = new URL(siteUrl)
  if (redirectTo.startsWith('?')) return `${site.origin}/${redirectTo}`
  const target = new URL(redirectTo, site)
  if (target.origin === site.origin) return target.toString()
  if (LOCAL.has(target.hostname) && target.protocol === 'http:') return target.toString()
  throw new Error('That address is not allowed for sign-in')
}
