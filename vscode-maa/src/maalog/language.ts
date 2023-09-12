import * as vscode from 'vscode'

import { isRowBegin, parseRowInfo } from './parser'

const categoryMapper: Record<string, string> = {
  TRC: 'trace',
  DBG: 'debug',
  INF: 'info',
  WRN: 'warning',
  ERR: 'error'
}

export const LanguageLegend = new vscode.SemanticTokensLegend(
  ['date', 'number', 'source', 'trace', 'debug', 'info', 'warning', 'error'],
  []
)

function getFullRow(doc: vscode.TextDocument, row: number) {
  let begin = row,
    end = row + 1
  while (!isRowBegin(doc.lineAt(begin).text)) {
    begin -= 1
  }
  while (end < doc.lineCount && !isRowBegin(doc.lineAt(end).text)) {
    end += 1
  }
  return new vscode.Range(doc.lineAt(begin).range.start, doc.lineAt(end - 1).range.end)
}

export class LanguageServer
  implements vscode.DocumentSemanticTokensProvider, vscode.DocumentSymbolProvider
{
  activeDecoration: vscode.TextEditorDecorationType

  constructor() {
    this.activeDecoration = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline'
    })
  }

  dispose() {
    this.activeDecoration.dispose()
  }

  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.DocumentSymbol[] {
    const result: vscode.DocumentSymbol[] = []

    const file = document.getText()
    const rows = file.split('\n')
    const processTraceInfo: Record<
      string,
      {
        root: vscode.DocumentSymbol
        threads: Record<
          string,
          {
            root: vscode.DocumentSymbol
            stack: {
              func: string
              row: number
              symbol: vscode.DocumentSymbol
            }[]
          }
        >
      }
    > = {}
    for (let i = 0; i < rows.length; i++) {
      if (!isRowBegin(rows[i])) {
        continue
      }
      const rowRange = getFullRow(document, i)
      const row = document.getText(rowRange)
      const info = parseRowInfo(row)
      if (!info) {
        continue
      }
      if (!(info.pid in processTraceInfo)) {
        const sym = new vscode.DocumentSymbol(
          info.tid,
          info.date,
          vscode.SymbolKind.Event,
          document.lineAt(i).range,
          document.lineAt(i).range
        )
        result.push(sym)
        processTraceInfo[info.pid] = {
          root: sym,
          threads: {}
        }
      }
      const procInfo = processTraceInfo[info.pid]
      if (!(info.tid in procInfo.threads)) {
        const sym = new vscode.DocumentSymbol(
          info.tid,
          '',
          vscode.SymbolKind.Event,
          document.lineAt(i).range,
          document.lineAt(i).range
        )
        procInfo.root.children.push(sym)
        procInfo.threads[info.tid] = {
          root: sym,
          stack: []
        }
      }
      const thrdInfo = procInfo.threads[info.tid]
      const stack = thrdInfo.stack
      if (row.endsWith(' enter ')) {
        if (!info.has2) {
          continue
        }
        const sym = new vscode.DocumentSymbol(
          info.func,
          '',
          vscode.SymbolKind.Function,
          document.lineAt(i).range,
          document.lineAt(i).range
        )
        sym.children = []
        if (stack.length > 0) {
          stack[stack.length - 1].symbol.children.push(sym)
        } else {
          thrdInfo.root.children.push(sym)
        }
        stack.push({
          func: info.func,
          row: i,
          symbol: sym
        })
      } else if (/leave, \d+ms $/.test(row)) {
        if (stack.length === 0) {
          continue
        }
        if (!info.has2) {
          continue
        }
        if (stack[stack.length - 1].func === info.func) {
          stack.pop()
        }
      }
    }

    return result
  }

  onDidChangeSemanticTokens?: vscode.Event<void> | undefined
  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(LanguageLegend)

    const file = document.getText()
    const rows = file.split(/\n(?= \[\d{4}-\d{2}-\d{2})/)

    let curRow = 0

    for (const row of rows) {
      const rowRow = row.split('\n')
      const get = (offset: number) => {
        let r = 0
        while (offset >= 0 && offset > rowRow[r].length) {
          offset -= rowRow[r].length + 1
          r += 1
        }
        return [r, offset]
      }
      const push = (b: [number, number], t: string) => {
        const p1 = get(b[0])
        const p2 = get(b[1])
        if (p1[0] === p2[0]) {
          tokensBuilder.push(new vscode.Range(curRow + p1[0], p1[1], curRow + p2[0], p2[1]), t)
        } else {
          tokensBuilder.push(
            new vscode.Range(curRow + p1[0], p1[1], curRow + p1[0], rowRow[p1[0]].length),
            t
          )
          for (let i = p1[0] + 1; i < p2[0]; i++) {
            tokensBuilder.push(document.lineAt(curRow + i).range, t)
          }
          tokensBuilder.push(new vscode.Range(curRow + p2[0], 0, curRow + p2[0], p2[1]), t)
        }
      }

      const info = parseRowInfo(row)
      if (!info) {
        continue
      }
      push(info.dateRange, 'date')
      if (info.category in categoryMapper) {
        push(info.categoryRange, categoryMapper[info.category])
        push(info.restRange, categoryMapper[info.category])
      }
      push(info.pidRange, 'number')
      push(info.tidRange, 'number')
      push(info.fileRange, 'source')
      if (info.has2) {
        push(info.lineRange, 'number')
        push(info.funcRange, 'source')
      }

      curRow += rowRow.length
    }

    return tokensBuilder.build()
  }

  onChangeSelection(editor: vscode.TextEditor, sel: readonly vscode.Selection[]) {
    if (sel.length === 0) {
      return
    }
    const pos = sel[0].active
    const range = getFullRow(editor.document, pos.line)
    editor.setDecorations(this.activeDecoration, [range])
  }
}
