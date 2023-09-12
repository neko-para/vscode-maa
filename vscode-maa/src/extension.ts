import * as vscode from 'vscode'

import { LanguageLegend, LanguageServer } from './maalog/language'

export function activate(context: vscode.ExtensionContext) {
  const documentSelector = [{ scheme: 'file', language: 'maalog' }]
  const lsp = new LanguageServer()
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(documentSelector, lsp, LanguageLegend)
  )
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (
        event.textEditor === vscode.window.activeTextEditor &&
        event.textEditor.document.languageId === 'maalog'
      ) {
        lsp.onChangeSelection(event.textEditor, event.selections)
      }
    })
  )
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(documentSelector, lsp))
  context.subscriptions.push(lsp)
}

export function deactivate() {}
