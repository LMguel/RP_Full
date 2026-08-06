import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { db } from '../services/offline/db';
import { cacheEmployees } from '../services/offline/employeeCache';
import type { Employee } from '../types';
import KioskOfflineMode from '../features/kiosk/components/KioskOfflineMode';

/**
 * Prova, em nível de componente, a garantia central: independentemente de qualquer
 * estado de horário/relógio do KioskPage, uma vez que o modo offline é montado com
 * um company_id válido, a lista de funcionários em cache aparece e o registro
 * offline funciona — sem depender de rede.
 */

const MOCK_EMPLOYEES: Employee[] = [
  { id: 'emp1', nome: 'Ana Silva', cargo: 'Operadora', ativo: true },
  { id: 'emp2', nome: 'Bruno Costa', cargo: 'Técnico', ativo: true },
];

beforeEach(async () => {
  await db.employees_cache.clear();
  await db.offline_records.clear();
});

afterEach(() => {
  cleanup();
});

describe('KioskOfflineMode — garantia de lista disponível offline', () => {
  it('mostra a lista em cache assim que monta, com company_id válido', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'cmp1');

    render(<KioskOfflineMode companyId="cmp1" onBack={vi.fn()} onRecordQueued={vi.fn()} />);

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
    // não deve mostrar a mensagem de cache vazio
    expect(screen.queryByText('Nenhum funcionário em cache')).not.toBeInTheDocument();
  });

  it('não afirma "cache vazio" enquanto companyId ainda não chegou (race de restauração de sessão)', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'cmp1');

    const { rerender } = render(<KioskOfflineMode companyId="" onBack={vi.fn()} onRecordQueued={vi.fn()} />);
    // com companyId vazio, deve mostrar carregando — nunca a mensagem de cache vazio
    expect(screen.getByText('Carregando funcionários…')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum funcionário em cache')).not.toBeInTheDocument();

    // AuthContext termina de restaurar a sessão e o company_id real chega
    rerender(<KioskOfflineMode companyId="cmp1" onBack={vi.fn()} onRecordQueued={vi.fn()} />);
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
  });

  it('permite selecionar, confirmar e enfileirar um registro offline de ponta a ponta', async () => {
    await cacheEmployees(MOCK_EMPLOYEES, 'cmp1');
    const onRecordQueued = vi.fn();

    render(<KioskOfflineMode companyId="cmp1" onBack={vi.fn()} onRecordQueued={onRecordQueued} />);

    fireEvent.click(await screen.findByText('Ana Silva'));
    expect(await screen.findByText('Confirma que é você?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('✓ Registrar'));

    await waitFor(async () => {
      const records = await db.offline_records.toArray();
      expect(records).toHaveLength(1);
      expect(records[0].employee_id).toBe('emp1');
      expect(records[0].company_id).toBe('cmp1');
      expect(records[0].synced).toBe(false);
    });
    expect(onRecordQueued).toHaveBeenCalled();
  });

  it('mostra "cache vazio" apenas quando de fato não há nada cacheado (não confundido com carregando)', async () => {
    render(<KioskOfflineMode companyId="cmp-sem-cache" onBack={vi.fn()} onRecordQueued={vi.fn()} />);
    expect(await screen.findByText('Nenhum funcionário em cache')).toBeInTheDocument();
  });
});
