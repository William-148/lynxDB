import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { Product } from "../../types/product-test.type";

describe("Transaction Table - Concurrency Commit", () => {
  const TestData: Product[] = [
    { id: 1, name: "Laptop", price: 1500, stock: 30 },
    { id: 2, name: "Mouse",  price: 20, stock: 100 },
    { id: 3, name: "Keyboard", price: 50, stock: 50 },
    { id: 4, name: "Monitor", price: 900, stock: 20 },
    { id: 5, name: "Headset", price: 100, stock: 30 },
  ];

  let table: Table<Product>;
  let transactionTables: TransactionTable<Product>[];
  const TransactionCount = 5;

  beforeEach(() => {
    table = new Table<Product>("products", ["id"]);
    table.bulkInsert(TestData);
    transactionTables = [];

    for (let i = 0; i < TransactionCount; i++) {  
      transactionTables.push( new TransactionTable<Product>(
        crypto.randomUUID(),
        table.name,
        table.recordsMap,
        table.recordsArray,
        table.lockManager,
        table.pkDefinition
      ));
    }
  });

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = TestData[2];
    const TableSizeAtStart = TestData.length;
    const NewTableSize = TableSizeAtStart + 1;
    const NewProduct: Product = { id: 100, name: "Tablet", price: 800, stock: 10 };
    const UpdateProduct: Partial<Product> = { price: 1100, stock: 10 };

    await Promise.all(transactionTables.map(async (transactionTable, index) => {
      const product = await transactionTable.findByPk({ id: CommitedProduct.id });
      if (!product) return;
      if (product.stock === 0) return;
      const newStock = product.stock - 1;
      if (newStock < 0) return;

      const affected = await transactionTable.update({ stock: newStock }, { id: { eq: CommitedProduct.id }});
      expect(affected).toBe(1);

      // Execute commit
      await expect(transactionTable.commit()).resolves.not.toThrow();
    }));

    console.table(await table.findByPk({ id: CommitedProduct.id }));

  });

});