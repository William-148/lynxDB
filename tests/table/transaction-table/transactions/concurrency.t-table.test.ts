import { Config } from "../../../../src/core/config";
import { LockTimeoutError } from "../../../../src/core/errors/record-lock-manager.error";
import { TransactionConflictError } from "../../../../src/core/errors/transaction.error";
import { Table } from "../../../../src/core/table";
import { TransactionTable } from "../../../../src/core/transaction-table";
import { ConfigOptions } from "../../../../src/types/config.type";
import { IsolationLevel } from "../../../../src/types/transaction.type";
import { delay } from "../../../../src/utils/delay";
import { generateId } from "../../../../src/utils/generate-id";
import { Product } from "../../../types/product-test.type";

function generateTransactionTables(
  transactionCount: number,
  table: Table<Product>,
  configOptions?: ConfigOptions
): TransactionTable<Product>[] {
  const transactionTables = [];
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
  { id: 4, name: "Sneackers", price: 400, stock: 2 },
  { id: 5, name: "Hat", price: 55, stock: 30 },
];

describe("Transaction Table - Common Concurrency", () => {
  let table: Table<Product>;

  beforeEach(() => {
    table = new Table<Product>({ primaryKey: ["id"] });
    table.bulkInsert(clothesProducts);
  });

  it("should handle concurrent transactions gracefully", async () => {
    const commonConfig = { 
      lockTimeout: 20
    }
    const tTables = generateTransactionTables(2, table, commonConfig);
    const tx1 = tTables[0];
    const tx2 = tTables[1];

    // TX1 make update
    await tx1.update({ price: 9999 }, { id: { eq: 1 } });

    // TX2 try to update the same record
    await expect(
      tx2.update({ price: 8888 }, { id: { eq: 1 } })
    ).rejects.toThrow(LockTimeoutError);

    // TX1 commit
    await tx1.commit();

    // TX" retry after TX1 commit
    await expect(
      tx2.update({ price: 8888 }, { id: { eq: 1 } })
    ).resolves.toBe(1);
  });

  it("should handle concurrent transactions with conflicting inserts", async () => {
    const newProduct = { id: 100, name: "Socks", price: 5, stock: 100 };
    const commonConfig = { 
      lockTimeout: 500
    }
    const tTables = generateTransactionTables(2, table, commonConfig);
    const tx1 = tTables[0];
    const tx2 = tTables[1];

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
      table , 
      { isolationLevel: IsolationLevel.ReadLatest }
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


describe(`Transaction Table - Concurrency Commit ${IsolationLevel.ReadLatest}`, () => {
  let table: Table<Product>;

  let defaultConfig: ConfigOptions = {
    isolationLevel: IsolationLevel.ReadLatest,
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

    await tx1.update({ stock: 25 }, { id: { eq: itemTest.id } });
    await tx1.commit();

    const productInTx2 = await tx2.findByPk({ id: itemTest.id });
    expect(productInTx2).toEqual({ ...itemTest, stock: 25 });
  });

  it("should handle concurrent updates with shared and exclusive locks", async () => {
    const itemTest = clothesProducts[1];
    const tTables = generateTransactionTables(2, table, defaultConfig);
    const tx1 = tTables[0];
    const tx2 = tTables[1];

    // Update then read the item in tx1
    await tx1.update({ stock: 15 }, { id: { eq: itemTest.id } });
    const tx1Updated = await tx1.findByPk({ id: itemTest.id });
    expect(tx1Updated).toEqual({ ...itemTest, stock: 15 });

    // Try to update the same item in tx2, but the item is locked by tx1
    // so it should wait for the lock to be released
    const tx2UpdatePromise = tx2.update({ stock: 10 }, { id: { eq: itemTest.id } });

    // tx1 should commit and release the lock
    await tx1.commit();

    // tx2 should be able to update the item now and lock the item again
    await tx2UpdatePromise;
    tx2.commit(); // tx2 commit the changes and release the lock

    // The changes should be visible in the table
    const finalState = await table.findByPk({ id: 2 });
    expect(finalState).toEqual({ ...itemTest, stock: 10 });
  });

  it("should ...", async () => {
    const itemTest = clothesProducts[2];
    const tTables = generateTransactionTables(2, table, defaultConfig);
    const tx1 = tTables[0];
    const tx2 = tTables[1];
    const stockInTx1 = 15;
    const stockInTx2 = 25;

    const operationsTx1 = async () => {
      try{ 
      // Lock the record with shared lock
      const found = await tx1.findByPk({ id: itemTest.id });

      // Release the shared lock and lock the record with exclusive lock
      if(found){
        const affected = await tx1.update({ stock: found.stock - 1 }, { id: { eq: found.id }, stock: { eq: found.stock } });
        if (affected !== 1) throw new Error("Product external changes");
      }

      console.table([
        found,
        await tx1.findByPk({ id: itemTest.id })
      ])
      tx1.commit();
    }
    catch (error) {
      tx1.rollback();
      console.error(error);
    }
    }

    const operationsTx2 = async () => {
      try {
        const found = await tx2.findByPk({ id: itemTest.id });
        if(found){
          await delay(1000);
          const affected = await tx2.update({ stock: found.stock - 1 }, { id: { eq: found.id }, stock: { eq: found.stock } });
          if (affected !== 1) throw new Error("Product external changes");
        }
        console.table([
          found,
          await tx2.findByPk({ id: itemTest.id })
        ])
        tx2.commit();
      }
      catch (error) {
        tx2.rollback();
        console.error(error);
      }
      
    }

    await Promise.all([
      operationsTx1(),
      operationsTx2()
    ])

    console.table([
      await table.findByPk({ id: itemTest.id })
    ])
  });

  // it("Template test", async () => {
  //   // Create transaction tables example
  //   const tx1 = new TransactionTable<Product>(generateId(), table, new Config(defaultConfig));
  //   const tx2 = new TransactionTable<Product>(generateId(), table, new Config(defaultConfig));

  //   /**
  //    * Where clause supported operators:
  //    * - eq
  //    * - gt
  //    * - lt
  //    * - gte
  //    * - lte
  //    * - includes: Receives an array of values
  //    * - like
  //    */

  //   // Insert example
  //   await tx1.insert(
  //     { id: 100, name: "Socks", price: 5, stock: 100 } // Product
  //   );

  //   // Bulk insert example
  //   await tx1.bulkInsert([
  //     // Multiple products
  //   ]);

  //   // Find by primary key example
  //   const product: Product | null = await tx1.findByPk(
  //     { id: 1 } // Partial<Product> where should be all fields of the primary key
  //   );

  //   // update example
  //   await tx1.update(
  //     { price: 9999 }, // new values
  //     { id: { eq: 1 } } // where clause
  //   );

  //   // select example
  //   const found: Array<Partial<Product>> = await tx1.select(
  //     [], // fields to select
  //     { price: { gte: 50 } } // where clause
  //   );

  //   // commit and rollback example
  //   await tx1.commit();
  //   await tx1.rollback();
  //   await tx2.commit();
  //   await tx2.rollback();

  // });

});


describe(`Transaction Table - Concurrency Commit ${IsolationLevel.StrictLocking}`, () => {
  const technologyProducts: Product[] = [
    { id: 1, name: "Laptop", price: 1500, stock: 30 },
    { id: 2, name: "Mouse", price: 20, stock: 100 },
    { id: 3, name: "Keyboard", price: 17, stock: 100 },
    { id: 4, name: "Monitor", price: 900, stock: 20 },
    { id: 5, name: "Headset", price: 100, stock: 30 },
  ];

  let table: Table<Product>;
  const defaultConfig: ConfigOptions = { isolationLevel: IsolationLevel.StrictLocking };

  beforeEach(() => {
    table = new Table<Product>({ primaryKey: ["id"] });
    table.bulkInsert(technologyProducts);
  });

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = technologyProducts[2];
    const TransactionCount = 150;
    const transactionTables = generateTransactionTables(
      TransactionCount,
      table,
      defaultConfig
    );
    await Promise.all(transactionTables.map(async (transactionTable) => {
      const product = await transactionTable.findByPk({ id: CommitedProduct.id });
      if (!product) return;
      const newStock = product.stock - 1;
      if (newStock < 0) {
        transactionTable.rollback();
        return;
      }

      const affected = await transactionTable.update({ stock: newStock }, { id: { eq: CommitedProduct.id } });
      expect(affected).toBe(1);

      // Execute commit
      await expect(transactionTable.commit()).resolves.not.toThrow();
    }));

    const updatedProduct = await table.findByPk({ id: CommitedProduct.id });
    const finalStock = CommitedProduct.stock - TransactionCount;
    expect(updatedProduct?.stock).toBe(finalStock < 0 ? 0 : finalStock);
  });

});