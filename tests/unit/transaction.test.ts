import { User } from "../types/user-test.type";
import { TableNotFoundError } from "../../src/core/errors/data-base.error";
import { Transaction } from "../../src/core/transaction";
import { Table } from "../../src/core/table";
import { TransactionCompletedError, TransactionConflictError } from "../../src/core/errors/transaction.error";

describe('Transaction', () => {
  it("create an instance correctly", async () => {
    const transaction = new Transaction(new Map());
    expect(transaction).toBeInstanceOf(Transaction);
  });

  it("retrieve an existing table", async () => {
    const tables = new Map<string, Table<User>>();
    tables.set("users", new Table<User>({ primaryKey: ["id"] }));
    const transaction = new Transaction(tables);
    const users = transaction.get("users");
    expect(users).not.toBeUndefined();
  });

  it("throw an error when retrieve a non-existing table", async () => {
    const transaction = new Transaction(new Map());
    expect(() => transaction.get("non-existing-table" as any)).toThrow(TableNotFoundError);
  });

  it("throw errors when transaction is not active", async () => {
    const tables = new Map<string, Table<User>>();
    tables.set("users", new Table<User>({ primaryKey: ["id"] }));
    const transaction = new Transaction(tables);

    expect(() => transaction.get("users")).not.toThrow();
    await expect(transaction.commit()).resolves.not.toThrow();
    expect(() => transaction.get("users")).toThrow(TransactionCompletedError);
    await expect(transaction.commit()).rejects.toThrow(TransactionCompletedError);
    await expect(transaction.rollback()).resolves.not.toThrow();
  });

  it("throw error when exist conflicts on commit", async () => {
    type Entity = { id: number; name: string };
    const tables = new Map<string, Table<Entity>>();
    const entities = new Table<Entity>({ primaryKey: ["id"] });
    tables.set("entities", entities);
    const transaction = new Transaction<{ entities: Entity }>(tables);
    
    // Insert a record in transaction
    await transaction.get('entities').insert({ id: 1, name: "John Doe" });

    // Insert the same record in the main table
    entities.insert({ id: 1, name: "John Doe" });


    await expect(transaction.commit()).rejects.toThrow(TransactionConflictError);
    expect(entities.size()).toBe(1);
    expect(await entities.findByPk({ id: 1 })).toEqual({ id: 1, name: "John Doe" });
    await expect(transaction.commit()).rejects.toThrow(TransactionCompletedError);
  });

});