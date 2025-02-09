import { Config } from "../../../../../src/core/config";
import { LockTimeoutError } from "../../../../../src/core/errors/record-lock-manager.error";
import { TransactionConflictError } from "../../../../../src/core/errors/transaction.error";
import { Table } from "../../../../../src/core/table";
import { TransactionTable } from "../../../../../src/core/transaction-table";
import { ConfigOptions } from "../../../../../src/types/config.type";
import { IsolationLevel } from "../../../../../src/types/transaction.type";
import { generateId } from "../../../../../src/utils/generate-id";
import { Product } from "../../../../types/product-test.type";
import { delay } from "../../../../utils/delay-test";

function generateTransactionTables(
  transactionCount: number,
  table: Table<Product>,
  configOptions?: ConfigOptions
): TransactionTable<Product>[] {
  const transactionTables: TransactionTable<Product>[] = [];
  for (let i = 0; i < transactionCount; i++) {
    transactionTables.push(new TransactionTable<Product>(
      generateId(),
      table,
      new Config(configOptions)
    ));
  }
  return transactionTables;
}

const clothesProducts: Product[] = [
  { id: 1, name: "Jacket", price: 1000, stock: 30 },
  { id: 2, name: "Jeans", price: 50, stock: 44 },
  { id: 3, name: "T-Shirt", price: 25, stock: 23 },
  { id: 4, name: "Sneackers", price: 400, stock: 5 },
  { id: 5, name: "Hat", price: 55, stock: 30 },
];

