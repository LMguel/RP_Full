# REGISTRA.PONTO — Landing Page

Projeto: Landing page moderna para o SaaS REGISTRA.PONTO

Stack: React (Vite), Tailwind CSS, Framer Motion

Como rodar localmente:

1. Instale dependências:
   - `npm install` (ou `yarn`)
2. Rode em modo dev:
   - `npm run dev` (Vite inicia tipicamente em `http://localhost:5173`)
3. Abra no navegador:
   - Acesse `http://localhost:5173` (ou a porta indicada no terminal do Vite)
4. Build de produção:
   - `npm run build` e `npm run preview` para testar o build localmente

Observações importantes:
- O número do WhatsApp é um placeholder `+55 11 99999-9999` — substitua pelo número real em `src/components/WhatsAppButton.jsx`.
- Plugin de tema: há um alternador de tema (claro/escuro) no canto superior do hero que persiste a preferência no `localStorage`.
- Código organizado por componentes em `src/components`.
- Animações implementadas com Framer Motion e efeitos de scroll via `whileInView`.

Estrutura principal:
- `Hero`, `Problems`, `Solution`, `HowItWorks`, `Benefits`, `CTA`, `Footer`, `WhatsAppButton`, `ThemeToggle`

Apoio à acessibilidade:
- Seções possuem `aria-labelledby` quando aplicável e botões têm `aria-label`/`title`.

Próximos passos sugeridos:
- Substituir placeholders de textos e números pelo conteúdo final e número real do WhatsApp.
- Testes de usabilidade em dispositivos móveis e ajustes de copy para conversão.
