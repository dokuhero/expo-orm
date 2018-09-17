import { Debug } from '@dokuhero/debug'
import {
  Constants,
  DocumentPicker,
  FileSystem,
  MailComposer,
  SQLite,
  Util
} from 'expo'
import { Table } from './table'
import { DbTransaction } from './transaction'
import { Utils } from './utils'
import { KeyVal, ValueOf, TableClass } from './types'

const debug = Debug('@dokuhero/expo-orm:db')

export interface DbConfig<TModels> {
  database: string
  entities: TModels
}

export class Db<T> {
  /**
   * Create new database instance.
   * @param config Database Configuration
   */
  static async init<TModels>(config: DbConfig<TModels>): Promise<Db<TModels>> {
    const _db = new Db<TModels>()

    _db.config = config

    try {
      _db.sqliteDb = SQLite.openDatabase(config.database)
      const tables: KeyVal<any> = {}

      for (const key of Object.keys(config.entities)) {
        const cls = config.entities as any
        const table = new Table(cls[key] as any, _db)
        tables[key] = table
        await table.createTable()
      }
      _db.tables = tables as any

      return _db
    } catch (error) {
      debug('Database connection error: ', error)
      throw new Error(error)
    }
  }

  config!: DbConfig<T>
  sqliteDb!: SQLite.Database
  tables!: { [P in keyof T]: Table<ValueOf<T[P]>, TableClass<ValueOf<T[P]>>> }

  trx<S = any>(
    callback: (
      transaction: DbTransaction,
      tables: {
        [P in keyof T]: Table<ValueOf<T[P]>, TableClass<ValueOf<T[P]>>>
      }
    ) => any
  ): Promise<S> {
    return new Promise<S>((resolve, reject) => {
      let result: any
      this.sqliteDb.transaction(
        tx => {
          result = callback(new DbTransaction(tx), this.tables)
        },
        reject,
        () => {
          resolve(result)
        }
      )
    })
  }

  async backup(callback: (state: 'sending-email' | 'sent' | 'cancel') => void) {
    // TODO: next release
    // await this.backupItemImages()

    const fileUri = this.getFileUri()
    const val = await FileSystem.getInfoAsync(fileUri)
    if (!val.exists) {
      throw new Error(`Can not find database file: ${fileUri}.`)
    }

    const now = new Date()
    const timestamp = Utils.timeStamp(now)
    const { name } = Constants.manifest

    const targetUri = `${FileSystem.cacheDirectory}backup/${name
      .replace(/\s/g, '-')
      .toLowerCase()}-${timestamp}.db`
    await FileSystem.copyAsync({
      from: fileUri,
      to: targetUri
    })

    callback('sending-email')

    const res = await MailComposer.composeAsync({
      attachments: [targetUri],
      body: `${name} backup data`,
      subject: `${name} backup data ${now.toISOString()}`
    })

    if (res.status === 'sent') {
      callback('sent')
    } else {
      callback('cancel')
    }
  }

  async restore(): Promise<boolean> {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*'
      })

      if (res.type === 'success') {
        await FileSystem.copyAsync({
          // @ts-ignore
          from: res.uri,
          to: this.getFileUri()
        })

        // TODO: next release
        // await this.restoreImages()
        Util.reload()
        return true
      }

      return false
    } catch (error) {
      throw error
    }
  }

  getFileUri() {
    return `${FileSystem.documentDirectory}SQLite/${this.config.database}`
  }
}
