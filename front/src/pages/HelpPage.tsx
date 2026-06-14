import React, { useState } from 'react';
import PageLayout from '../sections/PageLayout';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  EditCalendar as AdjustIcon,
  PersonAdd as PersonAddIcon,
  BeachAccess as HolidayIcon,
  TableChart as MirrorIcon,
  Dashboard as DashboardIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  BuildCircle as BuildCircleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  faqs: FaqItem[];
}

const sections: Section[] = [
  {
    title: 'Ajuste de Registros',
    icon: <AdjustIcon />,
    color: '#f59e0b',
    badge: 'Mais usado',
    faqs: [
      {
        question: 'Como corrigir um registro de ponto incorreto?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Acesse <b>Registros → Espelho de Ponto</b>, selecione o funcionário e o mês desejado.</Typography>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>Clique na linha do dia que precisa de ajuste</li>
              <li>Expanda a linha para ver os registros individuais (batidas)</li>
              <li>Clique em <b>Ajustar</b> no registro incorreto</li>
              <li>Informe o horário correto e uma justificativa (ex: "Esquecimento de registro")</li>
              <li>Confirme — o registro fica com o badge "Ajuste" para auditoria</li>
            </ol>
          </Box>
        ),
      },
      {
        question: 'Como adicionar um registro que o funcionário esqueceu de bater?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>No Espelho de Ponto do funcionário, clique em <b>"+ Adicionar Registro"</b> no dia correspondente.</Typography>
            <Typography sx={{ mb: 1 }}>Selecione o tipo:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><b>Entrada</b> — registro de chegada</li>
              <li><b>Saída</b> — registro de saída</li>
              <li><b>Dia Inteiro</b> — lança o dia completo como trabalhado (conforme horário cadastrado)</li>
            </ul>
            <Typography sx={{ mt: 1 }}>Todos os registros manuais ficam marcados para auditoria.</Typography>
          </Box>
        ),
      },
      {
        question: 'Como invalidar (excluir) um registro criado por engano?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>No Espelho de Ponto, expanda o dia e clique em <b>Invalidar</b> no registro desejado.</Typography>
            <Typography>O registro não é deletado — ele fica visível com status "Invalidado" para histórico. Isso garante rastreabilidade completa de todas as alterações.</Typography>
          </Box>
        ),
      },
      {
        question: 'O sistema mostra "Incompleto" num dia. O que significa?',
        answer: (
          <Typography>Significa que o funcionário teve registro de entrada mas não de saída (ou vice-versa) naquele dia. Verifique se houve esquecimento de bater o ponto na saída e, se necessário, adicione o registro manualmente.</Typography>
        ),
      },
    ],
  },
  {
    title: 'Correções',
    icon: <BuildCircleIcon />,
    color: '#a78bfa',
    badge: 'Novo',
    faqs: [
      {
        question: 'O que é a aba de Correções e quando ela aparece?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>
              A aba <b>Correções</b> centraliza todos os dias com alguma inconsistência de ponto — sem precisar varrer o espelho de ponto funcionário por funcionário.
            </Typography>
            <Typography sx={{ mb: 1 }}>
              Um banner amarelo aparece automaticamente no <b>Dashboard</b> sempre que há pendências no mês atual, indicando o total. Clique nele para ir direto às correções.
            </Typography>
            <Typography>
              A contagem considera os mesmos critérios da página de Correções, incluindo registros próximos demais — dashboard e correções sempre mostram o mesmo número.
            </Typography>
          </Box>
        ),
      },
      {
        question: 'Quais tipos de pendência são detectados?',
        answer: (
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[
                { color: '#f97316', label: 'Sem saída', desc: 'Funcionário registrou entrada mas não registrou saída no dia.' },
                { color: '#eab308', label: 'Incompleto', desc: 'Número de batidas menor que o esperado para o tipo de jornada. Ex: funcionário com intervalo manual e apenas 2 registros (faltam saída do almoço e saída final).' },
                { color: '#ef4444', label: 'Falta', desc: 'Nenhum registro encontrado num dia útil em que o funcionário deveria ter trabalhado.' },
                { color: '#f59e0b', label: 'Atraso', desc: 'Funcionário registrou presença mas com atraso além da tolerância configurada.' },
                { color: '#a78bfa', label: 'Registros Próximos', desc: 'Dois ou mais registros do mesmo dia estão separados por menos de 10 minutos — possível duplo clique ou engano.' },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', gap: 1.25, p: 1.25, borderRadius: '8px', bgcolor: `${item.color}0d`, border: `1px solid ${item.color}25` }}>
                  <Box sx={{ width: 8, borderRadius: 99, bgcolor: item.color, flexShrink: 0, mt: 0.25 }} />
                  <Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: item.color, mb: 0.25 }}>{item.label}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{item.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ),
      },
      {
        question: 'Como corrigir uma pendência — editar ou invalidar um registro?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>
              Clique em qualquer linha da tabela para abrir o painel lateral com todos os registros daquele dia.
            </Typography>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>O painel lista cada batida com horário, tipo e método de registro</li>
              <li>Clique no <b>lápis ✎</b> para ajustar o horário de um registro (informe o novo horário e uma justificativa)</li>
              <li>Clique na <b>lixeira 🗑</b> para invalidar um registro incorreto (o registro fica visível como "Invalidado" para auditoria)</li>
              <li>Clique em <b>"+ Adicionar registro"</b> para inserir uma batida que o funcionário esqueceu — o sistema detecta automaticamente o tipo correto (entrada, saída, volta do almoço etc.)</li>
            </ol>
            <Typography sx={{ mt: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              Todos os ajustes manuais ficam registrados com justificativa para fins de auditoria.
            </Typography>
          </Box>
        ),
      },
      {
        question: 'O que são "Registros Próximos" e como tratar?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>
              Quando dois registros do mesmo dia têm menos de <b>10 minutos</b> de diferença, o sistema sinaliza como <b>Registros Próximos</b> (chip roxo). Isso geralmente indica:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 8 }}>
              <li>Funcionário passou duas vezes no totem por engano</li>
              <li>Registro manual duplicado</li>
              <li>Casos legítimos (ex: saída e retorno rápido)</li>
            </ul>
            <Typography sx={{ mb: 1 }}>Ao abrir o painel do dia, os registros envolvidos ficam destacados em amarelo. O gestor tem duas opções:</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#a78bfa', mb: 0.25 }}>✓ Confirmar como correto</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>O registro está certo mesmo — o alerta some da lista. Pode ser feito pelo botão roxo na tabela ou dentro do painel lateral.</Typography>
              </Box>
              <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#4ade80', mb: 0.25 }}>↗ Corrigir</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Abre o painel para invalidar o registro duplicado ou ajustar o horário.</Typography>
              </Box>
            </Box>
          </Box>
        ),
      },
      {
        question: 'Como filtrar e buscar pendências específicas?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Use os controles no topo da página:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><b>Chips de status</b> (Incompleto, Falta, Sem saída…) — filtram por tipo de pendência com contagem ao lado</li>
              <li><b>Campo de busca</b> — filtra por nome do funcionário</li>
              <li><b>Seletor de mês/ano</b> — navega entre períodos históricos</li>
            </ul>
            <Typography sx={{ mt: 1 }}>Por padrão a página mostra o mês atual. Dias do dia de hoje em diante nunca geram pendências — somente dias passados são considerados.</Typography>
          </Box>
        ),
      },
    ],
  },
  {
    title: 'Funcionários',
    icon: <PersonAddIcon />,
    color: '#10b981',
    faqs: [
      {
        question: 'Como cadastrar um novo funcionário?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Vá em <b>Funcionários</b> e clique em <b>"Cadastrar Funcionário"</b>.</Typography>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>Preencha nome, cargo e senha de acesso ao ponto</li>
              <li>Adicione foto (usada no reconhecimento facial)</li>
              <li>Escolha o tipo de horário: <b>Fixo</b> (dias e horários definidos) ou <b>Variável</b> (sem horário fixo)</li>
              <li>Para horário Fixo: configure entrada, saída e dias ativos de cada semana</li>
              <li>Defina o intervalo individual (se diferente do padrão da empresa)</li>
            </ol>
          </Box>
        ),
      },
      {
        question: 'Qual a diferença entre horário Fixo e Variável?',
        answer: (
          <Box>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1.5, mb: 1 }}>
              <Typography sx={{ fontWeight: 700, color: '#10b981', mb: 0.5 }}>Horário Fixo</Typography>
              <Typography sx={{ fontSize: 13 }}>Para funcionários com dias e horários definidos. O sistema calcula automaticamente previstos, atrasos e horas extras com base no horário cadastrado.</Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1.5 }}>
              <Typography sx={{ fontWeight: 700, color: '#3b82f6', mb: 0.5 }}>Horário Variável (Horista)</Typography>
              <Typography sx={{ fontSize: 13 }}>Para funcionários com carga horária variável por dia ou semana. O sistema registra as batidas mas não calcula previstos automaticamente.</Typography>
            </Box>
          </Box>
        ),
      },
      {
        question: 'Como configurar turnos diferentes para cada funcionário?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Ao cadastrar ou editar um funcionário com horário <b>Fixo</b>, configure os horários por dia da semana.</Typography>
            <Typography sx={{ mb: 1 }}>Você pode ativar/desativar dias individuais e usar os <b>Presets de Horário</b> para aplicar rapidamente um padrão de turno já configurado na empresa.</Typography>
            <Typography>Cada funcionário pode ter horários distintos por dia da semana — ex: entra às 8h na segunda e às 9h na quarta.</Typography>
          </Box>
        ),
      },
      {
        question: 'Como editar os dados de um funcionário já cadastrado?',
        answer: (
          <Typography>Na lista de <b>Funcionários</b>, clique no menu (⋮) ao lado do funcionário e selecione <b>Editar</b>. Você pode alterar todos os dados, incluindo horários e foto. A alteração de horário passa a valer a partir do próximo registro.</Typography>
        ),
      },
    ],
  },
  {
    title: 'Feriados',
    icon: <HolidayIcon />,
    color: '#8b5cf6',
    faqs: [
      {
        question: 'Como adicionar um feriado ao calendário?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Acesse <b>Configurações → Calendário de Feriados</b>.</Typography>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>Clique em <b>"+ Adicionar Feriado"</b></li>
              <li>Selecione a data e informe o nome (ex: "Aniversário da Cidade")</li>
              <li>Salve — o feriado aparece imediatamente no calendário</li>
            </ol>
            <Typography sx={{ mt: 1 }}>Você também pode importar feriados nacionais automaticamente clicando em <b>"Importar Feriados Nacionais"</b>.</Typography>
          </Box>
        ),
      },
      {
        question: 'O que acontece com os funcionários em dias de feriado?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Dias marcados como feriado são tratados automaticamente:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>No Espelho de Ponto o dia aparece com marcador <b>F</b> (feriado)</li>
              <li>Funcionários com horário fixo que <b>não registraram ponto</b> no feriado recebem crédito automático das horas previstas</li>
              <li>Se o funcionário trabalhou no feriado, o sistema registra normalmente e pode calcular hora extra conforme configuração</li>
            </ul>
          </Box>
        ),
      },
      {
        question: 'Como remover um feriado cadastrado por engano?',
        answer: (
          <Typography>Em <b>Configurações → Calendário de Feriados</b>, localize o feriado na lista e clique no ícone de lixeira. A remoção é imediata e os cálculos do Espelho de Ponto são atualizados na próxima visualização.</Typography>
        ),
      },
    ],
  },
  {
    title: 'Espelho de Ponto',
    icon: <MirrorIcon />,
    color: '#3b82f6',
    faqs: [
      {
        question: 'Como acessar o espelho de ponto de um funcionário?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Existem dois caminhos:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Via <b>Registros → Espelho de Ponto</b>: busque o funcionário pelo nome</li>
              <li>Via <b>Funcionários</b>: clique no nome ou no menu (⋮) → "Ver Espelho"</li>
            </ul>
          </Box>
        ),
      },
      {
        question: 'O que significam os ícones no calendário do espelho?',
        answer: (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              { icon: '✓', label: 'Presente', color: '#10b981' },
              { icon: '!', label: 'Com atraso', color: '#f59e0b' },
              { icon: '⚠', label: 'Incompleto (sem saída)', color: '#f59e0b' },
              { icon: 'F', label: 'Feriado', color: '#8b5cf6' },
              { icon: '✗', label: 'Falta', color: '#ef4444' },
              { icon: '○', label: 'Sem registro (dia não útil)', color: '#6b7280' },
              { icon: '⏳', label: 'Em processamento (hoje)', color: '#3b82f6' },
            ].map(item => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: 15, color: item.color, minWidth: 20, textAlign: 'center' }}>{item.icon}</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        ),
      },
      {
        question: 'Como exportar o espelho para Excel?',
        answer: (
          <Typography>No Espelho de Ponto, clique no botão <b>"Exportar Excel"</b> no canto superior direito. O arquivo baixado contém todas as batidas do mês selecionado com totais de horas trabalhadas, extras e saldo do banco de horas.</Typography>
        ),
      },
      {
        question: 'O que é o Banco de Horas e como ele funciona?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>O Banco de Horas acumula a diferença entre horas trabalhadas e horas previstas ao longo do mês:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><b>Saldo positivo:</b> funcionário trabalhou mais que o previsto (horas extras acumuladas)</li>
              <li><b>Saldo negativo:</b> funcionário trabalhou menos que o previsto</li>
            </ul>
            <Typography sx={{ mt: 1 }}>Uma tolerância mensal de 2 horas é aplicada — diferenças ≤ 2h no mês são desconsideradas para evitar penalidades por pequenos atrasos compensados.</Typography>
          </Box>
        ),
      },
    ],
  },
  {
    title: 'Dashboard e Relatórios',
    icon: <DashboardIcon />,
    color: '#ef4444',
    faqs: [
      {
        question: 'O que mostra o Dashboard principal?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>O Dashboard mostra uma visão em tempo real do dia:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><b>Presentes hoje:</b> quantos funcionários já registraram ponto</li>
              <li><b>Ausências:</b> quem ainda não registrou (pode ser falta, atestado ou folga)</li>
              <li><b>Horas no mês:</b> total de horas trabalhadas por todos no mês atual</li>
              <li><b>Saldo do mês:</b> saldo acumulado do banco de horas de toda a equipe</li>
              <li><b>Últimos Registros:</b> as 5 batidas mais recentes com status de pontualidade</li>
            </ul>
          </Box>
        ),
      },
      {
        question: 'Como ver todos os registros do dia?',
        answer: (
          <Typography>Acesse <b>Registros → Registros Diários</b> para visualizar todas as batidas do dia, com filtros por funcionário, tipo (entrada/saída) e horário. Para registros históricos, use <b>Registros Gerais</b> com filtro de período.</Typography>
        ),
      },
    ],
  },
  {
    title: 'Configurações',
    icon: <ScheduleIcon />,
    color: '#06b6d4',
    faqs: [
      {
        question: 'Como configurar o horário padrão da empresa?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>Em <b>Configurações → Horários da Empresa</b>, defina os horários padrão que serão usados como base para funcionários sem horário individual configurado.</Typography>
            <Typography>Você pode criar <b>Presets de Horário</b> (ex: "Turno A", "Turno B", "Integral") e aplicá-los rapidamente ao cadastrar funcionários.</Typography>
          </Box>
        ),
      },
      {
        question: 'O que é a Tolerância de Ponto?',
        answer: (
          <Box>
            <Typography sx={{ mb: 1 }}>A Tolerância é uma margem de minutos que não é contada como atraso. Exemplo: com 5 minutos de tolerância, um funcionário que chegou às 8h05 para um turno de 8h não é penalizado.</Typography>
            <Typography sx={{ color: '#fbbf24', fontSize: 13 }}>Pela CLT Art. 58 §1º, a tolerância máxima permitida é de <b>10 minutos por dia</b> (soma de atrasos e antecipações).</Typography>
          </Box>
        ),
      },
      {
        question: 'O que é o Intervalo Automático?',
        answer: (
          <Typography>Quando ativado, o sistema desconta automaticamente o tempo de intervalo (ex: 1 hora de almoço) no cálculo de horas trabalhadas, sem precisar de batida de saída/retorno do intervalo. Ideal para empresas onde funcionários não registram ponto no intervalo.</Typography>
        ),
      },
    ],
  },
];

