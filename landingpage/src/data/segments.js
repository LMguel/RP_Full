import { GraduationCap, UtensilsCrossed, Clock, Users, FileSpreadsheet, ShieldCheck, CalendarClock, Repeat } from 'lucide-react'

export const SEGMENTS = [
  {
    slug: 'escolas',
    path: '/escolas',
    label: 'Escolas e faculdades',
    seo: {
      title: 'Sistema de Ponto Eletrônico para Escolas — REGISTRA.PONTO',
      description: 'Controle de ponto com reconhecimento facial para escolas e faculdades. Registro de docentes e funcionários administrativos, banco de horas e exportação para o DP. Implantação em até 48h.',
    },
    badge: 'Para escolas e faculdades',
    headline: 'Controle o ponto de professores e equipe administrativa sem planilha.',
    subheadline:
      'Docentes com horários variáveis, substituições e múltiplos turnos tornam o controle manual de ponto uma fonte constante de erro. O REGISTRA.PONTO registra automaticamente, sem cartão nem senha.',
    heroImage: '/image/dashboard.webp',
    heroImageAlt: 'Dashboard do REGISTRA.PONTO usado em escola',
    painPoints: [
      {
        icon: CalendarClock,
        title: 'Horários variáveis por professor',
        description: 'Cada docente tem grade própria — o sistema acompanha jornada individual sem precisar recalcular manualmente todo mês.',
      },
      {
        icon: Users,
        title: 'Equipe administrativa e docente no mesmo painel',
        description: 'Professores, coordenação e equipe de apoio registrados e visíveis num único dashboard, sem planilhas separadas.',
      },
      {
        icon: FileSpreadsheet,
        title: 'Fechamento simplificado para o financeiro',
        description: 'Exportação em Excel pronta para o setor financeiro ou contabilidade da escola, sem retrabalho manual.',
      },
      {
        icon: ShieldCheck,
        title: 'Registro à prova de fraude',
        description: 'Reconhecimento facial elimina o "bater ponto pelo colega" — cada registro tem foto e horário reais.',
      },
    ],
    ctaMessage: 'Olá! Tenho uma escola/faculdade e gostaria de saber mais sobre o REGISTRA.PONTO para controle de ponto de professores e equipe.',
  },
  {
    slug: 'restaurantes',
    path: '/restaurantes',
    label: 'Restaurantes e buffets',
    seo: {
      title: 'Sistema de Ponto Eletrônico para Restaurantes — REGISTRA.PONTO',
      description: 'Controle de ponto com reconhecimento facial para restaurantes e buffets. Feito para alta rotatividade de turno, escalas e fechamento rápido. Implantação em até 48h.',
    },
    badge: 'Para restaurantes e buffets',
    headline: 'Controle o ponto da equipe mesmo com escala e rotatividade alta.',
    subheadline:
      'Turnos partidos, folgas variáveis e troca frequente de equipe tornam o controle manual inviável em cozinha e salão. O REGISTRA.PONTO registra em segundos, sem fila na entrada.',
    heroImage: '/image/captura.webp',
    heroImageAlt: 'Tablet de registro facial usado em restaurante',
    painPoints: [
      {
        icon: Repeat,
        title: 'Alta rotatividade de equipe',
        description: 'Cadastro rápido de novos funcionários — sem processo burocrático para colocar alguém pra registrar ponto no mesmo dia.',
      },
      {
        icon: Clock,
        title: 'Turnos partidos e escalas variáveis',
        description: 'O sistema acompanha múltiplas entradas e saídas por dia sem confundir intervalo com falta.',
      },
      {
        icon: Users,
        title: 'Sem fila no horário de pico',
        description: 'Reconhecimento facial registra em segundos — não trava a entrada da cozinha antes do movimento começar.',
      },
      {
        icon: FileSpreadsheet,
        title: 'Fechamento de horas extras sem retrabalho',
        description: 'Horas extras de fim de semana e feriado calculadas automaticamente, prontas para a folha.',
      },
    ],
    ctaMessage: 'Olá! Tenho um restaurante/buffet e gostaria de saber mais sobre o REGISTRA.PONTO para controle de ponto da equipe.',
  },
]

export function getSegmentBySlug(slug) {
  return SEGMENTS.find((s) => s.slug === slug) ?? null
}
