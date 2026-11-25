import { isDate, isTime, daysBetween } from "./dates.js";
import { OBJECTIVES, ACTIVITIES } from "./goals.js";

const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => typeof v === "string";
const num = (v) => Number.isFinite(v) && v >= 0;
const pos = (v) => Number.isFinite(v) && v > 0;
const list = (v, check) => Array.isArray(v) && v.every(check);
const map = (v, check) => obj(v) && Object.entries(v).every(([k, x]) => check(x, k));
const values = (v) => num(v.kcal) && num(v.protein) && num(v.carbs) && num(v.fat);
const objective = (v) => Object.hasOwn(OBJECTIVES, v);

const profile = (p) => p === null || (obj(p) && ["m", "f"].includes(p.sex) && pos(p.age) && pos(p.height) && ACTIVITIES.some(([v]) => v === p.activity) && objective(p.objective));
const goal = (g) => obj(g) && isDate(g.date) && objective(g.objective) && values(g);
const food = (f) => obj(f) && str(f.id) && str(f.name) && values(f);
const portion = (p) => obj(p) && str(p.id) && str(p.name) && pos(p.grams);
const optionItem = (i) => obj(i) && str(i.foodId) && pos(i.grams);
const option = (o) => obj(o) && str(o.id) && str(o.name) && list(o.items, optionItem);
const meal = (m) => obj(m) && str(m.id) && str(m.name) && list(m.options, option);
const entry = (i) => obj(i) && str(i.id) && str(i.mealId) && str(i.mealName) && str(i.name) && isTime(i.time) && values(i)
  && (i.foodId === null ? i.grams === null : str(i.foodId) && pos(i.grams) && obj(i.per100) && values(i.per100))
  && (i.fromOption === null || str(i.fromOption)) && typeof i.edited === "boolean";

export function isValidState(s) {
  return obj(s) && s.app === "dieta" && s.version === 1
    && profile(s.profile)
    && list(s.goals, goal)
    && map(s.weights, (kg, date) => isDate(date) && pos(kg))
    && list(s.customFoods, food)
    && map(s.portions, (p) => list(p, portion))
    && list(s.meals, meal)
    && map(s.days, (items, date) => isDate(date) && list(items, entry))
    && list(s.recent, str)
    && (s.lastBackup === null || isDate(s.lastBackup))
    && isDate(s.createdAt);
}

export const exportData = (state) => JSON.stringify(state);

export function importData(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("O arquivo não é um backup válido."); }
  if (obj(data) && data.app === "dieta" && data.version !== 1) throw new Error("Backup de uma versão que este app não conhece.");
  if (!isValidState(data)) throw new Error("O arquivo não é um backup válido deste app.");
  data.goals.sort((a, b) => a.date.localeCompare(b.date));
  return data;
}

export const needsBackup = (state, today) => daysBetween(state.lastBackup ?? state.createdAt, today) > 14;
