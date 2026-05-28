export function getSaoPauloDateTime(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 3600000);
}

export function getSaoPauloTimeString(): string {
  const sp = getSaoPauloDateTime();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${sp.getFullYear()}-${pad(sp.getMonth() + 1)}-${pad(sp.getDate())} ${pad(sp.getHours())}:${pad(sp.getMinutes())}:${pad(sp.getSeconds())}`;
}

export function getSaoPauloDateString(): string {
  return getSaoPauloDateTime().toISOString().slice(0, 10);
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
