import { Config } from "../../../../../src/core/config";
import { LockTimeoutError } from "../../../../../src/core/errors/record-lock-manager.error";
import { DuplicatePrimaryKeyValueError } from "../../../../../src/core/errors/table.error";
import { Table } from "../../../../../src/core/table";
import { TransactionTable } from "../../../../../src/core/transaction-table";
import { IsolationLevel } from "../../../../../src/types/transaction.type";
import { generateId } from "../../../../../src/utils/generate-id";
import { Product } from "../../../../types/product-test.type";
import { TransactionCompletedError, TransactionConflictError } from "../../../../../src/core/errors/transaction.error";

describe(`Transaction Table Commit ${IsolationLevel.RepeatableRead}`, () => {
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
    table = new Table<Product>({ primaryKey: ["id"] });
    table.bulkInsert(TestData);

    transactionTable = new TransactionTable<Product>(
      generateId(),
      table,
      new Config({ isolationLevel: IsolationLevel.RepeatableRead })
    );
  });

  it("should commit update and insert operations without errors", async () => {
    const CommitedProduct = TestData[3];
    const TableSizeAtStart = TestData.length;
    const NewTableSize = TableSizeAtStart + 1;
    const NewProduct: Product = { id: 100, name: "Tablet", price: 800, stock: 10 };
    const UpdateProduct: Partial<Product> = { price: 1100, stock: 10 };

    const promiseUpdate = transactionTable.update(UpdateProduct, { id: { $eq: CommitedProduct.id }});
    const promiseInsert = transactionTable.insert(NewProduct);
    expect(await promiseUpdate).toBe(1);
    await expect(promiseInsert).resolves.not.toThrow();

    // Validate transaction table before commit
    expect(transactionTable.size()).toBe(NewTableSize);

    expect(await transactionTable.findByPk({ id: CommitedProduct.id }))
      .toEqual({ ...CommitedProduct, ...UpdateProduct });

    expect(await transactionTable.findByPk({ id: NewProduct.id }))
      .toEqual(NewProduct);

    // Validate table before commit
    expect(table.size()).toBe(TableSizeAtStart);

    // Execute commit
    await expect(transactionTable.commit()).resolves.not.toThrow();

    // Transaction table after commit
    expect(transactionTable.size()).toBe(NewTableSize);

    // Table after commit
    expect(table.size()).toBe(NewTableSize);
    expect(await table.findByPk({ id: CommitedProduct.id }))
      .toEqual({ ...CommitedProduct, ...UpdateProduct });

    expect(await table.findByPk({ id: NewProduct.id })).toEqual(NewProduct);

  });

  
  it("should block main table operations on locked records", async () => {
    const productToLock = TestData[1];
    const mainTableUpdateAttempt: Partial<Product> = { price: 9999 };
    const transactionTableUpdateAttempt: Partial<Product> = { price: 1500 * 2 };
    // Configure lock timeout
    table.lockManager.config.set('lockTimeout', 20);

    // Block record in transaction
    await transactionTable.update(
      transactionTableUpdateAttempt, 
      { id: { $eq: productToLock.id } }
    );

    // Try to update the same record in the main table
    await expect(
      table.update(mainTableUpdateAttempt, { id: { $eq: productToLock.id } })
    ).rejects.toThrow(LockTimeoutError);

    // Commit to release the lock
    await transactionTable.commit();

    // Post-commit: The operation should be successful
    await expect(table.findByPk({ id: productToLock.id }))
      .resolves
      .toEqual({...productToLock, ...transactionTableUpdateAttempt});

    await expect(
      table.update(mainTableUpdateAttempt, { id: { $eq: productToLock.id }})
    ).resolves.toBe(1);

    await expect(table.findByPk({ id: productToLock.id }))
      .resolves
      .toEqual({...productToLock, ...mainTableUpdateAttempt});
  });

  it("should apply all changes on commit", async () => {
    const newProduct: Product = { id: 1000, name: "Tablet", price: 800, stock: 10 };
    const updates = [
      { id: 1, update: { price: 2000 } },
      { id: 2, update: { stock: 50 } }
    ];

    // Multiple operations
    await transactionTable.insert(newProduct);
    for (const { id, update } of updates) {
      await transactionTable.update(update, { id: { $eq: id } });
    }

    // Pre-commit: Main Table intact
    expect(table.size()).toBe(TestData.length);

    // Commit
    await transactionTable.commit();

    // Post-commit: Verify all changes
    expect(table.size()).toBe(TestData.length + 1);
    for (const { id, update } of updates) {
      const original = TestData.find(p => p.id === id)!;
      expect(await table.findByPk({ id })).toEqual({ ...original, ...update });
    }
    expect(await table.findByPk({ id: newProduct.id })).toEqual(newProduct);
  });

  it("should update the record many times with the same data", async () => {
    const productToTest = TestData[0];
    const updateData = { ...productToTest, price: 1500, stock: 30 };

    // Update the record 3 times
    await transactionTable.update(updateData, { id: { $eq: productToTest.id } });
    await transactionTable.update(updateData, { id: { $eq: productToTest.id } });
    await transactionTable.update(updateData, { id: { $eq: productToTest.id } });

    // Commit the transaction
    await expect(transactionTable.commit()).resolves.not.toThrow();
    // Check the record after the commit
    expect(await table.findByPk({ id: productToTest.id })).toEqual({ ...updateData });
    expect(table.size()).toBe(TestData.length);
  });

  it("should update a record and the normal table filter does not match the record for an update operation", async () => {
    const itemToTest = TestData[3];
    // Lock with shared lock
    await transactionTable.findByPk({ id: itemToTest.id });
    // Normal table try to update the same record (it's locked by the transaction)
    // The update operation should not affect any record 
    const tableUpdatePromise = table.update({ price: 8888, stock: 70 }, { 
      id: { $eq: itemToTest.id }, 
      price: { $eq: itemToTest.price }
    });
    // Update the record in the transaction table
    const transactionUpdatePromise = transactionTable.update({ price: 9999, stock: 100 }, { 
      id: { $eq: itemToTest.id } 
    });

    await expect(transactionUpdatePromise).resolves.toBe(1);
    await expect(transactionTable.commit()).resolves.not.toThrow();
    await expect(tableUpdatePromise).resolves.toBe(0);
  });

  it("should delete a record and the normal table cannot perform any operation on the record", async () => {
    const itemToTest = TestData[4];
    
    // Delete the record in the transaction table
    const recordDeleted = await transactionTable.deleteByPk({ id: itemToTest.id });
    // Normal table try to update the same record (it's locked by the transaction)
    // The update operation should not affect any record 
    const tableUpdatePromise = table.update({ price: 8888, stock: 70 }, { id: { $eq: itemToTest.id } });
    
    expect(recordDeleted).toEqual(itemToTest);
    await expect(transactionTable.commit()).resolves.not.toThrow();
    await expect(tableUpdatePromise).resolves.toBe(0);
  });

  it("should discard all changes on rollback", async () => {
    const doomedProduct: Product = { id: 888, name: "Doomed", price: 0, stock: 0 };
    const ooopsName = "ooops";
    
    // Operations in transaction
    await transactionTable.insert(doomedProduct);
    const updatedCount = await transactionTable.update({ name: ooopsName }, { id: { $gt: 0 } });
    expect(updatedCount).toBe(TestData.length + 1);
    expect(await transactionTable.select([], { name: { $eq: ooopsName }}))
      .toHaveLength(TestData.length + 1);
    
    // Explicit rollback
    await transactionTable.rollback();

    // Post-rollback: Original state
    expect(table.size()).toBe(TestData.length);
    expect(await table.select([], { name: { $eq: ooopsName }}))
      .toHaveLength(0);
    expect(await table.findByPk({ id: doomedProduct.id })).toBeNull();

    // Transaction marked as completed
    await expect(transactionTable.apply()).rejects.toThrow(TransactionCompletedError);
    await expect(transactionTable.commit()).rejects.toThrow(TransactionCompletedError);
    await expect(transactionTable.rollback()).resolves.not.toThrow();
  });

  it("should throw an error when trying to commit and exist conflicts with primary keys", async () => {
    const productTransaction: Product = { id: 100, name: "Tablet", price: 800, stock: 10 };
    const productMainTable: Product = { id: 100, name: "Print", price: 800, stock: 10 }

    // Insert new record in transaction table
    await transactionTable.insert(productTransaction);
    // Insert a record with the same primary key in the main table
    table.insert(productMainTable);

    // Should throw an error because the PKs are the same
    await expect(transactionTable.commit()).rejects.toThrow(TransactionConflictError);
    expect(await table.findByPk({ id: productTransaction.id })).toEqual(productMainTable);
  });

  it("should throw an error when trying to update a primary key to a value that already exists in the table", async () => {
    const productToModify = TestData[2];
    const productTransaction: Product = { id: productToModify.id, name: "Tablet", price: 800, stock: 10 };

    // Update the PK of the original record
    await transactionTable.update({ id: 100 }, { id: { $eq: productToModify.id } });
    // Insert new record in transaction table with the original PK
    await transactionTable.insert(productTransaction);
    // Try to update the PK of the updated record to the original PK
    const promiseUpdate =  transactionTable.update({ id: productToModify.id }, { id: { $eq: 100 } });

    // Should throw an error because the PK is the same as the record that was inserted
    await expect(promiseUpdate).rejects.toThrow(DuplicatePrimaryKeyValueError);
    await expect(transactionTable.commit()).resolves.not.toThrow();
    expect(table.size()).toBe(TestData.length + 1);
  });

  it("should throw an error when trying to update a record to a primary key that already exists in the table", async () => {
    const productToModify = TestData[2];
    const productTransaction: Product = { id: productToModify.id, name: "Tablet", price: 800, stock: 10 };

    // Update the PK of the original record
    await transactionTable.update({ id: 100 }, { id: { $eq: productToModify.id } });
    // Insert new record in transaction table with the original PK
    await transactionTable.insert(productTransaction);
    // Try to update the inserted record to an existing PK
    const promiseUpdate =  transactionTable.update({ id: 100 }, { id: { $eq: productTransaction.id } });

    // Should throw an error because the PK is the same as the record that was inserted
    await expect(promiseUpdate).rejects.toThrow(DuplicatePrimaryKeyValueError);
    await expect(transactionTable.commit()).resolves.not.toThrow();
    expect(table.size()).toBe(TestData.length + 1);
  });

  it("should throw an error when trying to commit an update operation with primary keys conflicts", async () => {
    const productToTest = TestData[3];
    const newPk = 1000;
    const productMainTable: Product = { id: newPk, name: "Print", price: 800, stock: 10 }

    // Update a record with the new PK in the transaction table
    await transactionTable.update({ id: newPk }, { id: { $eq: productToTest.id } });
    // Insert a record with the same primary key in the main table
    table.insert(productMainTable);

    // Should throw an error because the PKs are the same
    await expect(transactionTable.commit()).rejects.toThrow(TransactionConflictError);
    expect(await table.findByPk({ id: productMainTable.id })).toEqual(productMainTable);
    expect(table.size()).toBe(TestData.length + 1);
  });

  it("should correctly update and swap primary keys of two records", async () => {
    const productToModifyA = TestData[2];
    const productToModifyB = TestData[3];

    // Modify the PK of the record A
    const modifyA = await transactionTable.update({ id: 100 }, { id: { $eq: productToModifyA.id } });
    // Modify the PK of the record B to the PK of the record A
    const modifyB = await transactionTable.update({ id: productToModifyA.id }, { id: { $eq: productToModifyB.id } });

    expect(modifyA).toBe(1);
    expect(modifyB).toBe(1);
    await expect(transactionTable.commit()).resolves.not.toThrow();
    // Validate the committed changes
    expect(await table.findByPk({ id: 100 })).toEqual({ ...productToModifyA, id: 100 });
    expect(await table.findByPk({ id: productToModifyA.id })).toEqual({ ...productToModifyB, id: productToModifyA.id });
    await expect(table.findByPk({ id: productToModifyB.id })).resolves.toBeNull();
    expect(table.size()).toBe(TestData.length);
  });

  it('update the PK of a record 2 times and commit it', async () => {
    const itemToTest = TestData[2];
    const originalPk = itemToTest.id;
    const newPk = 1000;

    // Update the PK for the first time
    const affectedRowsFirstUpdate = await transactionTable.update(
      { id: newPk }, { id: { $eq: originalPk } }
    );
    
    // Get the updated records, these records shouldn't exist after the second update
    const shouldNotExistAtEnd = await transactionTable.findByPk({ id: newPk });
    
    // Update the PK for the second time
    const affectedRowsSecondUpdate = await transactionTable.update(
      { id: originalPk }, { id: { $eq: newPk } }
    );

    const secondUpdatedRecord = await transactionTable.findByPk({ id: originalPk });
    const record = await transactionTable.findByPk({ id: shouldNotExistAtEnd?.id || newPk });

    expect(affectedRowsFirstUpdate).toBe(1);
    expect(shouldNotExistAtEnd).not.toBeNull();
    expect(affectedRowsSecondUpdate).toBe(1);

    // Check if the records with the original PK exists
    expect(secondUpdatedRecord).toEqual(itemToTest);
    // Check if the records with the new PK no longer exist
    expect(record).toBeNull();
    expect(transactionTable.size()).toBe(TestData.length);
    await expect(transactionTable.commit()).resolves.not.toThrow();
    // After commit
    await expect(transactionTable.findByPk({ id: shouldNotExistAtEnd?.id || newPk })).resolves.toBeNull();
    expect(table.size()).toBe(TestData.length);
  });
});