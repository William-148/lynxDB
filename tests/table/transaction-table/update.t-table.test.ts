import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { Enrollment } from "../../types/enrollment-test.type";
import { 
  updateTestWithCompositePK,
  updateTestWithoutPK,
  updateTestWithSinglePK
} from "../common-tests/update.table";

describe('Transaction Table - update() - should...', () => {
  updateTestWithSinglePK(async (testData) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(testData);
    return new TransactionTable<any>(generateId(), table);
  });
  
  updateTestWithoutPK(async (testData) => {
    const table = new Table<any>({ });
    await table.bulkInsert(testData);
    return new TransactionTable<any>(generateId(), table);
  });
  
  updateTestWithCompositePK(async (testData) => {
    const table = new Table<Enrollment>({ primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
    await table.bulkInsert(testData);
    return new TransactionTable<Enrollment>(generateId(), table);
  });
});