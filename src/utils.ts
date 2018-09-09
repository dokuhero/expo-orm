export class Utils {
  static asValue(v: any) {
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
}
