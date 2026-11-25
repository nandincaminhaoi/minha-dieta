// Datas "AAAA-MM-DD" e horas "HH:MM" sempre no horário local.
const pad = (n) => String(n).padStart(2, "0");

export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function toDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(date, n) {
  const d = toDate(date);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && localDate(toDate(s)) === s;
export const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// Quem estava vendo "hoje" passa para o novo hoje; outro dia escolhido fica.
export const followToday = (viewed, oldToday, today) => (viewed === oldToday ? today : viewed);

export function daysBetween(from, to) {
  return Math.round((toDate(to) - toDate(from)) / 86400000);
}
