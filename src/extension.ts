import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const AGENT_DIRS = ["agents", "prompts", "instructions"] as const;

// ステータスバーアイテム
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  // コマンド登録
  context.subscriptions.push(
    vscode.commands.registerCommand("myAgent.install", () => installAgents(context)),
    vscode.commands.registerCommand("myAgent.update",  () => updateAgents(context)),
    vscode.commands.registerCommand("myAgent.status",  () => showStatus(context)),
    vscode.commands.registerCommand("myAgent.menu",    () => showMenu(context))
  );

  // ステータスバーに「🤖 My Agents」ボタンを追加
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(robot) My Agents";
  statusBar.tooltip = "クリックしてエージェントメニューを開く";
  statusBar.command = "myAgent.menu";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // インストール済みか確認してステータスバーを更新
  updateStatusBar(context);
}

export function deactivate() {}

// ────────────────────────────────────────────────────────────
// ステータスバー更新
// ────────────────────────────────────────────────────────────

function updateStatusBar(context: vscode.ExtensionContext) {
  const ws = getWorkspaceRoot();
  if (!ws) return;
  const agentDir = path.join(ws, ".github", "agents");
  if (fs.existsSync(agentDir) && fs.readdirSync(agentDir).length > 0) {
    statusBar.text = "$(robot) My Agents ✓";
    statusBar.backgroundColor = undefined;
  } else {
    statusBar.text = "$(robot) My Agents";
    statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  }
}

// ────────────────────────────────────────────────────────────
// メニュー (Quick Pick)
// ────────────────────────────────────────────────────────────

async function showMenu(context: vscode.ExtensionContext) {
  const ws = getWorkspaceRoot();
  const agentDir = ws ? path.join(ws, ".github", "agents") : null;
  const isInstalled = agentDir && fs.existsSync(agentDir) && fs.readdirSync(agentDir).length > 0;

  const items: vscode.QuickPickItem[] = [
    {
      label: isInstalled ? "$(sync) エージェントを更新" : "$(cloud-download) エージェントをインストール",
      description: isInstalled ? "最新版で上書き" : "このプロジェクトに展開",
      detail: ws ? ws : "ワークスペースが未設定"
    },
    {
      label: "$(checklist) インストール状況を確認",
      description: "展開済みファイルの一覧を表示"
    },
    {
      label: "$(settings-gear) 推奨設定を適用",
      description: ".vscode/settings.json に Copilot Agent 推奨設定を追加"
    }
  ];

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "My Agents — 操作を選択してください"
  });
  if (!picked) return;

  if (picked.label.includes("インストール")) {
    await installAgents(context);
  } else if (picked.label.includes("更新")) {
    await updateAgents(context);
  } else if (picked.label.includes("状況")) {
    await showStatus(context);
  } else if (picked.label.includes("推奨設定")) {
    await applyRecommendedSettings();
  }

  updateStatusBar(context);
}

// ────────────────────────────────────────────────────────────
// 推奨設定を適用
// ────────────────────────────────────────────────────────────

async function applyRecommendedSettings() {
  const ws = getWorkspaceRoot();
  if (!ws) return;

  const settingsDir  = path.join(ws, ".vscode");
  const settingsPath = path.join(settingsDir, "settings.json");

  fs.mkdirSync(settingsDir, { recursive: true });

  let current: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try { current = JSON.parse(fs.readFileSync(settingsPath, "utf8")); } catch {}
  }

  const recommended: Record<string, unknown> = {
    "github.copilot.chat.agent.thinkingTool": true,
    "github.copilot.chat.codesearch.enabled": true,
    "github.copilot.chat.experimental.agentDesktop": true
  };

  const merged = { ...current, ...recommended };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), "utf8");

  vscode.window.showInformationMessage("推奨設定を .vscode/settings.json に適用しました。VS Code を再起動してください。");
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function copyAgentFiles(
  context: vscode.ExtensionContext,
  overwrite: boolean
): Promise<{ copied: number; skipped: number }> {
  const ws = getWorkspaceRoot();
  if (!ws) {
    vscode.window.showErrorMessage("ワークスペースが開かれていません。");
    return { copied: 0, skipped: 0 };
  }

  let copied = 0;
  let skipped = 0;

  for (const dir of AGENT_DIRS) {
    const srcDir  = path.join(context.extensionPath, dir);
    const destDir = path.join(ws, ".github", dir === "agents" ? "agents" : dir);

    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(destDir, { recursive: true });

    for (const file of fs.readdirSync(srcDir)) {
      const src  = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      if (!overwrite && fs.existsSync(dest)) { skipped++; continue; }
      fs.copyFileSync(src, dest);
      copied++;
    }
  }
  return { copied, skipped };
}

// ────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────

async function installAgents(context: vscode.ExtensionContext) {
  const ws = getWorkspaceRoot();
  if (!ws) return;

  const answer = await vscode.window.showInformationMessage(
    `エージェントファイルを "${ws}/.github/" にインストールします。`,
    "インストール", "キャンセル"
  );
  if (answer !== "インストール") return;

  const { copied, skipped } = await copyAgentFiles(context, false);
  vscode.window.showInformationMessage(
    `インストール完了: ${copied} ファイルをコピーしました（スキップ: ${skipped}）`
  );
}

async function updateAgents(context: vscode.ExtensionContext) {
  const ws = getWorkspaceRoot();
  if (!ws) return;

  const answer = await vscode.window.showWarningMessage(
    "既存のエージェントファイルを最新版で上書きします。よろしいですか？",
    "上書き更新", "キャンセル"
  );
  if (answer !== "上書き更新") return;

  const { copied } = await copyAgentFiles(context, true);
  vscode.window.showInformationMessage(`更新完了: ${copied} ファイルを上書きしました`);
}

async function showStatus(context: vscode.ExtensionContext) {
  const ws = getWorkspaceRoot();
  if (!ws) return;

  const lines: string[] = ["## My Agents インストール状況\n"];
  for (const dir of AGENT_DIRS) {
    const destDir = path.join(ws, ".github", dir === "agents" ? "agents" : dir);
    const exists  = fs.existsSync(destDir);
    const files   = exists ? fs.readdirSync(destDir) : [];
    lines.push(`### ${dir} (${files.length} ファイル)`);
    files.forEach(f => lines.push(`  - ${f}`));
  }

  const doc = await vscode.workspace.openTextDocument({ content: lines.join("\n"), language: "markdown" });
  vscode.window.showTextDocument(doc);
}