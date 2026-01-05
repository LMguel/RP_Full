import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dashboardImg from '../../image/dashboard.png'
import registrosImg from '../../image/registros.png'
import registrosDetalhadosImg from '../../image/registros_detalhados.png'
import configuracoesImg from '../../image/configuracoes.png'
import sistemaImg from '../../image/sistema.png'
import funcionarioImg from '../../image/funcionario.png'
import ImageModal from './ImageModal'

const images = [
  {src: dashboardImg, alt: 'Dashboard do sistema', label: 'Dashboard'},
  {src: registrosImg, alt: 'Registros', label: 'Registros'},
  {src: registrosDetalhadosImg, alt: 'Registros detalhados', label: 'Registros detalhados'},
  {src: configuracoesImg, alt: 'Configurações da empresa', label: 'Configurações'},
  {src: sistemaImg, alt: 'PWA do sistema', label: 'PWA — Funcionário / Empresa'},
  {src: funcionarioImg, alt: 'Tela do funcionário', label: 'Funcionário'}
]

export default function Screens(){
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [index, setIndex] = useState(0)

  function openImage(img){ setSelected(img); setOpen(true) }
  function close(){ setOpen(false); setSelected(null) }

  function prev(){ setIndex(i => (i - 1 + images.length) % images.length) }
  function next(){ setIndex(i => (i + 1) % images.length) }

  return (
    <section className="mt-12 py-12">
      <h2 className="text-center text-2xl font-bold">Telas do sistema</h2>
      <p className="text-center mt-2 text-gray-600">Demonstração visual das principais telas — clique para ampliar</p>

      <div className="mt-8 relative max-w-4xl mx-auto">
        <div className="relative glass rounded-lg shadow-lg overflow-visible px-4 py-6">
          <div className="flex items-center justify-center gap-4">
            {/* Left arrow outside image area (desktop) */}
            <button type="button" onClick={(e)=>{e.stopPropagation(); prev();}} aria-label="Anterior" className="hidden sm:flex items-center justify-center h-12 w-12 rounded-full bg-white/6 text-white hover:bg-white/10">‹</button>

            {/* central image area with fixed height so all images share same box */}
            <div className="w-full max-w-3xl">
              <div className="h-[420px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={images[index].src}
                    src={images[index].src}
                    alt={images[index].alt}
                    onClick={()=>openImage(images[index])}
                    initial={{opacity:0, scale:0.98}}
                    animate={{opacity:1, scale:1}}
                    exit={{opacity:0, scale:0.98}}
                    transition={{duration:0.36}}
                    className="h-full w-full object-contain cursor-zoom-in rounded"
                  />
                </AnimatePresence>
              </div>
            </div>

            {/* Right arrow outside image area (desktop) */}
            <button type="button" onClick={(e)=>{e.stopPropagation(); next();}} aria-label="Próximo" className="hidden sm:flex items-center justify-center h-12 w-12 rounded-full bg-white/6 text-white hover:bg-white/10">›</button>
          </div>

          <div className="mt-6 p-3 glass">
            <div className="flex gap-3 overflow-x-auto py-2">
              {images.map((img, i) => (
                <motion.button key={img.alt} onClick={()=>setIndex(i)} whileHover={{scale:1.05}} className={`flex-none rounded overflow-hidden border ${i===index? 'ring-2 ring-brand-500':'border-transparent'}`}>
                  <img src={img.src} alt={img.alt} className="h-20 w-36 object-cover" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ImageModal open={open} src={selected?.src} alt={selected?.alt} onClose={close} />
    </section>
  )
}
