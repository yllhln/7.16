"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, "public");
const CONTENT_ROOT = APP_DIR;
const DEFAULT_SYNC_TARGET = path.resolve(APP_DIR, "..", "XHBlogs");
const BACKUP_DIR = path.join(APP_DIR, "backups");
const PORT = 38655;
const PREVIEW_PORT = 38656;
const DEPLOY_CONFIG_FILE = path.join(CONTENT_ROOT, "data", "deploy_config.json");

let previewProcess = null;
let previewLog = [];
let publishBusy = false;

const DOCUMENT_DIRECTORIES = {
  post: "posts",
  chatter: "chatters",
  moment: "moments",
};

const SETTINGS_FILES = {
  site: { path: "siteConfig.ts", format: "text" },
  "ai-chat": { path: path.join("data", "vtuberConfig.json"), format: "json" },
  "ai-models": { path: path.join("data", "aiModels.json"), format: "json" },
  pets: { path: path.join("data", "petProfiles.json"), format: "json" },
  "live2d-models": { path: path.join("data", "live2dModels.json"), format: "json" },
  albums: { path: path.join("data", "albums.ts"), format: "text" },
  friends: { path: path.join("data", "friends.ts"), format: "text" },
  projects: { path: path.join("data", "projects.ts"), format: "text" },
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function sendError(response, status, message) {
  sendJson(response, status, { success: false, message });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function appendPreviewLog(chunk) {
  const lines = String(chunk).split(/\r?\n/).filter(Boolean);
  previewLog.push(...lines);
  previewLog = previewLog.slice(-120);
}

function runCommand(command, args, workingDirectory, timeoutMs = 300000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: workingDirectory,
      windowsHide: true,
      shell: false,
      env: process.env,
    });
    const output = [];
    const errors = [];
    const timer = setTimeout(() => {
      spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => output.push(String(chunk)));
    child.stderr?.on("data", (chunk) => errors.push(String(chunk)));
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: output.join(""), stderr: errors.join("") + error.message });
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: output.join(""), stderr: errors.join("") });
    });
  });
}

function isPreviewRunning() {
  return Boolean(previewProcess && previewProcess.exitCode === null && !previewProcess.killed);
}

function isPreviewReady() {
  return new Promise((resolve) => {
    const request = http.get(
      { hostname: "127.0.0.1", port: PREVIEW_PORT, path: "/", timeout: 1200 },
      (response) => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode < 500));
      },
    );
    request.once("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.once("error", () => resolve(false));
  });
}

