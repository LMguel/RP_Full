// Mesmo esquema já usado pelo EmpresaLoginPage.tsx pro kiosk: guarda login+senha
// localmente pra reconectar sem pedir login toda vez o app é aberto. Codificação
// (base64) não é criptografia — é só ofuscação, mesmo nível de proteção do
// esquema já em produção pra empresa/kiosk.
//
// Todo acesso ao localStorage é blindado com try/catch: em modo privado do
// Safari/iOS (e alguns bloqueios de cookies/site data), setItem/getItem podem
// lançar exceção. Sem a blindagem, isso derrubava o login inteiro — o usuário
// via "ID ou senha inválidos" mesmo com credenciais corretas, porque o erro de
// storage era capturado pelo catch do login e mascarava o sucesso real.
const SAVED_ID_KEY = '@funcionario:saved_id';
const SAVED_SENHA_KEY = '@funcionario:saved_senha';

export function saveFuncionarioCredentials(id: string, senha: string) {
  try {
    localStorage.setItem(SAVED_ID_KEY, id);
    localStorage.setItem(SAVED_SENHA_KEY, btoa(unescape(encodeURIComponent(senha))));
  } catch {
    // Storage indisponível (modo privado, cookies bloqueados, quota) — login
    // segue normalmente, só não persiste para a próxima abertura do app.
  }
}

export function loadFuncionarioCredentials(): { id: string; senha: string } | null {
  try {
    const id = localStorage.getItem(SAVED_ID_KEY);
    const senhaB64 = localStorage.getItem(SAVED_SENHA_KEY);
    if (!id || !senhaB64) return null;
    const senha = decodeURIComponent(escape(atob(senhaB64)));
    return { id, senha };
  } catch {
    return null;
  }
}

export function clearFuncionarioCredentials() {
  try {
    localStorage.removeItem(SAVED_ID_KEY);
    localStorage.removeItem(SAVED_SENHA_KEY);
  } catch {
    // ignore
  }
}
