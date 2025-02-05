import { Config } from "../../../../src/core/config";
import { LockTimeoutError } from "../../../../src/core/errors/record-lock-manager.error";
import { TransactionCompletedError } from "../../../../src/core/errors/transaction.error";
import { Table } from "../../../../src/core/table";
import { TransactionTable } from "../../../../src/core/transaction-table";
import { IsolationLevel } from "../../../../src/types/transaction.type";
import { generateId } from "../../../../src/utils/generate-id";
import { Product } from "../../../types/product-test.type";

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

    const promiseUpdate = transactionTable.update(UpdateProduct, { id: { eq: CommitedProduct.id }});
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
      { id: { eq: productToLock.id } }
    );

    // Try to update the same record in the main table
    await expect(
      table.update(mainTableUpdateAttempt, { id: { eq: productToLock.id } })
    ).rejects.toThrow(LockTimeoutError);

    // Commit to release the lock
    await transactionTable.commit();

    // Post-commit: The operation should be successful
    await expect(table.findByPk({ id: productToLock.id }))
      .resolves
      .toEqual({...productToLock, ...transactionTableUpdateAttempt});

    await expect(
      table.update(mainTableUpdateAttempt, { id: { eq: productToLock.id }})
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
      await transactionTable.update(update, { id: { eq: id } });
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

  it("should discard all changes on rollback", async () => {
    const doomedProduct: Product = { id: 888, name: "Doomed", price: 0, stock: 0 };
    const ooopsName = "ooops";
    
    // Operations in transaction
    await transactionTable.insert(doomedProduct);
    const updatedCount = await transactionTable.update({ name: ooopsName }, { id: { gt: 0 } });
    expect(updatedCount).toBe(TestData.length + 1);
    expect(await transactionTable.select([], { name: { eq: ooopsName }}))
      .toHaveLength(TestData.length + 1);
    
    // Explicit rollback
    await transactionTable.rollback();

    // Post-rollback: Original state
    expect(table.size()).toBe(TestData.length);
    expect(await table.select([], { name: { eq: ooopsName }}))
      .toHaveLength(0);
    expect(await table.findByPk({ id: doomedProduct.id })).toBeNull();

    // Transaction marked as completed
    await expect(transactionTable.apply()).rejects.toThrow(TransactionCompletedError);
    await expect(transactionTable.commit()).rejects.toThrow(TransactionCompletedError);
    await expect(transactionTable.rollback()).resolves.not.toThrow();
  });

  // it.only('update the composite PK of multiple records 2 times', async () => {
  //   const YearToTest = 2025;
  //   const OriginalSemester = 'Fall';
  //   const SemesterToUpdate = 'Summer';

  //   // Update the PK for the first time
  //   const affectedRowsFirstUpdate = await enrollmentTable.update(
  //     { semester: SemesterToUpdate }, 
  //     {
  //       year: { eq: YearToTest },
  //       semester: { eq: OriginalSemester }
  //     }
  //   );

  //   expect(affectedRowsFirstUpdate).toBe(4);

  //   // Get the updated records, these records shouldn't exist after the second update
  //   const shouldNotExistAtEnd = await enrollmentTable.select([], {
  //     year: { eq: YearToTest },
  //     semester: { eq: SemesterToUpdate }
  //   });

  //   expect(shouldNotExistAtEnd).toHaveLength(6);

  //   // Update the PK for the second time
  //   const affectedRowsSecondUpdate = await enrollmentTable.update(
  //     { semester: OriginalSemester }, 
  //     {
  //       year: { eq: YearToTest },
  //       semester: { eq: SemesterToUpdate }
  //     }
  //   );

  //   expect(affectedRowsSecondUpdate).toBe(6);

  //   // Check if the records with the original semester
  //   const secondUpdatedRecords = await enrollmentTable.select([], {
  //     year: { eq: YearToTest },
  //     semester: { eq: OriginalSemester }
  //   });
  //   expect(secondUpdatedRecords).toHaveLength(6);
  //   secondUpdatedRecords.forEach(item => {
  //     expect(item.year).toBe(YearToTest);
  //     expect(item.semester).toBe(OriginalSemester);
  //   });

  //   console.log('shouldNotExistAtEnd', await enrollmentTable.select([], {}));
  //   // console.log('shouldNotExistAtEnd', shouldNotExistAtEnd);

  //   // Check if the records with the old semester no longer exist
  //   for (let item of shouldNotExistAtEnd) {
  //     const record = await enrollmentTable.findByPk({
  //       year: item.year,
  //       semester: item.semester,
  //       courseId: item.courseId,
  //       studentId: item.studentId
  //     });
  //     expect(record).toBeNull();
  //   }
  //   expect(enrollmentTable.size()).toBe(enrollmentData.length);
  // });
});