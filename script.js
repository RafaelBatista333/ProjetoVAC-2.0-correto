const STORAGE_KEY = "vac.animais";
const ORDER_STORAGE_KEY = "vac.pedidos";
const ADMIN_STORAGE_KEY = "vac.colaboradores.admin";
const ADMIN_SESSION_STORAGE_KEY = "vac.colaboradores.admin.session";

const DEFAULT_ANIMAIS = [
  {
    nome: "Mel",
    especie: "Cachorro",
    local: "Praça Central",
    saude: "Saudável",
    descricao: "Recebe alimentação diária de moradores da região.",
    criadoEm: "2026-03-25T10:30:00.000Z"
  },
  {
    nome: "Lua",
    especie: "Gato",
    local: "Rua das Palmeiras",
    saude: "Ferido",
    descricao: "Precisa de avaliação em uma das patas traseiras.",
    criadoEm: "2026-03-26T15:00:00.000Z"
  }
];

const state = {
  animais: [],
  pedidos: [],
  pedidoAdmin: null,
  pedidoAdminSession: "",
  activeRequester: null,
  mapa: null
};

document.addEventListener("DOMContentLoaded", () => {
  state.animais = loadAnimals();
  state.pedidos = loadOrders();
  state.pedidoAdmin = loadAdminCredential();
  state.pedidoAdminSession = loadAdminSession();

  bindEvent("loginForm", "submit", handleLogin);
  bindEvent("entrarDireto", "click", handleQuickEntry);
  bindEvent("formAnimal", "submit", handleAnimalSubmit);
  bindEvent("pedido-access-form", "submit", handleRequesterAccess);
  bindEvent("pedido-clear-requester", "click", clearRequester);
  bindEvent("pedido-form", "submit", handleOrderSubmit);
  bindEvent("pedido-admin-setup-form", "submit", handleAdminSetup);
  bindEvent("pedido-admin-login-form", "submit", handleAdminLogin);
  bindEvent("pedido-admin-logout", "click", handleAdminLogout);
  bindEvent("pedido-admin-list", "change", handleOrderStatusChange);

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => openTab(button.dataset.tab));
  });

  renderAnimals();
  syncRequesterUI();
  syncPedidoAdminUI();
  renderOrders();
});

function bindEvent(id, eventName, handler) {
  const element = document.getElementById(id);

  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form.reportValidity()) {
    return;
  }

  const nome = document.getElementById("nomeUsuario").value.trim();
  const tipo = document.getElementById("tipoUsuario").value;

  enterApp(nome || "Visitante", tipo);
}

function handleQuickEntry() {
  enterApp("Visitante", "cliente");
}

function enterApp(nome, tipo) {
  document.body.classList.add("is-app-open");
  document.getElementById("loginTela").classList.add("is-hidden");
  document.getElementById("app").classList.remove("is-hidden");
  document.getElementById("mensagemBoasVindas").textContent =
    `Usuário ativo: ${nome} | Perfil: ${capitalize(tipo)}.`;

  openTab("inicio");
  initMap();
}

function openTab(tabId) {
  const app = document.getElementById("app");

  document.querySelectorAll(".aba").forEach((section) => {
    section.classList.toggle("is-active", section.id === tabId);
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabId);
  });

  if (app) {
    app.dataset.activeTab = tabId;
  }

  if (tabId === "inicio" && state.mapa) {
    setTimeout(() => {
      state.mapa.invalidateSize();
    }, 120);
  }
}

function handleAnimalSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form.reportValidity()) {
    return;
  }

  const animal = {
    nome: document.getElementById("nomeAnimal").value.trim(),
    especie: document.getElementById("especie").value,
    local: document.getElementById("localAnimal").value.trim(),
    saude: document.getElementById("saudeAnimal").value,
    descricao: document.getElementById("descAnimal").value.trim(),
    criadoEm: new Date().toISOString()
  };

  state.animais.unshift(animal);
  saveAnimals();
  renderAnimals();

  form.reset();

  const status = document.getElementById("statusCadastro");
  status.textContent = `${animal.nome} foi registrado com sucesso.`;
  status.classList.add("is-success");

  openTab("inicio");
}

function handleRequesterAccess(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form.reportValidity()) {
    return;
  }

  state.activeRequester = {
    nome: document.getElementById("pedido-requester-name").value.trim(),
    email: document.getElementById("pedido-requester-email").value.trim()
  };

  syncRequesterUI();
  setStatusMessage(
    "pedido-access-feedback",
    `Colaborador ${state.activeRequester.nome} liberado para registrar pedidos.`,
    "success"
  );
  setStatusMessage("pedido-feedback", "");
}

function clearRequester() {
  state.activeRequester = null;

  const accessForm = document.getElementById("pedido-access-form");
  const orderForm = document.getElementById("pedido-form");

  if (accessForm) {
    accessForm.reset();
  }

  if (orderForm) {
    orderForm.reset();
  }

  syncRequesterUI();
  setStatusMessage("pedido-access-feedback", "");
  setStatusMessage("pedido-feedback", "");
}

function syncRequesterUI() {
  const accessForm = document.getElementById("pedido-access-form");
  const summary = document.getElementById("pedido-requester-summary");
  const summaryText = document.getElementById("pedido-requester-text");
  const orderForm = document.getElementById("pedido-form");
  const hasRequester = Boolean(state.activeRequester);

  if (!accessForm || !summary || !summaryText || !orderForm) {
    return;
  }

  accessForm.classList.toggle("is-hidden", hasRequester);
  summary.classList.toggle("is-hidden", !hasRequester);
  orderForm.classList.toggle("is-hidden", !hasRequester);

  if (hasRequester) {
    summaryText.textContent =
      `${state.activeRequester.nome} | ${state.activeRequester.email}`;
  } else {
    summaryText.textContent = "";
  }
}

function handleOrderSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!state.activeRequester) {
    setStatusMessage(
      "pedido-feedback",
      "Identifique primeiro o colaborador responsável pelo pedido.",
      "error"
    );
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const pedido = {
    id: createId(),
    colaboradorNome: state.activeRequester.nome,
    colaboradorEmail: state.activeRequester.email,
    animalNome: document.getElementById("pedido-animal-name").value.trim(),
    animalEspecie: document.getElementById("pedido-animal-species").value,
    item: document.getElementById("pedido-item").value,
    quantidade: document.getElementById("pedido-quantity").value.trim(),
    prioridade: document.getElementById("pedido-priority").value,
    localEntrega: document.getElementById("pedido-location").value.trim(),
    observacoes: document.getElementById("pedido-notes").value.trim(),
    status: "Recebido",
    criadoEm: new Date().toISOString()
  };

  state.pedidos.unshift(pedido);
  saveOrders();
  renderOrders();

  form.reset();
  setStatusMessage(
    "pedido-feedback",
    `Pedido de ração registrado para ${pedido.animalNome}.`,
    "success"
  );
}

function handleAdminSetup(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form.reportValidity()) {
    return;
  }

  const nome = document.getElementById("pedido-admin-setup-name").value.trim();
  const senha = document.getElementById("pedido-admin-setup-password").value;
  const confirmacao = document.getElementById("pedido-admin-setup-password-confirm").value;

  if (senha !== confirmacao) {
    setStatusMessage(
      "pedido-admin-setup-feedback",
      "A confirmação da senha precisa ser igual à senha administrativa.",
      "error"
    );
    return;
  }

  state.pedidoAdmin = { nome, senha };
  state.pedidoAdminSession = "";

  saveAdminCredential();
  saveAdminSession("");

  form.reset();
  syncPedidoAdminUI();

  const loginInput = document.getElementById("pedido-admin-username");

  if (loginInput) {
    loginInput.value = nome;
  }

  setStatusMessage(
    "pedido-admin-setup-feedback",
    "Acesso administrativo criado. Use as credenciais para entrar no painel.",
    "success"
  );
  setStatusMessage("pedido-admin-login-feedback", "");
}

function handleAdminLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form.reportValidity()) {
    return;
  }

  if (!state.pedidoAdmin) {
    setStatusMessage(
      "pedido-admin-login-feedback",
      "Crie primeiro o acesso administrativo para liberar a área.",
      "error"
    );
    return;
  }

  const nome = document.getElementById("pedido-admin-username").value.trim();
  const senha = document.getElementById("pedido-admin-password").value;

  if (nome !== state.pedidoAdmin.nome || senha !== state.pedidoAdmin.senha) {
    setStatusMessage(
      "pedido-admin-login-feedback",
      "Nome ou senha administrativos inválidos.",
      "error"
    );
    return;
  }

  state.pedidoAdminSession = nome;
  saveAdminSession(nome);
  syncPedidoAdminUI();

  form.reset();
  setStatusMessage(
    "pedido-admin-login-feedback",
    `Painel liberado para ${nome}.`,
    "success"
  );
}

function handleAdminLogout() {
  state.pedidoAdminSession = "";
  saveAdminSession("");
  syncPedidoAdminUI();
  setStatusMessage("pedido-admin-login-feedback", "Sessão administrativa encerrada.", "success");
}

function syncPedidoAdminUI() {
  const accessTitle = document.getElementById("pedido-admin-access-title");
  const accessDescription = document.getElementById("pedido-admin-access-description");
  const statusText = document.getElementById("pedido-admin-status-text");
  const panelTitle = document.getElementById("pedido-admin-panel-title");
  const panelDescription = document.getElementById("pedido-admin-panel-description");
  const setupForm = document.getElementById("pedido-admin-setup-form");
  const loginForm = document.getElementById("pedido-admin-login-form");
  const dashboard = document.getElementById("pedido-admin-dashboard");
  const sessionText = document.getElementById("pedido-admin-session");
  const loginInput = document.getElementById("pedido-admin-username");
  const isAuthenticated = hasAdminSession();

  if (!accessTitle || !accessDescription || !statusText || !panelTitle || !panelDescription) {
    return;
  }

  if (!state.pedidoAdmin) {
    accessTitle.textContent = "Criar acesso administrativo";
    accessDescription.textContent =
      "Defina um nome e uma senha exclusivos para o administrador dos pedidos.";
    statusText.textContent = "Nenhum administrador cadastrado.";
    panelTitle.textContent = "Criar acesso administrativo";
    panelDescription.textContent =
      "O primeiro acesso cria a credencial administrativa. Depois disso, apenas esse perfil pode abrir a planilha de acompanhamento.";

    toggleHidden(setupForm, false);
    toggleHidden(loginForm, true);
    toggleHidden(dashboard, true);

    if (sessionText) {
      sessionText.textContent = "";
    }

    return;
  }

  if (loginInput) {
    loginInput.value = state.pedidoAdmin.nome;
  }

  accessTitle.textContent = isAuthenticated ? "Painel administrativo ativo" : "Acesso administrativo criado";
  accessDescription.textContent = isAuthenticated
    ? "Os pedidos estão prontos para acompanhamento, atualização de status e conferências."
    : "Use o nome e a senha cadastrados para liberar a área administrativa dos pedidos.";
  statusText.textContent = isAuthenticated
    ? `Administrador ativo: ${state.pedidoAdmin.nome}.`
    : `Administrador cadastrado: ${state.pedidoAdmin.nome}.`;
  panelTitle.textContent = isAuthenticated ? "Painel administrativo liberado" : "Entrar como administrador";
  panelDescription.textContent = isAuthenticated
    ? "A equipe pode acompanhar a fila abaixo e atualizar o status de cada entrega."
    : "Somente o nome e a senha cadastrados conseguem abrir a planilha de acompanhamento.";

  toggleHidden(setupForm, true);
  toggleHidden(loginForm, isAuthenticated);
  toggleHidden(dashboard, !isAuthenticated);

  if (sessionText) {
    sessionText.textContent = isAuthenticated
      ? `Acompanhando os pedidos como ${state.pedidoAdmin.nome}.`
      : "";
  }
}

