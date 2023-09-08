"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const language_1 = require("./language");
function activate(context) {
    // let disposable = vscode.commands.registerCommand('vscode-maa.helloWorld', () => {
    //   vscode.window.showInformationMessage('Hello World from vscode-maa!')
    // })
    // context.subscriptions.push(disposable)
    const documentSelector = [{ scheme: 'file', language: 'maalog' }];
    const lsp = new language_1.LanguageServer();
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(documentSelector, lsp, language_1.LanguageLegend));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor === vscode.window.activeTextEditor &&
            event.textEditor.document.languageId === 'maalog') {
            lsp.onChangeSelection(event.textEditor, event.selections);
        }
    }));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(documentSelector, lsp));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map