// Registro diário. Cada item guarda nome e valores próprios: o passado não muda.
import { newId } from "./state.js";
import { isTime } from "./dates.js";
import { findFood, nutrients } from "./foods.js";
import { round1 } from "./num.js";

const KEYS = ["kcal", "protein", "carbs", "fat"];
const MAX_RECENT = 20;

const checkGrams = (g) => { if (!(Number.isFinite(g) && g > 0 && g <= 100000)) throw new Error("Quantidade inválida."); };
const checkTime = (t) => { if (!isTime(t)) throw new Error("Horário inválido."); };
const mealOf = (state, mealId) => state.meals.find((m) => m.id === mealId);

export function totals(items = []) {
  const sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of items) for (const k of KEYS) sum[k] += item[k];
  for (const k of KEYS) sum[k] = round1(sum[k]);
  return sum;
}

export const canLog = (date, today) => date <= today;

function push(state, date, mealId, fields) {
  const items = (state.days[date] ??= []);
  const mealName = mealOf(state, mealId)?.name ?? items.find((i) => i.mealId === mealId)?.mealName ?? "Refeição";
  items.push({ id: newId("i"), mealId, mealName, fromOption: null, edited: false, ...fields });
}

function remember(state, foodId) {
  state.recent = [foodId, ...state.recent.filter((id) => id !== foodId)].slice(0, MAX_RECENT);
}

export function addFood(state, date, mealId, food, grams, time, fromOption = null) {
  checkGrams(grams);
  checkTime(time);
  const per100 = Object.fromEntries(KEYS.map((k) => [k, food[k] ?? 0]));
  push(state, date, mealId, { time, foodId: food.id, name: food.name, grams, per100, ...nutrients(food, grams), fromOption });
  remember(state, food.id);
}

export function addQuick(state, date, mealId, { name, kcal, protein = 0, carbs = 0, fat = 0 }, time) {
  checkTime(time);
  const values = { kcal, protein, carbs, fat };
  if (!String(name ?? "").trim()) throw new Error("Informe um nome.");
  if (!KEYS.every((k) => Number.isFinite(values[k]) && values[k] >= 0)) throw new Error("Valor inválido.");
  push(state, date, mealId, { time, foodId: null, name: name.trim(), grams: null, ...values });
}

export const isEaten = (state, date, mealId) =>
  (state.days[date] ?? []).some((i) => i.mealId === mealId && i.fromOption !== null);

export const hasEditedFromOption = (state, date, mealId) =>
  (state.days[date] ?? []).some((i) => i.mealId === mealId && i.fromOption !== null && i.edited);

export function eatOption(state, date, mealId, optionId, base, time) {
  if (isEaten(state, date, mealId)) return false;
  const option = mealOf(state, mealId)?.options.find((o) => o.id === optionId);
  const found = (option?.items ?? [])
    .map(({ foodId, grams }) => ({ food: findFood(base, state, foodId), grams }))
    .filter((x) => x.food);
  if (!found.length) return false;
  for (const { food, grams } of found) addFood(state, date, mealId, food, grams, time, optionId);
  return true;
}

function keep(state, date, filter) {
  const items = (state.days[date] ?? []).filter(filter);
  if (items.length) state.days[date] = items;
  else delete state.days[date];
}

export const undoMeal = (state, date, mealId) =>
  keep(state, date, (i) => !(i.mealId === mealId && i.fromOption !== null));

export const removeItem = (state, date, itemId) => keep(state, date, (i) => i.id !== itemId);

// changes: { grams, time } para alimentos; { name, kcal, protein, carbs, fat, time } para registro rápido.
export function updateItem(state, date, itemId, changes) {
  const items = state.days[date] ?? [];
  const index = items.findIndex((i) => i.id === itemId);
  if (index < 0) return;
  const old = items[index];
  const changed = Object.entries(changes).some(([k, v]) => k !== "time" && v !== old[k]);
  const next = { ...old, ...changes, edited: old.edited || changed };
  checkTime(next.time);
  if (next.foodId !== null) {
    checkGrams(next.grams);
    Object.assign(next, nutrients(next.per100, next.grams));
  } else {
    if (!String(next.name).trim() || !KEYS.every((k) => Number.isFinite(next[k]) && next[k] >= 0)) throw new Error("Valor inválido.");
  }
  items[index] = next;
}

// Transforma o que foi registrado numa refeição em opção do cardápio (registro rápido fica de fora).
export function saveAsOption(state, date, mealId, name) {
  const meal = mealOf(state, mealId);
  const items = (state.days[date] ?? [])
    .filter((i) => i.mealId === mealId && i.foodId !== null)
    .map(({ foodId, grams }) => ({ foodId, grams }));
  if (!meal || !items.length || !name.trim()) return false;
  meal.options.push({ id: newId("o"), name: name.trim(), items });
  return true;
}

// Grupos do dia: refeições atuais mais as apagadas que têm itens.
// Em dias passados vale o nome que a refeição tinha no registro.
export function mealGroups(state, date, today = date) {
  const items = [...(state.days[date] ?? [])];
  const group = (mealId, name, exists) => {
    const own = items.filter((i) => i.mealId === mealId);
    return {
      mealId, exists,
      name: date < today && own.length ? own[0].mealName : name,
      items: own.sort((a, b) => a.time.localeCompare(b.time)),
    };
  };
  const groups = state.meals.map((m) => group(m.id, m.name, true));
  for (const item of items) {
    if (!groups.some((g) => g.mealId === item.mealId)) groups.push(group(item.mealId, item.mealName, false));
  }
  return groups;
}