function handleOrderStatusChange(event) {
  const select = event.target;

  if (!(select instanceof HTMLSelectElement) || select.dataset.orderStatus !== "true") {
    return;
  }

  if (!hasAdminSession()) {
    renderOrders();
    return;
  }

  const pedido = state.pedidos.find((item) => item.id === select.dataset.orderId);

  if (!pedido) {
    return;
  }

  pedido.status = select.value;
  saveOrders();
  renderOrders();
}

function renderAnimals() {
  const list = document.getElementById("listaAnimais");
  const counter = document.getElementById("contadorAnimais");

  if (!list || !counter) {
    return;
  }

  list.innerHTML = "";
  counter.textContent = String(state.animais.length);

  state.animais.forEach((animal) => {
    const item = document.createElement("li");
    item.className = "animal-item";

    const title = document.createElement("h4");
    title.textContent = `${animal.nome} - ${animal.especie}`;

    const meta = document.createElement("p");
    meta.className = "animal-item__meta";
    meta.textContent = `${animal.local} | ${animal.saude} | ${formatDate(animal.criadoEm)}`;

    const description = document.createElement("p");
    description.textContent = animal.descricao;

    item.append(title, meta, description);
    list.appendChild(item);
  });
}

function renderOrders() {
  const list = document.getElementById("pedido-admin-list");
  const emptyState = document.getElementById("pedido-empty-state");
  const totalCount = document.getElementById("pedido-total-count");
  const openCount = document.getElementById("pedido-open-count");
  const highCount = document.getElementById("pedido-high-count");
  const tableWrap = document.querySelector("#pedido-admin-dashboard .pedido-table-wrap");

  if (!list || !emptyState || !totalCount || !openCount || !highCount || !tableWrap) {
    return;
  }

  list.innerHTML = "";
  totalCount.textContent = String(state.pedidos.length);
  openCount.textContent = String(state.pedidos.filter((pedido) => pedido.status !== "Entregue").length);
  highCount.textContent = String(state.pedidos.filter((pedido) => pedido.prioridade === "Alta").length);

  if (!state.pedidos.length) {
    emptyState.classList.remove("is-hidden");
    tableWrap.classList.add("is-hidden");
    return;
  }

  emptyState.classList.add("is-hidden");
  tableWrap.classList.remove("is-hidden");

  state.pedidos.forEach((pedido) => {
    const row = document.createElement("tr");

    row.append(
      createMetaCell(
        pedido.colaboradorNome,
        pedido.colaboradorEmail,
        formatDate(pedido.criadoEm)
      ),
      createMetaCell(
        `${pedido.animalNome} - ${pedido.animalEspecie}`,
        pedido.observacoes,
        `Prioridade: ${pedido.prioridade}`
      ),
      createMetaCell(
        pedido.item,
        `Quantidade: ${pedido.quantidade}`,
        `Status atual: ${pedido.status}`
      ),
      createMetaCell(
        pedido.localEntrega,
        "Ponto de apoio informado pelo colaborador"
      ),
      createStatusCell(pedido)
    );

    list.appendChild(row);
  });
}

function createMetaCell(titleText, metaText, detailText = "") {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  const title = document.createElement("strong");
  const meta = document.createElement("span");

  wrapper.className = "pedido-meta";
  title.textContent = titleText;
  meta.textContent = metaText;

  wrapper.append(title, meta);

  if (detailText) {
    const detail = document.createElement("small");
    detail.textContent = detailText;
    wrapper.appendChild(detail);
  }

  cell.appendChild(wrapper);
  return cell;
}

function createStatusCell(pedido) {
  const cell = document.createElement("td");
  const select = document.createElement("select");
  const statusOptions = ["Recebido", "Em separação", "Em rota", "Entregue"];

  select.className = "pedido-status-select";
  select.dataset.orderStatus = "true";
  select.dataset.orderId = pedido.id;

  statusOptions.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });

  select.value = pedido.status;
  cell.appendChild(select);

  return cell;
}

function initMap() {
  const mapElement = document.getElementById("mapa");

  if (!mapElement || mapElement.dataset.ready === "true") {
    return;
  }

  if (typeof window.L === "undefined") {
    mapElement.innerHTML = `
      <div class="mapa-fallback">
        <div>
          <strong>Mapa online indisponível</strong>
          <p>Ponto de referência principal: Centro de São Paulo</p>
          <p>Latitude: -23.5505 | Longitude: -46.6333</p>
        </div>
      </div>
    `;
    mapElement.dataset.ready = "true";
    return;
  }

  state.mapa = window.L.map("mapa", {
    scrollWheelZoom: false
  }).setView([-23.5505, -46.6333], 12);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(state.mapa);

  window.L.marker([-23.5505, -46.6333])
    .addTo(state.mapa)
    .bindPopup("Ponto de apoio V.A.C.")
    .openPopup();

  mapElement.dataset.ready = "true";
}

