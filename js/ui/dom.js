// Criação de elementos. Texto vira sempre nó de texto (nunca innerHTML).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

export const button = (label, onclick, kind = "") => el("button", { type: "button", class: kind, onclick }, label);
export const field = (label, control) => el("label", { class: "field" }, el("span", {}, label), control);
export const input = (value = "", props = {}) => {
  const node = el("input", { autocomplete: "off", ...props });
  node.value = value;
  return node;
};
export const numberInput = (value = "") =>
  input(value === "" ? "" : String(value).replace(".", ","), { inputmode: "decimal" });
export function select(options, value) {
  const node = el("select", {}, options.map(([v, label]) => el("option", { value: v }, label)));
  if (value !== undefined) node.value = String(value);
  return node;
}
export const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const macroLine = (v) => `${fmt(Math.round(v.kcal))} kcal · P ${fmt(v.protein)} g · C ${fmt(v.carbs)} g · G ${fmt(v.fat)} g`;

// Janela. build(close, body) preenche o corpo. A promessa resolve com o valor passado a close.
export function dialog(title, build) {
  return new Promise((resolve) => {
    let result = null;
    const body = el("div", { class: "body" });
    const node = el("dialog", {},
      el("header", {}, el("h2", {}, title), button("Fechar", () => { node.close(); finish(); }, "quiet")),
      body);
    // Resolve na hora; o evento "close" (Esc, voltar do Android) pode chegar com atraso.
    const finish = () => { node.remove(); resolve(result); };
    const close = (value = null) => { result = value; node.close(); finish(); };
    node.addEventListener("close", finish);
    build(close, body);
    document.body.append(node);
    node.showModal();
  });
}

export const confirmDialog = async (message, yes = "Confirmar") =>
  (await dialog("Confirmar", (close, body) => {
    body.append(el("p", {}, message), el("div", { class: "row" },
      button("Cancelar", () => close(false), "quiet"), button(yes, () => close(true), "primary")));
  })) === true;

// Formulário: onSubmit lança Error para mostrar a mensagem sem fechar.
export function form(fields, submitLabel, onSubmit, extra = []) {
  const error = el("p", { class: "error", role: "alert" });
  let busy = false; // toque duplo não envia duas vezes
  return el("form", {
    novalidate: true,
    onsubmit: async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      error.textContent = "";
      try { await onSubmit(); } catch (e) { error.textContent = e.message; } finally { busy = false; }
    },
  }, fields, error, el("div", { class: "row" }, extra, el("button", { type: "submit", class: "primary" }, submitLabel)));
}

export const askText = (title, label, value = "") =>
  dialog(title, (close, body) => {
    const text = input(value, { maxlength: 60 });
    body.append(form([field(label, text)], "Salvar", () => {
      if (!text.value.trim()) throw new Error("Preencha o nome.");
      close(text.value.trim());
    }));
  });

let timer = null;
export function toast(message) {
  document.querySelector(".toast")?.remove();
  const node = el("div", { class: "toast", role: "status" }, message);
  (document.querySelector("dialog[open]") ?? document.body).append(node);
  clearTimeout(timer);
  timer = setTimeout(() => node.remove(), 3500);
}
