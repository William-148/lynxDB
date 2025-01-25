import { DuplicatePrimaryKeyValueError } from "../../../../src/core/errors/table.error";
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
      isolationLevel
    ));
  }
  return transactionTables;
}

describe(`Transaction Table - Concurrency Commit ${IsolationLevel.ReadLatest}`, () => {
  const TestData: Product[] = [
    { id: 1, name: "Jacket", price: 1000, stock: 30 },
    { id: 2, name: "Jeans",  price: 50, stock: 44 },
    { id: 3, name: "T-Shirt", price: 25, stock: 23 },
    { id: 4, name: "Sneackers", price: 400, stock: 2 },
    { id: 5, name: "Hat", price: 55, stock: 30 },
  ];

  let table: Table<Product>;

  beforeEach(() => {
    table = new Table<Product>({ name: "products", primaryKey: ["id"] });
    table.bulkInsert(TestData);
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
    const FinalSize = TestData.length + 1;
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
        await expect(transactionTables[i].commit()).rejects.toThrow(DuplicatePrimaryKeyValueError);
      }
    }
    // Check if the table has the new product
    expect(table.size()).toBe(FinalSize);
    expect(table.sizeMap).toBe(FinalSize);
  });

});


describe(`Transaction Table - Concurrency Commit ${IsolationLevel.StrictLocking}`, () => {
  const TestData: Product[] = [
    { id: 1, name: "Laptop", price: 1500, stock: 30 },
    { id: 2, name: "Mouse",  price: 20, stock: 100 },
    { id: 3, name: "Keyboard", price: 17, stock: 23 },
    { id: 4, name: "Monitor", price: 900, stock: 20 },
    { id: 5, name: "Headset", price: 100, stock: 30 },
  ];

  let table: Table<Product>;
  const isolationLevel = IsolationLevel.StrictLocking;

  beforeEach(() => {
    table = new Table<Product>({ name: "products", primaryKey: ["id"] });
    table.bulkInsert(TestData);
  });

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = TestData[2];
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

      const affected = await transactionTable.update({ stock: newStock }, { id: { eq: CommitedProduct.id }});
      expect(affected).toBe(1);

      // Execute commit
      await expect(transactionTable.commit()).resolves.not.toThrow();
    }));

    const updatedProduct = await table.findByPk({ id: CommitedProduct.id });
    const finalStock = CommitedProduct.stock - TransactionCount;
    expect(updatedProduct?.stock).toBe(finalStock < 0 ? 0 : finalStock);
  });

});