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
// hardware+markup para o Kiosk). Tabela vigente desde 2026-08-13.
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
      monthly: 119,
      implCash: 299,
      installments: [{ n: 3, value: 110 }],
    },
    kiosk: {
      monthly: 139,
      implCash: 699,
      installments: [{ n: 6, value: 320 }, { n: 12, value: 180 }],
    },
  },
  {
    id: '6-10',
    employees: 'Até 10 funcionários',
    popular: true,
    mobile: {
      monthly: 179,
      implCash: 349,
      installments: [{ n: 3, value: 125 }],
    },
    kiosk: {
      monthly: 199,
      implCash: 799,
      installments: [{ n: 6, value: 340 }, { n: 12, value: 195 }],
    },
  },
  {
    id: '11-20',
    employees: 'Até 20 funcionários',
    mobile: {
      monthly: 259,
      implCash: 449,
      installments: [{ n: 3, value: 160 }],
    },
    kiosk: {
      monthly: 279,
      implCash: 949,
      installments: [{ n: 6, value: 370 }, { n: 12, value: 210 }],
    },
  },
  {
    id: '21-30',
    employees: 'Até 30 funcionários',
    mobile: {
      monthly: 329,
      implCash: 549,
      installments: [{ n: 4, value: 150 }],
    },
    kiosk: {
      monthly: 349,
      implCash: 1099,
      installments: [{ n: 6, value: 400 }, { n: 12, value: 225 }],
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
