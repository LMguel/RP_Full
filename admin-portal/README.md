# Admin Portal

Admin Portal é a interface interna do Registro de Ponto usada pelo time administrativo para gerenciar empresas, usuários e operações diárias. O projeto é construído com React, TypeScript e Vite, com Tailwind CSS para estilização e ESLint para padronização.

## Principais recursos
- Autenticação com fluxo protegido (`ProtectedRoute`).
- Dashboard com indicadores operacionais.
- Gestão de empresas (listagem, criação e detalhes).
- Integração com a API interna via `services/api.ts`.

## Stack técnica
- React 18 + TypeScript.
- Vite para bundling e HMR.
- Tailwind CSS + componentes reutilizáveis em `src/components`.
- Context API e hooks customizados para estado de autenticação.

## Estrutura
- `src/pages`: páginas principais (Dashboard, Login, Companies, etc.).
- `src/components`: layout (Sidebar, Topbar, AppLayout) e biblioteca UI.
- `src/services/api.ts`: instância Axios configurada com base URL.
- `src/context/AuthContext.tsx`: guarda sessão do usuário e token.
- `public/`: assets estáticos servidos diretamente.

## Pré-requisitos
- Node.js 18+.
- Gerenciador de pacotes npm (default do projeto).

## Como executar
1. Instale dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Acesse http://localhost:5173.

## Scripts úteis
- `npm run dev`: modo desenvolvimento.
- `npm run build`: build de produção.
- `npm run preview`: serve o build gerado.
- `npm run lint`: executa ESLint com as regras do projeto.

## Variáveis de ambiente
- Copie `.env.example` para `.env` e preencha a URL da API, chaves de autenticação e demais valores obrigatórios.

## Convenções e qualidade
- ESLint e TypeScript evitam regressões e problemas de tipagem.
- Padrões visuais definidos em Tailwind + componentes reutilizáveis.
- Pull requests devem incluir prints do fluxo alterado sempre que houver mudança visual.

## Próximos passos
- Adicionar testes unitários para hooks e contextos.
- Documentar endpoints consumidos pelo `api.ts`.
- Automatizar deploy com CI/CD quando o build for estável.
