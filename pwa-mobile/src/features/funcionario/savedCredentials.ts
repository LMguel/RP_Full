// Mesmo esquema já usado pelo EmpresaLoginPage.tsx pro kiosk: guarda login+senha
// localmente pra reconectar sem pedir login toda vez o app é aberto. Codificação
// (base64) não é criptografia — é só ofuscação, mesmo nível de proteção do
// esquema já em produção pra empresa/kiosk.
const SAVED_ID_KEY = '@funcionario:saved_id';
const SAVED_SENHA_KEY = '@funcionario:saved_senha';

export function saveFuncionarioCredentials(id: string, senha: string) {
  localStorage.setItem(SAVED_ID_KEY, id);
  localStorage.setItem(SAVED_SENHA_KEY, btoa(unescape(encodeURIComponent(senha))));
}

export function loadFuncionarioCredentials(): { id: string; senha: string } | null {
  const id = localStorage.getItem(SAVED_ID_KEY);
  const senhaB64 = localStorage.getItem(SAVED_SENHA_KEY);
  if (!id || !senhaB64) return null;
  try {
    const senha = decodeURIComponent(escape(atob(senhaB64)));
    return { id, senha };
  } catch {
    return null;
  }
}

export function clearFuncionarioCredentials() {
  localStorage.removeItem(SAVED_ID_KEY);
  localStorage.removeItem(SAVED_SENHA_KEY);
}
