import { el, button, field, input, numberInput, form, dialog, confirmDialog, askText, fmt, toast } from "./dom.js";
import { pickFood, valueFields, need } from "./picker.js";
import * as log from "../core/log.js";
import { findFood, nutrients } from "../core/foods.js";
import { goalFor } from "../core/goals.js";
import { needsBackup } from "../core/backup.js";
import { hero } from "./hero.js";
import { addDays, toDate, localTime } from "../core/dates.js";

function title(date, today) {
  if (date === today) return "Hoje";
  if (date === addDays(today, -1)) return "Ontem";
  return toDate(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const longDate = (date) => toDate(date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

// Desenho da refeição, escolhido pelo nome.
const ICONS = [[/caf[eé]|desjejum/i, "☕", "sun"], [/lanche da manh/i, "🍎", "red"], [/almo[cç]o/i, "🍛", "sky"], [/lanche|ceia/i, "🥪", "red"], [/jantar|janta/i, "🍽️", "lilac"]];
export function mealIcon(name) {
  const [, icon, tone] = ICONS.find(([pattern]) => pattern.test(name)) ?? [null, "🍴", "sun"];
  return el("span", { class: `meal-icon ${tone}`, "aria-hidden": "true" }, icon);
}

const editItem = (ctx, date, item) =>
  dialog("Editar registro", (close, body) => {
    const time = input(item.time, { type: "time" });
    const grams = item.foodId === null ? null : numberInput(item.grams);
    const name = item.foodId === null ? input(item.name, { maxlength: 80 }) : null;
    const values = item.foodId === null ? valueFields(item, true) : null;
    body.append(el("h3", {}, item.name), form(
      [name && field("Nome", name), grams && field("Quantidade (g)", grams), values?.nodes, field("Horário", time)],
      "Salvar",
      async () => {
        const changes = grams
          ? { grams: need(grams, "Quantidade (g)", { min: 0.01 }), time: time.value }
          : { name: name.value.trim(), ...values.read(), time: time.value };
        log.updateItem(ctx.state, date, item.id, changes);
        await ctx.commit();
        close();
      },
      [button("Apagar", async () => {
        if (!(await confirmDialog(`Apagar "${item.name}"?`, "Apagar"))) return;
        log.removeItem(ctx.state, date, item.id);
        await ctx.commit();
        close();
      }, "danger")]));
  });

async function eat(ctx, date, meal) {
  const options = meal.options.filter((o) => o.items.some((i) => findFood(ctx.base, ctx.state, i.foodId)));
  let optionId = options[0].id;
  if (options.length > 1) {
    optionId = await dialog(`O que você comeu? ${meal.name}`, (close, body) => {
      body.append(...options.map((o) => {
        const parts = o.items.map((i) => ({ food: findFood(ctx.base, ctx.state, i.foodId), grams: i.grams })).filter((x) => x.food);
        const sum = log.totals(parts.map((x) => nutrients(x.food, x.grams)));
        return el("button", { type: "button", class: "item", onclick: () => close(o.id) },
          el("span", {}, o.name),
          el("small", {}, `${fmt(Math.round(sum.kcal))} kcal · ${parts.map((x) => `${x.food.name} ${fmt(x.grams)} g`).join("; ")}`));
      }));
    });
  }
  if (!optionId) return;
  if (log.eatOption(ctx.state, ctx.currentDate(date), meal.id, optionId, ctx.base, localTime())) await ctx.commit();
}

function mealCard(ctx, date, group) {
  const meal = ctx.state.meals.find((m) => m.id === group.mealId);
  const eaten = log.isEaten(ctx.state, date, group.mealId);
  const canEat = meal && !eaten && meal.options.some((o) => o.items.some((i) => findFood(ctx.base, ctx.state, i.foodId)));
  const sum = log.totals(group.items);

  const subtitle = group.items.length
    ? `${fmt(Math.round(sum.kcal))} kcal · ${fmt(sum.protein)} g proteína`
    : canEat ? meal.options.map((o) => o.name).join(" ou ") : "Nada registrado";

  const add = async () => {
    const result = await pickFood(ctx, { title: `Adicionar em ${group.name}`, withTime: true, quick: true });
    if (!result) return;
    const day = ctx.currentDate(date);
    if (result.quick) log.addQuick(ctx.state, day, group.mealId, result.quick, result.time);
    else log.addFood(ctx.state, day, group.mealId, result.food, result.grams, result.time);
    await ctx.commit();
  };
  const undo = async () => {
    if (log.hasEditedFromOption(ctx.state, date, group.mealId)
      && !(await confirmDialog("Você editou itens desta opção. Remover mesmo assim?", "Remover"))) return;
    log.undoMeal(ctx.state, date, group.mealId);
    await ctx.commit();
  };
  const saveOption = async () => {
    const name = await askText("Salvar no cardápio", "Nome da opção");
    if (name && log.saveAsOption(ctx.state, date, group.mealId, name)) {
      await ctx.commit();
      toast("Opção salva no cardápio.");
    }
  };

  const plus = group.exists ? button("+", add, "round add") : null;
  plus?.setAttribute("aria-label", `Adicionar alimento em ${group.name}`);
  const actions = [
    eaten ? el("span", { class: "eaten" }, "✓ comido") : null,
    eaten ? button("Desfazer", undo, "quiet") : null,
    group.exists && group.items.some((i) => i.foodId !== null) ? button("Salvar como opção", saveOption, "quiet") : null,
  ].filter(Boolean);

  return el("section", { class: "card meal" },
    el("div", { class: "meal-head" },
      mealIcon(group.name),
      el("div", { class: "grow" }, el("h2", {}, group.name), el("small", {}, subtitle)),
      canEat ? button("Comi", () => eat(ctx, date, meal), "primary") : null,
      plus),
    group.items.length ? el("ul", { class: "list" }, group.items.map((item) =>
      el("li", {}, el("button", { type: "button", class: "item entry", onclick: () => editItem(ctx, date, item) },
        el("span", { class: "grow" },
          el("span", {}, item.name),
          el("small", {}, `${item.time} · ${item.grams === null ? "registro rápido" : `${fmt(item.grams)} g`} · P ${fmt(item.protein)} g`)),
        el("b", {}, fmt(Math.round(item.kcal))))))) : null,
    actions.length ? el("div", { class: "row actions" }, actions) : null);
}

export function renderToday(ctx) {
  const { state, date, today } = ctx;
  const next = button("›", () => ctx.setDate(addDays(date, 1)), "round");
  next.disabled = date >= today;
  next.setAttribute("aria-label", "Dia seguinte");
  const previous = button("‹", () => ctx.setDate(addDays(date, -1)), "round");
  previous.setAttribute("aria-label", "Dia anterior");
  return [
    el("div", { class: "datebar" },
      el("div", {}, el("small", {}, longDate(date)), el("h1", {}, title(date, today))),
      el("div", { class: "row" }, previous, next)),
    needsBackup(state, today)
      ? el("div", { class: "warning" }, "Faz mais de 14 dias sem backup. ", button("Fazer agora", () => ctx.go("metas"), "quiet"))
      : null,
    hero(ctx, log.totals(state.days[date]), goalFor(state.goals, date)),
    ...log.mealGroups(state, date, today).filter((g) => g.exists || g.items.length).map((g) => mealCard(ctx, date, g)),
  ];
}
