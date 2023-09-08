import * as vscode from 'vscode'

import { LanguageLegend, LanguageServer } from './language'

export function activate(context: vscode.ExtensionContext) {
  // let disposable = vscode.commands.registerCommand('vscode-maa.helloWorld', () => {
  //   vscode.window.showInformationMessage('Hello World from vscode-maa!')
  // })
  // context.subscriptions.push(disposable)
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
}

export function deactivate() {}