const HelpPage: React.FC = () => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <PageLayout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', mb: 0.5 }}>
            Central de Ajuda
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', letterSpacing: '-0.02em', mb: 1 }}>
            Como usar o sistema
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, maxWidth: 520 }}>
            Guia para gestores — registros, ajustes, feriados e configurações de horários explicados passo a passo.
          </Typography>
        </Box>
      </motion.div>

      {/* Quick links */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4 }}>
          {sections.map((s) => (
            <Chip
              key={s.title}
              icon={<Box sx={{ color: s.color, display: 'flex', ml: 0.5 }}>{React.cloneElement(s.icon as React.ReactElement, { sx: { fontSize: 15 } })}</Box>}
              label={s.title}
              onClick={() => {
                const el = document.getElementById(`section-${s.title}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              sx={{ bgcolor: 'rgba(255,255,255,0.06)', border: `1px solid ${s.color}33`, color: 'rgba(255,255,255,0.75)', fontSize: 12, height: 30, cursor: 'pointer', '&:hover': { bgcolor: `${s.color}18`, color: 'white' }, transition: 'all 0.18s' }}
            />
          ))}
        </Box>
      </motion.div>

      {/* Sections */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {sections.map((section, si) => (
          <motion.div key={section.title} id={`section-${section.title}`}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 + si * 0.06 }}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: section.color + '1a', color: section.color, display: 'flex' }}>
                    {section.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontWeight: 700, color: 'white', fontSize: 16 }}>{section.title}</Typography>
                      {section.badge && (
                        <Chip label={section.badge} size="small" sx={{ bgcolor: section.color + '22', color: section.color, fontSize: 10, height: 18, fontWeight: 700 }} />
                      )}
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                {section.faqs.map((faq, fi) => (
                  <Accordion
                    key={fi}
                    expanded={expanded === `${si}-${fi}`}
                    onChange={handleChange(`${si}-${fi}`)}
                    elevation={0}
                    sx={{
                      bgcolor: 'transparent',
                      '&:before': { display: 'none' },
                      '& .MuiAccordionSummary-root': { px: 0, minHeight: 48 },
                      '& .MuiAccordionDetails-root': { px: 0, pt: 0, pb: 1.5 },
                      borderBottom: fi < section.faqs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }} />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <InfoIcon sx={{ fontSize: 15, color: section.color, opacity: 0.7, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                          {faq.question}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ pl: 3.5, color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7, '& b': { color: 'rgba(255,255,255,0.9)', fontWeight: 600 }, '& li': { mb: 0.5 } }}>
                        {faq.answer}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Box>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Box sx={{ mt: 4, p: 2.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Dúvidas adicionais? Use o <b style={{ color: 'rgba(255,255,255,0.55)' }}>Assistente RH</b> no menu lateral — ele responde perguntas sobre funcionários, faltas e saldos em tempo real.
          </Typography>
        </Box>
      </motion.div>
    </PageLayout>
  );
};

export default HelpPage;