function loadAnimals() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ANIMAIS));
      return DEFAULT_ANIMAIS.map(normalizeAnimalText);
    }

    return JSON.parse(stored).map(normalizeAnimalText);
  } catch (error) {
    return DEFAULT_ANIMAIS.map(normalizeAnimalText);
  }
}

function saveAnimals() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.animais));
  } catch (error) {
    console.error("Não foi possível salvar os registros localmente.", error);
  }
}

function loadOrders() {
  try {
    const stored = window.localStorage.getItem(ORDER_STORAGE_KEY);
    return stored ? JSON.parse(stored).map(normalizeOrderText) : [];
  } catch (error) {
    return [];
  }
}

function saveOrders() {
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(state.pedidos));
  } catch (error) {
    console.error("Não foi possível salvar os pedidos localmente.", error);
  }
}

function loadAdminCredential() {
  try {
    const stored = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function saveAdminCredential() {
  try {
    if (!state.pedidoAdmin) {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state.pedidoAdmin));
  } catch (error) {
    console.error("Não foi possível salvar o acesso administrativo.", error);
  }
}

function loadAdminSession() {
  try {
    return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || "";
  } catch (error) {
    return "";
  }
}

function saveAdminSession(sessionName) {
  try {
    if (!sessionName) {
      window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, sessionName);
  } catch (error) {
    console.error("Não foi possível salvar a sessão administrativa.", error);
  }
}

function normalizeAnimalText(animal) {
  return {
    ...animal,
    local: normalizePortugueseText(animal.local),
    saude: normalizePortugueseText(animal.saude),
    descricao: normalizePortugueseText(animal.descricao)
  };
}

function normalizeOrderText(pedido) {
  return {
    ...pedido,
    animalEspecie: normalizePortugueseText(pedido.animalEspecie),
    item: normalizePortugueseText(pedido.item),
    prioridade: normalizePortugueseText(pedido.prioridade),
    localEntrega: normalizePortugueseText(pedido.localEntrega),
    observacoes: normalizePortugueseText(pedido.observacoes),
    status: normalizePortugueseText(pedido.status)
  };
}

function normalizePortugueseText(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replaceAll("Praca", "Praça")
    .replaceAll("Saudavel", "Saudável")
    .replaceAll("alimentacao", "alimentação")
    .replaceAll("diaria", "diária")
    .replaceAll("regiao", "região")
    .replaceAll("avaliacao", "avaliação")
    .replaceAll("Racao", "Ração")
    .replaceAll("umida", "úmida")
    .replaceAll("terapeutica", "terapêutica")
    .replaceAll("Media", "Média")
    .replaceAll("separacao", "separação");
}

function hasAdminSession() {
  if (!state.pedidoAdmin || !state.pedidoAdminSession) {
    return false;
  }

  const isValidSession = state.pedidoAdminSession === state.pedidoAdmin.nome;

  if (!isValidSession) {
    state.pedidoAdminSession = "";
    saveAdminSession("");
  }

  return isValidSession;
}

function toggleHidden(element, shouldHide) {
  if (element) {
    element.classList.toggle("is-hidden", shouldHide);
  }
}

function setStatusMessage(elementId, message, statusType = "") {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("is-success", "is-error");

  if (statusType) {
    element.classList.add(`is-${statusType}`);
  }
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `pedido-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(isoDate));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ============================================================
   Módulo de acessibilidade e configurações
   (tema claro/escuro, cores para daltonismo, tamanho de texto,
   idioma, Libras e leitura em voz alta)
   ============================================================ */

const SETTINGS_KEY = "vac.settings";

const DEFAULT_SETTINGS = {
  theme: "light",
  colorMode: "default",
  fontSize: "normal",
  lang: "pt-BR",
  libras: false
};

const TRANSLATIONS = {
  "pt-BR": {
    "app.title": "V.A.C. | Vanguarda de Animais Comunitários",
    "hero.tag": "Atendimento comunitário para animais domésticos e silvestres",
    "hero.title": "V.A.C.",
    "hero.desc": "Registre ocorrências, acompanhe o fluxo de atendimento e mantenha a comunidade informada sobre os animais que precisam de ajuda.",
    "pilar.localize": "Localize",
    "pilar.cuide": "Cuide",
    "pilar.proteja": "Proteja",
    "pilar.conecte": "Conecte-se",
    "login.heading": "Entrar no aplicativo",
    "login.tipo.label": "Tipo de usuário",
    "login.tipo.cliente": "Cliente",
    "login.tipo.funcionario": "Funcionário",
    "login.nome.label": "Nome",
    "login.nome.placeholder": "Seu nome",
    "login.email.label": "E-mail",
    "login.senha.label": "Senha",
    "login.senha.placeholder": "Digite sua senha",
    "login.entrar": "Entrar",
    "login.entrarDireto": "Entrar sem cadastro",
    "app.tag": "Painel operacional",
    "nav.inicio": "Início",
    "nav.servicos": "Serviços",
    "nav.colaboradores": "Colaboradores",
    "nav.contato": "Contato",
    "nav.cadastro": "Registrar animal",
    "inicio.monitoramento": "Monitoramento",
    "inicio.mapa.titulo": "Mapa da comunidade",
    "inicio.mapa.nota": "Se o mapa online não carregar, o painel mostra um resumo do ponto central de atendimento.",
    "inicio.registros": "Registros recentes",
    "inicio.animais.titulo": "Animais cadastrados",
    "servicos.fluxo": "Fluxo do atendimento",
    "servicos.titulo": "Como o processo funciona",
    "servicos.passo1": "O cliente registra o animal e informa localização e estado de saúde.",
    "servicos.passo2": "A equipe do V.A.C. recebe a notificação e prioriza o chamado.",
    "servicos.passo3": "Um colaborador se desloca até o local para avaliar a situação.",
    "servicos.passo4": "O animal recebe atendimento, encaminhamento ou acompanhamento.",
    "colaboradores.rede": "Rede de apoio",
    "colaboradores.titulo": "ONGs e parceiros sugeridos",
    "colaboradores.li1": "Clínicas veterinárias de plantão do bairro",
    "colaboradores.li2": "Protetores independentes e lares temporários",
    "colaboradores.li3": "Secretaria municipal de meio ambiente",
    "colaboradores.li4": "Voluntários para transporte e resgate",
    "colaboradores.nota": "Os colaboradores também podem registrar pedidos de ração para os animais atendidos pela rede, centralizando solicitações e acompanhamento em um único lugar.",
    "pedidos.label": "Pedidos de apoio",
    "pedidos.titulo": "Sistema de pedidos de ração",
    "pedidos.nota": "Separe o fluxo de solicitação e administração para que cada colaborador registre rapidamente o que cada animal precisa, enquanto a equipe acompanha tudo em formato de planilha.",
    "pedidos.tag1": "Ração seca",
    "pedidos.tag2": "Ração úmida",
    "pedidos.tag3": "Entrega por ponto de apoio",
    "pedidos.situacaoAtual": "Situação atual:",
    "pedidos.areaColaborador": "Área do colaborador",
    "pedidos.registrarPedido": "Registrar novo pedido",
    "pedidos.instrucao": "Primeiro identifique o colaborador responsável. Depois disso, o formulário de pedido fica liberado para registrar o tipo de ração, quantidade e observações.",
    "pedidos.nomeColaborador": "Nome do colaborador",
    "pedidos.continuar": "Continuar para o pedido",
    "pedidos.trocarColaborador": "Trocar colaborador",
    "cadastro.nomeAnimal": "Nome do animal",
    "cadastro.especie": "Espécie",
    "especie.cachorro": "Cachorro",
    "especie.gato": "Gato",
    "especie.silvestre": "Silvestre",
    "pedidos.tipoRacao": "Tipo de ração",
    "pedidos.racaoTerapeutica": "Ração terapêutica",
    "pedidos.kitMisto": "Kit misto",
    "pedidos.quantidade": "Quantidade",
    "pedidos.prioridade": "Prioridade",
    "prioridade.alta": "Alta",
    "prioridade.media": "Média",
    "prioridade.baixa": "Baixa",
    "pedidos.localEntrega": "Local de entrega",
    "pedidos.observacoes": "Observações",
    "pedidos.registrarBotao": "Registrar pedido de ração",
    "pedidos.areaAdministrativa": "Área administrativa",
    "pedidos.nomeAdmin": "Nome do administrador",
    "pedidos.senhaAdmin": "Senha administrativa",
    "pedidos.confirmarSenha": "Confirmar senha",
    "pedidos.criarAcesso": "Criar acesso do administrador",
    "pedidos.entrarAdmin": "Entrar como administrador",
    "pedidos.acompanhamento": "Acompanhamento",
    "pedidos.filaPedidos": "Fila de pedidos",
    "pedidos.sair": "Sair",
    "pedidos.pedidosLabel": "Pedidos",
    "pedidos.emAberto": "Em aberto",
    "pedidos.altaPrioridade": "Alta prioridade",
    "pedidos.vazio": "Nenhum pedido cadastrado até o momento.",
    "pedidos.tabela.solicitante": "Solicitante",
    "pedidos.tabela.animal": "Animal",
    "pedidos.tabela.pedido": "Pedido",
    "pedidos.tabela.entrega": "Entrega",
    "pedidos.tabela.status": "Status",
    "contato.central": "Central",
    "contato.titulo": "Contato do atendimento",
    "contato.telefoneLabel": "Telefone:",
    "contato.emailLabel": "E-mail:",
    "contato.horarioLabel": "Horário:",
    "contato.horario": "atendimento comunitário 24 horas",
    "cadastro.novoRegistro": "Novo registro",
    "cadastro.relatarAnimal": "Relatar animal",
    "cadastro.local": "Local onde vive",
    "cadastro.estadoSaude": "Estado de saúde",
    "saude.saudavel": "Saudável",
    "saude.ferido": "Ferido",
    "saude.doente": "Doente",
    "cadastro.descricao": "Descrição",
    "cadastro.registrarBotao": "Registrar animal"
  },
  en: {
    "app.title": "V.A.C. | Community Animal Vanguard",
    "hero.tag": "Community care for domestic and wild animals",
    "hero.title": "V.A.C.",
    "hero.desc": "Log cases, follow the care workflow and keep the community informed about animals that need help.",
    "pilar.localize": "Locate",
    "pilar.cuide": "Care",
    "pilar.proteja": "Protect",
    "pilar.conecte": "Connect",
    "login.heading": "Sign in to the app",
    "login.tipo.label": "User type",
    "login.tipo.cliente": "Community member",
    "login.tipo.funcionario": "Staff",
    "login.nome.label": "Name",
    "login.nome.placeholder": "Your name",
    "login.email.label": "Email",
    "login.senha.label": "Password",
    "login.senha.placeholder": "Enter your password",
    "login.entrar": "Sign in",
    "login.entrarDireto": "Continue as guest",
    "app.tag": "Operations panel",
    "nav.inicio": "Home",
    "nav.servicos": "Services",
    "nav.colaboradores": "Contributors",
    "nav.contato": "Contact",
    "nav.cadastro": "Report animal",
    "inicio.monitoramento": "Monitoring",
    "inicio.mapa.titulo": "Community map",
    "inicio.mapa.nota": "If the online map does not load, the panel shows a summary of the main care point.",
    "inicio.registros": "Recent records",
    "inicio.animais.titulo": "Registered animals",
    "servicos.fluxo": "Care workflow",
    "servicos.titulo": "How the process works",
    "servicos.passo1": "The reporter registers the animal and shares its location and health status.",
    "servicos.passo2": "The V.A.C. team receives the notification and prioritizes the case.",
    "servicos.passo3": "A contributor travels to the location to assess the situation.",
    "servicos.passo4": "The animal receives care, referral or follow-up.",
    "colaboradores.rede": "Support network",
    "colaboradores.titulo": "Suggested NGOs and partners",
    "colaboradores.li1": "On-call local veterinary clinics",
    "colaboradores.li2": "Independent rescuers and foster homes",
    "colaboradores.li3": "Municipal environmental department",
    "colaboradores.li4": "Volunteers for transport and rescue",
    "colaboradores.nota": "Contributors can also register food requests for the animals supported by the network, centralizing requests and follow-up in one place.",
    "pedidos.label": "Support requests",
    "pedidos.titulo": "Pet food request system",
    "pedidos.nota": "Separate the request and administration flow so each contributor can quickly log what each animal needs, while the team tracks everything like a spreadsheet.",
    "pedidos.tag1": "Dry food",
    "pedidos.tag2": "Wet food",
    "pedidos.tag3": "Delivery at a support point",
    "pedidos.situacaoAtual": "Current status:",
    "pedidos.areaColaborador": "Contributor area",
    "pedidos.registrarPedido": "Register new request",
    "pedidos.instrucao": "First identify the responsible contributor. Then the request form unlocks so you can log the food type, amount and notes.",
    "pedidos.nomeColaborador": "Contributor name",
    "pedidos.continuar": "Continue to the request",
    "pedidos.trocarColaborador": "Switch contributor",
    "cadastro.nomeAnimal": "Animal name",
    "cadastro.especie": "Species",
    "especie.cachorro": "Dog",
    "especie.gato": "Cat",
    "especie.silvestre": "Wildlife",
    "pedidos.tipoRacao": "Food type",
    "pedidos.racaoTerapeutica": "Therapeutic food",
    "pedidos.kitMisto": "Mixed kit",
    "pedidos.quantidade": "Amount",
    "pedidos.prioridade": "Priority",
    "prioridade.alta": "High",
    "prioridade.media": "Medium",
    "prioridade.baixa": "Low",
    "pedidos.localEntrega": "Delivery location",
    "pedidos.observacoes": "Notes",
    "pedidos.registrarBotao": "Register food request",
    "pedidos.areaAdministrativa": "Admin area",
    "pedidos.nomeAdmin": "Administrator name",
    "pedidos.senhaAdmin": "Administrator password",
    "pedidos.confirmarSenha": "Confirm password",
    "pedidos.criarAcesso": "Create administrator access",
    "pedidos.entrarAdmin": "Sign in as administrator",
    "pedidos.acompanhamento": "Tracking",
    "pedidos.filaPedidos": "Request queue",
    "pedidos.sair": "Sign out",
    "pedidos.pedidosLabel": "Requests",
    "pedidos.emAberto": "Open",
    "pedidos.altaPrioridade": "High priority",
    "pedidos.vazio": "No requests registered yet.",
    "pedidos.tabela.solicitante": "Requester",
    "pedidos.tabela.animal": "Animal",
    "pedidos.tabela.pedido": "Request",
    "pedidos.tabela.entrega": "Delivery",
    "pedidos.tabela.status": "Status",
    "contato.central": "Hotline",
    "contato.titulo": "Care contact",
    "contato.telefoneLabel": "Phone:",
    "contato.emailLabel": "Email:",
    "contato.horarioLabel": "Hours:",
    "contato.horario": "24-hour community care",
    "cadastro.novoRegistro": "New record",
    "cadastro.relatarAnimal": "Report animal",
    "cadastro.local": "Where it lives",
    "cadastro.estadoSaude": "Health status",
    "saude.saudavel": "Healthy",
    "saude.ferido": "Injured",
    "saude.doente": "Sick",
    "cadastro.descricao": "Description",
    "cadastro.registrarBotao": "Register animal"
  },
  es: {
    "app.title": "V.A.C. | Vanguardia de Animales Comunitarios",
    "hero.tag": "Atención comunitaria para animales domésticos y silvestres",
    "hero.title": "V.A.C.",
    "hero.desc": "Registra casos, sigue el flujo de atención y mantén a la comunidad informada sobre los animales que necesitan ayuda.",
    "pilar.localize": "Localiza",
    "pilar.cuide": "Cuida",
    "pilar.proteja": "Protege",
    "pilar.conecte": "Conéctate",
    "login.heading": "Entrar a la aplicación",
    "login.tipo.label": "Tipo de usuario",
    "login.tipo.cliente": "Vecino",
    "login.tipo.funcionario": "Personal",
    "login.nome.label": "Nombre",
    "login.nome.placeholder": "Tu nombre",
    "login.email.label": "Correo electrónico",
    "login.senha.label": "Contraseña",
    "login.senha.placeholder": "Escribe tu contraseña",
    "login.entrar": "Entrar",
    "login.entrarDireto": "Entrar sin registro",
    "app.tag": "Panel operativo",
    "nav.inicio": "Inicio",
    "nav.servicos": "Servicios",
    "nav.colaboradores": "Colaboradores",
    "nav.contato": "Contacto",
    "nav.cadastro": "Registrar animal",
    "inicio.monitoramento": "Monitoreo",
    "inicio.mapa.titulo": "Mapa de la comunidad",
    "inicio.mapa.nota": "Si el mapa en línea no carga, el panel muestra un resumen del punto central de atención.",
    "inicio.registros": "Registros recientes",
    "inicio.animais.titulo": "Animales registrados",
    "servicos.fluxo": "Flujo de atención",
    "servicos.titulo": "Cómo funciona el proceso",
    "servicos.passo1": "La persona registra al animal e indica su ubicación y estado de salud.",
    "servicos.passo2": "El equipo del V.A.C. recibe la notificación y prioriza el caso.",
    "servicos.passo3": "Un colaborador se traslada al lugar para evaluar la situación.",
    "servicos.passo4": "El animal recibe atención, derivación o seguimiento.",
    "colaboradores.rede": "Red de apoyo",
    "colaboradores.titulo": "ONG y aliados sugeridos",
    "colaboradores.li1": "Clínicas veterinarias de guardia del barrio",
    "colaboradores.li2": "Rescatistas independientes y hogares temporales",
    "colaboradores.li3": "Secretaría municipal de medio ambiente",
    "colaboradores.li4": "Voluntarios para transporte y rescate",
    "colaboradores.nota": "Los colaboradores también pueden registrar pedidos de alimento para los animales atendidos por la red, centralizando solicitudes y seguimiento en un solo lugar.",
    "pedidos.label": "Pedidos de apoyo",
    "pedidos.titulo": "Sistema de pedidos de alimento",
    "pedidos.nota": "Separa el flujo de solicitud y administración para que cada colaborador registre rápidamente lo que necesita cada animal, mientras el equipo hace seguimiento como en una planilla.",
    "pedidos.tag1": "Alimento seco",
    "pedidos.tag2": "Alimento húmedo",
    "pedidos.tag3": "Entrega en punto de apoyo",
    "pedidos.situacaoAtual": "Situación actual:",
    "pedidos.areaColaborador": "Área del colaborador",
    "pedidos.registrarPedido": "Registrar nuevo pedido",
    "pedidos.instrucao": "Primero identifica al colaborador responsable. Después, el formulario de pedido se habilita para registrar el tipo de alimento, cantidad y notas.",
    "pedidos.nomeColaborador": "Nombre del colaborador",
    "pedidos.continuar": "Continuar al pedido",
    "pedidos.trocarColaborador": "Cambiar colaborador",
    "cadastro.nomeAnimal": "Nombre del animal",
    "cadastro.especie": "Especie",
    "especie.cachorro": "Perro",
    "especie.gato": "Gato",
    "especie.silvestre": "Silvestre",
    "pedidos.tipoRacao": "Tipo de alimento",
    "pedidos.racaoTerapeutica": "Alimento terapéutico",
    "pedidos.kitMisto": "Kit mixto",
    "pedidos.quantidade": "Cantidad",
    "pedidos.prioridade": "Prioridad",
    "prioridade.alta": "Alta",
    "prioridade.media": "Media",
    "prioridade.baixa": "Baja",
    "pedidos.localEntrega": "Lugar de entrega",
    "pedidos.observacoes": "Notas",
    "pedidos.registrarBotao": "Registrar pedido de alimento",
    "pedidos.areaAdministrativa": "Área administrativa",
    "pedidos.nomeAdmin": "Nombre del administrador",
    "pedidos.senhaAdmin": "Contraseña administrativa",
    "pedidos.confirmarSenha": "Confirmar contraseña",
    "pedidos.criarAcesso": "Crear acceso de administrador",
    "pedidos.entrarAdmin": "Entrar como administrador",
    "pedidos.acompanhamento": "Seguimiento",
    "pedidos.filaPedidos": "Cola de pedidos",
    "pedidos.sair": "Salir",
    "pedidos.pedidosLabel": "Pedidos",
    "pedidos.emAberto": "Abiertos",
    "pedidos.altaPrioridade": "Alta prioridad",
    "pedidos.vazio": "Todavía no hay pedidos registrados.",
    "pedidos.tabela.solicitante": "Solicitante",
    "pedidos.tabela.animal": "Animal",
    "pedidos.tabela.pedido": "Pedido",
    "pedidos.tabela.entrega": "Entrega",
    "pedidos.tabela.status": "Estado",
    "contato.central": "Central",
    "contato.titulo": "Contacto de atención",
    "contato.telefoneLabel": "Teléfono:",
    "contato.emailLabel": "Correo:",
    "contato.horarioLabel": "Horario:",
    "contato.horario": "atención comunitaria las 24 horas",
    "cadastro.novoRegistro": "Nuevo registro",
    "cadastro.relatarAnimal": "Reportar animal",
    "cadastro.local": "Lugar donde vive",
    "cadastro.estadoSaude": "Estado de salud",
    "saude.saudavel": "Saludable",
    "saude.ferido": "Herido",
    "saude.doente": "Enfermo",
    "cadastro.descricao": "Descripción",
    "cadastro.registrarBotao": "Registrar animal"
  }
};

const SPEECH_LANG = {
  "pt-BR": "pt-BR",
  en: "en-US",
  es: "es-ES"
};

function loadSettings() {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Não foi possível salvar as preferências de acessibilidade.", error);
  }
}

const settingsState = loadSettings();

function applyTheme(theme) {
  settingsState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  syncOptionGroup("[data-theme-option]", "themeOption", theme);
  saveSettings(settingsState);
}

function applyColorMode(colorMode) {
  settingsState.colorMode = colorMode;
  document.documentElement.setAttribute("data-color-mode", colorMode);
  syncOptionGroup("[data-color-option]", "colorOption", colorMode);
  saveSettings(settingsState);
}

function applyFontSize(fontSize) {
  settingsState.fontSize = fontSize;

  if (fontSize === "normal") {
    document.documentElement.removeAttribute("data-font-size");
  } else {
    document.documentElement.setAttribute("data-font-size", fontSize);
  }

  syncOptionGroup("[data-font-option]", "fontOption", fontSize);
  saveSettings(settingsState);
}

function syncOptionGroup(selector, datasetKey, activeValue) {
  document.querySelectorAll(selector).forEach((button) => {
    const isActive = button.dataset[datasetKey] === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyLanguage(lang) {
  const dictionary = TRANSLATIONS[lang] || TRANSLATIONS["pt-BR"];
  settingsState.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (dictionary[key]) {
      element.textContent = dictionary[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;

    if (dictionary[key]) {
      element.setAttribute("placeholder", dictionary[key]);
    }
  });

  if (dictionary["app.title"]) {
    document.title = dictionary["app.title"];
  }

  document.documentElement.lang = lang;

  const idiomaSelect = document.getElementById("idiomaSelect");

  if (idiomaSelect) {
    idiomaSelect.value = lang;
  }

  saveSettings(settingsState);
}

function applyLibras(enabled) {
  settingsState.libras = enabled;

  const wrapper = document.querySelector(".vlibras-wrapper");
  const toggle = document.getElementById("librasToggle");

  if (toggle) {
    toggle.checked = enabled;
  }

  if (wrapper) {
    wrapper.classList.toggle("is-hidden", !enabled);
  }

  if (enabled) {
    loadVLibrasScript();
  }

  saveSettings(settingsState);
}

let vlibrasScriptLoaded = false;

function loadVLibrasScript() {
  if (vlibrasScriptLoaded) {
    return;
  }

  vlibrasScriptLoaded = true;

  const script = document.createElement("script");
  script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
  script.onload = () => {
    if (window.VLibras) {
      new window.VLibras.Widget("https://vlibras.gov.br/app");
    }
  };
  script.onerror = () => {
    vlibrasScriptLoaded = false;
    console.error("Não foi possível carregar o widget oficial de Libras (VLibras).");
  };

  document.body.appendChild(script);
}

function openSettingsPanel() {
  const panel = document.getElementById("settingsPanel");
  const overlay = document.getElementById("settingsOverlay");
  const toggle = document.getElementById("settingsToggle");

  if (panel) panel.classList.add("is-open");
  if (overlay) overlay.classList.add("is-open");
  if (toggle) toggle.setAttribute("aria-expanded", "true");
}

function closeSettingsPanel() {
  const panel = document.getElementById("settingsPanel");
  const overlay = document.getElementById("settingsOverlay");
  const toggle = document.getElementById("settingsToggle");

  if (panel) panel.classList.remove("is-open");
  if (overlay) overlay.classList.remove("is-open");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function readActiveSectionAloud() {
  if (!("speechSynthesis" in window)) {
    setStatusMessage("pedido-feedback", "");
    window.alert("Seu navegador não suporta leitura em voz alta.");
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    return;
  }

  const appVisible = !document.getElementById("app").classList.contains("is-hidden");
  const container = appVisible
    ? document.querySelector(".aba.is-active")
    : document.getElementById("loginTela");

  if (!container) {
    return;
  }

  const text = container.innerText.replace(/\s+/g, " ").trim();

  if (!text) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG[settingsState.lang] || "pt-BR";
  window.speechSynthesis.speak(utterance);
}

function initSettings() {
  applyTheme(settingsState.theme);
  applyColorMode(settingsState.colorMode);
  applyFontSize(settingsState.fontSize);
  applyLanguage(settingsState.lang);
  applyLibras(settingsState.libras);

  bindEvent("settingsToggle", "click", () => {
    const panel = document.getElementById("settingsPanel");
    const isOpen = panel && panel.classList.contains("is-open");
    isOpen ? closeSettingsPanel() : openSettingsPanel();
  });

  bindEvent("settingsClose", "click", closeSettingsPanel);
  bindEvent("settingsOverlay", "click", closeSettingsPanel);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSettingsPanel();
    }
  });

  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeOption));
  });

  document.querySelectorAll("[data-color-option]").forEach((button) => {
    button.addEventListener("click", () => applyColorMode(button.dataset.colorOption));
  });

  document.querySelectorAll("[data-font-option]").forEach((button) => {
    button.addEventListener("click", () => applyFontSize(button.dataset.fontOption));
  });

  bindEvent("idiomaSelect", "change", (event) => applyLanguage(event.target.value));
  bindEvent("librasToggle", "change", (event) => applyLibras(event.target.checked));
  bindEvent("lerEmVozAlta", "click", readActiveSectionAloud);
}

document.addEventListener("DOMContentLoaded", initSettings);