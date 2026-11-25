import { load, save } from "./db.js";
import { newState } from "./core/state.js";
import { isValidState, importData } from "./core/backup.js";
import { localDate, followToday } from "./core/dates.js";
import { el, button, confirmDialog, toast } from "./ui/dom.js";
import { renderToday } from "./ui/today.js";
import { renderMenu } from "./ui/menu.js";
import { renderProgress } from "./ui/progress.js";
import { renderProfile } from "./ui/profile.js";

const TABS = [["hoje", "Hoje", renderToday], ["cardapio", "Cardápio", renderMenu], ["evolucao", "Evolução", renderProgress], ["metas", "Metas", renderProfile]];
const ICON_PATHS = {
  hoje: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2",
  cardapio: "M6 3v7a2 2 0 0 0 4 0V3M8 12v9M17 3c-2 1-3 4-3 7 0 2 1 3 3 3v8",
  evolucao: "M4 18l5-6 4 3 7-9M15 6h5v5",
  metas: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12h.01",
};
function tabIcon(id) {
  const ns = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(ns, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICON_PATHS[id]);
  icon.append(path);
  return icon;
}
const main = document.getElementById("tela");
const nav = document.getElementById("abas");
const alertBox = document.getElementById("aviso");
// Avisa outras janelas do app para recarregar, evitando que uma apague o que a outra salvou.
const channel = "BroadcastChannel" in window ? new BroadcastChannel("dieta") : null;
const today = localDate();
let stale = false; // outra janela salvou depois que esta carregou

function warn(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
}

const ctx = {
  state: null, base: [], tab: "hoje", today, date: today,
  render() {
    const scroll = window.scrollY;
    main.replaceChildren(...TABS.find(([id]) => id === ctx.tab)[2](ctx).filter(Boolean));
    nav.replaceChildren(...TABS.map(([id, label]) => {
      // Tocar em "Hoje" volta para o dia atual.
      const b = button(label, () => { if (id === "hoje") ctx.date = ctx.today; ctx.go(id); }, "tab");
      b.prepend(tabIcon(id));
      if (id === ctx.tab) b.setAttribute("aria-current", "page");
      return b;
    }));
    window.scrollTo(0, scroll);
  },
  go(tab) { ctx.tab = tab; ctx.render(); window.scrollTo(0, 0); },
  setDate(date) { ctx.date = date > ctx.today ? ctx.today : date; ctx.render(); },
  // Salva logo após cada alteração.
  async commit() {
    // Nunca grava por cima do que outra janela salvou, nem um estado que não abriria depois.
    if (stale) return location.reload();
    ctx.render();
    if (!isValidState(ctx.state)) return warn("Algum valor ficou inválido e a última alteração não foi salva. Feche o app e abra de novo.");
    try {
      await save(ctx.state);
      alertBox.hidden = true;
      channel?.postMessage("salvo");
    } catch (error) {
      console.error(error);
      warn("Não consegui salvar a última alteração. Verifique o espaço do celular e exporte um backup na aba Metas.");
    }
  },
  async replace(state) { ctx.state = state; ctx.date = ctx.today; await ctx.commit(); },
  // Dia em que um registro deve entrar, mesmo se a meia-noite passou com a tela aberta.
  currentDate(date) {
    const old = ctx.today;
    checkDay();
    return followToday(date, old, ctx.today);
  },
};

function checkDay() {
  const now = localDate();
  if (now === ctx.today || !ctx.state) return;
  ctx.date = followToday(ctx.date, ctx.today, now);
  ctx.today = now;
  ctx.render();
}

// Saída para dados ilegíveis: trocar por um backup bom, com confirmação.
function importButton() {
  const file = el("input", { type: "file", accept: ".json,application/json", hidden: true });
  file.addEventListener("change", async () => {
    const chosen = file.files[0];
    file.value = "";
    if (!chosen) return;
    try {
      const data = importData(await chosen.text());
      if (!(await confirmDialog("Os dados deste celular serão substituídos pelo backup. Continuar?", "Substituir"))) return;
      await save(data);
      location.reload();
    } catch (error) {
      toast(error.message);
    }
  });
  return el("div", {}, button("Importar backup", () => file.click()), file);
}

// Erro ao abrir: mostra o problema e NUNCA grava por cima dos dados.
function fail(message, raw) {
  main.replaceChildren(
    el("h1", {}, "Não foi possível abrir"),
    el("p", { class: "warning" }, message),
    el("p", {}, "Seus dados não foram alterados. Feche o app e abra de novo."),
    button("Tentar de novo", () => location.reload(), "primary"),
    ...(raw === undefined ? [] : [importButton()]),
    ...(raw === undefined ? [] : [button("Salvar cópia dos dados", () => {
      const link = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(raw)], { type: "application/json" })), download: "dieta-copia.json" });
      document.body.append(link);
      link.click();
      link.remove();
    })]));
}

async function start() {
  let stored;
  try {
    const response = await fetch("data/foods.json");
    if (!response.ok) throw new Error(String(response.status));
    ctx.base = await response.json();
  } catch (error) {
    console.error(error);
    return fail("A lista de alimentos não carregou. Conecte-se à internet e tente de novo.");
  }
  try {
    stored = await load();
  } catch (error) {
    console.error(error);
    return fail("O armazenamento do navegador não respondeu.");
  }
  if (stored !== null && !isValidState(stored)) return fail("Os dados salvos estão em um formato que este app não reconhece.", stored);
  ctx.state = stored ?? newState(ctx.today);
  if (stored === null) ctx.tab = "metas";
  ctx.render();
  if (stored === null) await ctx.commit();
  navigator.storage?.persist?.().catch(() => {});
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 60000);
  if (channel) channel.onmessage = () => {
    stale = true;
    if (!document.querySelector("dialog[open]")) location.reload();
  };
}

// Versão nova baixada: oferece recarregar em vez de esperar o app ser fechado.
async function watchUpdates() {
  const workers = navigator.serviceWorker;
  if (!workers) return;
  const registration = await workers.register("sw.js");
  const offer = (worker) => {
    if (!worker || !workers.controller) return;
    const notice = el("p", { class: "warning banner" }, "Há uma versão nova do app. ",
      button("Atualizar", () => {
        workers.addEventListener("controllerchange", () => location.reload(), { once: true });
        worker.postMessage("atualizar");
      }, "primary"));
    document.body.prepend(notice);
  };
  offer(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker.addEventListener("statechange", () => { if (worker.state === "installed") offer(worker); });
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) registration.update().catch(() => {}); });
}

start();
watchUpdates().catch((error) => console.error(error));
