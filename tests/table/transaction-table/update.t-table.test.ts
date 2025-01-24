import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { Enrollment } from "../../types/enrollment-test.type";
import { 
  updateTestWithCompositePK,
  updateTestWithoutPK,
  updateTestWithSinglePK
} from "../common-tests/update.table";

updateTestWithSinglePK("Transaction table with single PK - update() - should...", async (testData) => {
  const table = new Table<any>({ name: 'entities', primaryKey: ['id'] });
  await table.bulkInsert(testData);
  return new TransactionTable<any>(generateId(), table);
});

updateTestWithoutPK("Transaction table without PK - update() - should...", async (testData) => {
  const table = new Table<any>({ name: 'entities' });
  await table.bulkInsert(testData);
  return new TransactionTable<any>(generateId(), table);
});

updateTestWithCompositePK("Transaction table with composite PK - update() - should...", async (testData) => {
  const table = new Table<Enrollment>({ name: 'entities', primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
  await table.bulkInsert(testData);
  return new TransactionTable<Enrollment>(generateId(), table);
});