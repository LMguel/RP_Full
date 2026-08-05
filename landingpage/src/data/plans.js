export const WHATSAPP_NUMBER = '5524992272778'
export const WA_BASE = `https://wa.me/${WHATSAPP_NUMBER}?text=`

export function buildWaUrl(message) {
  return `${WA_BASE}${encodeURIComponent(message)}`
}

export const BASE_FEATURES = [
  'Reconhecimento facial',
  'Dashboard web',
  'Relatórios de ponto',
  'Gestão de funcionários',
  'Exportação Excel',
  'Suporte técnico',
]

export const START_PLAN = {
  id: 'start',
  name: 'Start',
  employees: 'Até 5 funcionários',
  price: 119,
  tabletOptional: true,
  features: BASE_FEATURES,
}

export const PLANS = [
  {
    id: 'plano10',
    name: 'Plano 10',
    employees: 'Até 10 funcionários',
    price: 179,
    roi: '≈ R$6/dia por até 10 funcionários',
    popular: true,
    tabletNote: 'Tablet opcional — use dispositivo da empresa ou receba tablet dedicado.',
    tabletOptional: true,
    features: BASE_FEATURES,
  },
  {
    id: 'plano20',
    name: 'Plano 20',
    employees: 'Até 20 funcionários',
    price: 239,
    roi: '= R$8/dia — menos que uma multa trabalhista',
    popular: false,
    tabletNote: 'Tablet dedicado recomendado para maior fluidez operacional.',
    tabletOptional: false,
    features: [...BASE_FEATURES, 'Suporte prioritário'],
  },
  {
    id: 'plano30',
    name: 'Plano 30',
    employees: 'Até 30 funcionários',
    price: 299,
    roi: '≈ R$10/dia para equipes de até 30 pessoas',
    popular: false,
    tabletNote: 'Tablet dedicado recomendado para maior fluidez operacional.',
    tabletOptional: false,
    features: [...BASE_FEATURES, 'Suporte prioritário', 'Treinamento operacional'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    employees: '31+ funcionários',
    price: null,
    roi: null,
    popular: false,
    description: 'Implantação personalizada',
    features: [],
  },
]

export const IMPLANTATION = {
  device: { label: 'Dispositivo da empresa', cash: 399, installV: 49, installN: 12 },
  tablet: { label: 'Tablet incluso', cash: 1599, installV: 149, installN: 12 },
}

export const PLUS_MODULE_PRICE = 89.90

export const EMPLOYEE_RANGES = [
  { id: 'up5', label: 'Até 5', planId: 'start' },
  { id: '6-10', label: '6 – 10', planId: 'plano10' },
  { id: '11-20', label: '11 – 20', planId: 'plano20' },
  { id: '21-30', label: '21 – 30', planId: 'plano30' },
  { id: '31+', label: '31+', planId: 'enterprise' },
]

export function getPlanById(id) {
  if (id === 'start') return START_PLAN
  return PLANS.find((p) => p.id === id) ?? null
}
