import { Config } from "../../../../src/core/config";
import { LockTimeoutError } from "../../../../src/core/errors/record-lock-manager.error";
import { TransactionConflictError } from "../../../../src/core/errors/transaction.error";
import { Table } from "../../../../src/core/table";
import { TransactionTable } from "../../../../src/core/transaction-table";
import { IsolationLevel } from "../../../../src/types/transaction.type";
import { generateId } from "../../../../src/utils/generate-id";
import { Product } from "../../../types/product-test.type";

function generateTransactionTables(
  transactionCount: number,
  table: Table<Product>,
  isolationLevel?: IsolationLevel,
): TransactionTable<Product>[] {
  const transactionTables = [];
  for (let i = 0; i < transactionCount; i++) {
    transactionTables.push(new TransactionTable<Product>(
      generateId(),
      table,
      new Config({ isolationLevel })
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
    const commonConfig = new Config({ 
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 20
    });
    const tx1 = new TransactionTable<Product>(generateId(), table, commonConfig);
    const tx2 = new TransactionTable<Product>(generateId(), table, commonConfig);

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
    const commonConfig = new Config({ 
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 500
    });
    const tx1 = new TransactionTable<Product>(generateId(), table, commonConfig);
    const tx2 = new TransactionTable<Product>(generateId(), table, commonConfig);

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
});

describe(`Transaction Table - Concurrency Commit ${IsolationLevel.ReadLatest}`, () => {
  let table: Table<Product>;

  beforeEach(() => {
    table = new Table<Product>({ primaryKey: ["id"] });
    table.bulkInsert(clothesProducts);
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
    const transactionTables = generateTransactionTables(TransactionCount, table);

    // Insert new products with the same primary key
    await Promise.all(transactionTables.map(async (transactionTable, i) => {
      const inserted = await transactionTable.insert(newProductsWithSamePk[i]);
      expect(inserted).toEqual(newProductsWithSamePk[i]);
      expect(transactionTable.size()).toBe(FinalSize);
      expect(transactionTable.sizeMap).toBe(FinalSize);
    }));

    // Commit transactions, Only one should be commited
    for (let i = 0; i < TransactionCount; i++) {
      if (i === 0) {
        await expect(transactionTables[i].commit()).resolves.not.toThrow();
      }
      else {
        await expect(transactionTables[i].commit()).rejects.toThrow(TransactionConflictError);
      }
    }
    // Check if the table has the new product
    expect(table.size()).toBe(FinalSize);
    expect(table.sizeMap).toBe(FinalSize);
  });

});


describe(`Transaction Table - Concurrency Commit ${IsolationLevel.StrictLocking}`, () => {
  const technologyProducts: Product[] = [
    { id: 1, name: "Laptop", price: 1500, stock: 30 },
    { id: 2, name: "Mouse", price: 20, stock: 100 },
    { id: 3, name: "Keyboard", price: 17, stock: 23 },
    { id: 4, name: "Monitor", price: 900, stock: 20 },
    { id: 5, name: "Headset", price: 100, stock: 30 },
  ];

  let table: Table<Product>;
  const isolationLevel = IsolationLevel.StrictLocking;

  beforeEach(() => {
    table = new Table<Product>({ primaryKey: ["id"] });
    table.bulkInsert(technologyProducts);
  });

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = technologyProducts[2];
    const TransactionCount = 30;
    const transactionTables = generateTransactionTables(
      TransactionCount,
      table,
      isolationLevel
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