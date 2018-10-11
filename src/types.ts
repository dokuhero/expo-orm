export type KeyVal<V = string> = { [key: string]: V }
export type ValueOf<T> = T[keyof T]

export type PrimaryKeyTypes = 'INTEGER' | 'NVARCHAR' | 'CHAR'
export type ColumnTypes = PrimaryKeyTypes | 'BOOLEAN' | 'DECIMAL' | 'DATETIME' | 'MONEY'

export interface TableClass<T> extends Function {
  new (): T
}

export interface ColumnInfo {
  type: ColumnTypes
  size: number
}
