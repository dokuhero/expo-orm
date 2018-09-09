import { SQLite } from 'expo'
type HashMap<T> = { [key: string]: T }

export interface SqlRows<T = any> {
  length: number
  item: (index: number) => T
  _array: Array<HashMap<T>>
}

export class DbTransaction {
  trx: SQLite.Transaction
  constructor(transaction: SQLite.Transaction) {
    this.trx = transaction
    this.exec = this.exec.bind(this)
    this.query = this.query.bind(this)
    this.single = this.single.bind(this)
  }

  exec(sql: string): Promise<SQLite.ResultSet> {
    return new Promise((resolve, reject) => {
      this.trx.executeSql(
        sql,
        undefined,
        (_, result) => {
          this.trx = _
          resolve(result)
        },
        (_, error) => {
          reject(error)
        }
      )
    })
  }

  query<T = any>(sql: string): Promise<Array<HashMap<T>>> {
    return new Promise<Array<HashMap<T>>>((resolve, reject) => {
      this.trx.executeSql(
        sql,
        [],
        (_, { rows }) => {
          resolve(rows._array)
        },
        reject
      )
    })
  }

  single<T = any>(sql: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.trx.executeSql(
        sql,
        [],
        (_, { rows }) => {
          resolve(rows.length ? rows.item(0) : undefined)
        },
        reject
      )
    })
  }
}
