"use strict";

const state = {
  view: "workbench",
  preview: { running: false, ready: false, url: "http://127.0.0.1:38656", logs: [] },
  customization: {},
  documentType: "post",
  documents: [],
  selectedSlug: null,
  aiChatConfig: {},
  aiModels: [],
  pets: [],
  live2dModels: [],
  selectedPet: 0,
  advancedSetting: "albums",
  advancedItems: [],
  publish: null,
  busy: false,
};

const viewMeta = {
  workbench: ["实时工作台", "一边看前端，一边调整设置，保存后立即呈现。"],
  content: ["内容管理", "编辑文章、杂谈和说说，保存后直接更新本地前端。"],
  ai: ["AI 设置", "分别管理 AI 聊天页面和 AI Pet 使用的配置。"],
  pets: ["AI 宠物", "集中设置角色、Live2D 模型、关键词动作和情绪规则。"],
  advanced: ["高级数据", "编辑相册、友链和项目等结构化数据。"],
  publish: ["同步与发布", "按本地、GitHub、Vercel 三个阶段控制发布流程。"],
};

const documentLabels = { post: "文章", chatter: "杂谈", moment: "说说" };
const advancedLabels = { albums: "相册数据", friends: "友链数据", projects: "项目数据", "live2d-models": "Live2D 模型库" };
let previewPollTimer = null;

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function setGlobalStatus(message, type = "ready") {
  const element = byId("global-status");
  element.className = `global-status ${type}`;
  element.querySelector("b").textContent = message;
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  byId("toast-region").appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("本地服务返回了无法识别的结果。");
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "本地操作失败。");
  }
  return data;
}

function jsonRequest(method, value) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}

async function runTask(label, task) {
  if (state.busy) return;
  state.busy = true;
  setGlobalStatus(label, "ready");
  try {
    const result = await task();
    setGlobalStatus("本地服务正常", "ready");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    setGlobalStatus(message, "error");
    showToast(message, true);
    throw error;
  } finally {
    state.busy = false;
  }
}

function showView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `${view}-view`));
  document.querySelectorAll(".nav-item").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
  byId("view-title").textContent = viewMeta[view][0];
  byId("view-description").textContent = viewMeta[view][1];

  if (view === "workbench") {
    void loadCustomization();
    void updatePreviewStatus(true);
  }
  if (view === "content") void loadDocuments();
  if (view === "ai") void loadAISettings();
  if (view === "pets") void loadPets();
  if (view === "advanced") void loadAdvancedSetting();
  if (view === "publish") void loadPublishStatus();
}

function previewAddress() {
  const route = byId("preview-route").value || "/";
  return `${state.preview.url}${route}`;
}

function refreshPreview(delay = 0) {
  window.setTimeout(() => {
    if (!state.preview.ready) return;
    const frame = byId("preview-frame");
    const separator = previewAddress().includes("?") ? "&" : "?";
    byId("preview-stage").classList.remove("ready");
    frame.src = `${previewAddress()}${separator}managerPreview=${Date.now()}`;
  }, delay);
}

function renderPreviewStatus() {
  const status = byId("preview-state");
  const text = byId("preview-state-text");
  status.className = "preview-state";
  if (state.preview.ready) {
    status.classList.add("running");
    text.textContent = "前端已就绪";
    if (!byId("preview-frame").src) refreshPreview();
  } else if (state.preview.running) {
    status.classList.add("running");
    text.textContent = "正在启动前端";
  } else {
    text.textContent = "前端未启动";
    byId("preview-stage").classList.remove("ready");
    byId("preview-frame").removeAttribute("src");
  }
  byId("start-preview").disabled = state.preview.running;
  byId("stop-preview").disabled = !state.preview.running;
  byId("preview-logs").textContent = state.preview.logs.length ? state.preview.logs.join("\n") : "等待前端运行记录...";
}

async function updatePreviewStatus(autoStart = false) {
  try {
    let result = await api("/api/preview");
    if (autoStart && !result.running) {
      await api("/api/preview/start", { method: "POST" });
      result = await api("/api/preview");
    }
    state.preview = result;
    renderPreviewStatus();
    setGlobalStatus("本地服务正常", "ready");
  } catch (error) {
    setGlobalStatus(error.message, "error");
  }
}