function startPreview() {
  if (isPreviewRunning()) return;
  previewLog = [];
  previewProcess = spawn(
    "cmd.exe",
    ["/d", "/s", "/c", `npm.cmd run dev -- --hostname 127.0.0.1 --port ${PREVIEW_PORT}`],
    { cwd: DEFAULT_SYNC_TARGET, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  previewProcess.stdout.on("data", appendPreviewLog);
  previewProcess.stderr.on("data", appendPreviewLog);
  previewProcess.once("exit", (code) => {
    appendPreviewLog(`Preview process exited with code ${code}.`);
    previewProcess = null;
  });
}

function stopPreview() {
  if (!isPreviewRunning()) return;
  spawn("taskkill.exe", ["/PID", String(previewProcess.pid), "/T", "/F"], {
    windowsHide: true,
    stdio: "ignore",
  });
  previewProcess = null;
}

function readDeployConfig() {
  try {
    return JSON.parse(fs.readFileSync(DEPLOY_CONFIG_FILE, "utf8"));
  } catch {
    return {
      blogPath: DEFAULT_SYNC_TARGET,
      sourceRepoUrl: "",
      sourceBranch: "main",
    };
  }
}

function writeDeployConfig(config) {
  fs.mkdirSync(path.dirname(DEPLOY_CONFIG_FILE), { recursive: true });
  backupFile(DEPLOY_CONFIG_FILE);
  fs.writeFileSync(DEPLOY_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
}

const CUSTOMIZATION_FIELDS = {
  title: "string",
  faviconUrl: "string",
  authorName: "string",
  bio: "string",
  navTitle: "string",
  navSuffix: "string",
  navAfter: "string",
  avatarUrl: "string",
  useGradient: "boolean",
  themeColors: "array",
  bgImages: "array",
  petPageBackground: "string",
  aiPageBackground: "string",
  defaultPostCover: "string",
  photoWallImage: "string",
  chatterTitle: "string",
  chatterDescription: "string",
  danmakuList: "array",
  petPageTitle: "string",
  enableLevelSystem: "boolean",
};

function parseCustomization() {
  const configPath = getSettingPath("site");
  const content = fs.readFileSync(configPath, "utf8");
  const result = {};
  for (const [key, type] of Object.entries(CUSTOMIZATION_FIELDS)) {
    let match;
    if (type === "string") {
      match = content.match(new RegExp(`\\b${key}\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
      if (match) {
        try { result[key] = JSON.parse(match[1]); } catch { result[key] = ""; }
      }
    } else if (type === "boolean") {
      match = content.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
      if (match) result[key] = match[1] === "true";
    } else {
      match = content.match(new RegExp(`\\b${key}\\s*:\\s*(\\[[\\s\\S]*?\\])`));
      if (match) {
        try { result[key] = JSON.parse(match[1]); } catch { result[key] = []; }
      }
    }
  }
  return result;
}

function writeCustomization(updates) {
  const configPath = getSettingPath("site");
  let content = fs.readFileSync(configPath, "utf8");
  backupFile(configPath);
  for (const [key, type] of Object.entries(CUSTOMIZATION_FIELDS)) {
    if (!(key in updates)) continue;
    const serialized = type === "boolean" ? String(Boolean(updates[key])) : JSON.stringify(updates[key]);
    const valuePattern = type === "string"
      ? '"(?:\\\\.|[^"\\\\])*"'
      : type === "boolean" ? "true|false" : "\\[[\\s\\S]*?\\]";
    const pattern = new RegExp(`(\\b${key}\\s*:\\s*)(${valuePattern})`);
    content = content.replace(pattern, (_match, prefix) => prefix + serialized);
  }
  fs.writeFileSync(configPath, content, "utf8");
}

async function readJson(request) {
  const raw = await readBody(request);
  if (!raw.length) return {};
  return JSON.parse(raw.toString("utf8"));
}

function sanitizeSlug(value) {
  const slug = String(value || "").trim();
  if (!slug || slug.includes("..") || /[\\/:*?"<>|]/.test(slug)) {
    throw new Error("Invalid document identifier.");
  }
  return slug.replace(/\.md$/i, "");
}

function getDocumentPath(type, slug) {
  const directory = DOCUMENT_DIRECTORIES[type];
  if (!directory) throw new Error("Unsupported document type.");
  return path.join(CONTENT_ROOT, directory, sanitizeSlug(slug) + ".md");
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const relativeName = path.relative(CONTENT_ROOT, filePath).replace(/[\\/]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.copyFileSync(filePath, path.join(BACKUP_DIR, timestamp + "_" + relativeName));
}

function parseFrontMatter(raw) {
  const output = { attributes: {}, content: raw };
  if (!raw.startsWith("---")) return output;

  const boundary = raw.indexOf("\n---", 3);
  if (boundary < 0) return output;

  const header = raw.slice(3, boundary).trim();
  output.content = raw.slice(boundary + 4).replace(/^\r?\n/, "");

  for (const line of header.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key) continue;

    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        output.attributes[key] = JSON.parse(value);
      } catch {
        output.attributes[key] = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
      }
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      try {
        output.attributes[key] = JSON.parse(value);
      } catch {
        output.attributes[key] = value.slice(1, -1);
      }
    } else {
      output.attributes[key] = value;
    }
  }
  return output;
}

function createFrontMatter(document) {
  const fields = [
    ["title", document.title],
    ["description", document.description],
    ["date", document.date],
    ["cover", document.cover],
    ["mood", document.mood],
  ];
  const lines = ["---"];
  for (const [key, value] of fields) {
    if (value) lines.push(key + ": " + JSON.stringify(String(value)));
  }
  if (Array.isArray(document.tags) && document.tags.length) {
    lines.push("tags: " + JSON.stringify(document.tags.map((tag) => String(tag).trim()).filter(Boolean)));
  }
  lines.push("---", "");
  return lines.join("\n") + String(document.content || "").replace(/\r\n/g, "\n").trimEnd() + "\n";
}

function readDocument(type, slug) {
  const filePath = getDocumentPath(type, slug);
  if (!fs.existsSync(filePath)) throw new Error("Document not found.");
  const parsed = parseFrontMatter(fs.readFileSync(filePath, "utf8"));
  return {
    success: true,
    document: {
      slug: sanitizeSlug(slug),
      type,
      title: parsed.attributes.title || "",
      description: parsed.attributes.description || "",
      date: parsed.attributes.date || "",
      cover: parsed.attributes.cover || "",
      mood: parsed.attributes.mood || "",
      tags: Array.isArray(parsed.attributes.tags) ? parsed.attributes.tags : [],
      content: parsed.content,
    },
  };
}

function listDocuments(type) {
  const directory = DOCUMENT_DIRECTORIES[type];
  if (!directory) throw new Error("Unsupported document type.");
  const targetDir = path.join(CONTENT_ROOT, directory);
  if (!fs.existsSync(targetDir)) return [];

  return fs.readdirSync(targetDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const slug = name.slice(0, -3);
      const fullPath = path.join(targetDir, name);
      const parsed = parseFrontMatter(fs.readFileSync(fullPath, "utf8"));
      return {
        slug,
        title: parsed.attributes.title || slug,
        description: parsed.attributes.description || parsed.content.slice(0, 120),
        date: parsed.attributes.date || "",
        tags: Array.isArray(parsed.attributes.tags) ? parsed.attributes.tags : [],
        updatedAt: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function getSettingPath(name) {
  const setting = SETTINGS_FILES[name];
  if (!setting) throw new Error("Unsupported setting.");
  return path.join(CONTENT_ROOT, setting.path);
}

function readSetting(name) {
  const settingPath = getSettingPath(name);
  const setting = SETTINGS_FILES[name];
  if (!fs.existsSync(settingPath)) {
    return setting.format === "text" ? "" : [];
  }
  const raw = fs.readFileSync(settingPath, "utf8");
  return setting.format === "text" ? raw : JSON.parse(raw);
}

function writeSetting(name, value) {
  const settingPath = getSettingPath(name);
  const setting = SETTINGS_FILES[name];
  fs.mkdirSync(path.dirname(settingPath), { recursive: true });
  if (setting.format === "text") {
    if (typeof value !== "string") throw new Error("This setting must be text.");
    backupFile(settingPath);
    fs.writeFileSync(settingPath, value.replace(/\r\n/g, "\n"), "utf8");
  } else {
    backupFile(settingPath);
    fs.writeFileSync(settingPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  }
}

function copyPath(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function syncRelativePath(relativePath, targetPath = DEFAULT_SYNC_TARGET) {
  const target = path.resolve(targetPath);
  const source = path.join(CONTENT_ROOT, relativePath);
  const destination = path.join(target, relativePath);
  if (!fs.existsSync(path.join(target, "package.json"))) {
    throw new Error("Target must be a frontend project containing package.json.");
  }
  if (fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  } else {
    fs.rmSync(destination, { recursive: true, force: true });
  }
  return target;
}

function syncToFrontend(targetPath) {
  const target = path.resolve(targetPath || DEFAULT_SYNC_TARGET);
  if (!fs.existsSync(path.join(target, "package.json"))) {
    throw new Error("Target must be a frontend project containing package.json.");
  }
  for (const directory of ["posts", "chatters", "moments"]) {
    copyPath(path.join(CONTENT_ROOT, directory), path.join(target, directory));
  }
  for (const directory of ["site", "pets", "backgrounds", "legacy"]) {
    copyPath(path.join(CONTENT_ROOT, "assets", directory), path.join(target, "public", "assets", directory));
  }
  const live2dTarget = path.join(target, "public", "live2d");
  fs.rmSync(live2dTarget, { recursive: true, force: true });
  for (const directory of ["runtime", "models"]) {
    copyPath(path.join(CONTENT_ROOT, "assets", "live2d", directory), path.join(live2dTarget, directory));
  }
  for (const file of [
    "siteConfig.ts",
    path.join("data", "vtuberConfig.json"),
    path.join("data", "aiModels.json"),
    path.join("data", "aiModels.ts"),
    path.join("data", "petProfiles.json"),
    path.join("data", "petProfiles.ts"),
    path.join("data", "live2dModels.json"),
    path.join("data", "live2dModels.ts"),
    path.join("data", "albums.ts"),
    path.join("data", "friends.ts"),
    path.join("data", "projects.ts"),
  ]) {
    const source = path.join(CONTENT_ROOT, file);
    const destination = path.join(target, file);
    if (fs.existsSync(source)) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }
  return target;
}

function findLive2DEntries(root) {
  const output = [];
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...findLive2DEntries(fullPath));
    else if (/\.(?:model3|model)\.json$/i.test(entry.name)) output.push(fullPath);
  }
  return output;
}

function createModelId(value) {
  return value.normalize("NFKC").replace(/\.(?:model3|model)\.json$/i, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || `model-${Date.now()}`;
}

function scanLive2DModels() {
  const live2dRoot = path.join(CONTENT_ROOT, "assets", "live2d");
  const modelRoot = path.join(live2dRoot, "models");
  const referenceRoot = path.resolve(APP_DIR, "..", "..", "references", "live2d-model-library");
  const cubism2Source = path.resolve(APP_DIR, "..", "..", "references", "live2d-companion-ref", "live2d-companion", "live2d.min.js");
  const cubism2Target = path.join(live2dRoot, "runtime", "cubism2", "live2d.min.js");
  fs.mkdirSync(modelRoot, { recursive: true });

  for (const sourceEntry of findLive2DEntries(referenceRoot)) {
    const relative = path.relative(referenceRoot, sourceEntry);
    const id = createModelId(relative);
    const destination = path.join(modelRoot, id);
    if (!fs.existsSync(destination)) fs.cpSync(path.dirname(sourceEntry), destination, { recursive: true });
  }
  if (fs.existsSync(cubism2Source) && !fs.existsSync(cubism2Target)) {
    fs.mkdirSync(path.dirname(cubism2Target), { recursive: true });
    fs.copyFileSync(cubism2Source, cubism2Target);
  }

  const existing = readSetting("live2d-models") || [];
  const registered = new Map(existing.map((model) => [model.id, model]));
  for (const entryPath of findLive2DEntries(modelRoot)) {
    const relative = path.relative(modelRoot, entryPath);
    const segments = relative.split(path.sep);
    const id = createModelId(segments[0] || path.basename(entryPath));
    const runtime = entryPath.toLowerCase().endsWith(".model3.json") ? "cubism4" : "cubism2";
    const modelDirectory = path.dirname(entryPath);
    const files = fs.readdirSync(modelDirectory);
    const thumbnail = files.find((name) => /^(?:icon|preview|thumbnail)\.(?:png|jpe?g|webp)$/i.test(name)) || files.find((name) => /\.(?:png|jpe?g|webp)$/i.test(name)) || "";
    const entryUrl = `/live2d/models/${relative.replace(/\\/g, "/")}`;
    const thumbnailUrl = thumbnail ? `/live2d/models/${path.relative(modelRoot, path.join(modelDirectory, thumbnail)).replace(/\\/g, "/")}` : "";
    const current = registered.get(id) || existing.find((model) => model.entryUrl === entryUrl) || {};
    registered.set(id, {
      ...current,
      id,
      name: current.name || path.basename(entryPath).replace(/\.(?:model3|model)\.json$/i, ""),
      enabled: current.enabled !== false,
      runtime,
      modelFormat: runtime === "cubism4" ? "model3" : "model",
      entryUrl,
      thumbnailUrl: current.thumbnailUrl || thumbnailUrl,
      notes: current.notes || `本地扫描注册的 ${runtime === "cubism4" ? "Cubism 4" : "Cubism 2"} 模型。`,
      layout: current.layout || { scale: 0.86, offsetX: 0, offsetY: 0 },
      parameterRanges: current.parameterRanges || {},
      presets: current.presets || {},
    });
  }

  copyPath(modelRoot, path.join(DEFAULT_SYNC_TARGET, "public", "live2d", "models"));
  copyPath(path.join(live2dRoot, "runtime"), path.join(DEFAULT_SYNC_TARGET, "public", "live2d", "runtime"));
  return [...registered.values()];
}

async function getPublishStatus() {
  const config = readDeployConfig();
  const blogPath = path.resolve(config.blogPath || DEFAULT_SYNC_TARGET);
  const [branch, remote, changes] = await Promise.all([
    runCommand("git.exe", ["branch", "--show-current"], blogPath, 15000),
    runCommand("git.exe", ["remote", "get-url", "origin"], blogPath, 15000),
    runCommand("git.exe", ["status", "--short"], blogPath, 15000),
  ]);
  return {
    config: { ...config, blogPath },
    branch: branch.stdout.trim() || config.sourceBranch || "main",
    remote: remote.stdout.trim() || config.sourceRepoUrl || "",
    changes: changes.stdout.trim().split(/\r?\n/).filter(Boolean),
    previewRunning: isPreviewRunning(),
  };
}

async function publishAction(action, payload) {
  if (publishBusy) throw new Error("Another publish task is already running.");
  publishBusy = true;
  try {
    const config = { ...readDeployConfig(), ...(payload.config || {}) };
    const blogPath = path.resolve(config.blogPath || DEFAULT_SYNC_TARGET);
    writeDeployConfig({ ...config, blogPath });

    if (action === "local") {
      const target = syncToFrontend(blogPath);
      return { success: true, message: "Changes applied to the local frontend.", target, output: "Local files synchronized." };
    }

    syncToFrontend(blogPath);
    if (action === "github") {
      const branchResult = await runCommand("git.exe", ["branch", "--show-current"], blogPath, 15000);
      const branch = branchResult.stdout.trim() || config.sourceBranch || "main";
      const addResult = await runCommand("git.exe", ["add", "."], blogPath, 60000);
      if (addResult.code !== 0) throw new Error(addResult.stderr || "git add failed.");

      const diffResult = await runCommand("git.exe", ["diff", "--cached", "--quiet"], blogPath, 15000);
      let commitOutput = "No new changes to commit.\n";
      if (diffResult.code !== 0) {
        const message = String(payload.commitMessage || `Update site ${new Date().toISOString()}`).slice(0, 180);
        const commitResult = await runCommand("git.exe", ["commit", "-m", message], blogPath, 120000);
        if (commitResult.code !== 0) throw new Error(commitResult.stderr || "git commit failed.");
        commitOutput = commitResult.stdout + commitResult.stderr;
      }

      const pushResult = await runCommand("git.exe", ["push", "origin", branch], blogPath, 300000);
      if (pushResult.code !== 0) throw new Error(pushResult.stderr || "git push failed.");
      return {
        success: true,
        message: "Changes pushed to GitHub.",
        output: commitOutput + pushResult.stdout + pushResult.stderr,
      };
    }

    if (action === "vercel") {
      const deployResult = await runCommand(
        "cmd.exe",
        ["/d", "/s", "/c", "npx.cmd vercel --prod --yes"],
        blogPath,
        600000,
      );
      if (deployResult.code !== 0) {
        throw new Error(deployResult.stderr || deployResult.stdout || "Vercel deployment failed.");
      }
      return {
        success: true,
        message: "Vercel production deployment completed.",
        output: deployResult.stdout + deployResult.stderr,
      };
    }

    throw new Error("Unknown publish action.");
  } finally {
    publishBusy = false;
  }
}

function openBrowser() {
  spawn("cmd.exe", ["/d", "/c", "start", "", "http://127.0.0.1:" + PORT], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, "." + requested);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
}

function serveContentAsset(response, pathname) {
  const relativePath = decodeURIComponent(pathname.slice("/source-assets".length));
  const filePath = path.resolve(CONTENT_ROOT, "." + relativePath);
  if (!filePath.startsWith(CONTENT_ROOT + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Asset not found");
    return;
  }
  response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
}

async function handleApi(request, response, url) {
  const method = request.method || "GET";
  const parts = url.pathname.split("/").filter(Boolean);
  const route = parts.slice(1);

  if (method === "GET" && route[0] === "health") {
    return sendJson(response, 200, { success: true, service: "manager-v2" });
  }

  if (method === "GET" && route[0] === "dashboard") {
    return sendJson(response, 200, {
      success: true,
      data: {
        posts: listDocuments("post").length,
        chatters: listDocuments("chatter").length,
        moments: listDocuments("moment").length,
        root: CONTENT_ROOT,
      },
    });
  }

  if (route[0] === "preview") {
    if (method === "GET") {
      return sendJson(response, 200, {
        success: true,
        running: isPreviewRunning(),
        ready: await isPreviewReady(),
        url: `http://127.0.0.1:${PREVIEW_PORT}`,
        logs: previewLog,
      });
    }
    if (method === "POST" && route[1] === "start") {
      startPreview();
      return sendJson(response, 200, { success: true, message: "Preview is starting.", url: `http://127.0.0.1:${PREVIEW_PORT}` });
    }
    if (method === "POST" && route[1] === "stop") {
      stopPreview();
      return sendJson(response, 200, { success: true, message: "Preview stopped." });
    }
  }

  if (route[0] === "customization") {
    if (method === "GET") {
      return sendJson(response, 200, { success: true, value: parseCustomization() });
    }
    if (method === "PUT") {
      const body = await readJson(request);
      writeCustomization(body.value || {});
      const target = syncRelativePath("siteConfig.ts");
      return sendJson(response, 200, { success: true, message: "Customization saved and applied.", target });
    }
  }

  if (route[0] === "documents") {
    const type = url.searchParams.get("type") || route[1];
    const slug = route[2];
    if (method === "GET" && !slug) return sendJson(response, 200, { success: true, documents: listDocuments(type) });
    if (method === "GET" && slug) return sendJson(response, 200, readDocument(type, slug));
    if (method === "PUT" && slug) {
      const body = await readJson(request);
      const document = { ...body, slug: sanitizeSlug(slug), type };
      const filePath = getDocumentPath(type, document.slug);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      backupFile(filePath);
      fs.writeFileSync(filePath, createFrontMatter(document), "utf8");
      syncRelativePath(path.relative(CONTENT_ROOT, filePath));
      return sendJson(response, 200, { success: true, message: "Saved and applied.", slug: document.slug });
    }
    if (method === "DELETE" && slug) {
      const filePath = getDocumentPath(type, slug);
      fs.rmSync(filePath, { force: true });
      syncRelativePath(path.relative(CONTENT_ROOT, filePath));
      return sendJson(response, 200, { success: true, message: "Deleted and applied." });
    }
  }

  if (route[0] === "settings" && route[1]) {
    const name = route[1];
    if (method === "GET" && name === "live2d-models" && route[2] === "scan") {
      return sendJson(response, 200, { success: true, value: scanLive2DModels() });
    }
    if (method === "GET") return sendJson(response, 200, { success: true, value: readSetting(name) });
    if (method === "PUT") {
      const body = await readJson(request);
      writeSetting(name, body.value);
      syncRelativePath(SETTINGS_FILES[name].path);
      return sendJson(response, 200, { success: true, message: "Saved and applied." });
    }
  }

  if (method === "POST" && route[0] === "sync") {
    const body = await readJson(request);
    const target = syncToFrontend(body.targetPath);
    return sendJson(response, 200, { success: true, message: "Synced.", target });
  }

  if (route[0] === "publish") {
    if (method === "GET") {
      return sendJson(response, 200, { success: true, data: await getPublishStatus() });
    }
    if (method === "PUT" && route[1] === "config") {
      const body = await readJson(request);
      writeDeployConfig(body.value || {});
      return sendJson(response, 200, { success: true, message: "Publish configuration saved." });
    }
    if (method === "POST" && route[1]) {
      const body = await readJson(request);
      return sendJson(response, 200, await publishAction(route[1], body));
    }
  }

  return sendError(response, 404, "Unknown local API route.");
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:" + PORT);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else if (url.pathname.startsWith("/source-assets/")) {
      serveContentAsset(response, url.pathname);
    } else {
      serveStatic(request, response, url.pathname);
    }
  } catch (error) {
    sendError(response, 500, error.message || "Unexpected local server error.");
  }
});

server.once("error", (error) => {
  if (error.code === "EADDRINUSE") {
    openBrowser();
    setImmediate(() => process.exit(0));
    return;
  }
  console.error(error);
  process.exitCode = 1;
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Manager v2 is ready at http://127.0.0.1:" + PORT);
  openBrowser();
});

function shutdown() {
  stopPreview();
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
process.on("exit", shutdown);
