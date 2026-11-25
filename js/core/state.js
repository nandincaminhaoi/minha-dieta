let counter = 0;

export function newId(prefix) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

const MEALS = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar"];

export function newState(today) {
  return {
    app: "dieta",
    version: 1,
    profile: null,
    goals: [],
    weights: {},
    customFoods: [],
    portions: {},
    meals: MEALS.map((name, i) => ({ id: `m${i + 1}`, name, options: [] })),
    days: {},
    recent: [],
    lastBackup: null,
    createdAt: today,
  };
}
