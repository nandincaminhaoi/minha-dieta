import { el, button, field, numberInput, form, dialog, confirmDialog, askText, fmt } from "./dom.js";
import { pickFood, need } from "./picker.js";
import { mealIcon } from "./today.js";
import { hero } from "./hero.js";
import { findFood, nutrients } from "../core/foods.js";
import { totals } from "../core/log.js";
import { goalFor } from "../core/goals.js";
import { newId } from "../core/state.js";

const optionTotals = (ctx, option) =>
  totals((option?.items ?? []).flatMap((i) => {
    const food = findFood(ctx.base, ctx.state, i.foodId);
    return food ? [nutrients(food, i.grams)] : [];
  }));

const editGrams = (ctx, option, index, name) =>
  dialog("Editar item", (close, body) => {
    const item = option.items[index];
    const grams = numberInput(item.grams);
    body.append(el("h3", {}, name), form([field("Quantidade (g)", grams)], "Salvar", async () => {
      item.grams = need(grams, "Quantidade (g)", { min: 0.01 });
      close();
      await ctx.commit();
    }, [button("Remover", async () => {
      const at = option.items.indexOf(item);
      if (at < 0) return;
      option.items.splice(at, 1);
      close();
      await ctx.commit();
    }, "danger")]));
  });

async function addItem(ctx, option) {
  const result = await pickFood(ctx, { title: `Adicionar em ${option.name}` });
  if (!result) return;
  option.items.push({ foodId: result.food.id, grams: result.grams });
  await ctx.commit();
}

function optionBlock(ctx, meal, option) {
  const sum = optionTotals(ctx, option);
  return el("div", { class: "option" },
    el("div", { class: "card-head" },
      el("div", {}, el("h3", {}, option.name), el("small", {}, `${fmt(Math.round(sum.kcal))} kcal · P ${fmt(sum.protein)} g`)),
      el("div", { class: "row" },
        button("Renomear", async () => {
          const name = await askText("Renomear opção", "Nome", option.name);
          if (name) { option.name = name; await ctx.commit(); }
        }, "quiet"),
        button("Apagar", async () => {
          if (!(await confirmDialog(`Apagar a opção "${option.name}"? O que já foi registrado não muda.`, "Apagar"))) return;
          meal.options = meal.options.filter((o) => o !== option);
          await ctx.commit();
        }, "quiet"))),
    el("ul", { class: "list" }, option.items.map((item, index) => {
      const food = findFood(ctx.base, ctx.state, item.foodId);
      const name = food?.name ?? "Alimento não encontrado";
      return el("li", {}, el("button", { type: "button", class: "item", onclick: () => editGrams(ctx, option, index, name) },
        el("span", {}, name),
        el("small", {}, `${fmt(item.grams)} g${food ? ` · ${fmt(Math.round(nutrients(food, item.grams).kcal))} kcal` : ""}`)));
    })),
    button("+ alimento", () => addItem(ctx, option)));
}

function mealCard(ctx, meal, index) {
  const { meals } = ctx.state;
  const move = (step) => async () => {
    [meals[index], meals[index + step]] = [meals[index + step], meals[index]];
    await ctx.commit();
  };
  const up = button("↑", move(-1), "quiet");
  up.disabled = index === 0;
  up.setAttribute("aria-label", "Mover para cima");
  const down = button("↓", move(1), "quiet");
  down.disabled = index === meals.length - 1;
  down.setAttribute("aria-label", "Mover para baixo");
  return el("section", { class: "card" },
    el("div", { class: "meal-head" }, mealIcon(meal.name), el("h2", { class: "grow" }, meal.name), el("div", { class: "row" }, up, down)),
    el("div", { class: "row" },
      button("Renomear", async () => {
        const name = await askText("Renomear refeição", "Nome", meal.name);
        if (name) { meal.name = name; await ctx.commit(); }
      }, "quiet"),
      button("Apagar refeição", async () => {
        if (!(await confirmDialog(`Apagar "${meal.name}" e suas opções? O que já foi registrado não muda.`, "Apagar"))) return;
        ctx.state.meals = meals.filter((m) => m !== meal);
        await ctx.commit();
      }, "quiet")),
    meal.options.map((o) => optionBlock(ctx, meal, o)),
    button("+ nova opção", async () => {
      const name = await askText(`Nova opção: ${meal.name}`, "Nome da opção", `Opção ${meal.options.length + 1}`);
      if (!name) return;
      const option = { id: newId("o"), name, items: [] };
      meal.options.push(option);
      await ctx.commit();
      await addItem(ctx, option);
    }));
}

export function renderMenu(ctx) {
  const first = totals(ctx.state.meals.map((m) => optionTotals(ctx, m.options[0])));
  return [
    el("h1", {}, "Cardápio"),
    el("p", { class: "hint" }, "Um atalho para o que você costuma comer. O total abaixo soma a primeira opção de cada refeição."),
    hero(ctx, first, goalFor(ctx.state.goals, ctx.today), { planned: true }),
    ...ctx.state.meals.map((m, i) => mealCard(ctx, m, i)),
    button("+ nova refeição", async () => {
      const name = await askText("Nova refeição", "Nome");
      if (name) { ctx.state.meals.push({ id: newId("m"), name, options: [] }); await ctx.commit(); }
    }),
  ];
}
