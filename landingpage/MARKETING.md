# Marketing — REGISTRA.PONTO

*Última atualização: 2026-08-05*

Este documento registra o estado atual da presença digital do REGISTRA.PONTO, o que já foi feito no site para SEO/conversão, e o que falta — para ser consultado e atualizado ao longo do tempo, sem precisar reconstruir o histórico a cada conversa.

---

## 1. Identidade da marca

| Canal | Nome usado | Observação |
|---|---|---|
| Produto / site | **REGISTRA.PONTO** | `registraponto.app.br` |
| Empresa (CNPJ, contratos) | **LME Tech** | 57.800.994/0001-46 |
| Instagram | **LME Tech** (`@lmetech`) | ⚠️ ver nota abaixo |
| WhatsApp Business | **LME Tech** | ⚠️ ver nota abaixo |
| Google Business Profile | Categoria "Empresa de Automação Empresarial" | Em processo de verificação |

**⚠️ Ponto de atenção — inconsistência de nome:** o produto é vendido e ranqueado como **REGISTRA.PONTO**, mas Instagram e WhatsApp Business estão sob o nome **LME Tech**. Isso pode custar conversão: alguém que pesquisa "REGISTRA.PONTO Instagram" ou salva o WhatsApp esperando ver "REGISTRA.PONTO" no perfil pode estranhar ou não confirmar que é o canal certo. Vale considerar:
- Trocar o nome de exibição do Instagram/WhatsApp Business para "REGISTRA.PONTO" (mantendo LME Tech como a empresa por trás, igual está no rodapé do site — "Desenvolvido por LME Tech"), **ou**
- Deixar como está se a estratégia é a LME Tech ser a marca-mãe visível e o REGISTRA.PONTO um produto dela (modelo tipo "casa de produtos") — mas nesse caso vale deixar isso explícito no bio/descrição dos dois perfis, algo como "LME Tech — criadora do REGISTRA.PONTO".

Essa decisão não foi tomada ainda — está registrada aqui para quando o usuário quiser decidir.

---

## 2. Site — o que já foi feito

### Fase 1 — Correções técnicas críticas
- Imagens convertidas de PNG para WebP: **~11 MB → ~450 KB** no total
- Favicon, `manifest.json` e `og-image.png` criados (antes ausentes — compartilhamento no WhatsApp/Instagram quebrado)
- Preço divergente corrigido (R$129 no `index.html`/JSON-LD vs R$119 real no código)
- Google Analytics 4 instalado (`G-Y1K2YZTWKF`), evento `click_whatsapp` com parâmetro de origem em todos os CTAs de WhatsApp (permite ver por qual seção/botão o lead veio)
- Sitemap limpo (removidas URLs-âncora sem valor de indexação)
- Preço de implantação ocultado da UI (badge "Sob consulta" + botão de orçamento dedicado) — só a mensalidade do plano fica visível

### Fase 2 — Prova social
- Seção "Quem usa" reformulada com dado real: **3 empresas** (Escola, Restaurante, Comércio) em Angra dos Reis e região, sem inventar nomes/logos fictícios (isso seria propaganda enganosa)
- Feedback do contador mantido anônimo, por decisão do usuário

### Fase 3 — Arquitetura (SEO técnico) + redesign
- **Pré-renderização (SSG)**: o site é Vite + React (SPA), sem framework SSR. Em vez de migrar para Next/Astro, foi implementado um build step próprio (`scripts/prerender.mjs` + `src/entry-server.jsx`) que renderiza cada rota para HTML estático via `ReactDOMServer`, injeta no `dist/<rota>/index.html` e hidrata no cliente. Resultado: crawlers e usuários recebem HTML com conteúdo real já na primeira resposta, sem depender de JS carregar primeiro.
- **Design centralizado**: Hero, header do Features, HowItWorks e a seção "Quem usa" foram redesenhados com alinhamento central — visual mais sério/corporativo, a pedido do usuário. As seções Showcase (zig-zag imagem/texto) foram mantidas como estão — é um padrão intencional (mesmo usado por Stripe, Linear), não uma assimetria a corrigir.
- **Páginas de segmento**: `/escolas` e `/restaurantes` criadas com SEO próprio (title, description, canonical), reaproveitando Pricing/FAQ/Footer do site principal. Linkadas a partir do Footer ("Segmentos") e dos cards de setor na seção "Quem usa" da home.
- **Roteamento**: `react-router-dom` adicionado (antes o site era single-page só com âncoras `#`).

### Rotas existentes hoje
| Rota | Status |
|---|---|
| `/` | Home completa |
| `/escolas` | Página de segmento — escolas e faculdades |
| `/restaurantes` | Página de segmento — restaurantes e buffets |

### Rotas planejadas (não criadas ainda)
| Rota | Ideia |
|---|---|
| `/comercios` | Segmento comércio (já existe dado de contexto — falta content page) |
| `/contador` | Dirigida a contadores/escritórios contábeis, foco em "exportação pronta pro fechamento" — potencial canal de indicação |
| `/angra-dos-reis` | Página geográfica para SEO local |
| `/paraty` | Página geográfica para SEO local |
| `/blog` | Conteúdo educativo (banco de horas, Portaria 671, etc.) — não vende diretamente, atrai tráfego de pesquisa |

---

## 3. Google

- **Google Search Console**: configurado, domínio verificado, sitemap enviado e processado.
- **Google Business Profile**: perfil criado, categoria "Empresa de Automação Empresarial", área de atendimento Angra dos Reis e região. **Verificação em andamento** (não confirmada ainda).
- **Avaliações**: nenhuma avaliação real coletada ainda. Prioridade alta — pedir avaliação às 3 empresas que já usam o sistema, tanto para o Google Business quanto para eventualmente popular o Schema `Review` no site (hoje não implementado, propositalmente, para não inventar dado).

---

## 4. Analytics

- **GA4**: `G-Y1K2YZTWKF`, instalado via `gtag.js` direto no `index.html` (sem GTM).
- **Evento customizado**: `click_whatsapp` com parâmetro `origin` identificando de qual CTA veio o clique (ex: `hero_whatsapp`, `pricing_start`, `segment_escolas_hero`, `footer_bottom_bar`, etc.) — ver `src/lib/analytics.js` e `src/data/plans.js`.
- **Sem GTM**: se no futuro for necessário adicionar mais pixels (Meta Ads, etc.), vale reconsiderar migrar para GTM em vez de instalar scripts direto no `index.html`.

---

## 5. O que falta (fora do código, prioridade)

1. **Finalizar verificação do Google Business Profile** e pedir avaliações às 3 empresas clientes — maior alavancador de "aparecer no Google" disponível agora.
2. **Decidir a questão de nome da marca** (seção 1) nos perfis de Instagram/WhatsApp Business.
3. **Backlinks locais**: associação comercial de Angra dos Reis, indicação do contador parceiro, câmara de comércio.
4. **Completar páginas de segmento**: `/comercios`, `/contador`.
5. **Páginas geográficas**: `/angra-dos-reis`, `/paraty` — dependem de ter conteúdo genuíno o suficiente para não parecer spam de SEO (páginas "vazias" só trocando o nome da cidade são penalizadas pelo Google).
6. **Blog**: maior esforço, maior retorno de longo prazo. Vale começar depois que os itens 1–3 estiverem andando.
7. **WhatsApp Business — catálogo**: usar o catálogo nativo do WhatsApp Business para listar os planos, se ainda não configurado.
