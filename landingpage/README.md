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
- Plugin de tema: há um alternador de tema (claro/escuro) no canto superior do hero que persiste a preferência no `localStorage`.
- Código organizado por componentes em `src/components`.
- Animações implementadas com Framer Motion e efeitos de scroll via `whileInView`.

Formulário de contato (envio por e-mail sem backend)
-------------------------------------------------
- O componente `src/components/ContactForm.jsx` está preparado para enviar via um endpoint externo.
- Para envio automático para seu e-mail recomendamos usar Formspree (rápido e sem backend).

Passos rápidos para ativar Formspree:

1. Crie uma conta em https://formspree.io e crie um formulário para receber envios.
2. Copie a URL do endpoint (ex.: `https://formspree.io/f/xxxxxx`).
3. Na pasta `landingpage`, crie um arquivo `.env` (não comitar) com a variável:

```bash
# landingpage/.env
VITE_FORM_ENDPOINT=https://formspree.io/f/SEU_ID_AQUI
```

4. Reinicie o dev server: `npm run dev`.

O `ContactForm` faz POST para esse endpoint com `FormData`; se não houver `VITE_FORM_ENDPOINT` definido, ele abrirá o cliente de e-mail do usuário usando `mailto:miguelesquivel2018@outlook.com` como fallback.

Se preferir, posso configurar integração via EmailJS (envio direto do browser) — me diga se quer essa opção.

Estrutura principal:
- `Hero`, `Problems`, `Solution`, `HowItWorks`, `Benefits`, `CTA`, `Footer`, `ThemeToggle`

Apoio à acessibilidade:
- Seções possuem `aria-labelledby` quando aplicável e botões têm `aria-label`/`title`.

Próximos passos sugeridos:
- Substituir placeholders de textos e números pelo conteúdo final e número real do WhatsApp.
- Testes de usabilidade em dispositivos móveis e ajustes de copy para conversão.
