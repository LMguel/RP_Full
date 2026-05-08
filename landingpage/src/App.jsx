import React, { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Showcase from './components/Showcase'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'
import ContactModal from './components/ContactModal'

const showcases = [
  {
    id: 'dashboard',
    label: 'Gestão centralizada',
    title: 'Dashboard completo em tempo real',
    description: 'Acompanhe presenças, ausências, horas extras e ocorrências de toda a equipe em um único painel. Informações claras para decisões rápidas.',
    image: '/image/dashboard.png',
    imageAlt: 'Dashboard do REGISTRA.PONTO',
    side: 'right',
    accent: 'blue',
    features: [
      'Visão geral de toda a equipe em tempo real',
      'Alertas de ausências e atrasos automáticos',
      'Gráficos de jornada e banco de horas',
      'Acesso web em qualquer dispositivo',
    ],
  },
  {
    id: 'tablet',
    label: 'Registro por tablet',
    title: 'Ponto facial no tablet — sem fricção',
    description: 'Instale o tablet na entrada da empresa e seus funcionários registram o ponto em segundos com reconhecimento. Sem cartão, sem senha, sem fila.',
    image: '/image/captura.jpg',
    imageAlt: 'Registro de ponto via tablet — REGISTRA.PONTO',
    side: 'left',
    accent: 'cyan',
    features: [
      'Registro rápido e seguro por tablet fixo',
      'Sem necessidade de cartão ou senha',
      'Foto capturada em cada registro',
      'Instalação presencial — levamos o tablet pronto para uso',
    ],
  },
  {
    id: 'localizacao',
    label: 'Mobile com GPS',
    title: 'Registro pelo celular com geolocalização',
    description: 'Colaboradores externos registram o ponto diretamente no celular. A localização é capturada no momento do registro, garantindo integridade e transparência.',
    image: '/image/localizacao.png',
    imageAlt: 'Registro por geolocalização — REGISTRA.PONTO',
    side: 'right',
    accent: 'green',
    imageClass: 'max-w-[320px] md:max-w-[380px] mx-auto',
    features: [
      'Geolocalização capturada em cada batida',
      'Funciona no celular pessoal do colaborador',
      'Sem necessidade de equipamento adicional',
      'Rastreio de localização auditável',
    ],
  },
  {
    id: 'funcionarios',
    label: 'Gestão de equipe',
    title: 'Cadastro e gestão de funcionários',
    description: 'Gerencie toda a equipe em um lugar: cadastre colaboradores, defina jornadas, horários e turnos. Organização completa para empresas de qualquer tamanho.',
    image: '/image/funcionarios.png',
    imageAlt: 'Gestão de funcionários — REGISTRA.PONTO',
    side: 'left',
    accent: 'blue',
    features: [
      'Cadastro completo de colaboradores',
      'Configuração de jornadas e turnos',
      'Controle de férias e afastamentos',
      'Histórico completo por funcionário',
    ],
  },
  {
    id: 'excel',
    label: 'Exportação de dados',
    title: 'Espelho de ponto em Excel pronto para DP',
    description: 'Exporte o espelho de ponto em Excel formatado para o departamento pessoal. Feche o mês em minutos, sem retrabalho.',
    image: '/image/excel.jpeg',
    imageAlt: 'Exportação em Excel — REGISTRA.PONTO',
    side: 'right',
    accent: 'green',
    features: [
      'Exportação em .xlsx compatível com qualquer DP',
      'Filtros por período, funcionário e turno',
      'Horas extras e banco de horas calculados',
      'Relatórios prontos para folha de pagamento',
    ],
  },
  {
    id: 'espelho',
    label: 'Espelho de ponto',
    title: 'Espelho de ponto detalhado e preciso',
    description: 'Visualize o registro completo de cada colaborador: entradas, saídas, intervalos, horas trabalhadas e ocorrências. Transparência total para gestores e funcionários.',
    image: '/image/espelho.jpeg',
    imageAlt: 'Espelho de ponto — REGISTRA.PONTO',
    side: 'left',
    accent: 'cyan',
    features: [
      'Histórico de todos os registros do colaborador',
      'Entradas, saídas e intervalos detalhados',
      'Ocorrências e justificativas registradas',
      'Conformidade com a legislação trabalhista',
    ],
  },
]

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')

  function openModal(plan = '') {
    setSelectedPlan(plan)
    setModalOpen(true)
  }

  return (
    <div className="bg-rp-bg text-slate-100 min-h-screen overflow-x-hidden">
      <Navbar onContact={() => openModal()} />
      <Hero onContact={() => openModal()} />
      <Features />
      {showcases.map((s) => (
        <Showcase key={s.id} {...s} onContact={() => openModal(s.label)} />
      ))}
      <Pricing onContact={openModal} />
      <FAQ />
      <FinalCTA onContact={() => openModal()} />
      <Footer onContact={() => openModal()} />
      <ContactModal open={modalOpen} plan={selectedPlan} onClose={() => setModalOpen(false)} />
    </div>
  )
}