async function startPreview() {
  try {
    await api("/api/preview/start", { method: "POST" });
    showToast("本地前端正在启动。");
    await updatePreviewStatus();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function stopPreview() {
  try {
    await api("/api/preview/stop", { method: "POST" });
    await updatePreviewStatus();
    showToast("本地前端已停止。");
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderThemeColors() {
  const colors = Array.isArray(state.customization.themeColors) ? state.customization.themeColors : [];
  const host = byId("theme-colors");
  host.innerHTML = "";
  colors.forEach((color, index) => {
    const item = document.createElement("div");
    item.className = "color-item";
    item.innerHTML = `<input type="color" value="${escapeHtml(color)}" aria-label="主题色 ${index + 1}"><button type="button" title="删除颜色">×</button>`;
    item.querySelector("input").addEventListener("input", (event) => {
      state.customization.themeColors[index] = event.target.value;
    });
    item.querySelector("button").addEventListener("click", () => {
      state.customization.themeColors.splice(index, 1);
      renderThemeColors();
    });
    host.appendChild(item);
  });
}

function splitLines(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function fillCustomizationForm() {
  const form = byId("customization-form");
  const fields = ["title", "authorName", "bio", "faviconUrl", "avatarUrl", "navTitle", "navSuffix", "navAfter", "petPageBackground", "aiPageBackground", "defaultPostCover", "photoWallImage", "chatterTitle", "chatterDescription", "petPageTitle"];
  fields.forEach((field) => {
    form.elements[field].value = state.customization[field] ?? "";
  });
  form.elements.useGradient.checked = Boolean(state.customization.useGradient);
  form.elements.enableLevelSystem.checked = Boolean(state.customization.enableLevelSystem);
  form.elements.bgImages.value = (state.customization.bgImages || []).join("\n");
  form.elements.danmakuList.value = (state.customization.danmakuList || []).join("\n");
  renderThemeColors();
}

async function loadCustomization() {
  try {
    const result = await api("/api/customization");
    state.customization = result.value || {};
    if (!Array.isArray(state.customization.themeColors) || !state.customization.themeColors.length) {
      state.customization.themeColors = ["#0f766e", "#0f172a", "#c2410c", "#e2e8f0"];
    }
    fillCustomizationForm();
  } catch (error) {
    showToast(`读取站点设置失败：${error.message}`, true);
  }
}

function collectCustomization() {
  const form = byId("customization-form");
  const value = { ...state.customization };
  const textFields = ["title", "authorName", "bio", "faviconUrl", "avatarUrl", "navTitle", "navSuffix", "navAfter", "petPageBackground", "aiPageBackground", "defaultPostCover", "photoWallImage", "chatterTitle", "chatterDescription", "petPageTitle"];
  textFields.forEach((field) => { value[field] = form.elements[field].value.trim(); });
  value.useGradient = form.elements.useGradient.checked;
  value.enableLevelSystem = form.elements.enableLevelSystem.checked;
  value.bgImages = splitLines(form.elements.bgImages.value);
  value.danmakuList = splitLines(form.elements.danmakuList.value);
  value.themeColors = [...state.customization.themeColors];
  return value;
}

async function saveCustomization(event) {
  event.preventDefault();
  try {
    await runTask("正在保存并同步站点设置", async () => {
      const value = collectCustomization();
      await api("/api/customization", jsonRequest("PUT", { value }));
      state.customization = value;
    });
    showToast("站点设置已同步，预览正在更新。");
    refreshPreview(900);
  } catch {}
}

function clearDocumentEditor() {
  state.selectedSlug = null;
  byId("document-form").reset();
  byId("editor-kind").textContent = `新建${documentLabels[state.documentType]}`;
  byId("delete-document").disabled = true;
  renderDocuments();
}

function renderDocuments() {
  const host = byId("document-list");
  if (!state.documents.length) {
    host.innerHTML = "<p class=\"empty\">这里还没有内容。</p>";
    return;
  }
  host.innerHTML = state.documents.map((entry) => `
    <button class="document-item${entry.slug === state.selectedSlug ? " active" : ""}" data-slug="${encodeURIComponent(entry.slug)}">
      <strong>${escapeHtml(entry.title || entry.slug)}</strong>
      <span>${escapeHtml(entry.date || "未设置日期")} · ${escapeHtml((entry.tags || []).join(", ") || "无标签")}</span>
    </button>
  `).join("");
  host.querySelectorAll("[data-slug]").forEach((button) => {
    button.addEventListener("click", () => void openDocument(decodeURIComponent(button.dataset.slug)));
  });
}

async function loadDocuments() {
  try {
    const result = await api(`/api/documents?type=${encodeURIComponent(state.documentType)}`);
    state.documents = result.documents || [];
    renderDocuments();
    if (!state.selectedSlug) clearDocumentEditor();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function openDocument(slug) {
  try {
    const result = await api(`/api/documents/${state.documentType}/${encodeURIComponent(slug)}`);
    const entry = result.document;
    state.selectedSlug = entry.slug;
    byId("doc-slug").value = entry.slug;
    byId("doc-title").value = entry.title;
    byId("doc-description").value = entry.description;
    byId("doc-date").value = entry.date;
    byId("doc-tags").value = (entry.tags || []).join(", ");
    byId("doc-cover").value = entry.cover;
    byId("doc-content").value = entry.content;
    byId("editor-kind").textContent = documentLabels[state.documentType];
    byId("delete-document").disabled = false;
    renderDocuments();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveDocument(event) {
  event.preventDefault();
  const slug = byId("doc-slug").value.trim();
  if (!slug) {
    showToast("请先填写文件标识。", true);
    return;
  }
  const body = {
    title: byId("doc-title").value,
    description: byId("doc-description").value,
    date: byId("doc-date").value,
    tags: byId("doc-tags").value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    cover: byId("doc-cover").value,
    content: byId("doc-content").value,
  };
  try {
    await runTask("正在保存内容并更新前端", () => api(`/api/documents/${state.documentType}/${encodeURIComponent(slug)}`, jsonRequest("PUT", body)));
    state.selectedSlug = slug;
    await loadDocuments();
    showToast("内容已保存并更新到前端。");
    refreshPreview(700);
  } catch {}
}

async function deleteDocument() {
  if (!state.selectedSlug || !window.confirm("确认删除这条内容吗？本地前端中的对应文件也会删除。")) return;
  try {
    await runTask("正在删除内容", () => api(`/api/documents/${state.documentType}/${encodeURIComponent(state.selectedSlug)}`, { method: "DELETE" }));
    clearDocumentEditor();
    await loadDocuments();
    showToast("内容已删除。");
    refreshPreview(500);
  } catch {}
}

function renderAIModels() {
  const host = byId("ai-model-list");
  if (!state.aiModels.length) {
    host.innerHTML = "<div class=\"panel empty\">还没有 AI 模型，点击“添加模型”开始。</div>";
    return;
  }
  host.innerHTML = state.aiModels.map((model, index) => `
    <article class="panel model-card" style="--model-accent:${escapeHtml(model.accent || "#0f766e")}">
      <span class="model-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="section-kicker">${index === 0 ? "DEFAULT MODEL" : "AVAILABLE MODEL"}</span>
      <div class="form-grid two">
        <label>显示名称<input data-model-index="${index}" data-key="name" value="${escapeHtml(model.name)}"></label>
        <label>模型 ID<input data-model-index="${index}" data-key="id" value="${escapeHtml(model.id)}"></label>
        <label>服务商<input data-model-index="${index}" data-key="provider" value="${escapeHtml(model.provider)}" placeholder="gemini"></label>
        <label>远程模型名<input data-model-index="${index}" data-key="remoteModel" value="${escapeHtml(model.remoteModel)}"></label>
        <label>主题色<input data-model-index="${index}" data-key="accent" type="color" value="${escapeHtml(model.accent || "#0f766e")}"></label>
      </div>
      <label>模型说明<input data-model-index="${index}" data-key="description" value="${escapeHtml(model.description)}"></label>
      <button type="button" class="text-button remove-card" data-remove-model="${index}">删除模型</button>
    </article>
  `).join("");
  host.querySelectorAll("[data-model-index]").forEach((input) => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.modelIndex);
      state.aiModels[index][input.dataset.key] = input.value;
      if (input.dataset.key === "accent") input.closest(".model-card").style.setProperty("--model-accent", input.value);
    });
  });
  host.querySelectorAll("[data-remove-model]").forEach((button) => {
    button.addEventListener("click", () => {
      state.aiModels.splice(Number(button.dataset.removeModel), 1);
      renderAIModels();
    });
  });
}

function renderAIChatConfig() {
  const form = byId("ai-chat-form");
  const config = state.aiChatConfig || {};
  const select = form.elements.defaultModelId;
  const enabledModels = state.live2dModels.filter((model) => model.enabled !== false);
  const selectedId = String(config.defaultModelId || "");
  const selectedModelEnabled = enabledModels.some((model) => model.id === selectedId);
  const options = enabledModels.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name || model.id)}</option>`);
  if (selectedId && !selectedModelEnabled) {
    options.unshift(`<option value="${escapeHtml(selectedId)}">${escapeHtml(selectedId)}（当前不可用）</option>`);
  }
  if (!options.length) options.push("<option value=\"\">没有已启用的 Live2D 模型</option>");
  select.innerHTML = options.join("");
  select.value = selectedId || enabledModels[0]?.id || "";
  form.elements.assistantName.value = config.assistantName || "星语";
  form.elements.maxContextMessages.value = config.maxContextMessages || 16;
  form.elements.maxStoredSessions.value = config.maxStoredSessions || 12;
  form.elements.systemPrompt.value = config.systemPrompt || "";
}

async function loadAISettings() {
  try {
    const [chat, models, live2d] = await Promise.all([
      api("/api/settings/ai-chat"),
      api("/api/settings/ai-models"),
      api("/api/settings/live2d-models"),
    ]);
    state.aiChatConfig = chat.value && !Array.isArray(chat.value) ? chat.value : {};
    state.aiModels = Array.isArray(models.value) ? models.value : [];
    state.live2dModels = Array.isArray(live2d.value) ? live2d.value : [];
    renderAIChatConfig();
    renderAIModels();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function loadAIModels() {
  try {
    const result = await api("/api/settings/ai-models");
    state.aiModels = Array.isArray(result.value) ? result.value : [];
    renderAIModels();
  } catch (error) {
    showToast(error.message, true);
  }
}

function boundedInteger(input, label) {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error(`${label}必须是 1 到 50 之间的整数。`);
  }
  return value;
}

async function saveAIChatConfig(event) {
  event.preventDefault();
  const form = event.currentTarget;
  let value;
  try {
    value = {
      assistantName: form.elements.assistantName.value.trim(),
      defaultModelId: form.elements.defaultModelId.value,
      maxContextMessages: boundedInteger(form.elements.maxContextMessages, "上下文消息数"),
      maxStoredSessions: boundedInteger(form.elements.maxStoredSessions, "本地会话上限"),
      systemPrompt: form.elements.systemPrompt.value.trim(),
    };
    if (!value.assistantName || !value.defaultModelId || !value.systemPrompt) {
      throw new Error("助手名称、默认模型和系统提示词不能为空。");
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : "AI 聊天配置无效。", true);
    return;
  }
  try {
    await runTask("正在保存 AI 聊天配置", () => api("/api/settings/ai-chat", jsonRequest("PUT", { value })));
    state.aiChatConfig = value;
    byId("preview-route").value = "/ai";
    showToast("AI 聊天配置已更新到前端。");
    refreshPreview(700);
  } catch {}
}

function addAIModel() {
  const index = state.aiModels.length + 1;
  state.aiModels.push({
    id: `model-${index}`,
    provider: "gemini",
    remoteModel: "",
    name: `新模型 ${index}`,
    description: "",
    accent: "#0f766e",
  });
  renderAIModels();
}

async function saveAIModels(event) {
  event.preventDefault();
  try {
    await runTask("正在保存 AI 模型", () => api("/api/settings/ai-models", jsonRequest("PUT", { value: state.aiModels })));
    byId("preview-route").value = "/pet";
    showToast("AI Pet 云模型已更新到前端。");
    refreshPreview(700);
  } catch {}
}

function assetPreviewUrl(assetPath) {
  return assetPath && assetPath.startsWith("/") ? `/source-assets${assetPath}` : "";
}

function normalizePublicPath(value) {
  const path = String(value || "").trim().replace(/\\/g, "/");
  if (!path || /^(?:https?:|data:|\/)/i.test(path)) return path;
  return `/${path.replace(/^\.\/?/, "")}`;
}

function renderPetSelector() {
  const host = byId("pet-selector");
  if (!state.pets.length) {
    host.innerHTML = "<p class=\"empty\">还没有宠物角色。</p>";
    byId("pet-form").style.display = "none";
    return;
  }
  byId("pet-form").style.display = "grid";
  host.innerHTML = state.pets.map((pet, index) => `
    <button type="button" class="pet-choice${index === state.selectedPet ? " active" : ""}" data-pet-index="${index}">
      <img src="${escapeHtml(assetPreviewUrl(pet.previewImage || pet.avatar))}" alt="" onerror="this.style.visibility='hidden'">
      <span><strong>${escapeHtml(pet.name || pet.id)}</strong><span>${escapeHtml(pet.live2d?.runtime || "无 Live2D")}</span></span>
    </button>
  `).join("");
  host.querySelectorAll("[data-pet-index]").forEach((button) => {
    button.addEventListener("click", () => {
      collectCurrentPet(false);
      state.selectedPet = Number(button.dataset.petIndex);
      renderPetSelector();
      fillPetForm();
    });
  });
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function fillPetForm() {
  const pet = state.pets[state.selectedPet];
  if (!pet) return;
  const form = byId("pet-form");
  const values = {
    id: pet.id,
    name: pet.name,
    subtitle: pet.subtitle,
    background: normalizePublicPath(pet.background),
    avatar: normalizePublicPath(pet.avatar),
    previewImage: normalizePublicPath(pet.previewImage),
    transitionGif: normalizePublicPath(pet.transitionGif),
    greeting: pet.greeting,
    systemPrompt: pet.systemPrompt,
    live2dRuntime: "Cubism 4",
    modelFormat: "model3.json",
    idleGroup: pet.live2d?.idleGroup || "idle",
    talkGroup: pet.live2d?.talkGroup || "talk",
    thinkingGroup: pet.live2d?.motions?.thinking || pet.live2d?.talkGroup || "talk",
    happyGroup: pet.live2d?.motions?.happy || "happy",
    surprisedGroup: pet.live2d?.motions?.surprised || "surprised",
  };
  Object.entries(values).forEach(([name, value]) => { form.elements[name].value = value ?? ""; });
  renderLive2DModelOptions(pet.live2d?.modelId || "");
  renderKeywordActions();
  renderPetRules();
  byId("pet-editor-title").textContent = pet.name || "宠物设置";
}

function renderLive2DModelOptions(selectedId = "") {
  const form = byId("pet-form");
  const select = form?.elements.live2dModelId;
  if (!select) return;
  const models = state.live2dModels.filter((model) => model.enabled !== false);
  select.innerHTML = ["<option value=\"\">未选择 Live2D 模型</option>", ...models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name || model.id)}</option>`)].join("");
  select.value = selectedId;
  renderLive2DModelDetails();
}

function renderLive2DModelDetails() {
  const form = byId("pet-form");
  const modelId = form?.elements.live2dModelId?.value;
  const model = state.live2dModels.find((entry) => entry.id === modelId);
  const details = byId("live2d-model-details");
  if (!model) {
    details.textContent = "未选择模型时，宠物页面只会显示角色底图。";
    return;
  }
  form.elements.live2dRuntime.value = model.runtime === "cubism2" ? "Cubism 2" : "Cubism 4";
  form.elements.modelFormat.value = model.modelFormat === "model" || model.runtime === "cubism2" ? "model.json" : "model3.json";
  details.textContent = `${model.name || model.id}：${model.notes || "已启用本地 Live2D 模型。"}`;
}

const petActionOptions = ["idle", "thinking", "happy", "surprised"];

function renderActionSelect(value) {
  return `<select data-key="action">${petActionOptions.map((action) => `<option value="${action}"${value === action ? " selected" : ""}>${action}</option>`).join("")}</select>`;
}

function renderKeywordActions() {
  const pet = state.pets[state.selectedPet];
  const host = byId("keyword-action-list");
  if (!pet || !host) return;
  const entries = Object.entries(pet.keywordActions || {});
  host.innerHTML = entries.length ? entries.map(([keyword, rule], index) => `
    <article class="structured-card keyword-card" data-keyword-index="${index}">
      <div class="structured-card-head"><strong>关键词动作 ${index + 1}</strong><button type="button" class="text-button danger" data-remove-keyword="${index}">删除</button></div>
      <div class="form-grid three">
        <label>关键词<input data-key="keyword" value="${escapeHtml(keyword)}"></label>
        <label>动作组${renderActionSelect(rule?.action || "idle")}</label>
        <label>好感变化<input data-key="affection" type="number" min="0" max="100" value="${Number(rule?.affection || 0)}"></label>
      </div>
      <label>回应内容<input data-key="response" value="${escapeHtml(rule?.response || "")}"></label>
    </article>
  `).join("") : "<p class=\"empty\">还没有关键词动作。</p>";
  host.querySelectorAll("[data-keyword-index] input, [data-keyword-index] select").forEach((input) => {
    input.addEventListener("input", () => updateKeywordAction(input));
    input.addEventListener("change", () => updateKeywordAction(input));
  });
  host.querySelectorAll("[data-remove-keyword]").forEach((button) => button.addEventListener("click", () => {
    const entries = Object.entries(pet.keywordActions || {});
    entries.splice(Number(button.dataset.removeKeyword), 1);
    pet.keywordActions = Object.fromEntries(entries);
    renderKeywordActions();
  }));
}

function updateKeywordAction(input) {
  const pet = state.pets[state.selectedPet];
  const card = input.closest("[data-keyword-index]");
  if (!pet || !card) return;
  const entries = Object.entries(pet.keywordActions || {});
  const index = Number(card.dataset.keywordIndex);
  const [keyword, current] = entries[index] || ["", {}];
  const next = { action: current.action || "idle", response: current.response || "", affection: Number(current.affection || 0) };
  const key = input.dataset.key;
  if (key === "keyword") {
    entries[index] = [input.value.trim(), next];
    pet.keywordActions = Object.fromEntries(entries.filter(([entry]) => entry));
    renderKeywordActions();
    return;
  }
  next[key] = key === "affection" ? Number(input.value || 0) : input.value;
  entries[index] = [keyword, next];
  pet.keywordActions = Object.fromEntries(entries);
}

function renderPetRules() {
  const pet = state.pets[state.selectedPet];
  const host = byId("pet-rule-list");
  if (!pet || !host) return;
  const rules = Array.isArray(pet.rules) ? pet.rules : [];
  host.innerHTML = rules.length ? rules.map((rule, index) => `
    <article class="structured-card pet-rule-card" data-rule-index="${index}">
      <div class="structured-card-head"><strong>组合规则 ${index + 1}</strong><button type="button" class="text-button danger" data-remove-rule="${index}">删除</button></div>
      <div class="form-grid three">
        <label>规则 ID<input data-key="id" value="${escapeHtml(rule.id || "rule-" + (index + 1))}"></label>
        <label>动作组${renderActionSelect(rule.action || "idle")}</label>
        <label>好感变化<input data-key="affection" type="number" min="0" max="100" value="${Number(rule.affection || 0)}"></label>
      </div>
      <div class="form-grid three">
        <label>时间条件<input data-when-key="time" value="${escapeHtml(rule.when?.time || "")}" placeholder="night"></label>
        <label>最小字数<input data-when-key="minLength" type="number" min="0" value="${Number(rule.when?.minLength || 0) || ""}"></label>
        <label>语义条件<input data-when-key="semantic" value="${escapeHtml(rule.when?.semantic || "")}" placeholder="positive"></label>
      </div>
    </article>
  `).join("") : "<p class=\"empty\">还没有组合规则。</p>";
  host.querySelectorAll("[data-rule-index] input, [data-rule-index] select").forEach((input) => {
    input.addEventListener("input", () => updatePetRule(input));
    input.addEventListener("change", () => updatePetRule(input));
  });
  host.querySelectorAll("[data-remove-rule]").forEach((button) => button.addEventListener("click", () => {
    pet.rules.splice(Number(button.dataset.removeRule), 1);
    renderPetRules();
  }));
}

function updatePetRule(input) {
  const pet = state.pets[state.selectedPet];
  const card = input.closest("[data-rule-index]");
  if (!pet || !card) return;
  const rule = pet.rules[Number(card.dataset.ruleIndex)];
  if (input.dataset.whenKey) {
    const key = input.dataset.whenKey;
    const value = input.value.trim();
    if (value) rule.when[key] = key === "minLength" ? Number(value) : value;
    else delete rule.when[key];
    return;
  }
  rule[input.dataset.key] = input.dataset.key === "affection" ? Number(input.value || 0) : input.value;
}

function addKeywordAction() {
  const pet = state.pets[state.selectedPet];
  if (!pet) return;
  pet.keywordActions = { ...(pet.keywordActions || {}), "新关键词": { action: "happy", response: "", affection: 0 } };
  renderKeywordActions();
}

function addPetRule() {
  const pet = state.pets[state.selectedPet];
  if (!pet) return;
  pet.rules = [...(pet.rules || []), { id: `rule-${(pet.rules || []).length + 1}`, when: {}, action: "idle", affection: 0 }];
  renderPetRules();
}

function collectCurrentPet(showError = true) {
  const pet = state.pets[state.selectedPet];
  if (!pet) return true;
  const form = byId("pet-form");
  try {
    const selectedModel = state.live2dModels.find((model) => model.id === form.elements.live2dModelId.value);
    const previewImage = normalizePublicPath(form.elements.previewImage.value);
    if (previewImage && !/\.(?:png|jpe?g)(?:[?#].*)?$/i.test(previewImage)) {
      throw new Error("选择卡片仅支持 PNG、JPG、JPEG 静态图片。");
    }
    const motions = { ...(pet.live2d?.motions || {}) };
    motions.idle = form.elements.idleGroup.value.trim();
    motions.thinking = form.elements.thinkingGroup.value.trim() || form.elements.talkGroup.value.trim();
    motions.happy = form.elements.happyGroup.value.trim();
    motions.surprised = form.elements.surprisedGroup.value.trim();
    state.pets[state.selectedPet] = {
      ...pet,
      id: form.elements.id.value.trim(),
      name: form.elements.name.value.trim(),
      subtitle: form.elements.subtitle.value.trim(),
      background: normalizePublicPath(form.elements.background.value),
      avatar: normalizePublicPath(form.elements.avatar.value),
      previewImage,
      transitionGif: normalizePublicPath(form.elements.transitionGif.value),
      greeting: form.elements.greeting.value.trim(),
      systemPrompt: form.elements.systemPrompt.value.trim(),
      live2d: {
        ...(pet.live2d || {}),
        runtime: selectedModel?.runtime || "cubism4",
        modelFormat: selectedModel?.modelFormat || (selectedModel?.runtime === "cubism2" ? "model" : "model3"),
        modelId: form.elements.live2dModelId.value.trim(),
        idleGroup: form.elements.idleGroup.value.trim(),
        talkGroup: form.elements.talkGroup.value.trim(),
        motions,
      },
      keywordActions: pet.keywordActions || {},
      rules: pet.rules || [],
    };
    return true;
  } catch (error) {
    if (showError) showToast(error.message, true);
    return false;
  }
}

async function loadPets() {
  try {
    const [result, models] = await Promise.all([api("/api/settings/pets"), api("/api/settings/live2d-models")]);
    state.pets = Array.isArray(result.value) ? result.value : [];
    state.live2dModels = Array.isArray(models.value) ? models.value : [];
    state.selectedPet = Math.min(state.selectedPet, Math.max(0, state.pets.length - 1));
    renderPetSelector();
    fillPetForm();
  } catch (error) {
    showToast(error.message, true);
  }
}

function addPet() {
  collectCurrentPet(false);
  const index = state.pets.length + 1;
  const defaultModel = state.live2dModels.find((model) => model.enabled !== false);
  state.pets.push({
    id: `pet-${index}`,
    name: `新宠物 ${index}`,
    subtitle: "新的虚拟伙伴",
    background: "/assets/site/background.png",
    avatar: "",
    previewImage: "",
    transitionGif: "",
    live2d: { runtime: defaultModel?.runtime || "cubism4", modelFormat: defaultModel?.modelFormat || "model3", modelId: defaultModel?.id || "", idleGroup: "idle", talkGroup: "talk", motions: { idle: "idle", thinking: "talk", happy: "happy", surprised: "surprised" } },
    images: { idle: "", thinking: "", happy: "", surprised: "" },
    greeting: "你好，我已经准备好了。",
    systemPrompt: "你是一位温暖、简洁、有个性的虚拟伙伴。",
    keywordActions: {},
    rules: [],
  });
  state.selectedPet = state.pets.length - 1;
  renderPetSelector();
  fillPetForm();
}

function deletePet() {
  if (!state.pets.length || !window.confirm("确认删除这个宠物角色吗？")) return;
  state.pets.splice(state.selectedPet, 1);
  state.selectedPet = Math.max(0, state.selectedPet - 1);
  renderPetSelector();
  fillPetForm();
}

async function savePets(event) {
  event.preventDefault();
  if (!collectCurrentPet()) return;
  if (state.pets.some((pet) => !pet.id || !pet.name)) {
    showToast("每个宠物都必须填写角色 ID 和名称。", true);
    return;
  }
  try {
    await runTask("正在保存 AI 宠物设置", () => api("/api/settings/pets", jsonRequest("PUT", { value: state.pets })));
    renderPetSelector();
    byId("preview-route").value = "/pet";
    showToast("AI 宠物设置已更新到前端。");
    refreshPreview(700);
  } catch {}
}

const advancedExportNames = { albums: "albums", friends: "friendsData", projects: "projectsData" };

function parseAdvancedSource(source, setting) {
  const exportName = advancedExportNames[setting];
  const marker = `export const ${exportName}`;
  const start = source.indexOf("[", source.indexOf(marker));
  const end = source.lastIndexOf("];" );
  if (start < 0 || end < start) throw new Error(`${advancedLabels[setting]}格式无法识别。`);
  try { return JSON.parse(source.slice(start, end + 1)); } catch { throw new Error(`${advancedLabels[setting]}包含无法图形化解析的数据。`); }
}

function renderAdvancedInput(label, key, value, type = "text") {
  return `<label>${label}<input data-advanced-key="${key}" type="${type}" value="${escapeHtml(value ?? "")}"></label>`;
}

function renderAdvancedSetting() {
  const host = byId("advanced-editor");
  const items = state.advancedItems;
  const setting = state.advancedSetting;
  if (setting === "albums") {
    host.innerHTML = items.map((item, index) => `
      <article class="structured-card" data-advanced-index="${index}">
        <div class="structured-card-head"><strong>${escapeHtml(item.title || `相册 ${index + 1}`)}</strong><button type="button" class="text-button danger" data-remove-advanced="${index}">删除</button></div>
        <div class="form-grid two">${renderAdvancedInput("ID", "id", item.id)}${renderAdvancedInput("标题", "title", item.title)}${renderAdvancedInput("日期", "date", item.date)}${renderAdvancedInput("封面", "cover", item.cover)}</div>
        ${renderAdvancedInput("说明", "description", item.description)}
        <div class="editor-row"><span class="field-label">照片</span><button type="button" class="text-button" data-add-photo="${index}">添加照片</button></div>
        <div class="structured-list photo-list">${(item.photos || []).map((photo, photoIndex) => `<div class="photo-row" data-photo-index="${photoIndex}"><input data-photo-key="url" value="${escapeHtml(photo.url)}" placeholder="图片地址"><input data-photo-key="caption" value="${escapeHtml(photo.caption || "")}" placeholder="说明"><button type="button" class="text-button danger" data-remove-photo="${photoIndex}">删除</button></div>`).join("") || "<p class=\"empty\">暂无照片。</p>"}</div>
      </article>
    `).join("");
  } else if (setting === "friends") {
    host.innerHTML = items.map((item, index) => `
      <article class="structured-card" data-advanced-index="${index}">
        <div class="structured-card-head"><strong>${escapeHtml(item.name || `友链 ${index + 1}`)}</strong><button type="button" class="text-button danger" data-remove-advanced="${index}">删除</button></div>
        <div class="form-grid two">${renderAdvancedInput("ID", "id", item.id)}${renderAdvancedInput("名称", "name", item.name)}${renderAdvancedInput("链接", "url", item.url)}${renderAdvancedInput("头像", "avatar", item.avatar)}${renderAdvancedInput("主题色", "themeColor", item.themeColor)}</div>
        ${renderAdvancedInput("说明", "description", item.description)}
      </article>
    `).join("");
  } else if (setting === "projects") {
    host.innerHTML = items.map((item, index) => `
      <article class="structured-card" data-advanced-index="${index}">
        <div class="structured-card-head"><strong>${escapeHtml(item.name || `项目 ${index + 1}`)}</strong><button type="button" class="text-button danger" data-remove-advanced="${index}">删除</button></div>
        <div class="form-grid two">${renderAdvancedInput("ID", "id", item.id)}${renderAdvancedInput("名称", "name", item.name)}${renderAdvancedInput("图标", "icon", item.icon)}${renderAdvancedInput("GitHub 链接", "githubUrl", item.githubUrl)}</div>
        ${renderAdvancedInput("标签（逗号分隔）", "tags", (item.tags || []).join(", "))}
        <label>说明<textarea data-advanced-key="description" rows="3">${escapeHtml(item.description || "")}</textarea></label>
      </article>
    `).join("");
  } else {
    host.innerHTML = items.map((item, index) => `
      <article class="structured-card" data-advanced-index="${index}">
        <div class="structured-card-head"><strong>${escapeHtml(item.name || item.id || `模型 ${index + 1}`)}</strong><button type="button" class="text-button danger" data-remove-advanced="${index}">删除</button></div>
        <div class="form-grid two">${renderAdvancedInput("ID", "id", item.id)}${renderAdvancedInput("名称", "name", item.name)}<label>运行时<select data-advanced-key="runtime"><option value="cubism4"${item.runtime !== "cubism2" ? " selected" : ""}>Cubism 4</option><option value="cubism2"${item.runtime === "cubism2" ? " selected" : ""}>Cubism 2</option></select></label><label>模型格式<select data-advanced-key="modelFormat"><option value="model3"${item.modelFormat !== "model" ? " selected" : ""}>model3.json</option><option value="model"${item.modelFormat === "model" ? " selected" : ""}>model.json</option></select></label>${renderAdvancedInput("模型入口", "entryUrl", item.entryUrl)}${renderAdvancedInput("缩略图", "thumbnailUrl", item.thumbnailUrl)}${renderAdvancedInput("备注", "notes", item.notes)}${renderAdvancedInput("缩放", "layoutScale", item.layout?.scale ?? 0.86, "number")}</div>
        <label class="toggle-row"><span><b>启用模型</b><small>启用后会出现在 AI 宠物模型选择器</small></span><input data-advanced-key="enabled" type="checkbox"${item.enabled !== false ? " checked" : ""}></label>
        <label>动作预设 JSON<textarea data-advanced-key="presets" class="code-editor small" rows="5">${escapeHtml(JSON.stringify(item.presets || {}, null, 2))}</textarea></label>
      </article>
    `).join("");
  }
  host.querySelectorAll("[data-advanced-index] [data-advanced-key]").forEach((input) => input.addEventListener("input", () => updateAdvancedItem(input)));
  host.querySelectorAll("[data-advanced-index] [data-advanced-key][type=checkbox]").forEach((input) => input.addEventListener("change", () => updateAdvancedItem(input)));
  host.querySelectorAll("[data-remove-advanced]").forEach((button) => button.addEventListener("click", () => { items.splice(Number(button.dataset.removeAdvanced), 1); renderAdvancedSetting(); }));
  host.querySelectorAll("[data-add-photo]").forEach((button) => button.addEventListener("click", () => { items[Number(button.dataset.addPhoto)].photos.push({ url: "", caption: "" }); renderAdvancedSetting(); }));
  host.querySelectorAll("[data-remove-photo]").forEach((button) => button.addEventListener("click", () => { const card = button.closest("[data-advanced-index]"); items[Number(card.dataset.advancedIndex)].photos.splice(Number(button.dataset.removePhoto), 1); renderAdvancedSetting(); }));
  host.querySelectorAll("[data-photo-index] [data-photo-key]").forEach((input) => input.addEventListener("input", () => { const card = input.closest("[data-advanced-index]"); const photo = items[Number(card.dataset.advancedIndex)].photos[Number(input.closest("[data-photo-index]").dataset.photoIndex)]; photo[input.dataset.photoKey] = input.value; }));
}

function updateAdvancedItem(input) {
  const card = input.closest("[data-advanced-index]");
  if (!card) return;
  const item = state.advancedItems[Number(card.dataset.advancedIndex)];
  const key = input.dataset.advancedKey;
  if (key === "enabled") item.enabled = input.checked;
  else if (key === "tags") item.tags = input.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
  else if (key === "layoutScale") item.layout = { ...(item.layout || {}), scale: Number(input.value || 0.86) };
  else if (key === "presets") {
    try { item.presets = JSON.parse(input.value || "{}"); } catch { return; }
  } else item[key] = input.value;
}

function addAdvancedItem() {
  const index = state.advancedItems.length + 1;
  const defaults = {
    albums: { id: `album-${Date.now()}`, title: `新相册 ${index}`, description: "", cover: "", date: "", photos: [] },
    friends: { id: `friend-${Date.now()}`, name: `新友链 ${index}`, description: "", avatar: "", url: "", themeColor: "" },
    projects: { id: `project-${Date.now()}`, name: `新项目 ${index}`, description: "", icon: "", githubUrl: "", tags: [] },
    "live2d-models": { id: `model-${Date.now()}`, name: `新模型 ${index}`, enabled: true, runtime: "cubism4", modelFormat: "model3", entryUrl: "", thumbnailUrl: "", notes: "", layout: { scale: 0.86 }, parameterRanges: {}, presets: {} },
  };
  state.advancedItems.push(defaults[state.advancedSetting]);
  renderAdvancedSetting();
}

function createAdvancedSource(setting, items) {
  const value = JSON.stringify(items, null, 2);
  if (setting === "albums") return `export interface Photo { url: string; caption?: string; }\nexport interface Album { id: string; title: string; description: string; cover: string; date: string; photos: Photo[]; }\n\nexport const albums: Album[] = ${value};\n`;
  if (setting === "friends") return `export interface Friend { id: string; name: string; url: string; description: string; avatar: string; themeColor: string; }\n\nexport const friendsData: Friend[] = ${value};\n`;
  return `export type Project = { id: string; name: string; description: string; icon: string; githubUrl: string; tags: string[]; };\n\nexport const projectsData: Project[] = ${value};\n`;
}

async function loadAdvancedSetting() {
  try {
    const result = await api(`/api/settings/${state.advancedSetting}`);
    const isLive2D = state.advancedSetting === "live2d-models";
    state.advancedItems = isLive2D && Array.isArray(result.value) ? result.value : [];
    byId("advanced-title").textContent = advancedLabels[state.advancedSetting];
    byId("advanced-description").textContent = isLive2D ? "管理 Cubism 2/4 模型；扫描会递归导入参考模型库。" : "保留现有 TypeScript 导出结构。保存前会自动备份原文件。";
    byId("advanced-code-editor").hidden = isLive2D;
    byId("advanced-editor").hidden = !isLive2D;
    byId("add-advanced-item").hidden = !isLive2D;
    byId("scan-live2d-models").hidden = !isLive2D;
    if (isLive2D) renderAdvancedSetting();
    else byId("advanced-code-editor").value = typeof result.value === "string" ? result.value : "";
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveAdvancedSetting() {
  try {
    const value = state.advancedSetting === "live2d-models" ? state.advancedItems : byId("advanced-code-editor").value;
    if (state.advancedSetting === "live2d-models") { state.live2dModels = state.advancedItems; renderLive2DModelOptions(); }
    await runTask("正在保存高级数据", () => api(`/api/settings/${state.advancedSetting}`, jsonRequest("PUT", { value })));
    showToast(`${advancedLabels[state.advancedSetting]}已更新到前端。`);
    refreshPreview(700);
  } catch {}
}

async function scanLive2DModels() {
  try {
    const result = await api("/api/settings/live2d-models/scan");
    state.advancedItems = result.value || [];
    renderAdvancedSetting();
    showToast(`已扫描到 ${state.advancedItems.length} 个 Live2D 模型。`);
  } catch (error) { showToast(error.message, true); }
}

function collectPublishConfig() {
  const form = byId("publish-config");
  return {
    ...(state.publish?.config || {}),
    blogPath: form.elements.blogPath.value.trim(),
    sourceRepoUrl: form.elements.sourceRepoUrl.value.trim(),
    sourceBranch: form.elements.sourceBranch.value.trim() || "main",
  };
}

function renderPublishStatus() {
  if (!state.publish) return;
  const form = byId("publish-config");
  form.elements.blogPath.value = state.publish.config.blogPath || "";
  form.elements.sourceRepoUrl.value = state.publish.config.sourceRepoUrl || "";
  form.elements.sourceBranch.value = state.publish.config.sourceBranch || state.publish.branch || "main";
  byId("publish-branch").textContent = state.publish.branch || "-";
  byId("publish-remote").textContent = state.publish.remote || "未设置";
  const changes = state.publish.changes || [];
  byId("publish-changes").innerHTML = changes.length
    ? changes.map((entry) => `<div class="change-item">${escapeHtml(entry)}</div>`).join("")
    : "<p class=\"empty\">工作区没有未提交改动。</p>";
}

async function loadPublishStatus() {
  try {
    const result = await api("/api/publish");
    state.publish = result.data;
    renderPublishStatus();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function savePublishConfig(event) {
  event.preventDefault();
  try {
    const config = collectPublishConfig();
    await api("/api/publish/config", jsonRequest("PUT", { value: config }));
    if (state.publish) state.publish.config = config;
    showToast("发布目标已保存。");
  } catch (error) {
    showToast(error.message, true);
  }
}

async function runPublish(action) {
  const names = { local: "本地同步", github: "GitHub 推送", vercel: "Vercel 部署" };
  if (action === "github" && !window.confirm("将把当前 XHBlogs 的全部未提交改动提交并推送到 GitHub。确认继续吗？")) return;
  if (action === "vercel" && !window.confirm("将把当前版本部署为 Vercel 正式站点。确认继续吗？")) return;

  const buttons = document.querySelectorAll("[data-publish]");
  buttons.forEach((button) => { button.disabled = true; });
  byId("publish-output").textContent = `${names[action]}正在执行，请稍候...`;
  try {
    const result = await runTask(`正在执行${names[action]}`, () => api(`/api/publish/${action}`, jsonRequest("POST", {
      config: collectPublishConfig(),
      commitMessage: byId("commit-message").value.trim(),
    })));
    byId("publish-output").textContent = `${result.message}\n\n${result.output || ""}`;
    showToast(result.message);
    await loadPublishStatus();
    if (action === "local") refreshPreview(500);
  } catch (error) {
    byId("publish-output").textContent = `执行失败：${error.message}`;
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  byId("start-preview").addEventListener("click", startPreview);
  byId("stop-preview").addEventListener("click", stopPreview);
  byId("refresh-preview").addEventListener("click", () => refreshPreview());
  byId("fullscreen-preview").addEventListener("click", async () => {
    const stage = byId("preview-stage");
    if (document.fullscreenElement === stage) await document.exitFullscreen();
    else await stage.requestFullscreen();
  });
  byId("open-preview").addEventListener("click", () => window.open(previewAddress(), "_blank"));
  byId("preview-route").addEventListener("change", () => refreshPreview());
  byId("preview-frame").addEventListener("load", () => byId("preview-stage").classList.add("ready"));
  document.querySelectorAll("[data-device]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-device]").forEach((item) => item.classList.toggle("active", item === button));
      byId("preview-stage").classList.remove("desktop", "tablet", "mobile");
      byId("preview-stage").classList.add(button.dataset.device);
    });
  });

  byId("customization-form").addEventListener("submit", saveCustomization);
  byId("add-theme-color").addEventListener("click", () => {
    state.customization.themeColors.push("#d8793c");
    renderThemeColors();
  });

  byId("document-types").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentType = button.dataset.type;
      state.selectedSlug = null;
      byId("document-types").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      void loadDocuments();
    });
  });
  byId("new-document").addEventListener("click", clearDocumentEditor);
  byId("document-form").addEventListener("submit", saveDocument);
  byId("delete-document").addEventListener("click", deleteDocument);

  byId("ai-chat-form").addEventListener("submit", saveAIChatConfig);
  byId("add-ai-model").addEventListener("click", addAIModel);
  byId("ai-models-form").addEventListener("submit", saveAIModels);
  byId("add-pet").addEventListener("click", addPet);
  byId("delete-pet").addEventListener("click", deletePet);
  byId("pet-form").addEventListener("submit", savePets);
  byId("pet-form").elements.live2dModelId.addEventListener("change", renderLive2DModelDetails);
  byId("add-keyword-action").addEventListener("click", addKeywordAction);
  byId("add-pet-rule").addEventListener("click", addPetRule);

  byId("advanced-tabs").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.advancedSetting = button.dataset.setting;
      byId("advanced-tabs").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      void loadAdvancedSetting();
    });
  });
  byId("save-advanced").addEventListener("click", saveAdvancedSetting);
  byId("add-advanced-item").addEventListener("click", addAdvancedItem);
  byId("scan-live2d-models").addEventListener("click", scanLive2DModels);

  byId("publish-config").addEventListener("submit", savePublishConfig);
  byId("refresh-publish").addEventListener("click", loadPublishStatus);
  document.querySelectorAll("[data-publish]").forEach((button) => button.addEventListener("click", () => runPublish(button.dataset.publish)));
}

async function initialize() {
  bindEvents();
  const requestedView = new URLSearchParams(window.location.search).get("view");
  const initialView = requestedView && viewMeta[requestedView] ? requestedView : "workbench";
  showView(initialView);
  if (initialView !== "workbench") await updatePreviewStatus(true);
  previewPollTimer = window.setInterval(() => void updatePreviewStatus(false), 2500);
}

window.addEventListener("beforeunload", () => {
  if (previewPollTimer) window.clearInterval(previewPollTimer);
});

void initialize();
