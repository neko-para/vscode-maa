import * as fs from 'fs/promises'
import { visit } from 'jsonc-parser'
import * as path from 'path'
import * as vscode from 'vscode'

import {
  ResourceJsonFileEntry,
  ResourceJsonSymbolEntry,
  ResourceRootEntry,
  ResourceTreeItem
} from './types'

async function locateResourceRoot(under: string, prefix: string = '') {
  const root: string[] = []
  for (const file of await fs.readdir(under, { withFileTypes: true })) {
    if (file.isDirectory()) {
      root.push(
        ...(await locateResourceRoot(path.join(under, file.name), path.join(prefix, file.name)))
      )
    } else if (file.isFile()) {
      if (path.basename(file.name) === 'properties.json') {
        root.push(prefix)
      }
    }
  }
  return root
}

async function loadProperties(root: string) {
  const obj = JSON.parse(await fs.readFile(path.join(root, 'properties.json'), 'utf-8'))
  return {
    base: !!obj.is_base
  }
}

async function locateJson(under: string, prefix: string = '') {
  const files: string[] = []
  for (const file of await fs.readdir(under, { withFileTypes: true })) {
    if (file.isDirectory()) {
      files.push(...(await locateJson(path.join(under, file.name), path.join(prefix, file.name))))
    } else if (file.isFile()) {
      if (path.extname(file.name) === '.json') {
        files.push(path.join(prefix, file.name))
      }
    }
  }
  return files
}

async function loadResourceJsonEntry(file: string): Promise<ResourceJsonSymbolEntry[]> {
  const json = await fs.readFile(file, 'utf-8')
  let level = 0
  const res: ResourceJsonSymbolEntry[] = []
  visit(json, {
    onObjectBegin() {
      level += 1
    },
    onObjectEnd() {
      level -= 1
    },
    onObjectProperty(property, offset, length, startLine, startCharacter, pathSupplier) {
      if (level !== 1) {
        return
      }
      res.push({
        type: 'json.symbol',
        file,
        line: startLine,
        symbol: property
      })
    }
  })
  return res
}

async function loadResourceJsonFileEntry(root: string): Promise<ResourceJsonFileEntry[]> {
  const res: ResourceJsonFileEntry[] = []
  for (const file of await locateJson(root)) {
    res.push({
      type: 'json.file',
      file,
      symbols: await loadResourceJsonEntry(path.join(root, file))
    })
  }
  return res
}

async function loadResourceRootEntry(root: [string, string]): Promise<ResourceRootEntry> {
  return {
    type: 'root',
    root: root[1],
    base: (await loadProperties(root[0])).base,
    json: {
      type: 'json.root',
      files: await loadResourceJsonFileEntry(path.join(root[0], 'pipeline'))
    }
  }
}

class ResourceTreeProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
  getTreeItem(element: ResourceTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    switch (element.type) {
      case 'root':
        return new vscode.TreeItem(
          (element.base ? '[BASE]' : '') + element.root,
          vscode.TreeItemCollapsibleState.Expanded
        )
      case 'json.root':
        return new vscode.TreeItem('pipeline', vscode.TreeItemCollapsibleState.Expanded)
      case 'json.file':
        return new vscode.TreeItem(element.file, vscode.TreeItemCollapsibleState.Collapsed)
      case 'json.symbol': {
        const item = new vscode.TreeItem(element.symbol, vscode.TreeItemCollapsibleState.None)
        item.command = {
          title: 'reveal symbol',
          command: 'vscode.open',
          arguments: [
            vscode.Uri.file(element.file).with({
              fragment: `L${element.line + 1}`
            })
          ]
        }
        return item
      }
    }
  }
  async getChildren(element?: ResourceTreeItem | undefined): Promise<ResourceTreeItem[]> {
    if (element) {
      switch (element.type) {
        case 'root':
          return [element.json]
        case 'json.root':
          return element.files
        case 'json.file':
          return element.symbols
        case 'json.symbol':
          return []
      }
    } else {
      const roots: [string, string][] = []
      for (const root of vscode.workspace.workspaceFolders ?? []) {
        roots.push(
          ...(await locateResourceRoot(root.uri.fsPath)).map(
            p => [path.join(root.uri.fsPath, p), p] as [string, string]
          )
        )
      }
      const res: ResourceRootEntry[] = []
      for (const root of roots) {
        res.push(await loadResourceRootEntry(root))
      }
      return res
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const tree = new ResourceTreeProvider()
  context.subscriptions.push(
    vscode.window.createTreeView('maares.outline', {
      treeDataProvider: tree
    })
  )
}
