export type KeyVal<V = string> = { [key: string]: V }
export type ValueOf<T> = T[keyof T]
