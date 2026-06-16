import React from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Showcase from './components/Showcase'
import HowItWorks from './components/HowItWorks'
import Testimonial from './components/Testimonial'
import OperationalValidation from './components/OperationalValidation'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import Simulator from './components/Simulator'

const showcases = [
  {
    id: 'tablet',
    label: 'Registro facial',
    title: 'Ponto no tablet — sem cartão, sem senha',
    description: 'Tablet fixo na entrada da empresa. Seus funcionários registram o ponto em segundos com reconhecimento facial. Rápido, seguro e sem fila.',
    image: '/image/captura.png',
    imageAlt: 'Tablet de registro facial na parede — REGISTRA.PONTO',
    side: 'right',
    accent: 'sky',
    imageClass: 'w-3/5 sm:w-1/2 mx-auto block',
    features: [
      'Tablet instalado e configurado por nós',
      'Registro em segundos sem cartão ou senha',
      'Foto capturada e vinculada a cada batida',
      'Funciona mesmo com quedas momentâneas de internet',
    ],
  },
  {
    id: 'dashboard',
    label: 'Gestão centralizada',
    title: 'Dashboard completo em tempo real',
    description: 'Acompanhe presenças, ausências, horas extras e ocorrências de toda a equipe em um único painel. Informações claras para decisões rápidas — sem abrir planilha.',
    image: '/image/dashboard.png',
    imageAlt: 'Dashboard do REGISTRA.PONTO',
    side: 'left',
    accent: 'blue',
    imageClass: 'w-full block',
    features: [
      'Visão geral de toda a equipe em tempo real',
      'Alertas automáticos de ausências e atrasos',
      'Gráficos de jornada e banco de horas',
      'Acesso web em qualquer dispositivo',
    ],
  },
  {
    id: 'chatbot',
    label: 'Assistente de RH com IA',
    title: 'Chatbot inteligente para o seu RH',
    description: 'Pergunte ao assistente quem está presente, quais funcionários faltaram, o saldo de banco de horas ou qualquer dado da equipe — e receba a resposta em segundos.',
    image: '/image/chatbot_rh.png',
    imageAlt: 'Chatbot de RH com IA — REGISTRA.PONTO',
    side: 'right',
    accent: 'blue',
    imageClass: 'w-full block',
    features: [
      'Consultas em linguagem natural sobre a equipe',
      'Presenças, faltas e banco de horas na ponta dos dedos',
      'Respostas instantâneas sem abrir relatórios',
      'Disponível direto no painel web',
    ],
  },
  {
    id: 'espelho',
    label: 'Espelho de ponto',
    title: 'Visão individual de cada colaborador',
    description: 'Acesse o espelho completo de qualquer funcionário: entradas, saídas, intervalos, horas trabalhadas e ocorrências. Transparência total para gestores.',
    image: '/image/espelho.png',
    imageAlt: 'Espelho de ponto individual — REGISTRA.PONTO',
    side: 'left',
    accent: 'blue',
    imageClass: 'w-full block',
    features: [
      'Histórico detalhado de todos os registros',
      'Entradas, saídas e intervalos por dia',
      'Saldo de horas extras e banco de horas',
      'Conformidade com a legislação trabalhista',
    ],
  },
  {
    id: 'excel',
    label: 'Exportação para DP',
    title: 'Espelho em Excel pronto para o DP',
    description: 'Exporte o fechamento do mês em planilha formatada para o departamento pessoal. Feche a folha em minutos, sem retrabalho manual.',
    image: '/image/excel.png',
    imageAlt: 'Exportação Excel para departamento pessoal — REGISTRA.PONTO',
    side: 'right',
    accent: 'indigo',
    imageClass: 'w-full block',
    features: [
      'Exportação .xlsx compatível com qualquer DP',
      'Filtros por período, funcionário e turno',
      'Horas extras e banco de horas já calculados',
      'Relatório pronto para folha de pagamento',
    ],
  },
]

export default function App() {
  return (
    <div className="bg-rp-bg text-rp-text min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Simulator />
      <Features />
      {showcases.map((s) => (
        <Showcase key={s.id} {...s} />
      ))}
      <HowItWorks />
      <Testimonial />
      <OperationalValidation />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
