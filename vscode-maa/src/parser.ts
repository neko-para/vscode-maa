import * as vscode from 'vscode'

import { ParseResult, R1, R2 } from './types'

export function isRowBegin(row: string) {
  return /^ \[\d{4}-\d{2}-\d{2} /.test(row)
}

function offset(r: [number, number], v: number): [number, number] {
  return [r[0] + v, r[1] + v]
}

export function parseRowInfo(row: string): ParseResult | null {
  const restRange: [number, number] = [0, row.length]
  const gRe =
    /^ \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3})\]\[([A-Z]+)\]\[Px(\d+)\]\[Tx(\d+)\]\[([^\]]+)\]/d
  const gMt = gRe.exec(row)
  if (!gMt) {
    return null
  }
  const result1 = {
    date: gMt[1],
    dateRange: gMt.indices![1],
    category: gMt[2],
    categoryRange: gMt.indices![2],
    pid: gMt[3],
    pidRange: gMt.indices![3],
    tid: gMt[4],
    tidRange: gMt.indices![4],
    file: gMt[5],
    fileRange: gMt.indices![5]
  }
  row = row.slice(gMt[0].length)
  restRange[0] = restRange[0] + gMt[0].length
  const fRe = /^\[L(\d+)\]\[([^\]]+)\]/d
  const fMt = fRe.exec(row)
  if (!fMt) {
    return {
      has1: true,
      ...result1,

      rest: row,
      restRange
    }
  }
  const result2 = {
    line: fMt[1],
    lineRange: offset(fMt.indices![1], restRange[0]),
    func: fMt[2],
    funcRange: offset(fMt.indices![2], restRange[0])
  }
  row = row.slice(fMt[0].length)
  restRange[0] = restRange[0] + fMt[0].length
  return {
    has1: true,
    has2: true,
    ...result1,
    ...result2,

    rest: row,
    restRange
  }
}
