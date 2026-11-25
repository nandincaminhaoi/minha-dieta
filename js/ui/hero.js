// Painel de calorias (anel) e macros. Estilos dinâmicos vão por CSSOM, que a CSP permite.
import { el, button, fmt } from "./dom.js";

const share = (now, goal) => (goal ? Math.min(100, (now / goal) * 100) : 0);

function macro(label, now, goal) {
  const fill = el("i");
  fill.style.width = `${share(now, goal)}%`;
  return el("div", { class: "macro" },
    el("span", {}, label),
    el("b", {}, goal ? `${fmt(Math.round(now))} de ${fmt(goal)} g` : `${fmt(Math.round(now))} g`),
    goal ? el("div", { class: "track", "aria-hidden": "true" }, fill) : null);
}

// planned: no Cardápio o anel mostra o total planejado, não o que falta comer.
export function hero(ctx, sum, goal, { planned = false } = {}) {
  const eaten = Math.round(sum.kcal);
  const left = goal && !planned ? Math.round(goal.kcal) - eaten : null;
  const over = goal ? eaten > Math.round(goal.kcal) : false;
  const ring = el("div", { class: over ? "ring over" : "ring" },
    el("div", {},
      el("strong", {}, fmt(left === null ? eaten : Math.abs(left))),
      el("small", {}, planned ? "kcal no cardápio" : !goal ? "kcal" : over ? "kcal acima" : "kcal restantes")));
  ring.style.setProperty("--p", String(share(eaten, goal?.kcal)));
  return el("section", { class: "hero" },
    el("div", { class: "hero-main" }, ring,
      el("div", { class: "macros" },
        macro("Proteína", sum.protein, goal?.protein),
        macro("Carboidrato", sum.carbs, goal?.carbs),
        macro("Gordura", sum.fat, goal?.fat))),
    goal
      ? el("p", { class: "hero-total" }, `${fmt(eaten)} de ${fmt(goal.kcal)} kcal`)
      : button("Definir minhas metas", () => ctx.go("metas")));
}
