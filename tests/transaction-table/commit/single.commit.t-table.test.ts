import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { Product } from "../../types/product-test.type";

describe("Transaction Table Commit", () => {
  const TestData: Product[] = [
    { id: 1, name: "Laptop", price: 1500, stock: 30 },
    { id: 2, name: "Mouse",  price: 20, stock: 100 },
    { id: 3, name: "Keyboard", price: 50, stock: 50 },
    { id: 4, name: "Monitor", price: 900, stock: 20 },
    { id: 5, name: "Headset", price: 100, stock: 30 },
  ];

  let table: Table<Product>;
  let transactionTable: TransactionTable<Product>;

  beforeEach(() => {
    table = new Table<Product>("products", ["id"]);
    table.bulkInsert(TestData);

    transactionTable = new TransactionTable<Product>(
      crypto.randomUUID(),
      table.name,
      table.recordsMap,
      table.recordsArray,
      table.lockManager,
      table.pkDefinition
    );
  });

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = TestData[3];
    const TableSizeAtStart = TestData.length;
    const NewTableSize = TableSizeAtStart + 1;
    const NewProduct: Product = { id: 100, name: "Tablet", price: 800, stock: 10 };
    const UpdateProduct: Partial<Product> = { price: 1100, stock: 10 };

    const promiseUpdate = transactionTable.update(UpdateProduct, { id: { eq: CommitedProduct.id }});
    const promiseInsert = transactionTable.insert(NewProduct);
    expect(await promiseUpdate).toBe(1);
    await expect(promiseInsert).resolves.not.toThrow();

    // Validate transaction table before commit
    expect(transactionTable.size()).toBe(NewTableSize);
    expect(transactionTable.sizeMap).toBe(NewTableSize);

    expect(await transactionTable.findByPk({ id: CommitedProduct.id }))
      .toEqual({ ...CommitedProduct, ...UpdateProduct });

    expect(await transactionTable.findByPk({ id: NewProduct.id }))
      .toEqual(NewProduct);

    // Validate table before commit
    expect(table.size()).toBe(TableSizeAtStart);
    expect(table.sizeMap).toBe(TableSizeAtStart);
    expect(await table.findByPk({ id: CommitedProduct.id })).toEqual({ ...CommitedProduct });
    expect(await table.findByPk({ id: NewProduct.id })).toBeNull();

    // Execute commit
    await expect(transactionTable.commit()).resolves.not.toThrow();

    // Transaction table after commit
    expect(transactionTable.size()).toBe(NewTableSize);
    expect(transactionTable.sizeMap).toBe(NewTableSize);

    // Table after commit
    expect(table.size()).toBe(NewTableSize);
    expect(table.sizeMap).toBe(NewTableSize);
    expect(await table.findByPk({ id: CommitedProduct.id }))
      .toEqual({ ...CommitedProduct, ...UpdateProduct });

    expect(await table.findByPk({ id: NewProduct.id })).toEqual(NewProduct);

  });

  it("should commit delete operations without errors", async () => {
    
  });


});