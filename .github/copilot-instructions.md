# GitHub Copilot Workspace Instructions

This workspace contains a VS Code extension that deploys custom AI agents and skills.

---

## Language Policy

- **All AI responses must be in Japanese**, regardless of the language used in skills or prompts.
- Code, file names, and identifiers remain in English.

---

## Available Skills

The following skills are available in `.github/skills/`. When a user request falls within
a skill's domain, load the SKILL.md with `read_file` to get full instructions.

### Coding & Automation Skills

| Skill Name | Domain | Invoke When |
|-----------|--------|------------|
| `code-review-skill` | Code quality, security, bugs | Reviewing or auditing code |
| `workflow-automation-agent` | Task decomposition, orchestration | Planning multi-step workflows |
| `devops-assistant` | Git, CI/CD, deployment | DevOps and pipeline questions |
| `skill-creator-meta-skill` | Creating new SKILL.md files | Asked to build a new skill |

### Research & Knowledge Skills

| Skill Name | Domain | Invoke When |
|-----------|--------|------------|
| `deep-research-synthesizer` | Research synthesis, pattern detection | Analyzing codebases or docs |
| `knowledge-structuring-skill` | Knowledge organization, frameworks | Structuring complex information |

---

## Skill File Paths

```
.github/skills/
├── code-review-skill/SKILL.md
├── workflow-automation-agent/SKILL.md
├── devops-assistant/SKILL.md
├── skill-creator-meta-skill/SKILL.md
├── deep-research-synthesizer/SKILL.md
└── knowledge-structuring-skill/SKILL.md
```

---

## Agent Roster

| Agent | Mode File | Purpose |
|-------|-----------|---------|
| `main` | `.github/agents/main.agent.md` | 汎用司令塔（3案立案→承認→実行） |
| `planner` | `.github/agents/planner.agent.md` | 計画立案専門 |
| `debugger` | `.github/agents/debugger.agent.md` | バグ診断・修正 |
| `critical-thinking` | `.github/agents/critical-thinking.agent.md` | 批判的分析・妥当性検証 |
| `janitor` | `.github/agents/janitor.agent.md` | コード整理・廃止API除去 |
| `mentor` | `.github/agents/mentor.agent.md` | 学習・概念説明 |

---

## Coding Rules Summary

- PowerShell: 禁止 `Invoke-Expression` / `iex`; UTF-8 BOM なしで出力
- ファイル出力先: `c:\py\` 配下
- エラーメッセージ: 日本語
- API 優先順位: `Get-WinEvent > Get-CimInstance > Get-WmiObject`

See `.github/instructions/` for full coding rules, execution protocol, and quality gates.
