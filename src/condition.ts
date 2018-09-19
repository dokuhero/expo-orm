import { Utils } from './utils'
import { ColumnInfo } from './types'

export class Condition<T> {
  _sql: string[] = []

  descriptor: {}
  columns: { [key: string]: { primary: boolean } & ColumnInfo } = {}

  constructor(
    descriptor: {},
    columns: { [key: string]: { primary: boolean } & ColumnInfo }
  ) {
    this.descriptor = descriptor
    this.columns = columns
  }

  equals(p: { [key in keyof Partial<T>]: any }) {
    Object.keys(p).map(k => {
      this._sql.push(
        `${Utils.quote(k)} = ${Utils.asValue(
          this.columns[k].type,
          (p as any)[k]
        )}`
      )
    })
    return this
  }

  in(p: { [key in keyof Partial<T>]: any[] }) {
    Object.keys(p).map(k => {
      this._sql.push(
        `${Utils.quote(k)} IN (${(p as any)[k]
          .map((v: any) => Utils.asValue(this.columns[k].type, v))
          .join(', ')})`
      )
    })
    return this
  }

  between(p: { [key in keyof Partial<T>]: any[] }) {
    Object.keys(p).map(k => {
      const val = (p as any)[k]
      const colType = this.columns[k].type
      this._sql.push(
        `${Utils.quote(k)} BETWEEN ${Utils.asValue(
          colType,
          val[0]
        )} AND ${Utils.asValue(colType, val[1])}`
      )
    })
    return this
  }

  contains(p: { [key in keyof Partial<T>]: string }) {
    Object.keys(p).map(k => {
      this._sql.push(`${Utils.quote(k)} LIKE ${(p as any)[k]}`)
    })
    return this
  }

  startsWith(p: { [key in keyof Partial<T>]: string }) {
    Object.keys(p).map(k => {
      this._sql.push(`${Utils.quote(k)} LIKE ${(p as any)[k]}%`)
    })
    return this
  }

  endsWith(p: { [key in keyof Partial<T>]: string }) {
    Object.keys(p).map(k => {
      this._sql.push(`${Utils.quote(k)} LIKE %${(p as any)[k]}`)
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

export type ConditionCallbackPure<T> = (condition: Condition<T>) => Condition<T>
