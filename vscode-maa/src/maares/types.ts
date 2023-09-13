export type ResourceRootEntry = {
  type: 'root'
  root: string
  base: boolean
  json: ResourceJsonRootEntry
}

export type ResourceJsonRootEntry = {
  type: 'json.root'
  files: ResourceJsonFileEntry[]
}

export type ResourceJsonFileEntry = {
  type: 'json.file'
  file: string
  symbols: ResourceJsonSymbolEntry[]
}

export type ResourceJsonSymbolEntry = {
  type: 'json.symbol'
  file: string
  line: number
  symbol: string
}

export type ResourceTreeItem =
  | ResourceRootEntry
  | ResourceJsonRootEntry
  | ResourceJsonFileEntry
  | ResourceJsonSymbolEntry
