import * as vscode from "vscode";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";

const REPO_OWNER   = "aobamiku-hash";
const REPO_NAME    = "My_Agent";
const BRANCH       = "main";
const TREE_API     = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`;
const RAW_BASE     = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/`;
const TRACKED_DIRS = [".github/agents", ".github/skills", ".github/prompts", ".github/instructions"];
const EXTRA_FILES  = [".github/copilot-instructions.md"];

let statusBar: vscode.StatusBarItem;

// HTTP helper (no external deps)

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "my-agent-vscode-ext" } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// Security: path traversal prevention

function safePath(base: string, rel: string): string | null {
  if (rel.includes("..")) { return null; }
  const resolved = path.resolve(path.join(base, rel));
  const baseNorm = path.resolve(base);
  if (!resolved.startsWith(baseNorm + path.sep) && resolved !== baseNorm) { return null; }
  return resolved;
}

// GitHub download

async function downloadAgents(
  workspaceRoot: string,
  progress: vscode.Progress<{ message?: string }>
): Promise<number> {
  progress.report({ message: "\u30d5\u30a1\u30a4\u30eb\u4e00\u89a7\u3092\u53d6\u5f97\u4e2d..." });
  const treeJson = await httpsGet(TREE_API);
  const tree: { tree: Array<{ path: string; type: string }> } = JSON.parse(treeJson);

  const targets = tree.tree.filter(item => {
    if (item.type !== "blob") { return false; }
    const inDir  = TRACKED_DIRS.some(d => item.path.startsWith(d + "/"));
    const isFile = EXTRA_FILES.includes(item.path);
    return inDir || isFile;
  });

  let count = 0;
  for (const item of targets) {
    const dest = safePath(workspaceRoot, item.path);
    if (!dest) { continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    progress.report({ message: `\u53d6\u5f97\u4e2d: ${item.path}` });
    const content = await httpsGet(RAW_BASE + item.path);
    fs.writeFileSync(dest, content, { encoding: "utf8" });
    count++;
  }
  return count;
}

// Status check

function getStatusLines(workspaceRoot: string): string[] {
  const lines: string[] = [];
  for (const dir of TRACKED_DIRS) {
    const full = path.join(workspaceRoot, dir);
    if (fs.existsSync(full)) {
      const n = fs.readdirSync(full).filter(f => f.endsWith(".md")).length;
      lines.push(`\u2705 ${dir.replace(".github/", "")}: ${n}\u30d5\u30a1\u30a4\u30eb`);
    } else {
      lines.push(`\u26a0\ufe0f  ${dir.replace(".github/", "")}: \u672a\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb`);
    }
  }
  for (const f of EXTRA_FILES) {
    const full = path.join(workspaceRoot, f);
    lines.push(fs.existsSync(full)
      ? `\u2705 ${path.basename(f)}: \u3042\u308a`
      : `\u26a0\ufe0f  ${path.basename(f)}: \u306a\u3057`);
  }
  return lines;
}

// Helpers

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function refreshStatusBar(ws?: string): void {
  if (!ws) { return; }
  const agentDir = path.join(ws, ".github", "agents");
  if (fs.existsSync(agentDir) && fs.readdirSync(agentDir).length > 0) {
    statusBar.text = "$(robot) My Agents \u2713";
    statusBar.backgroundColor = undefined;
  } else {
    statusBar.text = "$(robot) My Agents";
    statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  }
}

// Recommended settings

async function applyRecommendedSettings(): Promise<void> {
  const ws = getWorkspaceRoot();
  if (!ws) { return; }
  const settingsDir  = path.join(ws, ".vscode");
  const settingsPath = path.join(settingsDir, "settings.json");
  fs.mkdirSync(settingsDir, { recursive: true });
  let current: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try { current = JSON.parse(fs.readFileSync(settingsPath, "utf8")); } catch {}
  }
  const merged = {
    ...current,
    "github.copilot.chat.agent.thinkingTool": true,
    "github.copilot.chat.codesearch.enabled": true,
    "github.copilot.chat.experimental.agentDesktop": true
  };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), "utf8");
  vscode.window.showInformationMessage(
    "\u63a8\u5968\u8a2d\u5b9a\u3092 .vscode/settings.json \u306b\u9069\u7528\u3057\u307e\u3057\u305f\u3002VS Code \u3092\u518d\u8d77\u52d5\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
  );
}

// Commands

