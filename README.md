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

# Transactions Support
# Isolation Levels

| Characteristic                    | READ LATEST | STRICT LOCKING |
|-----------------------------------|---------------------------|------------------------------|
| **Locking on reads**              | Shared Lock               | Exclusive Lock               |
| **Locking on writes**             | Exclusive Lock            | Exclusive Lock               |
| **MVCC**                          | No                        | No                           |
| **Reading recent data**          | Yes                       | Only if no active locks      |
| **Conflict due to locking**      | Writes                    | Reads and writes             |
