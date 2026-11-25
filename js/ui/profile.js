import { el, button, field, numberInput, select, form, confirmDialog, fmt, toast } from "./dom.js";
import { need, valueFields, customFoodDialog, portionsDialog, pickFoodForPortions } from "./picker.js";
import { ACTIVITIES, OBJECTIVES, calcGoals, saveGoal, goalFor } from "../core/goals.js";
import { latestWeight } from "../core/adherence.js";
import { exportData, importData, needsBackup } from "../core/backup.js";
import { toDate } from "../core/dates.js";

let messages = [];

function dataCard(ctx) {
  const p = ctx.state.profile ?? {};
  const weight = latestWeight(ctx.state.weights);
  const sex = select([["", "Escolha"], ["f", "Feminino"], ["m", "Masculino"]], p.sex ?? "");
  const age = numberInput(p.age ?? "");
  const kg = numberInput(weight?.kg ?? "");
  const height = numberInput(p.height ?? "");
  const activity = select(ACTIVITIES, p.activity ?? 1.375);
  const objective = select(Object.entries(OBJECTIVES), p.objective ?? "emagrecer");

  return el("section", { class: "card" },
    el("h2", {}, "Seus dados"),
    form([
      field("Sexo (usado na fórmula)", sex), field("Idade", age), field("Peso (kg)", kg),
      field("Altura (cm)", height), field("Atividade física", activity), field("Objetivo", objective),
    ], "Calcular metas", async () => {
      if (!sex.value) throw new Error("Escolha o sexo.");
      const profile = {
        sex: sex.value,
        age: need(age, "Idade", { min: 1, max: 120 }),
        height: need(height, "Altura (cm)", { min: 80, max: 250 }),
        activity: Number(activity.value),
        objective: objective.value,
      };
      const value = need(kg, "Peso (kg)", { min: 20, max: 400 });
      const result = calcGoals({ ...profile, weight: value });
      const current = goalFor(ctx.state.goals, ctx.today);
      if (result && current?.manual
        && !(await confirmDialog("Suas metas foram ajustadas à mão. Substituir pelo cálculo?", "Substituir"))) return;
      ctx.state.profile = profile;
      // Só cria lançamento no gráfico se o peso mudou.
      if (value !== weight?.kg) ctx.state.weights[ctx.today] = value;
      if (result) {
        const { warnings, ...goal } = result;
        ctx.state.goals = saveGoal(ctx.state.goals, { date: ctx.today, objective: profile.objective, ...goal, manual: false });
        messages = warnings;
        toast("Metas calculadas.");
      } else {
        messages = ["Para menores de 18 anos o app não calcula. Informe abaixo as metas dadas por um profissional."];
      }
      await ctx.commit();
    }));
}

function goalsCard(ctx) {
  const goal = goalFor(ctx.state.goals, ctx.today);
  const values = valueFields(goal ?? {});
  const objective = select(Object.entries(OBJECTIVES), goal?.objective ?? ctx.state.profile?.objective ?? "emagrecer");
  return el("section", { class: "card" },
    el("h2", {}, "Minhas metas diárias"),
    messages.map((m) => el("p", { class: "warning" }, m)),
    goal ? el("p", { class: "hint" }, `${goal.manual ? "Ajustadas à mão" : "Calculadas"} em ${toDate(goal.date).toLocaleDateString("pt-BR")}.`) : null,
    form([field("Objetivo", objective), values.nodes], "Salvar metas", async () => {
      const data = values.read();
      if (!data.kcal || !data.protein) throw new Error("Calorias e proteína precisam ser maiores que zero.");
      ctx.state.goals = saveGoal(ctx.state.goals, { date: ctx.today, objective: objective.value, ...data, manual: true });
      messages = [];
      await ctx.commit();
      toast("Metas salvas.");
    }),
    el("p", { class: "hint" }, "Os valores calculados são estimativas. Gestantes, lactantes e pessoas com problema de saúde devem usar metas dadas por um profissional."));
}

function foodsCard(ctx) {
  const own = ctx.state.customFoods.filter((f) => !f.deleted);
  return el("section", { class: "card" },
    el("h2", {}, "Meus alimentos"),
    el("ul", { class: "list" }, own.map((food) => el("li", {},
      el("button", { type: "button", class: "item", onclick: () => customFoodDialog(ctx, food) },
        el("span", {}, food.name), el("small", {}, `${fmt(food.kcal)} kcal · P ${fmt(food.protein)} g por 100 g`)),
      button("Apagar", async () => {
        if (!(await confirmDialog(`Apagar "${food.name}"? O que já foi registrado não muda.`, "Apagar"))) return;
        food.deleted = true;
        await ctx.commit();
      }, "quiet")))),
    el("div", { class: "row" },
      button("+ novo alimento", () => customFoodDialog(ctx)),
      button("Porções de um alimento", async () => {
        const food = await pickFoodForPortions(ctx);
        if (food) await portionsDialog(ctx, food);
      }, "quiet")));
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = el("a", { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function backupCard(ctx) {
  const file = el("input", { type: "file", accept: ".json,application/json", hidden: true });
  file.addEventListener("change", async () => {
    const chosen = file.files[0];
    file.value = "";
    if (!chosen) return;
    try {
      const data = importData(await chosen.text());
      if (!(await confirmDialog("Importar substitui todos os dados deste celular. Continuar?", "Substituir"))) return;
      messages = [];
      await ctx.replace(data);
      toast("Backup importado.");
    } catch (error) {
      toast(error.message);
    }
  });
  const last = ctx.state.lastBackup;
  return el("section", { class: "card" },
    el("h2", {}, "Backup"),
    needsBackup(ctx.state, ctx.today) ? el("p", { class: "warning" }, "Faz mais de 14 dias sem backup.") : null,
    el("p", { class: "hint" }, last ? `Último backup: ${toDate(last).toLocaleDateString("pt-BR")}.` : "Você ainda não fez backup. Guarde o arquivo fora do celular, como no Google Drive."),
    el("div", { class: "row" },
      button("Exportar", async () => {
        ctx.state.lastBackup = ctx.today;
        download(`dieta-backup-${ctx.today}.json`, exportData(ctx.state));
        await ctx.commit();
        toast("Confira se o arquivo apareceu nos downloads.");
      }, "primary"),
      button("Importar", () => file.click())),
    file);
}

export function renderProfile(ctx) {
  return [
    el("h1", {}, "Metas"),
    dataCard(ctx), goalsCard(ctx), foodsCard(ctx), backupCard(ctx),
    el("p", { class: "hint" }, "Alimentos: Tabela Brasileira de Composição de Alimentos (TACO), NEPA/Unicamp. As unidades prontas são pesos médios estimados."),
  ];
}
