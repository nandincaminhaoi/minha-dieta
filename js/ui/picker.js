// Escolha de alimento: busca, quantidade (gramas ou porção), registro rápido e cadastro.
import { el, button, field, input, numberInput, select, form, dialog, macroLine, fmt, toast, confirmDialog } from "./dom.js";
import { searchFoods, nutrients, foodUnits } from "../core/foods.js";
import { parseNumber, round1 } from "../core/num.js";
import { newId } from "../core/state.js";
import { localTime } from "../core/dates.js";

const need = (control, label, limits) => {
  const value = parseNumber(control.value, limits);
  if (value === null) throw new Error(`Confira o campo "${label}".`);
  return value;
};
export { need };

const VALUE_FIELDS = [["kcal", "Calorias (kcal)", 20000], ["protein", "Proteína (g)", 2000], ["carbs", "Carboidrato (g)", 2000], ["fat", "Gordura (g)", 2000]];

// Campos de calorias e macros. Em branco, os macros valem 0 quando optional.
export function valueFields(initial = {}, optionalMacros = false) {
  const controls = VALUE_FIELDS.map(([key]) => numberInput(initial[key] ?? ""));
  return {
    nodes: VALUE_FIELDS.map(([key, label], i) => field(optionalMacros && key !== "kcal" ? `${label}, opcional` : label, controls[i])),
    read() {
      return Object.fromEntries(VALUE_FIELDS.map(([key, label, max], i) => {
        if (optionalMacros && key !== "kcal" && !controls[i].value.trim()) return [key, 0];
        return [key, need(controls[i], label, { max })];
      }));
    },
  };
}

export const customFoodDialog = (ctx, food = null) =>
  dialog(food ? "Editar alimento" : "Novo alimento", (close, body) => {
    const name = input(food?.name ?? "", { maxlength: 80 });
    const values = valueFields(food ?? {});
    body.append(form([field("Nome", name), el("p", { class: "hint" }, "Valores por 100 g (veja o rótulo)."), values.nodes], "Salvar", async () => {
      if (!name.value.trim()) throw new Error("Preencha o nome.");
      const data = { name: name.value.trim(), ...values.read() };
      let saved = food;
      if (saved) Object.assign(saved, data);
      else ctx.state.customFoods.push((saved = { id: newId("c"), ...data }));
      await ctx.commit();
      close(saved);
    }));
  });

export const portionsDialog = (ctx, food) =>
  dialog("Porções", (close, body) => {
    const draw = () => {
      const name = input("", { maxlength: 40, placeholder: "ex.: unidade" });
      const grams = numberInput();
      const own = ctx.state.portions[food.id] ?? [];
      body.replaceChildren(
        el("p", {}, food.name),
        el("ul", { class: "list" },
          own.map((p) => el("li", {}, el("span", {}, `${p.name} = ${fmt(p.grams)} g`), button("Apagar", async () => {
            if (!(await confirmDialog(`Apagar a porção "${p.name}"?`, "Apagar"))) return;
            ctx.state.portions[food.id] = own.filter((x) => x.id !== p.id);
            await ctx.commit();
            draw();
          }, "quiet"))),
          (food.units ?? []).map((u) => el("li", {}, el("span", {}, `${u.name} = ${fmt(u.grams)} g (média pronta)`)))),
        form([field("Nome da porção", name), field("Peso em gramas", grams)], "Adicionar porção", async () => {
          if (!name.value.trim()) throw new Error("Preencha o nome.");
          const value = need(grams, "Peso em gramas", { min: 0.1, max: 5000 });
          (ctx.state.portions[food.id] ??= []).push({ id: newId("p"), name: name.value.trim(), grams: value });
          await ctx.commit();
          draw();
        }));
    };
    draw();
  });

function searchBox(ctx, onPick) {
  const box = input("", { type: "search", placeholder: "Buscar: arroz, ovo frito…", "aria-label": "Buscar alimento" });
  const results = el("ul", { class: "list results" });
  const update = () => {
    const found = searchFoods([...ctx.state.customFoods, ...ctx.base], box.value, ctx.state.recent);
    results.replaceChildren(...(found.length
      ? found.map((food) => el("li", {}, el("button", { type: "button", class: "item", onclick: () => onPick(food) },
          el("span", {}, food.name),
          el("small", {}, `${fmt(Math.round(food.kcal))} kcal · P ${fmt(food.protein)} g por 100 g${food.incomplete ? " · dado incompleto" : ""}`))))
      : [el("li", {}, "Nada encontrado. Cadastre o alimento ou use o registro rápido.")]));
  };
  box.addEventListener("input", update);
  update();
  return { box, results };
}

export const pickFoodForPortions = (ctx) =>
  dialog("Escolha o alimento", (close, body) => {
    const { box, results } = searchBox(ctx, close);
    body.append(box, results);
  });

// Resolve com { food, grams, time } ou { quick, time } ou null.
export function pickFood(ctx, { title = "Adicionar alimento", withTime = false, quick = false } = {}) {
  return dialog(title, (close, body) => {
    const time = input(localTime(), { type: "time" });
    const timeNodes = () => (withTime ? [field("Horário", time)] : []);
    const readTime = () => {
      if (withTime && !time.value) throw new Error("Informe o horário.");
      return time.value;
    };

    function search() {
      const { box, results } = searchBox(ctx, amount);
      body.replaceChildren(box, el("div", { class: "row" },
        button("Novo alimento", async () => {
          const food = await customFoodDialog(ctx);
          if (food) amount(food);
        }),
        quick && button("Registro rápido", quickEntry)), results);
      box.focus();
    }

    function amount(food) {
      const units = foodUnits(ctx.state, food);
      const unit = select([...units.map((u, i) => [i, `${u.name} (${fmt(u.grams)} g)`]), ["g", "gramas"]], units.length ? 0 : "g");
      const qty = numberInput(units.length ? 1 : 100);
      const preview = el("p", { class: "preview" });
      const grams = () => {
        const q = parseNumber(qty.value, { min: 0.01, max: 100000 });
        return q === null ? null : round1(unit.value === "g" ? q : q * units[Number(unit.value)].grams);
      };
      const update = () => {
        const g = grams();
        preview.textContent = g ? `${fmt(g)} g: ${macroLine(nutrients(food, g))}` : "Informe a quantidade.";
      };
      qty.addEventListener("input", update);
      unit.addEventListener("change", () => { qty.value = unit.value === "g" ? "100" : "1"; update(); });
      body.replaceChildren(el("h3", {}, food.name), form(
        [field("Medida", unit), field("Quantidade", qty), preview, timeNodes()],
        "Adicionar",
        () => {
          const g = grams();
          if (!g) throw new Error("Quantidade inválida.");
          close({ food, grams: g, time: readTime() });
        },
        [button("Voltar", search, "quiet"), button("Porções", async () => { await portionsDialog(ctx, food); amount(food); }, "quiet")]));
      update();
    }

    function quickEntry() {
      const name = input("", { maxlength: 80, placeholder: "ex.: pizza na festa" });
      const values = valueFields({}, true);
      body.replaceChildren(el("p", { class: "hint" }, "Para o que não está na lista. Valores do que você comeu, não por 100 g."),
        form([field("Nome", name), values.nodes, timeNodes()], "Adicionar", () => {
          if (!name.value.trim()) throw new Error("Preencha o nome.");
          close({ quick: { name: name.value.trim(), ...values.read() }, time: readTime() });
        }, [button("Voltar", search, "quiet")]));
      name.focus();
    }

    search();
  }).then((result) => { if (result) toast("Adicionado."); return result; });
}
