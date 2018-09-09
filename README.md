# Expo ORM

SQLite ORM for Typescript works in Expo

## Installation

Using npm:

```
npm i -S @dokuhero/expo-orm
```

or yarn:

```
yarn add @dokuhero/expo-orm
```

## Usage

For the best practice, is by using a repository pattern. That you will have two directories called **models** and **repository**.
A **models** directory will contains all models that represents all tables you have in your SQLite database
and **repository** contains the repository class you'll use to interact with the models.

Here's the example of the folder structure:

```
+-- models
|   +-- index.ts
|   +-- Settings.ts
|   +-- User.ts
+-- repository
|   +-- index.ts
```

### Create Model Classes

```javascript
// models/Settings.ts

import { Column, Primary } from '@dokuhero/expo-orm'

export class Settings {
  @Primary()
  id: number = 0

  @Column('NVARCHAR')
  theme: string = ''
}
```

```javascript
// models/User.ts

import { Column, Primary } from '@dokuhero/expo-orm'

export class User {
  @Primary()
  id: number = 0

  @Column('NVARCHAR')
  name: string = ''
}
```

Now export all your models in your `models/index.ts`. So everytime you add new model, you need to export it again trough `models/index.ts`.
This is for convenience use when accessing models later on in **repository**.

```javascript
// models/index.ts

export { User } from './User'
export { Settings } from './Settings'
```

### Create Repository Class

```javascript
// repository/index.ts

import * as models from '../models'
import { Db } from '@dokuhero/expo-orm'

// Now you have all your models types
type Models = typeof models

export class Repo {
  // Define database instance
  static db: Db<Models>

  // This action will create tables based on models
  // in your SQLite database if it's not exists yet.
  // Call this only once on your start-up project
  static async init() {
    this.db = await Db.init({
      database: 'name-of-database',
      entities: models
    })
  }

  // Now you're ready to interact with all models you have.
  // For example:

  static async getSettings(): Promise<models.Setting> {
    return await this.db.tables.Settings.selectOne()
  }

  static async updateSettings(value: Partial<models.Setting>) {
    const settings = (await this.getSettings()) || { id: 1 }
    await this.db.tables.Settings.upsert({ ...settings, ...value })
  }

  // And so on...
}
```

## License

MIT
