/** Utilitários do lançamento de ponto manual em lote. */

const HHMM_RE = /^(\d{1,2})[:hH.](\d{2})$/;

export function normalizarHhmm(valor: string): string | null {
  const m = HHMM_RE.exec(valor.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Mensagem de erro para as batidas de um dia, ou null se estiverem corretas. */
export function validarBatidasDia(batidas: string[]): string | null {
  const preenchidas = batidas.map(b => b.trim()).filter(Boolean);
  if (preenchidas.length === 0) return 'Preencha os horários';
  const norm = preenchidas.map(normalizarHhmm);
  if (norm.some(n => n === null)) return 'Horário inválido';
  if (norm.length % 2 !== 0) return 'Falta uma entrada ou saída';
  const ok = norm as string[];
  for (let i = 1; i < ok.length; i++) {
    if (ok[i] <= ok[i - 1]) return 'Horários fora de ordem';
  }
  return null;
}

export interface ParseColadoResultado {
  porData: Record<string, string[]>;
  erros: string[];
}

/**
 * Interpreta texto colado, uma linha por dia:
 *   07/11 08:00 12:00 13:00 17:00
 *   08/11/2026 08:00 17:00
 *   2026-11-09 08h 12h ...
 * A data sem ano é resolvida dentro do período informado (YYYY-MM-DD).
 */
export function parseHorariosColados(
  texto: string,
  inicio: string,
  fim: string,
): ParseColadoResultado {
  const porData: Record<string, string[]> = {};
  const erros: string[] = [];
  const anos = Array.from(new Set([Number(inicio.slice(0, 4)), Number(fim.slice(0, 4))]));

  const resolverData = (token: string): string | null => {
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
    if (m) return token;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(token);
    if (m) {
      const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    m = /^(\d{1,2})\/(\d{1,2})$/.exec(token);
    if (m) {
      for (const ano of anos) {
        const iso = `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        if (iso >= inicio && iso <= fim) return iso;
      }
    }
    return null;
  };

  texto.split(/\r?\n/).forEach(linhaBruta => {
    const linha = linhaBruta.trim();
    if (!linha) return;
    const [dataToken, ...resto] = linha.split(/[\s,;]+/).filter(Boolean);
    const iso = resolverData(dataToken);
    if (!iso) {
      erros.push(`"${linha}" — data não reconhecida ou fora do período`);
      return;
    }
    // Aceita "08:00 às 12:00" ignorando conectores
    const horas = resto.filter(t => !/^(a|à|às|as|e|-|–)$/i.test(t));
    const norm = horas.map(normalizarHhmm);
    if (horas.length === 0 || norm.some(n => n === null)) {
      erros.push(`"${linha}" — horário inválido`);
      return;
    }
    porData[iso] = norm as string[];
  });

  return { porData, erros };
}

export function formatarDataBr(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
