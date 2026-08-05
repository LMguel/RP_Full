import { useEffect } from 'react'

function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function useDocumentHead({ title, description, path }) {
  useEffect(() => {
    if (title) document.title = title
    if (description) {
      setMeta('description', description)
      setMeta('og:description', description, 'property')
      setMeta('twitter:description', description)
    }
    if (title) {
      setMeta('og:title', title, 'property')
      setMeta('twitter:title', title)
    }
    if (path) {
      setCanonical(`https://www.registraponto.app.br${path}`)
      setMeta('og:url', `https://www.registraponto.app.br${path}`, 'property')
    }
  }, [title, description, path])
}
