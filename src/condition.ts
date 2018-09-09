import { Utils } from './utils'

export class Condition<T> {
  _sql: string[] = []

  descriptor: {}

  constructor(descriptor: {}) {
    this.descriptor = descriptor
  }

  equals(p: { [key in keyof Partial<T>]: any }) {
    Object.keys(p).map(k => {
      this._sql.push(`${k} = ${Utils.asValue((p as any)[k])}`)
    })
    return this
  }

  in(p: { [key in keyof Partial<T>]: any[] }) {
    Object.keys(p).map(k => {
      this._sql.push(
        `${k} IN (${(p as any)[k]
          .map((v: any) => Utils.asValue(v))
          .join(', ')})`
      )
    })
    return this
  }

  between(p: { [key in keyof Partial<T>]: any[] }) {
    Object.keys(p).map(k => {
      const val = (p as any)[k]
      this._sql.push(
        `${k} BETWEEN ${Utils.asValue(val[0])} AND ${Utils.asValue(val[1])}`
      )
    })
    return this
  }

  get or() {
    this._sql.push('OR')
    return this
  }

  group(fn: (c: Condition<T>) => any) {
    this._sql.push('(')
    fn(this)
    this._sql.push(')')
    return this
  }

  field(fn: (k: T) => void) {
    return 'field:' + fn.apply(this, [this.descriptor])
  }

  sql() {
    const sql = []
    let idx = 0
    for (const s of this._sql) {
      sql.push(s)
      if (idx < this._sql.length - 1) {
        const next = this._sql[idx + 1]
        if (
          s !== 'OR' &&
          s !== '(' &&
          // s !== ')' &&
          (next !== ')' && next !== 'OR')
        ) {
          sql.push('AND')
        }
      }

      idx++
    }
    return sql.join(' ')
  }
}

type ValueOf<T> = T[keyof T]
export type ConditionCallback<T> = (
  condition: Condition<ValueOf<T>>
) => Condition<ValueOf<T>>

export type ConditionCallbackPure<T> = (
  condition: Condition<T>
) => Condition<T>
