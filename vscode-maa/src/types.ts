export type OffsetRange = [number, number]

export type ValAndRange<K extends string> = {
  [key in K]: string
} & {
  [key in `${K}Range`]: OffsetRange
}

export type ValAndRanges<K extends string[], T extends Record<string, unknown> = {}> = K extends [
  infer First,
  ...infer Rest
]
  ? First extends string
    ? Rest extends string[]
      ? ValAndRanges<Rest, T & ValAndRange<First>>
      : never
    : never
  : T

export type R1 = ValAndRanges<['date', 'category', 'pid', 'tid', 'file']>
export type R2 = ValAndRanges<['line', 'func']>

export type ParseResult = ValAndRange<'rest'> &
  (
    | ({
        has1: true
        has2?: never
      } & R1)
    | ({
        has1: true
        has2: true
      } & R1 &
        R2)
  )
