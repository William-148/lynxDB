import { IsolationLevel } from "../../src/types/transaction.type";
import { TablesDefinition } from "../../src/types/table.type";
import { User } from "../types/user-test.type";
import { createRandomUser } from "../utils/user.utils";
import { LynxDB } from "../../src/core/database";
import { TableNotFoundError } from "../../src/core/errors/data-base.error";
import { LockTimeoutError } from "../../src/core/errors/record-lock-manager.error";
import { thirtyItemsUserList, twentyOrderDetails } from "../data/data-test";
import { OrderDetail } from "../types/order-test.type";

const tableConfigs: TablesDefinition<{ users: User }> = {
  users: { primaryKey: ["id"] }
};

describe('Database', () => {
  it("create an instance correctly", async () => {
    const db = new LynxDB(tableConfigs);
    expect(db).toBeInstanceOf(LynxDB);
  });

  it("retrieve an existing table", async () => {
    const db = new LynxDB(tableConfigs);
    const users = db.get("users");
    expect(users).not.toBeUndefined();
  });

  it("throw an error when retrieve a non-existing table", async () => {
    const db = new LynxDB(tableConfigs);
    expect(() => db.get("non-existing-table" as any)).toThrow(TableNotFoundError);
  });

  describe("Transactions", () => {
    it("create a transaction correctly", async () => {
      const db = new LynxDB(tableConfigs);
      const transaction = db.createTransaction();
      expect(transaction).not.toBeUndefined();
    });

    it("create a transaction with custom configuration", async () => {
      const db = new LynxDB(tableConfigs);
      const transaction = db.createTransaction({
        isolationLevel: IsolationLevel.Serializable 
      });
      expect(transaction).not.toBeUndefined();
    });

    it("create a transaction with Reapetable Read isolation level", async () => {
      const db = new LynxDB(tableConfigs);
      const newUser = createRandomUser(1);
      db.get("users").insert(newUser);
      const tx1 = db.createTransaction();
      const tx2 = db.createTransaction();
      const tx3 = db.createTransaction({
        lockTimeout: 50
      });

      // Lock the record with shared lock
      const tx1Found = await tx1.get("users").findByPk({ id: 1 });
      const tx2Found = await tx2.get("users").findByPk({ id: 1 });
      // Try to update the record with exclusive lock, but it will fail
      const updatePromise = tx3.get("users").update({ fullName: "New Name" }, { id: { $eq: 1 } });

      // Tx1 and Tx2 can read the record because they have a shared lock
      expect(tx1Found).toEqual(newUser);
      expect(tx2Found).toEqual(newUser);
      // Tx3 can't update the record because it needs an exclusive lock
      await expect(updatePromise).rejects.toThrow(LockTimeoutError);
      // Commit the transactions
      await expect(tx1.commit()).resolves.not.toThrow();
      await expect(tx2.commit()).resolves.not.toThrow();
      await expect(tx3.commit()).resolves.not.toThrow();
      // The record should not be updated
      expect(await db.get("users").findByPk({ id: 1 })).toEqual(newUser);
    });

    it("create a transaction with Serializable isolation level", async () => {
      const db = new LynxDB(tableConfigs);
      const newUser = createRandomUser(1);
      db.get("users").insert(newUser);
      const tx1 = db.createTransaction({
        isolationLevel: IsolationLevel.Serializable
      });
      const tx2 = db.createTransaction({
        lockTimeout: 50
      });

      // Lock the record with exclusive lock
      const tx1Found = await tx1.get("users").findByPk({ id: 1 });
      // Try to read the record with shared lock, but it will fail
      const tx2FindPromise = tx2.get("users").findByPk({ id: 1 });

      // Tx1 can read the record because it has an exclusive lock
      expect(tx1Found).toEqual(newUser);
      // Tx2 can't read the record because it needs a shared lock
      await expect(tx2FindPromise).rejects.toThrow(LockTimeoutError);
      // Commit the transactions
      await expect(tx1.commit()).resolves.not.toThrow();
      await expect(tx2.commit()).resolves.not.toThrow();
    });
  });

  describe("Reset database", () => {
    const resetTableConfig: TablesDefinition<{ users: User; orderDetails: OrderDetail }> = {
      users: { primaryKey: ["id"] },
      orderDetails: { primaryKey: ["orderId", "productId"] }
    };

    it("should reset the database correctly", async () => {
      const db = new LynxDB(resetTableConfig);
      await db.get("users").bulkInsert(thirtyItemsUserList);
      await db.get("orderDetails").bulkInsert(twentyOrderDetails);

      expect(db.get("users").size()).toBe(thirtyItemsUserList.length);
      expect(db.get("orderDetails").size()).toBe(twentyOrderDetails.length);
      db.reset();

      expect(db.get("users").size()).toBe(0);
      expect(await db.get("users").select()).toEqual([]);

      expect(db.get("orderDetails").size()).toBe(0);
      expect(await db.get("orderDetails").select()).toEqual([]);
    });

    it("should reset the database when exists a transaction", async () => {
      const db = new LynxDB(resetTableConfig);
      const users = db.get("users");
      const orderDetails = db.get("orderDetails");

      await users.bulkInsert(thirtyItemsUserList);
      await orderDetails.bulkInsert(twentyOrderDetails);

      const usersInitSize = users.size();
      const orderDetailsInitSize = orderDetails.size();

      // Creating transaction
      const tx = db.createTransaction();
      await tx.get("users").bulkInsert([
        createRandomUser(3001),
        createRandomUser(3002)
      ]);
      await tx.get("orderDetails").bulkInsert([
        { orderId: 21, productId: 21, quantity: 1, price: 100 },
        { orderId: 22, productId: 21, quantity: 1, price: 100 }
      ]);

      const txUsersInitSize = tx.get("users").size();
      const txOrderDetailsInitSize = tx.get("orderDetails").size();

      db.reset();

      const txUsersAfterSize = tx.get("users").size();
      const txOrderDetailsAfterSize = tx.get("orderDetails").size();

      // Checking sizes before reset
      expect(usersInitSize).toBe(thirtyItemsUserList.length);
      expect(orderDetailsInitSize).toBe(twentyOrderDetails.length);
      expect(txUsersInitSize).toBe(thirtyItemsUserList.length + 2);
      expect(txOrderDetailsInitSize).toBe(twentyOrderDetails.length + 2);
      
      // Check transaction values after reset 
      expect(txUsersAfterSize).toBe(2);
      expect(txOrderDetailsAfterSize).toBe(2);
      await expect(tx.commit()).resolves.not.toThrow();

      // Check database values after reset
      expect(users.size()).toBe(0);
      expect(await users.select()).toEqual([]);

      expect(orderDetails.size()).toBe(0);
      expect(await orderDetails.select()).toEqual([]);
    });

    it("should reset the database and add new data", async () => {
      const db = new LynxDB(resetTableConfig);
      await db.get("users").bulkInsert(thirtyItemsUserList);
      await db.get("orderDetails").bulkInsert(twentyOrderDetails);

      const tx = db.createTransaction();
      await tx.get("users").bulkInsert([
        createRandomUser(3001),
        createRandomUser(3002)
      ]);
      await tx.get("orderDetails").bulkInsert([
        { orderId: 21, productId: 21, quantity: 1, price: 100 },
        { orderId: 22, productId: 21, quantity: 1, price: 100 }
      ]);

      expect(db.get("users").size()).toBe(thirtyItemsUserList.length);
      expect(db.get("orderDetails").size()).toBe(twentyOrderDetails.length);
      db.reset();

      expect(db.get("users").size()).toBe(0);
      expect(await db.get("users").select()).toEqual([]);

      expect(db.get("orderDetails").size()).toBe(0);
      expect(await db.get("orderDetails").select()).toEqual([]);

      // Add new data
      await db.get("users").bulkInsert(thirtyItemsUserList);
      await db.get("orderDetails").bulkInsert(twentyOrderDetails);

      await tx.commit();

      expect(db.get("users").size()).toBe(thirtyItemsUserList.length);
      expect(db.get("orderDetails").size()).toBe(twentyOrderDetails.length);
      expect(await db.get("users").findByPk({ id: 3001 })).toBeNull();
      expect(await db.get("users").findByPk({ id: 3002 })).toBeNull();
      expect(await db.get("orderDetails").findByPk({ orderId: 21, productId: 21 })).toBeNull();
      expect(await db.get("orderDetails").findByPk({ orderId: 22, productId: 21 })).toBeNull();
    });

  });

});