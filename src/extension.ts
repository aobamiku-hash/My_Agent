import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const AGENT_DIRS = ["agents", "prompts", "instructions"] as const;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("myAgent.install", () => installAgents(context)),
    vscode.commands.registerCommand("myAgent.update",  () => updateAgents(context)),
    vscode.commands.registerCommand("myAgent.status",  () => showStatus(context))
  );
}

export function deactivate() {}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * 拡張機能バンドル内のソースディレクトリ → ワークスペースの .github/ へコピー
 */
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
    const srcDir = path.join(context.extensionPath, dir);
    const destDir = path.join(ws, ".github", dir === "agents" ? "agents" : dir);

    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(destDir, { recursive: true });

    for (const file of fs.readdirSync(srcDir)) {
      const src  = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      if (!overwrite && fs.existsSync(dest)) {
        skipped++;
        continue;
      }
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
    "インストール",
    "キャンセル"
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
    "上書き更新",
    "キャンセル"
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

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown"
  });
  vscode.window.showTextDocument(doc);
}