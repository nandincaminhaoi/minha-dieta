// Lê um número digitado em pt-BR ("72,5"). Devolve null se não servir.
export function parseNumber(text, { min = 0, max = 100000 } = {}) {
  let clean = String(text ?? "").trim();
  // "2.200" é dois mil e duzentos; "72.5" continua sendo decimal.
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(clean)) clean = clean.replaceAll(".", "");
  clean = clean.replace(",", ".");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(clean)) return null;
  const value = Number(clean);
  return value >= min && value <= max ? value : null;
}

export const round1 = (value) => Math.round(value * 10) / 10;