describe("Transaction Table", () => {

  describe("Common Concurrency", () => {
    let table: Table<Product>;

    beforeEach(() => {
      table = new Table<Product>({ primaryKey: ["id"] });
      table.bulkInsert(clothesProducts);
    });

    it("should handle concurrent transactions gracefully", async () => {
      const commonConfig = {
        lockTimeout: 20
      }
      const [tx1, tx2] = generateTransactionTables(2, table, commonConfig);

      // TX1 make update
      await tx1.update({ price: 9999 }, { id: { $eq: 1 } });

      // TX2 try to update the same record
      await expect(
        tx2.update({ price: 8888 }, { id: { $eq: 1 } })
      ).rejects.toThrow(LockTimeoutError);

      // TX1 commit
      await tx1.commit();

      // TX2 retry after TX1 commit
      await expect(
        tx2.update({ price: 8888 }, { id: { $eq: 1 } })
      ).resolves.toBe(1);
    });

    it("should handle concurrent transactions with conflicting inserts", async () => {
      const newProduct = { id: 100, name: "Socks", price: 5, stock: 100 };
      const commonConfig = {
        lockTimeout: 500
      }
      const [tx1, tx2] = generateTransactionTables(2, table, commonConfig);

      // Make the same insert in both transactions
      await tx1.insert(newProduct);
      await tx2.insert(newProduct);

      // Try to commit both transactions
      const tryToCommit = async () => {
        await Promise.all([
          tx1.commit(),
          tx2.commit()
        ]);
      }

      await expect(tryToCommit()).rejects.toThrow(TransactionConflictError);

      // Check if the table has the new product
      // A new product should be inserted because one of the transactions should be commited
      expect(await table.findByPk({ id: newProduct.id })).not.toBeNull();
      expect(table.size()).toBe(clothesProducts.length + 1);
    });

    it("should handle record locking and ensure correct record deletion with concurrent transactions", async () => {
      const [tx1, tx2] = generateTransactionTables(2, table);
      const itemTest = clothesProducts[2];

      // The record should be locked by tx1
      const tx1DeletePromise = tx1.deleteByPk({ id: itemTest.id });
      // Tx2 should wait for the lock to be released by tx1
      const tx2SelectPromise = tx2.select([], { id: { $eq: itemTest.id } });
      // Tx1 release the lock by commit
      await tx1.commit();

      // Tx1 should delete the record and return the deleted record
      await expect(tx1DeletePromise).resolves.toEqual(itemTest);
      // Tx2 should be able to read the record but it should be deleted
      await expect(tx2SelectPromise).resolves.toHaveLength(0);
      await expect(tx2.commit()).resolves.not.toThrow();
      // Main table should not have the record
      await expect(table.findByPk({ id: itemTest.id })).resolves.toBeNull();
      expect(table.size()).toBe(clothesProducts.length - 1);
    });

    it("should throw an error when trying to update a record that has been deleted by another transaction", async () => {
      const [tx1, tx2, tx3] = generateTransactionTables(3, table);
      const itemTest = clothesProducts[2];

      // The record should be locked by tx1
      const tx1DeletePromise = tx1.deleteByPk({ id: itemTest.id });
      // Tx2 and tx3 should wait for the lock to be released by tx1
      const tx2UpdatePromise = tx2.update({ stock: 123 }, { id: { $eq: itemTest.id } });
      const tx3UpdatePromise = tx3.update({ stock: 321 }, { id: { $eq: itemTest.id } });
      // Tx1 release the lock by commit
      await tx1.commit();

      // Tx1 should delete the record and return the deleted record
      await expect(tx1DeletePromise).resolves.toEqual(itemTest);
      // Tx2 should be able to update the record
      await expect(tx2UpdatePromise).resolves.toBe(1);
      // Tx2 try to commit the changes but throw an error because the record was deleted
      await expect(tx2.commit()).rejects.toThrow(/has been externally modified/);

      // Tx3 should be able to update the record
      await expect(tx3UpdatePromise).resolves.toBe(1);
      // Tx3 try to commit the changes using apply() but throw an error 
      // because the record was deleted
      await expect(tx3.apply()).rejects.toThrow(/has been externally modified/);

      // Main table should not have the record
      await expect(table.findByPk({ id: itemTest.id })).resolves.toBeNull();
      expect(table.size()).toBe(clothesProducts.length - 1);
    });

    it("should commit the first insert and the others should throw an Duplicate PK error", async () => {
      const newProductsWithSamePk: Product[] = [
        { id: 100, name: "Socks", price: 5, stock: 100 },
        { id: 100, name: "Underwear", price: 10, stock: 50 },
        { id: 100, name: "Shirt", price: 30, stock: 20 },
        { id: 100, name: "Shorts", price: 35, stock: 10 },
        { id: 100, name: "Sweater", price: 70, stock: 5 }
      ];
      const TransactionCount = newProductsWithSamePk.length;
      const FinalSize = clothesProducts.length + 1;
      const transactionTables = generateTransactionTables(
        TransactionCount,
        table,
        { isolationLevel: IsolationLevel.RepeatableRead }
      );

      // Insert new products with the same primary key
      await Promise.all(transactionTables.map(async (transactionTable, i) => {
        const inserted = await transactionTable.insert(newProductsWithSamePk[i]);
        expect(inserted).toEqual(newProductsWithSamePk[i]);
        expect(transactionTable.size()).toBe(FinalSize);
      }));

      // Commit transactions, Only one should be commited
      const commitsResult = await Promise.allSettled(transactionTables.map(
        (t_table) => t_table.commit()
      ));
      let successCount = 0;
      for (const result of commitsResult) {
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(TransactionConflictError);
          continue;
        }
        successCount++;
      }
      expect(successCount).toBe(1);

      // Check if the table has the new product
      expect(table.size()).toBe(FinalSize);
    });

  });

  describe(`Concurrency Commit ${IsolationLevel.RepeatableRead}`, () => {
    let table: Table<Product>;

    let defaultConfig: ConfigOptions = {
      isolationLevel: IsolationLevel.RepeatableRead,
      lockTimeout: 5000
    };

    beforeEach(() => {
      table = new Table<Product>({ primaryKey: ["id"] });
      table.bulkInsert(clothesProducts);
    });

    it("should allow reading the most recent committed data", async () => {
      const itemTest = clothesProducts[2];
      const tTables = generateTransactionTables(2, table, defaultConfig);
      const tx1 = tTables[0];
      const tx2 = tTables[1];

      await tx1.update({ stock: 25 }, { id: { $eq: itemTest.id } });
      await tx1.commit();

      const productInTx2 = await tx2.findByPk({ id: itemTest.id });
      expect(productInTx2).toEqual({ ...itemTest, stock: 25 });
    });

    it("should avoid 'Read Skew' by using Repeatable Read isolation level", async () => {
      const itemTest = clothesProducts[3];
      const tTables = generateTransactionTables(2, table, defaultConfig);
      const tx1 = tTables[0];
      const tx2 = tTables[1];

      const tx1ProductFirstRead = await tx1.findByPk({ id: itemTest.id });
      const tx2UpdatePromise = tx2.update({ stock: 123 }, { id: { $eq: itemTest.id } });
      await delay(100);
      const tx1ProductSecondRead = await tx1.findByPk({ id: itemTest.id });

      // Values should be the same because tx1 is using Repeatable Read isolation level
      expect(tx1ProductFirstRead).toEqual(tx1ProductSecondRead);
      await tx1.commit();
      
      // tx2 should be able to update the item now
      await expect(tx2UpdatePromise).resolves.toBe(1);
      const productInTx2 = await tx2.findByPk({ id: itemTest.id });
      expect(productInTx2).toEqual({ ...itemTest, stock: 123 });
      tx2.commit();

      // The changes should be visible in the table
      expect(await table.findByPk({ id: itemTest.id })).toEqual({ ...itemTest, stock: 123 });
    });

    it("should handle concurrent updates with shared and exclusive locks", async () => {
      const itemTest = clothesProducts[1];
      const tTables = generateTransactionTables(2, table, defaultConfig);
      const tx1 = tTables[0];
      const tx2 = tTables[1];

      // Update then read the item in tx1
      await tx1.update({ stock: 15 }, { id: { $eq: itemTest.id } });
      const tx1Updated = await tx1.findByPk({ id: itemTest.id });
      expect(tx1Updated).toEqual({ ...itemTest, stock: 15 });

      // Try to update the same item in tx2, but the item is locked by tx1
      // so it should wait for the lock to be released
      const tx2UpdatePromise = tx2.update({ stock: 10 }, { id: { $eq: itemTest.id } });

      // tx1 should commit and release the lock
      await tx1.commit();

      // tx2 should be able to update the item now and lock the item again
      await tx2UpdatePromise;
      await tx2.commit(); // tx2 commit the changes and release the lock

      // The changes should be visible in the table
      const finalState = await table.findByPk({ id: 2 });
      expect(finalState).toEqual({ ...itemTest, stock: 10 });
    });

    it("should handle optimistic locking by correctly updating the stock with concurrent transactions", async () => {
      const itemTest = clothesProducts[2];
      const tTables = generateTransactionTables(3, table, defaultConfig);

      const result = await Promise.allSettled(tTables.map(async (transactionTable) => {
        try {
          // Lock the record with shared lock
          const found = await transactionTable.findByPk({ id: itemTest.id });
          if (!found) return;

          // Release the shared lock and lock the record with exclusive lock
          const affected = await transactionTable.update(
            { stock: found.stock - 1 },
            { id: { $eq: found.id }, stock: { $eq: found.stock } }
          );
          if (affected !== 1) throw new Error("Product external change");

          transactionTable.commit();
        }
        catch (error) {
          transactionTable.rollback();
          throw error;
        }
      }));

      const recordAffected = await table.findByPk({ id: itemTest.id });

      let successCount = 0;
      for (const resultItem of result) {
        if (resultItem.status === "rejected") {
          expect(resultItem.reason.message).toBe("Product external change");
        }
        else{
          successCount++;
        }
      }
      const finalStock = itemTest.stock - successCount;
      expect(recordAffected?.stock).toBe(finalStock < 0 ? 0 : finalStock);
    });

  });

  describe(`Concurrency Commit ${IsolationLevel.Serializable}`, () => {
    const technologyProducts: Product[] = [
      { id: 1, name: "Laptop", price: 1500, stock: 30 },
      { id: 2, name: "Mouse", price: 20, stock: 100 },
      { id: 3, name: "Keyboard", price: 17, stock: 100 },
      { id: 4, name: "Monitor", price: 900, stock: 20 },
      { id: 5, name: "Headset", price: 100, stock: 30 },
    ];

    let table: Table<Product>;
    const defaultConfig: ConfigOptions = { isolationLevel: IsolationLevel.Serializable };

    beforeEach(() => {
      table = new Table<Product>({ primaryKey: ["id"] });
      table.bulkInsert(technologyProducts);
    });

    it("should handle high concurrency transactions and update the stock correctly", async () => {
      const commitedProduct = technologyProducts[2];
      const transactionCount = 150;
      const transactionTables = generateTransactionTables(
        transactionCount,
        table,
        defaultConfig
      );
      await Promise.all(transactionTables.map(async (transactionTable) => {
        const product = await transactionTable.findByPk({ id: commitedProduct.id });
        if (!product) return;
        const newStock = product.stock - 1;
        if (newStock < 0) {
          transactionTable.rollback();
          return;
        }

        const affected = await transactionTable.update({ stock: newStock }, { id: { $eq: commitedProduct.id } });
        expect(affected).toBe(1);
        // Execute commit
        await expect(transactionTable.commit()).resolves.not.toThrow();
      }));

      const updatedProduct = await table.findByPk({ id: commitedProduct.id });
      const finalStock = commitedProduct.stock - transactionCount;
      expect(updatedProduct?.stock).toBe(finalStock < 0 ? 0 : finalStock);
    });

    it("should update the same register by many transactions", async () => {
      const newProduct: Product = { id: 100, name: "Monitor LED", price: 1000, stock: 100 };
      await table.insert(newProduct);
      const transactionCount = 10;
      const tTables = generateTransactionTables(transactionCount, table, defaultConfig);

      const result = await Promise.allSettled(tTables.map(async (tx) => {
        try {
          const found = await tx.findByPk({ id: newProduct.id });
          if (!found) return;
          // Lock the record with shared lock
          const affected = await tx.update({ stock: found.stock - 1 }, { id: { $eq: newProduct.id } });
          if (affected !== 1) throw new Error("Product external changes");
          tx.commit();
        }
        catch (error) {
          tx.rollback();
          throw error;
        }
      }));

      const recordAffected = await table.findByPk({ id: newProduct.id });

      result.forEach((resultItem) => {
        // All transactions should be successful because the transactions 
        // are less than the stock
        expect(resultItem.status).toBe("fulfilled");
      });

      const finalStock = newProduct.stock - transactionCount;
      expect(recordAffected?.stock).toBe(finalStock < 0 ? 0 : finalStock);
    });

  });
});