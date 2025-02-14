<div align="center">
  <picture>
      <img src="./assets/images/lynxDB-logo-text.svg" alt="Logo LynxDB" width="auto" height="200px">
  </picture>
  <p align="center">
  <a href="https://codecov.io/gh/William-148/lynxDB">
    <img src="https://codecov.io/gh/William-148/lynxDB/graph/badge.svg?token=YD82TVS9R2" alt="Codecov Badge" />
  </a>
</p>

</div>

## Content

- [Introduction](#lynxdb---in-memory-database-for-fast-testing)
- [Quick Start](#quick-start)
  - [Installation](#installation)
  - [Example](#example)
- [Primary key Handling](#primary-key-handling)
- [Database Operations](#database-operations)
- [Operators](#operators)
- [Transactions](#transactions)
  - [Creating and Using Transactions](#creating-and-using-transactions)
  - [Configuration](#configuration)
  - [Isolation Levels](#isolation-levels)
  - [Locks](#locks)
  - [Phenomena occurrence](#phenomena-occurrence)

## **LynxDB - In-Memory Database for Fast Testing**

`LynxDB` is a lightweight, in-memory database designed specifically for fast testing in applications. Although it can be used with both JavaScript and TypeScript, it is recommended to use it with TypeScript to fully leverage its typing features. Its primary focus is to support tool testing and experimentation with various technologies, providing an easy-to-configure and quick-to-prepare database solution for in-memory data testing without the complexity of managing full-fledged relational databases.

### Key Features:
- **In-Memory Storage**: All data is stored in memory, offering extremely fast read and write operations, perfect for testing scenarios.
- **Quick Setup**: Easily configure databases without the complexity of traditional database setup and management.
- **Support for Simple and Composite Primary Keys**: `LynxDB` allows you to define both simple and composite primary keys, enabling flexibility for complex data structures.
- **Transaction Support**: Fully supports transactions with two configurable isolation levels.
- **Fast and Lightweight**: Built for speed and efficiency, `LynxDB` is perfect for testing environments where rapid data manipulation and retrieval are essential.

`LynxDB` is the perfect choice for developers who need a fast, easy-to-use, and flexible in-memory database to simulate more complex database interactions during testing without the overhead of setting up a full database system.

# Quick Start

Welcome to `LynxDB`, the in-memory database built for fast testing in JavaScript and TypeScript environments. This quick start guide will help you install the package and perform basic operations to get you up and running in no time.

## Installation

Install the `LynxDB` package using npm (or pnpm):

```bash
  npm install lynxdb
```

Or, if you prefer pnpm:
```bash
  pnpm install lynxdb
```


## Example
For more, see the following [examples](examples.md).

Below is a minimal example demonstrating how to define tables, create a `LynxDB` instance, and perform basic operations:
```typescript
import { LynxDB, TablesDefinition } from "lynxdb";

// Types of data that the tables will store
type User = { id: number; name: string; email: string; }
type Post = { id: number; title: string; content: string; ownerId: number; }

// Type that lists all tables in the database
type MyTables = {
  users: User,
  post: Post
  // More tables...
}

// Define the configurations for the tables
const tableConfigs: TablesDefinition<MyTables> = {
  users: {
    primaryKey: ["id"]
  },
  post: {
    primaryKey: ["id"]
  }
  // More tables configuration...
};

// Create LynxDb instance
const db = new LynxDB(tableConfigs);

// Getting tables
const users = db.get("users");
const posts = db.get("post");

// Perform operations
users.insert({ 
  id: 1 , 
  name: "Jhon Smith", 
  email: "some@domain.com" 
});

posts.insert({ 
  id: 1, 
  title: "First Post", 
  content: "This is the first post", 
  ownerId: 1 
});
```

# Primary Key Handling

`LynxDB` uses primary keys to uniquely identify records in a table. There are two types of primary keys that you can define:

## Simple Primary Key

A simple primary key consists of a single field. For example, in the `users` table, you can define a simple primary key like this:

```typescript
const tableConfigs: TablesDefinition<{ users: User }> = {
  users: {
    primaryKey: ["id"]
  }
};
```

## Composite Primary Key
A composite primary key is made up of multiple fields that together uniquely identify a record. For example, in the "order details" table, you can define a composite primary key like this:
```typescript 
type OrderDetail = {
  orderId: number,
  productId: number,
  quantity: number,
  price: number
}

const tableConfigs: TablesDefinition<{ orderDetails: OrderDetail }> = {
  orderDetails: {
    primaryKey: ["orderId", "productId"]
  }
};
```

## Default Primary Key
If you do not define a primary key in the table configuration, `LynxDB` automatically assigns one by using the `_id` field. This ensures that every record has a unique identifier even when a primary key is not explicitly specified.

You can define a default primary key like this:
```typescript 
type Person = {
  name: string;
  age: string;
}

const tableConfigs: TablesDefinition<{ persons: Person }> = {
  persons: {
    primaryKey: [] // Without a PK defined
  }
};
```

# Database Operations
Once the database instance is created, you can retrieve tables and perform various operations. See [examples](examples.md#database-operations).

### Database operations:
| Operation |              Description             |
| ------------------ | ------------------------------------ |
| `reset`            | Deletes all records from all tables. |


### Table operations:
| Operation| Description                                                                                         |
|--------------|-----------------------------------------------------------------------------------------------------|
| `insert`     | Inserts a single record into a table and returns the newly inserted record.                         |
| `bulkInsert` | Inserts multiple records into a table at once.                                                      |
| `findByPk`   | Returns a record using its primary key. Returns `null` if not found.                                |
| `findOne`    | Returns the first record that satisfies the query criteria. Returns `null` if not found.            |
| `select`     | Selects records from a table. Supports filtering via a where clause and field selection.            |
| `update`     | Updates fields in records that match the specified conditions. Returns the number of affected rows. |
| `deleteByPk` | Deletes a record using its primary key and returns the deleted record (or `null` if not found).     |


# Operators
When performing select or update operations, you can use a where clause to filter records. The where clause supports several comparison operators and logical operators.

## Comparison Opeartors
| Operator       | Description                                           | Example                        |
|----------------| ------------------------------------------------------|--------------------------------|
| **`$eq`**      | Equal to                                              | `{ id: { $eq: 1 } }`           |
| **`$ne`**      | Not equal to                                          | `{ id: { $ne: 1 } }`           |
| **`$gt`**      | Greater than                                          | `{ id: { $gt: 8 } }`           |
| **`$gte`**     | Greater than or equal to                              | `{ id: { $gte: 8 } }`          |
| **`$lt`**      | Less than                                             | `{ id: { $lt: 100 } }`         |
| **`$lte`**     | Less than or equal to                                 | `{ id: { $lte: 100 } }`        |
| **`$in`**      | Checks if the field value is included in an array     | `{ id: { $in: [1, 2, 3] } }`   |
| **`$nin`**     | Checks if the field value is not included in an array | `{ id: { $nin: [1, 2, 3] } }`  |
| **`$like`**    | String pattern matching (e.g., wildcard search)       | `{ name: { $like: "Jhon%" } }` |

## Logical Operators
See [examples](examples.md#logical-operators) for logical operators.
| Operator   | Note                                       | Example                                 |
|------------|--------------------------------------------|-----------------------------------------|
| **`$and`** | Requires all conditions to be true         | See [example](examples.md#operator-and) |
| **`$or`**  | Requires at least one condition to be true | See [example](examples.md#operator-or)  |
| **`$not`** | Negates the specified condition            | See [example](examples.md#operator-not) |

# Transactions
`LynxDB` implements transactions using locks—both shared and exclusive—without support for MVCC. Each transaction acquires the necessary locks that are held for the entire duration of the transaction, until a commit or rollback occurs. This mechanism ensures data consistency, but it also means that transactions may become blocked if locks are not managed properly.
>**Note**:
>
> Locks have a default timeout of 5000 milliseconds. This value is configurable to suit different scenarios and workloads.

## Creating and Using Transactions
LynxDB offers two primary ways to create and use transactions: explicit transaction creation and transactional callbacks. Below are examples and explanations of both methods.

### Method 1: Explicit Transaction Creation
You can explicitly create a transaction using the `createTransaction` method and perform operations within the transaction context.

1. **Begin a Transaction**: Start by calling the `createTransaction` method on the LynxDB instance.
```typescript
import { LynxDB, TablesDefinition } from "lynxdb";

type User = { id: number; name: string; email: string; }

const tableConfigs: TablesDefinition<{ users: User }> = { 
  users: { primaryKey: ["id"] } 
};

// LynxDB instance
const db = new LynxDB(tableConfigs);
// Begin a transaction
const transaction = db.createTransaction();

```

2. **Perform Database Operations**: Inside the transaction, you can perform various database operations, see [database operations](#database-operations).
```typescript
async function transactionExample(){
  try {
    // Perform operations
    const userInserted = await transaction.get("users").insert({ 
      id: 1, 
      name: 'John Doe', 
      email: 'john.doe@example.com' 
    });
    const updatedCount = await transaction.get("users").update(
      { email: "doe.john@domain.com" }, 
      { id: { $eq: 1 } }
    );
    // More operations...

    // Commit changes
    await transaction.commit();

    console.log("User Inserted", userInserted);
    console.log("Updated count", updatedCount);

  }catch(error){
    console.error(error);
    await transaction.rollback();
  }
}
```

### Method 2: Transactional Callbacks
LynxDB also supports transactional callbacks, where you pass a callback function to the `transaction` method. The transaction is automatically committed or rolled back based on the success or failure of the callback.

```typescript
import { LynxDB, TablesDefinition } from "lynxdb";

type User = { id: number; name: string; email: string; }

const tableConfigs: TablesDefinition<{ users: User }> = { 
  users: { primaryKey: ["id"] } 
};

// LynxDB instance
const db = new LynxDB(tableConfigs);

// Use a transactional callback
async function transactionCallbackExample(){
  try {
    const result = await db.transaction(async (t) => {

      const userInserted = await t.get("users").insert({ 
        id: 1, 
        name: 'John Doe', 
        email: 'john.doe@example.com' 
      });

      const updatedCount = await t.get("users").update(
        { email: "doe.john@domain.com" }, 
        { id: { $eq: 1 } }
      );

      // More operations...

      // You can return any value or void
      return { userInserted, updatedCount }
    });
    
    // After the transaction is completed, you can get the returned values
    console.log("User Inserted", result.userInserted);
    console.log("Updated count", result.updatedCount);
  }
  catch(error){
    console.error(error);
  }
}
```

## Configuration
When creating a `LynxDB` instance, you can configure various options to tailor how transactions are handled. Below is a table detailing the available configuration options, these options are optional:

| Option          | Description                                                                                                      | Default Value        |
|-----------------|------------------------------------------------------------------------------------------------------------------|----------------------|
| `isolationLevel` | The isolation level for transactions. Determines how concurrent transactions are managed to ensure data consistency. See supported values ​​in [Isolation Levels](#isolation-levels) | `RepeatableRead`     |
| `lockTimeout`   | The timeout for locks in milliseconds. Specifies how long a transaction should wait before a lock is released.  | `5000` (milliseconds) |

By configuring these options, you can customize `LynxDB` to fit your specific transaction handling needs.

### Global Configuration
You can configure the transaction settings globally when creating the `LynxDB` instance. This configuration will apply to all transactions created by the instance unless overridden.

```typescript
import { LynxDB, IsolationLevel, TablesDefinition } from "lynxdb";

type User = { id: number; name: string; email: string; }

const tableConfigs: TablesDefinition<{ users: User }> = {
  users: { primaryKey: ["id"] }
};

// Create an instance and configure globally
const db = new LynxDB(tableConfigs, {
  isolationLevel: IsolationLevel.Serializable,
  lockTimeout: 1000
});
```

### Per-Transaction Configuration
You can also configure transactions individually when creating a transaction or using a transactional callback. This allows you to override the global configuration for specific transactions.

#### Method 1: Using `createTransaction`
```typescript
import { LynxDB, IsolationLevel } from "lynxdb";

// LynxDB instance
const db = new LynxDB(...); 

// Configure when creating a transaction
const transaction = db.createTransaction({
  isolationLevel: IsolationLevel.Serializable,
  lockTimeout: 4000
});

try {
  const users = transaction.get("users");
  // Perform operations...

  await transaction.commit();
} catch (error) {
  console.error(error);
  await transaction.rollback();
}
```

#### Method 2: Using `transaction` with Callback
```typescript
import { LynxDB, IsolationLevel } from "lynxdb";

// LynxDB instance
const db = new LynxDB(...);

// Configure within a transactional callback
db.transaction(async (transaction) => {
    const users = transaction.get("users");
    // Perform operations...
  }, 
  {
    isolationLevel: IsolationLevel.Serializable,
    lockTimeout: 2000
  }
).then(() => {
  console.log('Transaction committed successfully.');
}).catch((error) => {
  console.error('Transaction error:', error);
});

```

## Isolation Levels

`LynxDB` offers two isolation levels for its transactions:

1. Repeatable Read
2. Serializable

These levels determine how locks behave during read and write operations, affecting the types of concurrency anomalies (phenomena) that may occur.

Below is the enum for the available isolation levels, you can use it to set up transactions:
```Typescript
import { IsolationLevel } from "lynxdb";

// Example usage Reapetable Read
IsolationLevel.RepeatableRead

// Example usage Serializable
IsolationLevel.Serializable
```


## Locks
`LynxDB` utilizes two types of locks:

* **Shared Lock**:
Allows multiple transactions to read a record simultaneously. It is used for read operations under the *Repeatable Read* level.

* **Exclusive Lock**:
Prevents other transactions from reading or writing to the locked record. It is applied to write operations and, under the *Serializable level*, even read operations acquire this type of lock to ensure stronger consistency.

The following table summarizes the locking behavior by isolation level:

| Action  | Repeatable Read | Serializable   |
|-------- | --------------- | -------------- |
| Read    | Shared Lock     | Exclusive Lock |
| Write   | Exclusive Lock  | Exclusive Lock |

> **Important**:
> * Locks are held until the transaction completes (commit or rollback).
> * This means that once acquired, locks are not released until the transaction ends, which can affect concurrency in high-load environments.

## Phenomena occurrence
Since LynxDB’s transaction implementation relies solely on locks (without MVCC), the occurrence of certain phenomena varies depending on the isolation level: 

| Phenomena           | Repeatable Read | Serializable |
| ------------------- | --------------- | ------------ |
| Dirty Write         | No              | No           | 
| Dirty Read          | No              | No           | 
| Non-Repeatable Read | No              | No           | 
| Phantom Read        | Yes             | Yes          | 
| Read Skew           | No              | No           | 
| Write Skew          | Yes             | No           | 
| Lost Update         | Yes             | No           |

### Description of Phenomena:
* **Dirty Write**: Prevented at both isolation levels since no other process can write to a locked record.

* **Dirty Read**:
Not possible, as reads acquire locks that ensure only committed data is visible.

* **Non-Repeatable Read**:
Since locks persist for the duration of the transaction, once a row is read its value cannot change during that transaction.

* **Phantom Read**:
May occur at both isolation levels. Because `LynxDB` does not implement MVCC or range locking, new rows that match the search criteria can appear during the transaction.

* **Read Skew**:
Does not occur, as reads are protected by locks.

* **Write Skew**:
Under Repeatable Read, it is possible for two transactions to read data that, when combined, lead to an inconsistent state upon writing. This phenomenon is eliminated in the Serializable level by employing more restrictive locking.

* **Lost Update**:
Can occur in Repeatable Read if two transactions base their updates on stale data. In Serializable, using exclusive locks for both reads and writes prevents this issue.

This lock-based implementation ensures the integrity of transactional operations. However, it is important to understand the implications of the chosen isolation level and the potential phenomena in high-concurrency environments. For critical systems, it is recommended to use the *Serializable level*, even though it imposes stricter access control.
