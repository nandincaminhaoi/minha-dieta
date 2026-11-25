import { round1 } from "./num.js";

export const normalize = (text) =>
  String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Todas as palavras, em qualquer ordem. Recentes primeiro; depois quem começa pela primeira palavra.
export function searchFoods(foods, query, recent = [], limit = 30) {
  const words = normalize(query).split(/[\s,]+/).filter(Boolean);
  const hits = [];
  for (const food of foods) {
    if (food.deleted) continue;
    const name = normalize(food.name);
    if (!words.every((w) => name.includes(w))) continue;
    const r = recent.indexOf(food.id);
    hits.push({ food, name, rank: r < 0 ? Infinity : r, starts: words.length && name.startsWith(words[0]) ? 0 : 1 });
  }
  hits.sort((a, b) => (a.rank === b.rank ? a.starts - b.starts || a.name.localeCompare(b.name) : a.rank < b.rank ? -1 : 1));
  return hits.slice(0, limit).map((h) => h.food);
}

export function nutrients(food, grams) {
  const part = (v) => round1(((v ?? 0) * grams) / 100);
  return { kcal: part(food.kcal), protein: part(food.protein), carbs: part(food.carbs), fat: part(food.fat) };
}

export const findFood = (base, state, id) =>
  base.find((f) => f.id === id) ?? state.customFoods.find((f) => f.id === id) ?? null;

// Porções do usuário primeiro, depois as unidades prontas.
export const foodUnits = (state, food) => [...(state.portions[food.id] ?? []), ...(food.units ?? [])];
