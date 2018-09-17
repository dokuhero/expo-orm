import { Debug } from '@dokuhero/debug'
import { SQLite } from 'expo'
import 'reflect-metadata'
import { Condition, ConditionCallbackPure } from './condition'
import { Db } from './db'
import { Utils } from './utils'
import { ValueOf, TableClass, ColumnInfo } from './types'
import { COLUMN_META_KEY } from './column'
import { PRIMARY_META_KEY } from './primary'

const debug = Debug('@dokuhero/expo-orm:table')

export class Table<M, T extends TableClass<M>> {
  properties: string[]
  name: string
  table: M
  descriptor = {}
  db: Db<T>
  columns: { [key: string]: { primary: boolean } & ColumnInfo } = {}

  constructor(table: T, db: Db<T>) {
    this.table = new table()
    this.db = db
    this.name = table.name
    this.properties = Object.getOwnPropertyNames(this.table)
    this.properties.forEach(k => ((this.descriptor as any)[k] = k))
  }

  exec(sql: string): Promise<SQLite.ResultSet> {
    debug('SQL EXEC:', sql)
    return this.db.trx(async ({ exec }) => {
      return exec(sql)
    })
  }

  single(sql: string): Promise<M> {
    debug('SQL SINGLE:', sql)
    return this.db.trx<M>(async ({ single }) => {
      return single<M>(sql)
    })
  }

  query(sql: string): Promise<M> {
    debug('SQL QUERY:', sql)
    return this.db.trx<M>(async ({ query }) => {
      return query<M>(sql)
    })
  }

  createTable() {
    const { name, properties, table } = this

    const columns = properties
      .map(key => {
        let primary = false
        let column = Reflect.getMetadata(
          COLUMN_META_KEY,
          table,
          key
        ) as ColumnInfo

        if (!column) {
          column = Reflect.getMetadata(
            PRIMARY_META_KEY,
            table,
            key
          ) as ColumnInfo
          primary = true
        }

        if (!column) {
          return false
        }

        this.columns[key] = {
          primary,
          ...column
        }

        const colType = Utils.getRealColumnType(column)
        const colSize = column.size ? `(${column.size})` : ''
        const colPrimary = primary ? ' PRIMARY KEY' : ''

        return `${key} ${colType}${colSize}${colPrimary}`
      })
      .filter(x => x !== false)

    const sql = `CREATE TABLE IF NOT EXISTS ${name} (${columns.join(', ')})`
    return this.exec(sql)
  }

  dropTable() {
    return this.exec(`DROP TABLE IF EXISTS ${this.name}`)
  }

  insert(set: Partial<M> & Partial<ValueOf<T>>, upsert?: boolean) {
    const fields = []
    const values = []

    for (const key of Object.keys(set)) {
      fields.push(key)

      values.push(
        Utils.asValue(this.columns[key].type, (set as any)[key] as string)
      )
    }

    const sqlUpsert = upsert ? ' OR REPLACE' : ''
    const sql = `INSERT${sqlUpsert} INTO ${
      this.name
    } (${fields}) VALUES (${values})`
    return this.exec(sql)
  }

  upsert(set: Partial<M> & Partial<ValueOf<T>>) {
    return this.insert(set, true)
  }

  select(
    condition?: ConditionCallbackPure<M>,
    fields?: ((k: ValueOf<T>) => void) | '*',
    order?: { [P in keyof ValueOf<T>]?: 'ASC' | 'DESC' }
  ) {
    return this.query(this._selectSql(condition, fields, order))
  }

  selectOne(
    condition?: ConditionCallbackPure<M>,
    fields?: ((k: ValueOf<T>) => void) | '*',
    order?: { [P in keyof ValueOf<T>]?: 'ASC' | 'DESC' }
  ) {
    return this.single(this._selectSql(condition, fields, order) + ' LIMIT 1')
  }

  update(
    set: { [P in keyof ValueOf<T>]?: any } & { [P in keyof M]?: any },
    condition?: ConditionCallbackPure<M>
  ) {
    let sql = `UPDATE ${this.name} SET ${Object.keys(set)
      .map(
        k => `${k} = ${Utils.asValue(this.columns[k].type, (set as any)[k])}`
      )
      .join(', ')}`

    if (condition) {
      sql += ` WHERE ${this._condSql(condition)}`
    }

    return this.exec(sql)
  }

  delete(condition: ConditionCallbackPure<M>) {
    return this.exec(
      `DELETE FROM ${this.name} WHERE ${this._condSql(condition)}`
    )
  }

  private _selectSql(
    condition?: ConditionCallbackPure<M>,
    fields?: ((k: ValueOf<T>) => void) | '*',
    order?: { [P in keyof ValueOf<T>]?: 'ASC' | 'DESC' }
  ) {
    const { name } = this
    let flds: string = '*'

    if (fields) {
      if (typeof fields === 'string') {
        flds = fields
      } else {
        flds = this._select(fields)
      }
    }

    let sql = `SELECT ${flds} FROM ${name}`
    if (condition) {
      sql += ` WHERE ${this._condSql(condition)}`
    }

    if (order) {
      sql +=
        ' ORDER BY ' +
        Object.keys(order)
          .map(k => `${k} ${(order as any)[k]}`)
          .join(' ')
    }

    return sql
  }

  private _select(fn: (k: ValueOf<T>) => void) {
    return fn.call(this, this.descriptor)
  }

  private _condSql(fn: ConditionCallbackPure<M>) {
    return fn(new Condition(this.descriptor, this.columns)).sql()
  }
}
