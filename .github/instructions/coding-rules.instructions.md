---
applyTo: "**"
---

# コーディング規約

## PowerShell

### エラー処理
- 診断スクリプト: `$ErrorActionPreference = "SilentlyContinue"` 許容
- 本番/自動化スクリプト: 必ず `-ErrorAction Stop` + `try/catch`
- エラーメッセージは日本語で出力する

### セキュリティ必須
- `Invoke-Expression` / `iex` 絶対禁止
- ユーザー入力はホワイトリスト検証必須
- ファイルパスは `[System.IO.Path]::GetFullPath()` で正規化

### API 選択
```
優先: Get-WinEvent > Get-CimInstance > Get-WmiObject
非推奨: gwmi (エイリアス), wmic.exe (廃止予定)
```

### ファイル出力
```powershell
# 必ず UTF-8 BOM なしで統一
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
```

## ファイル命名
- スクリプト: `<目的>_<対象>.ps1` (例: `amd_tdr_check.ps1`)
- レポート: `<目的>_report_<YYYYMMDD>_<HHMMSS>.txt`
- 出力先: `c:\py\` 配下
