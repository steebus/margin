/** Words typed and not yet saved, which a reload would lose. */
const unsaved = () => [...document.querySelectorAll('textarea')].some(t => t.value.trim())

/**
 * Picks up a new version without losing anything being typed: a new service worker takes over at once, and the page
 * reloads the next time it's out of sight with no unsaved words on it. If a screen's code has gone because a deploy
 * replaced it, reload straight away, since that screen can't open anyway.
 */
export function watchForUpdates() {
  let ready = false
  const reloadIfSafe = () => { if (ready && document.visibilityState === 'hidden' && !unsaved()) location.reload() }
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    ready = true
    reloadIfSafe()
  })
  document.addEventListener('visibilitychange', reloadIfSafe)
  window.addEventListener('vite:preloadError', () => location.reload())
}
