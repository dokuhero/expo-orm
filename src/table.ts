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

  constructor(table: T, name: string, db: Db<T>) {
    this.table = new table()
    this.db = db
    this.name = name
    this.properties = Object.getOwnPropertyNames(this.table)
    this.properties.forEach(k => ((this.descriptor as any)[k] = k))
    this._mapResult = this._mapResult.bind(this)
  }

  exec(sql: string): Promise<SQLite.ResultSet> {
    debug('SQL EXEC:', sql)
    return this.db.trx(async ({ exec }) => {
      return exec(sql)
    })
  }

  single<TResult = M>(sql: string): Promise<TResult> {
    debug('SQL SINGLE:', sql)
    return this.db.trx<TResult>(async ({ single }) => {
      return new Promise(resolve => {
        single<TResult>(sql).then(data => {
          resolve(this._mapResult(data))
        })
      })
    })
  }

  query<TResult = M>(sql: string): Promise<TResult[]> {
    debug('SQL QUERY:', sql)
    return this.db.trx<TResult[]>(async ({ query }) => {
      return new Promise(resolve => {
        query<TResult[]>(sql).then(data => {
          resolve(data.map(this._mapResult))
        })
      })
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

        const colType = Utils.getRealColumnType(key, column)
        const colPrimary = primary ? ' PRIMARY KEY' : ''

        return `${Utils.quote(key)} ${colType}${colPrimary}`
      })
      .filter(x => x !== false)

    const sql = `CREATE TABLE IF NOT EXISTS ${Utils.quote(
      name
    )} (${columns.join(', ')})`
    return this.exec(sql)
  }

  async buildBackupSql() {
    const { name, properties, table } = this

    const columns = properties
      .map(key => {
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
        }

        if (!column) {
          return false
        }

        return Utils.quote(key)
      })
      .filter(x => x !== false)

    const cols = columns.join(', ')
    const tbl = Utils.quote(name)

    // const res = await this.exec(`SELECT ${cols} FROM ${tbl}`)
    const values: any[] = await this.db.trx(async ({ query }) => {
      return new Promise(resolve => {
        query(`SELECT ${cols} FROM ${tbl}`).then(data => {
          resolve(data)
        })
      })
    })

    if (!values || !values.length) {
      return ''
    }

    const sql = `INSERT INTO ${tbl} (${cols}) VALUES ${values
      .map(value => {
        return (
          '(' +
          Object.keys(value)
            .map(col => Utils.asRawValue(this.columns[col].type, value[col]))
            .join(',') +
          ')'
        )
      })
      .join(',')}`
    return sql + ';'
  }

  dropTable() {
    return this.exec(`DROP TABLE IF EXISTS ${Utils.quote(this.name)}`)
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
    const sql = `INSERT${sqlUpsert} INTO ${Utils.quote(
      this.name
    )} (${fields.map(Utils.quote)}) VALUES (${values})`
    return this.exec(sql)
  }

  insertMany(sets: (Partial<M> & Partial<ValueOf<T>>)[]) {
    if (!sets.length) {
      return
    }

    const fields: string[] = []
    const set: any = sets.shift()
    const selectVal = []
    for (const key of Object.keys(set)) {
      fields.push(key)
      selectVal.push(
        Utils.asValue(this.columns[key].type, (set as any)[key] as string) +
          ' AS ' +
          Utils.quote(key)
      )
    }

    const unions = sets.map(s => {
      return `UNION ALL SELECT ${fields.map(k =>
        Utils.asValue(this.columns[k].type, s[k])
      )}`
    })

    const sql = `INSERT INTO ${Utils.quote(this.name)} (${fields.map(
      Utils.quote
    )}) SELECT ${selectVal} ${unions.join(' ')}`
    return this.exec(sql)
  }

  upsert(set: Partial<M> & Partial<ValueOf<T>>) {
    return this.insert(set, true)
  }

  select(
    condition?: ConditionCallbackPure<M>,
    fields?: ((k: M) => void) | '*',
    order?: { [P in keyof M]?: 'ASC' | 'DESC' }
  ) {
    return this.query(this._selectSql(condition, fields, order))
  }

  selectOne(
    condition?: ConditionCallbackPure<M>,
    fields?: ((k: M) => void) | '*',
    order?: { [P in keyof M]?: 'ASC' | 'DESC' }
  ) {
    return this.single(this._selectSql(condition, fields, order) + ' LIMIT 1')
  }

  async count(condition?: ConditionCallbackPure<M>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${Utils.quote(this.name)}`
    if (condition) {
      sql += ` WHERE ${this._condSql(condition)}`
    }

    return (await this.single<any>(sql)).count
  }

  async any(condition?: ConditionCallbackPure<M>): Promise<boolean> {
    return (await this.count(condition)) > 0
  }

  update(
    set: { [P in keyof ValueOf<T>]?: any } & { [P in keyof M]?: any },
    condition?: ConditionCallbackPure<M>
  ) {
    let sql = `UPDATE ${Utils.quote(this.name)} SET ${Object.keys(set)
      .map(
        k =>
          `${Utils.quote(k)} = ${Utils.asValue(
            this.columns[k].type,
            (set as any)[k]
          )}`
      )
      .join(', ')}`

    if (condition) {
      sql += ` WHERE ${this._condSql(condition)}`
    }

    return this.exec(sql)
  }

  delete(condition: ConditionCallbackPure<M>) {
    return this.exec(
      `DELETE FROM ${Utils.quote(this.name)} WHERE ${this._condSql(condition)}`
    )
  }

  private _selectSql(
    condition?: ConditionCallbackPure<M>,
    fields?: ((k: M) => void) | '*',
    order?: { [P in keyof M]?: 'ASC' | 'DESC' }
  ) {
    const { name } = this
    let flds: string

    if (!fields || fields === '*') {
      flds = this._mapSelectFields(Object.keys(this.columns))
    } else {
      flds = this._select(fields)
    }

    let sql = `SELECT ${flds} FROM ${Utils.quote(name)}`
    if (condition) {
      sql += ` WHERE ${this._condSql(condition)}`
    }

    if (order) {
      sql +=
        ' ORDER BY ' +
        Object.keys(order)
          .map(k => `${Utils.quote(k)} ${(order as any)[k]}`)
          .join(' ')
    }

    return sql
  }

  private _select(fn: (k: M) => void) {
    const result = fn.call(this, this.descriptor)

    const fields: string[] =
      result instanceof Array ? result : result.split(',')
    return this._mapSelectFields(fields)
  }

  private _mapSelectFields(fields: string[]) {
    const selected: string[] = []

    fields.forEach(k => {
      selected.push(this._mapSelectField(k))
    })
    return selected.join(',')
  }

  private _mapSelectField(k: string) {
    const field = Utils.quote(k)
    if (this.columns[k].type === 'DATETIME') {
      return Utils.selectAsDate(field)
    }

    return field
  }

  private _condSql(fn: ConditionCallbackPure<M>) {
    return fn(new Condition(this.descriptor, this.columns)).sql()
  }

  private _mapResult<T = M>(d: T) {
    if (!d) {
      return undefined
    }

    const obj = {}
    Object.keys(d).forEach(k => {
      if (this.columns[k]) {
        obj[k] = Utils.asResult(this.columns[k].type, d[k] as any)
      } else {
        obj[k] = d[k]
      }
    })
    return obj
  }
}
