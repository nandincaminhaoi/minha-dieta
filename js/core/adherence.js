import { goalFor } from "./goals.js";
import { totals } from "./log.js";
import { addDays } from "./dates.js";

// Faixa de calorias aceita, em % da meta.
export const BANDS = { emagrecer: [85, 105], manter: [90, 110], ganhar: [95, 115] };
const PROTEIN_MIN = 95;

export function dayStatus(state, date, today) {
  if (date >= today) return "andamento";
  const items = state.days[date];
  if (!items?.length) return "sem-registro";
  const goal = goalFor(state.goals, date);
  if (!goal) return "sem-meta";
  const sum = totals(items);
  const kcal = Math.round(sum.kcal) * 100;
  const [low, high] = BANDS[goal.objective];
  const met = kcal >= goal.kcal * low && kcal <= goal.kcal * high && Math.round(sum.protein) * 100 >= goal.protein * PROTEIN_MIN;
  return met ? "cumprido" : "nao";
}

// Os n dias anteriores a hoje.
export function summary(state, today, n) {
  let met = 0, counted = 0, logged = 0, kcal = 0, protein = 0;
  for (let i = 1; i <= n; i++) {
    const date = addDays(today, -i);
    const status = dayStatus(state, date, today);
    if (status === "sem-registro") continue;
    const sum = totals(state.days[date]);
    logged++; kcal += sum.kcal; protein += sum.protein;
    if (status === "sem-meta") continue;
    counted++;
    if (status === "cumprido") met++;
  }
  return {
    met, counted,
    pct: counted ? Math.round((met / counted) * 100) : null,
    avgKcal: logged ? Math.round(kcal / logged) : null,
    avgProtein: logged ? Math.round(protein / logged) : null,
  };
}

export function latestWeight(weights) {
  const date = Object.keys(weights).sort().at(-1);
  return date ? { date, kg: weights[date] } : null;
}
