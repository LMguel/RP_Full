import React from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
// ThemeToggle removed per request
import sistemaImg from '../../image/sistema.png'

// Hero com CTA principal. Texto em Português com foco em benefício e conversão.
export default function Hero({onRequestDemo}){
  const { scrollYProgress } = useScroll()
  const blobY = useTransform(scrollYProgress, [0, 1], [0, -40])
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white">
      {/* colorful decorative blurred blob with subtle parallax */}
      <motion.div style={{ y: blobY }} className="absolute -top-28 -right-24 w-72 h-72 rounded-full blur-3xl opacity-18 bg-gradient-to-r from-pink-500 to-yellow-400 pointer-events-none" />
      {/* Top centered site title */}
      <div className="absolute inset-x-0 top-4 flex justify-center z-40 pointer-events-none">
        <div className="bg-transparent px-3 py-1">
          <div className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-white">
            <span className="inline-flex items-center gap-0 border-2 border-white rounded-full px-3 py-1">
              <span className="leading-none">REGISTRA.PONT</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 w-7 h-7 sm:w-8 md:-ml-1 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="relative flex items-start justify-between">
          {/* theme toggle removed */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center w-full">
            <motion.div initial={{opacity:0, x:-30}} animate={{opacity:1,x:0}} transition={{duration:0.6}}>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">Controle de ponto inteligente com reconhecimento facial e geolocalização</h1>
              <p className="mt-6 text-lg text-gray-200 dark:text-gray-300">Automatize o controle de jornada, evite fraudes e tenha total controle das horas trabalhadas — tudo em um único sistema.</p>

              <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button onClick={onRequestDemo} className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg">Agendar demonstração gratuita</button>
                <a href="#como-funciona" className="text-gray-300 hover:text-white">Ver como funciona →</a>
              </div>

              <div className="mt-3 text-sm text-gray-300">Sistema em uso piloto em ambiente real • Desenvolvido no Brasil • Suporte local</div>
            </motion.div>

            <motion.div initial={{opacity:0, scale:0.96}} whileHover={{scale:1.02}} animate={{opacity:1, scale:1}} transition={{duration:0.6}} className="p-4">
              <div className="phone-mockup mx-auto">
                <div className="phone-top flex justify-center items-center">
                  <div className="phone-speaker" />
                </div>

                <div className="phone-screen">
                  <img src={sistemaImg} alt="Tela inicial do sistema" className="w-full h-full object-cover" />
                </div>

                <div className="phone-bottom" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Ornamento sutil */}
      <svg className="absolute -bottom-10 left-0 opacity-20" width="400" height="200" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="400" height="200" rx="20" fill="#0F6BFF"/>
      </svg>
    </header>
  )
}
