import * as vscode from 'vscode'

type RegExpExecArrayWithIndices = RegExpExecArray & { indices: Array<[number, number]> }

const categoryMapper: Record<string, string> = {
  TRC: 'trace',
  DBG: 'debug',
  INF: 'info',
  WRN: 'warning',
  ERR: 'error'
}

export const LanguageLegend = new vscode.SemanticTokensLegend(
  ['namespace', 'date', 'number', 'source', 'trace', 'debug', 'info', 'warning', 'error'],
  []
)

const deco = vscode.window.createTextEditorDecorationType({
  textDecoration: 'underline'
})

function isRowBegin(row: string) {
  return /^ \[\d{4}-\d{2}-\d{2} /.test(row)
}

interface R1 {
  date: string
  dateRange: [number, number]
  category: string
  cateRange: [number, number]
  pid: string
  pidRange: [number, number]
  tid: string
  tidRange: [number, number]
  file: string
  fileRange: [number, number]
}

interface R2 {
  line: string
  lineRange: [number, number]
  func: string
  funcRange: [number, number]
}

function offset(r: [number, number], v: number): [number, number] {
  return [r[0] + v, r[1] + v]
}

function parseRow(row: string):
  | null
  | ({
      tier: 1
      rest: string
      restRange: [number, number]
    } & R1)
  | ({
      tier: 2
      rest: string
      restRange: [number, number]
    } & R1 &
      R2) {
  const restRange: [number, number] = [0, row.length]
  const gRe =
    /^ \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3})\]\[([A-Z]+)\]\[Px(\d+)\]\[Tx(\d+)\]\[([^\]]+)\]/d
  const gMt = gRe.exec(row) as RegExpExecArrayWithIndices
  if (!gMt) {
    return null
  }
  const result1 = {
    date: gMt[1],
    dateRange: gMt.indices[1],
    category: gMt[2],
    cateRange: gMt.indices[2],
    pid: gMt[3],
    pidRange: gMt.indices[3],
    tid: gMt[4],
    tidRange: gMt.indices[4],
    file: gMt[5],
    fileRange: gMt.indices[5]
  }
  row = row.slice(gMt[0].length)
  restRange[0] = restRange[0] + gMt[0].length
  const fRe = /^\[L(\d+)\]\[([^\]]+)\]/d
  const fMt = fRe.exec(row) as RegExpExecArrayWithIndices
  if (!fMt) {
    return {
      tier: 1,
      ...result1,

      rest: row,
      restRange
    }
  }
  const result2 = {
    line: fMt[1],
    lineRange: offset(fMt.indices[1], restRange[0]),
    func: fMt[2],
    funcRange: offset(fMt.indices[2], restRange[0])
  }
  row = row.slice(fMt[0].length)
  restRange[0] = restRange[0] + fMt[0].length
  return {
    tier: 2,
    ...result1,
    ...result2,

    rest: row,
    restRange
  }
}

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

interface TreeNode {
  text: string
}

export class LanguageServer
  implements vscode.DocumentSemanticTokensProvider, vscode.DocumentSymbolProvider
{
  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
    const result: vscode.DocumentSymbol[] = []

    const file = document.getText()
    const rows = file.split('\n')
    let proc: vscode.DocumentSymbol | null = null
    let threadTraceInfo: Record<
      string,
      {
        root: vscode.DocumentSymbol
        stack: [string, number, vscode.DocumentSymbol][]
      }
    > = {}
    for (let i = 0; i < rows.length; i++) {
      if (!isRowBegin(rows[i])) {
        continue
      }
      const rowRange = getFullRow(document, i)
      const row = document.getText(rowRange)
      const info = parseRow(row)
      if (!info) {
        continue
      }
      if (row.endsWith(' MAA Process Start ')) {
        const sym = new vscode.DocumentSymbol(
          'process',
          rows[i].slice(2, 18),
          vscode.SymbolKind.Package,
          new vscode.Range(i - 1, 0, i + 4, rows[i + 4].length),
          document.lineAt(i - 1).range
        )
        proc = sym
        sym.children = []
        result.push(sym)
        threadTraceInfo = {}
      }
      if (!proc) {
        continue
      }
      if (!(info.tid in threadTraceInfo)) {
        const sym = new vscode.DocumentSymbol(
          info.tid,
          '',
          vscode.SymbolKind.Event,
          document.lineAt(i).range,
          document.lineAt(i).range
        )
        proc.children.push(sym)
        threadTraceInfo[info.tid] = {
          root: sym,
          stack: []
        }
      }
      const stk = threadTraceInfo[info.tid].stack
      if (row.endsWith(' enter ')) {
        if (info.tier !== 2) {
          continue
        }
        const sym = new vscode.DocumentSymbol(
          'func',
          info.func,
          vscode.SymbolKind.Function,
          document.lineAt(i).range,
          document.lineAt(i).range
        )
        sym.children = []
        if (stk.length > 0) {
          stk[stk.length - 1][2].children.push(sym)
        } else {
          threadTraceInfo[info.tid].root.children.push(sym)
        }
        stk.push([info.func, i, sym])
      } else if (/leave, \d+ms $/.test(row)) {
        if (stk.length === 0) {
          continue
        }
        stk.pop()
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
          tokensBuilder.push(
            new vscode.Range(
              new vscode.Position(curRow + p1[0], p1[1]),
              new vscode.Position(curRow + p2[0], p2[1])
            ),
            t
          )
        } else {
          tokensBuilder.push(
            new vscode.Range(
              new vscode.Position(curRow + p1[0], p1[1]),
              new vscode.Position(curRow + p1[0], rowRow[p1[0]].length)
            ),
            t
          )
          for (let i = p1[0] + 1; i < p2[0]; i++) {
            tokensBuilder.push(document.lineAt(curRow + i).range, t)
          }
          tokensBuilder.push(
            new vscode.Range(
              new vscode.Position(curRow + p2[0], 0),
              new vscode.Position(curRow + p2[0], p2[1])
            ),
            t
          )
        }
      }

      const info = parseRow(row)
      if (!info) {
        continue
      }
      push(info.dateRange, 'date')
      if (info.category in categoryMapper) {
        push(info.cateRange, categoryMapper[info.category])
        push(info.restRange, categoryMapper[info.category])
      }
      push(info.pidRange, 'number')
      push(info.tidRange, 'number')
      push(info.fileRange, 'source')
      if (info.tier === 2) {
        push(info.lineRange, 'number')
        push(info.funcRange, 'source')
      }

      curRow += rowRow.length
    }

    return tokensBuilder.build()
  }
  // provideDocumentSemanticTokensEdits?(
  //   document: vscode.TextDocument,
  //   previousResultId: string,
  //   token: vscode.CancellationToken
  // ): vscode.ProviderResult<vscode.SemanticTokens | vscode.SemanticTokensEdits> {
  //   throw new Error('Method not implemented.')
  // }

  onChangeSelection(editor: vscode.TextEditor, sel: readonly vscode.Selection[]) {
    if (sel.length === 0) {
      return
    }
    const enterRe = /enter $/
    const leaveRe = /leave, \d+ms $/

    const pos = sel[0].active
    const range = getFullRow(editor.document, pos.line)
    editor.setDecorations(deco, [range])
  }
}
