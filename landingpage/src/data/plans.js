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

// ─── Métodos de registro ──────────────────────────────────────────────────
// Preços validados via modelo cost-plus (custo AWS ratado + margem alvo 75%,
// hardware+markup para o Kiosk). Tabela vigente desde 2026-09-13 — realinhada
// ao preço já validado pela base de clientes atuais (~R$149 para 30 func.)
// após recalcular o custo real de infra: ~R$33/empresa/mês fixo (fatura AWS
// rateada por 3 empresas ativas) + variável trivial de Rekognition (~R$1-7,
// mesmo custo pro Mobile e pro Kiosk — os dois usam reconhecimento facial
// a cada batida, não só o Kiosk). implCash/installments abaixo não são mais
// exibidos na página pública (implantação voltou a "Sob consulta"), mas
// ficam documentados aqui como o valor justo de referência para orçamento.
export const METHODS = [
  {
    id: 'mobile',
    name: 'REGISTRA.PONTO Mobile',
    shortLabel: 'Mobile',
    tagline: 'App no celular do próprio funcionário — reconhecimento facial + GPS, sem hardware dedicado.',
    badge: 'Sem hardware',
    icon: 'Smartphone',
  },
  {
    id: 'kiosk',
    name: 'REGISTRA.PONTO Kiosk',
    shortLabel: 'Kiosk (tablet)',
    tagline: 'Tablet fixo na entrada da empresa — reconhecimento facial centralizado, sem fila.',
    badge: 'Tablet incluso',
    icon: 'Tablet',
  },
]

// ─── Tiers por nº de funcionários ──────────────────────────────────────────
export const TIERS = [
  {
    id: 'up5',
    employees: 'Até 5 funcionários',
    mobile: {
      monthly: 79,
      implCash: 299,
      installments: [{ n: 3, value: 108 }],
    },
    kiosk: {
      monthly: 99,
      implCash: 1670,
      installments: [{ n: 6, value: 319 }, { n: 12, value: 178 }],
    },
  },
  {
    id: '6-10',
    employees: 'Até 10 funcionários',
    popular: true,
    mobile: {
      monthly: 99,
      implCash: 349,
      installments: [{ n: 3, value: 126 }],
    },
    kiosk: {
      monthly: 119,
      implCash: 1700,
      installments: [{ n: 6, value: 324 }, { n: 12, value: 181 }],
    },
  },
  {
    id: '11-20',
    employees: 'Até 20 funcionários',
    mobile: {
      monthly: 149,
      implCash: 429,
      installments: [{ n: 3, value: 155 }],
    },
    kiosk: {
      monthly: 169,
      implCash: 1760,
      installments: [{ n: 6, value: 336 }, { n: 12, value: 188 }],
    },
  },
  {
    id: '21-30',
    employees: 'Até 30 funcionários',
    mobile: {
      monthly: 179,
      implCash: 499,
      installments: [{ n: 4, value: 137 }],
    },
    kiosk: {
      monthly: 199,
      implCash: 1820,
      installments: [{ n: 6, value: 347 }, { n: 12, value: 194 }],
    },
  },
]

export const ENTERPRISE_TIER = {
  id: 'enterprise',
  employees: '31+ funcionários',
  description: 'Implantação personalizada',
}

export const PLUS_MODULE_PRICE = 89.90

export const EMPLOYEE_RANGES = [
  { id: 'up5', label: 'Até 5' },
  { id: '6-10', label: '6 – 10' },
  { id: '11-20', label: '11 – 20' },
  { id: '21-30', label: '21 – 30' },
  { id: '31+', label: '31+' },
]

export function getTierById(id) {
  return TIERS.find((t) => t.id === id) ?? null
}

export function getMethodById(id) {
  return METHODS.find((m) => m.id === id) ?? null
}
