import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export function uuid(): string {
  return uuidv4();
}

/**
 * Gera client_id determinístico para idempotência: <employee>:<minute>
 * Permite resync sem duplicar registros no backend.
 */
export function timeRecordClientId(employeeId: string, ts: Date = new Date()): string {
  const yyyy = ts.getUTCFullYear();
  const mm = String(ts.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ts.getUTCDate()).padStart(2, '0');
  const hh = String(ts.getUTCHours()).padStart(2, '0');
  const mi = String(ts.getUTCMinutes()).padStart(2, '0');
  return `${employeeId}-${yyyy}${mm}${dd}T${hh}${mi}`;
}
