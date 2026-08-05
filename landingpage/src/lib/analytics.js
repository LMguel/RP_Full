export function trackWhatsAppClick(origin) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', 'click_whatsapp', { origin })
}
