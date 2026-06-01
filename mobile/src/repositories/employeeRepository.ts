import { execute, rowsToArray } from '@database/sqlite';
import type { Employee } from '@/types/domain';
import { nowIso } from '@utils/time';

interface EmployeeRow {
  id: string;
  company_id: string;
  nome: string;
  matricula: string | null;
  cargo: string | null;
  foto_url: string | null;
  face_id: string | null;
  ativo: number;
  horario_entrada: string | null;
  horario_saida: string | null;
  updated_at: string;
}

function rowToEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    company_id: r.company_id,
    nome: r.nome,
    matricula: r.matricula ?? undefined,
    cargo: r.cargo ?? undefined,
    foto_url: r.foto_url ?? undefined,
    face_id: r.face_id ?? undefined,
    ativo: r.ativo === 1,
    horario_entrada: r.horario_entrada ?? undefined,
    horario_saida: r.horario_saida ?? undefined,
    updated_at: r.updated_at,
  };
}

export const EmployeeRepository = {
  async upsert(e: Employee): Promise<void> {
    await execute(
      `INSERT INTO employees (id, company_id, nome, matricula, cargo, foto_url, face_id, ativo, horario_entrada, horario_saida, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         company_id=excluded.company_id,
         nome=excluded.nome,
         matricula=excluded.matricula,
         cargo=excluded.cargo,
         foto_url=excluded.foto_url,
         face_id=excluded.face_id,
         ativo=excluded.ativo,
         horario_entrada=excluded.horario_entrada,
         horario_saida=excluded.horario_saida,
         updated_at=excluded.updated_at`,
      [
        e.id,
        e.company_id,
        e.nome,
        e.matricula ?? null,
        e.cargo ?? null,
        e.foto_url ?? null,
        e.face_id ?? null,
        e.ativo ? 1 : 0,
        e.horario_entrada ?? null,
        e.horario_saida ?? null,
        e.updated_at ?? nowIso(),
      ],
    );
  },

  async upsertMany(list: Employee[]): Promise<number> {
    let n = 0;
    for (const e of list) {
      await this.upsert(e);
      n++;
    }
    return n;
  },

  async findById(id: string): Promise<Employee | null> {
    const res = await execute('SELECT * FROM employees WHERE id = ? LIMIT 1', [id]);
    const rows = rowsToArray<EmployeeRow>(res);
    return rows[0] ? rowToEmployee(rows[0]) : null;
  },

  async listActive(companyId: string): Promise<Employee[]> {
    const res = await execute(
      'SELECT * FROM employees WHERE company_id = ? AND ativo = 1 ORDER BY nome ASC',
      [companyId],
    );
    return rowsToArray<EmployeeRow>(res).map(rowToEmployee);
  },

  async clear(companyId: string): Promise<void> {
    await execute('DELETE FROM employees WHERE company_id = ?', [companyId]);
  },

  async count(companyId: string): Promise<number> {
    const res = await execute('SELECT COUNT(*) as c FROM employees WHERE company_id = ?', [
      companyId,
    ]);
    return Number(res.rows.item(0)?.c ?? 0);
  },
};
