import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { IsolationLevel } from "../../../src/types/transaction.type";
import { generateId } from "../../../src/utils/generate-id";
import { Product } from "../../types/product-test.type";

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

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = TestData[3];
    const TransactionCount = 30;
    const transactionTables = generateTransactionTables(
      TransactionCount,
      table
    );
    // await Promise.all(transactionTables.map(async (transactionTable) => {
    //   const product = await transactionTable.findByPk({ id: CommitedProduct.id });
    //   if (!product) return;
    //   const newStock = product.stock - 1;
    //   if (newStock < 0) {
    //     transactionTable.rollback();
    //     return;
    //   }

    //   const affected = await transactionTable.update({ stock: newStock }, { id: { eq: CommitedProduct.id }});
    //   expect(affected).toBe(1);

    //   // Execute commit
    //   await expect(transactionTable.commit()).resolves.not.toThrow();
    // }));

    // const updatedProduct = await table.findByPk({ id: CommitedProduct.id });
    // const finalStock = CommitedProduct.stock - TransactionCount;
    // expect(updatedProduct?.stock).toBe(finalStock < 0 ? 0 : finalStock);
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