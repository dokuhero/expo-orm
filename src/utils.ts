import { ColumnInfo, ColumnTypes } from './types'

export class Utils {
  static getRealColumnType(info: ColumnInfo) {
    const colSize = info.size ? `(${info.size})` : ``

    switch (info.type) {
      case 'BOOLEAN':
        return `BOOLEAN NOT NULL CHECK (%s IN (0,1))`
      case 'DATETIME':
        return `INTEGER`
      default:
        return `${info.type}${colSize}`
    }
  }

  static asValue(colType: ColumnTypes, v: any) {

    switch (colType) {
      case 'DATETIME':
        return this.strftime(v)
    }

    switch (typeof v) {
      case 'string':
        if (v.startsWith('field:')) {
          return v.substr(6)
        }
        return `'${v}'`

      case 'undefined':
        return 'null'

      case 'boolean':
        return v === true ? '1' : '0'
    }

    if (v === null) {
      return 'null'
    }

    return v
  }

  static timeStamp(date: Date) {
    return date
      .toISOString()
      .slice(0, 19)
      .replace(/\-/g, '')
      .replace(/\:/g, '')
      .replace('T', '-')
  }

  static strftime(date: Date) {
    return `strftime('%s', '${this.formatSimpleISODate(date)}')`
  }

  static formatSimpleISODate(date: Date) {
    return `${date.getFullYear()}-${this.padStart(
      date.getMonth() + 1,
      2
    )}-${this.padStart(date.getDate(), 2)} ${this.padStart(
      date.getHours(),
      2
    )}:${this.padStart(date.getMinutes(), 2)}:${this.padStart(
      date.getSeconds(),
      2
    )}`
  }

  static padStart(
    str: any,
    targetLength: number,
    padString: string = '0'
  ): string {
    str = str.toString()
    padString = String(typeof padString !== 'undefined' ? padString : ' ')
    if (str.length > targetLength) {
      return str
    } else {
      targetLength = targetLength - str.length
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length)
      }
      return padString.slice(0, targetLength) + str
    }
  }

  static dateParse(str: string): Date {
    const parts = str.split(' ')
    const dates = parts[0].split('-').map(d => parseInt(d, 0))
    const times = parts[1].split(':').map(d => parseInt(d, 0))

    return new Date(
      dates[0],
      dates[1] - 1,
      dates[2],
      times[0],
      times[1],
      times[2]
    )
  }
}