async function installAgents(): Promise<void> {
  const ws = getWorkspaceRoot();
  if (!ws) {
    vscode.window.showErrorMessage("\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u304c\u958b\u304b\u308c\u3066\u3044\u307e\u305b\u3093\u3002");
    return;
  }

  const answer = await vscode.window.showInformationMessage(
    `GitHub \u304b\u3089\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8\u3092\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3057\u3066 "${ws}/.github/" \u306b\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u3057\u307e\u3059\u3002`,
    "\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb", "\u30ad\u30e3\u30f3\u30bb\u30eb"
  );
  if (answer !== "\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb") { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "My Agents \u30a4\u30f3\u30b9\u30c8\u30fc\u30eb", cancellable: false },
    async progress => {
      try {
        const n = await downloadAgents(ws, progress);
        vscode.window.showInformationMessage(`\u2705 \u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u5b8c\u4e86\uff08${n}\u30d5\u30a1\u30a4\u30eb\uff09`);
        refreshStatusBar(ws);
      } catch (e) {
        vscode.window.showErrorMessage(
          `\u274c \u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u5931\u6557: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );
}

async function updateAgents(): Promise<void> {
  const ws = getWorkspaceRoot();
  if (!ws) {
    vscode.window.showErrorMessage("\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u304c\u958b\u304b\u308c\u3066\u3044\u307e\u305b\u3093\u3002");
    return;
  }
  if (!fs.existsSync(path.join(ws, ".github", "agents"))) {
    vscode.window.showWarningMessage("\u5148\u306b\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u3092\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    "\u65e2\u5b58\u306e\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8\u30d5\u30a1\u30a4\u30eb\u3092 GitHub \u306e\u6700\u65b0\u7248\u3067\u4e0a\u66f8\u304d\u3057\u307e\u3059\u3002\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f",
    "\u4e0a\u66f8\u304d\u66f4\u65b0", "\u30ad\u30e3\u30f3\u30bb\u30eb"
  );
  if (answer !== "\u4e0a\u66f8\u304d\u66f4\u65b0") { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "My Agents \u66f4\u65b0", cancellable: false },
    async progress => {
      try {
        const n = await downloadAgents(ws, progress);
        vscode.window.showInformationMessage(`\u2705 \u66f4\u65b0\u5b8c\u4e86\uff08${n}\u30d5\u30a1\u30a4\u30eb\uff09`);
        refreshStatusBar(ws);
      } catch (e) {
        vscode.window.showErrorMessage(
          `\u274c \u66f4\u65b0\u5931\u6557: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  );
}

async function showStatus(): Promise<void> {
  const ws = getWorkspaceRoot();
  if (!ws) {
    vscode.window.showErrorMessage("\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u304c\u958b\u304b\u308c\u3066\u3044\u307e\u305b\u3093\u3002");
    return;
  }
  const lines = getStatusLines(ws);
  const doc = await vscode.workspace.openTextDocument({
    content: "## My Agents \u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u72b6\u6cc1\n\n" + lines.join("\n"),
    language: "markdown"
  });
  vscode.window.showTextDocument(doc);
}

async function showMenu(): Promise<void> {
  const ws = getWorkspaceRoot();
  const agentDir = ws ? path.join(ws, ".github", "agents") : null;
  const isInstalled = !!(agentDir && fs.existsSync(agentDir) && fs.readdirSync(agentDir).length > 0);

  const labelInstall = isInstalled
    ? "$(sync) \u30a8\u30fc\u30b8\u30a7\u30f3\u30c8\u3092\u66f4\u65b0"
    : "$(cloud-download) \u30a8\u30fc\u30b8\u30a7\u30f3\u30c8\u3092\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb";
  const descInstall = isInstalled
    ? "GitHub \u304b\u3089\u6700\u65b0\u7248\u3067\u4e0a\u66f8\u304d"
    : "GitHub \u304b\u3089\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3057\u3066\u5c55\u958b";

  const items: vscode.QuickPickItem[] = [
    {
      label: labelInstall,
      description: descInstall,
      detail: ws ?? "\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u304c\u672a\u8a2d\u5b9a"
    },
    {
      label: "$(checklist) \u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u72b6\u6cc1\u3092\u78ba\u8a8d",
      description: "\u5c55\u958b\u6e08\u307f\u30d5\u30a1\u30a4\u30eb\u306e\u4e00\u89a7\u3092\u8868\u793a"
    },
    {
      label: "$(settings-gear) \u63a8\u5968\u8a2d\u5b9a\u3092\u9069\u7528",
      description: ".vscode/settings.json \u306b Copilot Agent \u63a8\u5968\u8a2d\u5b9a\u3092\u8ffd\u52a0"
    }
  ];

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "My Agents \u2014 \u64cd\u4f5c\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044"
  });
  if (!picked) { return; }

  if      (picked.label.includes("\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb")) { await installAgents(); }
  else if (picked.label.includes("\u66f4\u65b0"))                         { await updateAgents(); }
  else if (picked.label.includes("\u72b6\u6cc1"))                         { await showStatus(); }
  else if (picked.label.includes("\u63a8\u5968\u8a2d\u5b9a"))             { await applyRecommendedSettings(); }
}

// Extension lifecycle

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("myAgent.install", installAgents),
    vscode.commands.registerCommand("myAgent.update",  updateAgents),
    vscode.commands.registerCommand("myAgent.status",  showStatus),
    vscode.commands.registerCommand("myAgent.menu",    showMenu)
  );

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(robot) My Agents";
  statusBar.tooltip = "\u30af\u30ea\u30c3\u30af\u3057\u3066\u30a8\u30fc\u30b8\u30a7\u30f3\u30c8\u30e1\u30cb\u30e5\u30fc\u3092\u958b\u304f";
  statusBar.command = "myAgent.menu";
  statusBar.show();
  context.subscriptions.push(statusBar);

  refreshStatusBar(getWorkspaceRoot());
}

export function deactivate(): void {}

