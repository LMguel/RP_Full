import { MapPin, Clock, ShieldCheck, FileSpreadsheet, Wifi, Headset } from 'lucide-react'

export const LOCATIONS = [
  {
    slug: 'paraty',
    path: '/paraty',
    label: 'Paraty',
    seo: {
      title: 'Sistema de Ponto Eletrônico em Paraty — REGISTRA.PONTO',
      description: 'Controle de ponto com reconhecimento facial para empresas de Paraty. Registro via tablet, computador ou celular, banco de horas e exportação para o DP. Implantação em até 48h, com suporte local da Costa Verde.',
    },
    badge: 'Para empresas de Paraty',
    headline: 'Ponto eletrônico para empresas de Paraty, com suporte local.',
    subheadline:
      'Pousadas, comércio e prestadoras de serviço de Paraty controlam o ponto da equipe com reconhecimento facial — sem depender de planilha ou cartão, e com suporte de quem conhece a região.',
    heroImage: '/image/dashboard.webp',
    heroImageAlt: 'Dashboard do REGISTRA.PONTO usado por empresa em Paraty',
    painPoints: [
      {
        icon: MapPin,
        title: 'Suporte de quem está na Costa Verde',
        description: 'Implantação e suporte próximos, sem depender de equipe de fora da região que não conhece a realidade local.',
      },
      {
        icon: Wifi,
        title: 'Funciona mesmo com instabilidade de internet',
        description: 'O registro funciona mesmo em quedas momentâneas de conexão, comuns em pontos mais afastados do centro.',
      },
      {
        icon: FileSpreadsheet,
        title: 'Fechamento pronto para o DP',
        description: 'Exportação em Excel com horas extras e banco de horas já calculados, prontos para a folha de pagamento.',
      },
      {
        icon: ShieldCheck,
        title: 'Registro à prova de fraude',
        description: 'Reconhecimento facial elimina o "bater ponto pelo colega" — cada registro tem foto e horário reais.',
      },
    ],
    ctaMessage: 'Olá! Tenho uma empresa em Paraty e gostaria de saber mais sobre o REGISTRA.PONTO para controle de ponto da equipe.',
  },
  {
    slug: 'mangaratiba',
    path: '/mangaratiba',
    label: 'Mangaratiba',
    seo: {
      title: 'Sistema de Ponto Eletrônico em Mangaratiba — REGISTRA.PONTO',
      description: 'Controle de ponto com reconhecimento facial para empresas de Mangaratiba. Registro via tablet, computador ou celular, banco de horas e exportação para o DP. Implantação em até 48h, com suporte local da Costa Verde.',
    },
    badge: 'Para empresas de Mangaratiba',
    headline: 'Ponto eletrônico para empresas de Mangaratiba, com suporte local.',
    subheadline:
      'Comércio, condomínios e prestadoras de serviço de Mangaratiba controlam o ponto da equipe com reconhecimento facial — sem depender de planilha ou cartão, e com suporte de quem conhece a região.',
    heroImage: '/image/dashboard.webp',
    heroImageAlt: 'Dashboard do REGISTRA.PONTO usado por empresa em Mangaratiba',
    painPoints: [
      {
        icon: MapPin,
        title: 'Suporte de quem está na Costa Verde',
        description: 'Implantação e suporte próximos, sem depender de equipe de fora da região que não conhece a realidade local.',
      },
      {
        icon: Clock,
        title: 'Múltiplos turnos e escalas sem erro',
        description: 'O sistema acompanha jornadas variáveis e folgas trocadas sem confundir intervalo com falta.',
      },
      {
        icon: Headset,
        title: 'Implantação em até 48h',
        description: 'Tablet configurado e equipe treinada rapidamente, sem meses de espera pra começar a usar.',
      },
      {
        icon: ShieldCheck,
        title: 'Registro à prova de fraude',
        description: 'Reconhecimento facial elimina o "bater ponto pelo colega" — cada registro tem foto e horário reais.',
      },
    ],
    ctaMessage: 'Olá! Tenho uma empresa em Mangaratiba e gostaria de saber mais sobre o REGISTRA.PONTO para controle de ponto da equipe.',
  },
]

export function getLocationBySlug(slug) {
  return LOCATIONS.find((l) => l.slug === slug) ?? null
}
