# Assets Folder

Este diretório contém os recursos visuais do app.

## Arquivos Opcionais

Por padrão, o Expo usa ícones e splash screens padrão. Você pode personalizar criando:

- **icon.png** - Ícone do app (1024x1024 px)
- **splash.png** - Tela de carregamento
- **adaptive-icon.png** - Ícone adaptativo Android (1024x1024 px)

## Como Criar os Assets

### Opção 1: Gerador Online
1. Acesse: https://www.appicon.co/
2. Faça upload do logo da empresa
3. Baixe os assets gerados
4. Coloque nesta pasta

### Opção 2: Criar Manualmente
Use qualquer editor de imagens (Photoshop, GIMP, Figma):

**icon.png:**
- Tamanho: 1024x1024 px
- Formato: PNG com transparência
- Conteúdo: Logo centralizado da empresa

**splash.png:**
- Tamanho: 1284x2778 px (ou maior)
- Formato: PNG
- Fundo: #0f172a (azul escuro)
- Conteúdo: Logo + "RegistraPonto" texto

**adaptive-icon.png:**
- Tamanho: 1024x1024 px
- Formato: PNG com transparência
- Área segura: 432x432 px central (Android pode cortar as bordas)

## Nota

O app funciona perfeitamente sem assets personalizados. Os ícones padrão do Expo serão usados até você adicionar os seus.
