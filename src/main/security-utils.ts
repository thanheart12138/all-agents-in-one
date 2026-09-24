/** Allow the app document, or the configured development server origin. */
export function isAllowedRendererUrl(candidate: string, devUrl: string | undefined, packagedUrl: string): boolean {
  if (candidate === packagedUrl) return true
  if (!devUrl) return false
  try {
    const candidateUrl = new URL(candidate)
    const devRendererUrl = new URL(devUrl)
    return candidateUrl.origin === devRendererUrl.origin
  } catch {
    return false
  }
}

/** Only send the Kimi OAuth token to an HTTPS usage endpoint. */
export function getSecureKimiQuotaUrl(baseUrl: string | undefined, defaultBaseUrl: string): string {
  try {
    const url = new URL(baseUrl ?? '')
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) {
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}/usages`
    }
  } catch {
    // Use the HTTPS default if the provider URL is malformed.
  }
  return `${defaultBaseUrl.replace(/\/+$/, '')}/usages`
}
