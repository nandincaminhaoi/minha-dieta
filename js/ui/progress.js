import { el, button, field, input, numberInput, form, dialog, confirmDialog, fmt, toast } from "./dom.js";
import { need } from "./picker.js";
import { summary, dayStatus } from "../core/adherence.js";
import { totals } from "../core/log.js";
import { addDays, daysBetween, toDate, isDate } from "../core/dates.js";

const short = (date) => toDate(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const LABELS = { cumprido: "✓ cumprido", nao: "✗ não cumprido", "sem-registro": "sem registro", "sem-meta": "sem meta" };
const RANGES = [[30, "30 dias"], [90, "90 dias"], [0, "Tudo"]];
let range = 30;
let showAll = false;

const svg = (tag, attrs = {}, text) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

function chart(points) {
  if (!points.length) return el("p", { class: "hint" }, "Nenhum peso neste período.");
  const W = 340, H = 180, L = 40, R = 12, T = 12, B = 24;
  const values = points.map((p) => p.kg);
  const low = Math.floor(Math.min(...values) - 1), high = Math.ceil(Math.max(...values) + 1);
  const first = points[0].date;
  const span = daysBetween(first, points.at(-1).date) || 1;
  const x = (date) => (points.length === 1 ? (L + W - R) / 2 : L + (daysBetween(first, date) / span) * (W - L - R));
  const y = (kg) => T + ((high - kg) / (high - low)) * (H - T - B);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": `Peso de ${fmt(values[0])} a ${fmt(values.at(-1))} kg` });
  for (const kg of [low, (low + high) / 2, high]) {
    root.append(svg("line", { x1: L, x2: W - R, y1: y(kg), y2: y(kg), class: "grid" }),
      svg("text", { x: L - 6, y: y(kg) + 4, "text-anchor": "end" }, fmt(kg)));
  }
  root.append(svg("polyline", { points: points.map((p) => `${x(p.date)},${y(p.kg)}`).join(" "), class: "line" }));
  for (const p of points) root.append(svg("circle", { cx: x(p.date), cy: y(p.kg), r: 3.5, class: "dot" }));
  root.append(svg("text", { x: L, y: H - 6 }, short(first)));
  if (points.length > 1) root.append(svg("text", { x: W - R, y: H - 6, "text-anchor": "end" }, short(points.at(-1).date)));
  return root;
}

function weightFields(ctx, initialDate, initialKg) {
  const date = input(initialDate, { type: "date", max: ctx.today });
  const kg = numberInput(initialKg);
  return {
    nodes: [field("Data", date), field("Peso (kg)", kg)],
    read() {
      if (!isDate(date.value) || date.value > ctx.today) throw new Error("Escolha uma data até hoje.");
      return [date.value, need(kg, "Peso (kg)", { min: 20, max: 400 })];
    },
  };
}

const editWeight = (ctx, oldDate) =>
  dialog("Editar peso", (close, body) => {
    const fields = weightFields(ctx, oldDate, ctx.state.weights[oldDate]);
    body.append(form(fields.nodes, "Salvar", async () => {
      const [date, kg] = fields.read();
      if (date !== oldDate && date in ctx.state.weights
        && !(await confirmDialog(`Já existe um peso em ${short(date)}. Substituir?`, "Substituir"))) return;
      delete ctx.state.weights[oldDate];
      ctx.state.weights[date] = kg;
      await ctx.commit();
      close();
    }, [button("Apagar", async () => {
      if (!(await confirmDialog(`Apagar o peso de ${short(oldDate)}?`, "Apagar"))) return;
      delete ctx.state.weights[oldDate];
      await ctx.commit();
      close();
    }, "danger")]));
  });

function stats(ctx, days) {
  const s = summary(ctx.state, ctx.today, days);
  return el("div", { class: "stat" },
    el("h3", {}, `Últimos ${days} dias`),
    el("strong", {}, s.pct === null ? "sem dados" : `${s.pct}%`),
    el("small", {}, s.counted ? `${s.met} de ${s.counted} dias cumpridos` : "Registre refeições e defina metas."),
    s.avgKcal === null ? null : el("small", {}, `Média: ${fmt(s.avgKcal)} kcal · P ${fmt(s.avgProtein)} g`));
}

export function renderProgress(ctx) {
  const dates = Object.keys(ctx.state.weights).sort();
  const since = range ? addDays(ctx.today, -(range - 1)) : "";
  const points = dates.filter((d) => d >= since).map((date) => ({ date, kg: ctx.state.weights[date] }));
  const fields = weightFields(ctx, ctx.today, ctx.state.weights[ctx.today] ?? "");
  const listed = [...dates].reverse();

  return [
    el("h1", {}, "Evolução"),
    el("section", { class: "card" },
      el("h2", {}, "Peso"),
      el("div", { class: "row" }, RANGES.map(([value, label]) => {
        const b = button(label, () => { range = value; ctx.render(); }, value === range ? "primary" : "quiet");
        b.setAttribute("aria-pressed", String(value === range));
        return b;
      })),
      chart(points),
      form(fields.nodes, "Salvar peso", async () => {
        const [date, kg] = fields.read();
        ctx.state.weights[date] = kg;
        await ctx.commit();
        toast("Peso salvo.");
      }),
      el("ul", { class: "list" }, listed.slice(0, showAll ? listed.length : 5).map((date) =>
        el("li", {}, el("button", { type: "button", class: "item", onclick: () => editWeight(ctx, date) },
          el("span", {}, `${fmt(ctx.state.weights[date])} kg`), el("small", {}, toDate(date).toLocaleDateString("pt-BR")))))),
      listed.length > 5 ? button(showAll ? "Mostrar menos" : "Mostrar todos", () => { showAll = !showAll; ctx.render(); }, "quiet") : null),
    el("section", { class: "card" }, el("h2", {}, "Metas cumpridas"), el("div", { class: "stats" }, stats(ctx, 7), stats(ctx, 30)),
      el("p", { class: "hint" }, "Hoje não entra na conta. Dias sem registro também não.")),
    el("section", { class: "card" }, el("h2", {}, "Dia a dia"),
      el("ul", { class: "list" }, Array.from({ length: 7 }, (_, i) => addDays(ctx.today, -(i + 1))).map((date) => {
        const status = dayStatus(ctx.state, date, ctx.today);
        const sum = totals(ctx.state.days[date]);
        return el("li", {}, el("button", { type: "button", class: "item", onclick: () => { ctx.setDate(date); ctx.go("hoje"); } },
          el("span", {}, `${short(date)} ${LABELS[status]}`),
          status === "sem-registro" ? null : el("small", {}, `${fmt(Math.round(sum.kcal))} kcal · P ${fmt(sum.protein)} g`)));
      }))),
  ];
}
