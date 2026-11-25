export const ACTIVITIES = [
  [1.2, "Sedentário"],
  [1.375, "Leve (1 a 3 dias por semana)"],
  [1.55, "Moderado (3 a 5 dias)"],
  [1.725, "Intenso (6 a 7 dias)"],
  [1.9, "Muito intenso"],
];
export const OBJECTIVES = { emagrecer: "Emagrecer", manter: "Manter", ganhar: "Ganhar massa" };

const ADJUST = { emagrecer: 0.8, manter: 1, ganhar: 1.1 };
const PROTEIN = { emagrecer: 1.8, manter: 1.4, ganhar: 1.8 };
const FLOOR = { f: 1200, m: 1500 };

// Mifflin-St Jeor. Estimativa; null para menores de 18.
export function calcGoals({ sex, age, weight, height, activity, objective }) {
  if (age < 18) return null;
  const warnings = [];
  const rest = 10 * weight + 6.25 * height - 5 * age + (sex === "m" ? 5 : -161);
  let kcal = rest * activity * ADJUST[objective];
  if (kcal < FLOOR[sex]) {
    kcal = FLOOR[sex];
    warnings.push(`O cálculo ficou abaixo do mínimo; usei ${FLOOR[sex]} kcal. Procure um profissional.`);
  }
  const protein = PROTEIN[objective] * Math.min(weight, 30 * (height / 100) ** 2);
  const fat = (kcal * 0.25) / 9;
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs <= 0) {
    carbs = 0;
    warnings.push("Proteína e gordura já ocupam todas as calorias; ajuste as metas à mão.");
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), warnings };
}

export function saveGoal(goals, entry) {
  return [...goals.filter((g) => g.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

export function goalFor(goals, date) {
  let found = goals[0] ?? null;
  for (const goal of goals) if (goal.date <= date) found = goal;
  return found;
}
