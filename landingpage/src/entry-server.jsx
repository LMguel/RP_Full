import React from 'react'
import { renderToString } from 'react-dom/server'
import { MotionConfig } from 'framer-motion'
import App from './App'

export function render() {
  return renderToString(
    <React.StrictMode>
      <MotionConfig reducedMotion="always">
        <App />
      </MotionConfig>
    </React.StrictMode>
  )
}
