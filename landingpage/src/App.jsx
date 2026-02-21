import React, { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import ProofGallery from './components/ProofGallery'
import Pricing from './components/Pricing'
import Benefits from './components/Benefits'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'
import ImageModal from './components/ImageModal'

export default function App() {
  const [modalImg, setModalImg] = useState(null)

  function openImage(src, alt) {
    setModalImg({ src, alt })
  }

  function closeImage() {
    setModalImg(null)
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Header />
      <Hero onImageClick={openImage} />
      <main>
        <HowItWorks onImageClick={openImage} />
        <ProofGallery onImageClick={openImage} />
        <Pricing />
        <Benefits />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <ImageModal src={modalImg?.src} alt={modalImg?.alt} onClose={closeImage} />
    </div>
  )
}
