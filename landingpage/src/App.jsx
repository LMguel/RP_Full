import React from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SegmentPage from './pages/SegmentPage'
import { SEGMENTS } from './data/segments'

export default function App() {
  return (
    <div className="bg-rp-bg text-rp-text min-h-screen overflow-x-hidden">
      <Routes>
        <Route path="/" element={<HomePage />} />
        {SEGMENTS.map((segment) => (
          <Route key={segment.slug} path={segment.path} element={<SegmentPage segment={segment} />} />
        ))}
      </Routes>
    </div>
  )
}
