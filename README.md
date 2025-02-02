# LynxDB

<div style="display: flex; align-items: center;">
<img src="./assets/images/logo.svg" alt="Logo LynxDB" style="fill: blue; width: 100px; height: 100px; margin-right: 10px;">
  <span style="font-size: 3rem">LynxDB</span>
</div>

## **LynxDB - In-Memory Database for Fast Testing**

LynxDB is a lightweight, in-memory database designed specifically for fast testing in applications built with JavaScript or TypeScript. It is ideal for developers who need a quick and efficient database solution for testing complex data models without the overhead of configuring and maintaining full-fledged relational databases.

### Key Features:
- **In-Memory Storage**: All data is stored in memory, offering extremely fast read and write operations, perfect for testing scenarios.
- **Quick Setup**: Easily configure databases without the complexity of traditional database setup and management.
- **Support for Simple and Composite Primary Keys**: LynxDB allows you to define both simple and composite primary keys, enabling flexibility for complex data structures.
- **Transaction Support**: Fully supports transactions with two configurable isolation levels.
- **Fast and Lightweight**: Built for speed and efficiency, LynxDB is perfect for testing environments where rapid data manipulation and retrieval are essential.

LynxDB is the perfect choice for developers who need a fast, easy-to-use, and flexible in-memory database to simulate more complex database interactions during testing without the overhead of setting up a full database system.

# Transactions
LynxDB implements transactions using locks—both shared and exclusive—without support for MVCC. Each transaction acquires the necessary locks that are held for the entire duration of the transaction, until a commit or rollback occurs. This mechanism ensures data consistency, but it also means that transactions may become blocked if locks are not managed properly.
> **Note**:
>
> Locks have a default timeout of 5000 milliseconds. This value is configurable to suit different scenarios and workloads.

## Isolation Levels

LynxDB offers two isolation levels for its transactions:

1. Repeatable Read
2. Serializable

These levels determine how locks behave during read and write operations, affecting the types of concurrency anomalies (phenomena) that may occur.


### Locks
LynxDB utilizes two types of locks:

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

### Phenomena occurrence
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

#### Description of Phenomena:
* **Dirty Write**: Prevented at both isolation levels since no other process can write to a locked record.

* **Dirty Read**:
Not possible, as reads acquire locks that ensure only committed data is visible.

* **Non-Repeatable Read**:
Since locks persist for the duration of the transaction, once a row is read its value cannot change during that transaction.

* **Phantom Read**:
May occur at both isolation levels. Because LynxDB does not implement MVCC or range locking, new rows that match the search criteria can appear during the transaction.

* **Read Skew**:
Does not occur, as reads are protected by locks.

* **Write Skew**:
Under Repeatable Read, it is possible for two transactions to read data that, when combined, lead to an inconsistent state upon writing. This phenomenon is eliminated in the Serializable level by employing more restrictive locking.

* **Lost Update**:
Can occur in Repeatable Read if two transactions base their updates on stale data. In Serializable, using exclusive locks for both reads and writes prevents this issue.

This lock-based implementation ensures the integrity of transactional operations. However, it is important to understand the implications of the chosen isolation level and the potential phenomena in high-concurrency environments. For critical systems, it is recommended to use the *Serializable level*, even though it imposes stricter access control.