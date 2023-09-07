import * as vscode from 'vscode'

export const LanguageLegend = new vscode.SemanticTokensLegend(
  ['namespace', 'decorator', 'comment', 'number'],
  []
)

export class LanguageServer implements vscode.DocumentSemanticTokensProvider {
  onDidChangeSemanticTokens?: vscode.Event<void> | undefined
  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(LanguageLegend)

    const file = document.getText()
    const rows = file.split(/\n(?= \[\d{4}-\d{2}-\d{2})/)

    const re =
      /^ \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3})\]\[([A-Z]+)\]\[Px(\d+)\]\[Tx(\d+)\]\[([^\]]+)\]/d

    let curRow = 0
    console.log(rows)

    const push = (v: [number, number], t: string) => {
      tokensBuilder.push(
        new vscode.Range(new vscode.Position(curRow, v[0]), new vscode.Position(curRow, v[1])),
        t
      )
    }

    for (const row of rows) {
      const m = re.exec(row) as RegExpMatchArray & { indices: Array<[number, number]> }
      if (!m) {
        continue
      }
      push(m.indices[1], 'comment')
      push(m.indices[2], 'decorator')
      push(m.indices[3], 'number')
      push(m.indices[4], 'number')
      push(m.indices[5], 'namespace')
      curRow += 1 + row.split('').filter(x => x === '\n').length
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
}
