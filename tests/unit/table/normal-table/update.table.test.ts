import { Table } from "../../../../src/core/table";
import { Enrollment } from "../../../types/enrollment-test.type";
import { 
  updateTestWithCompositePK, 
  updateTestWithoutPK, 
  updateTestWithSinglePK 
} from "../common-tests/update.table";

describe('Table - update() - should...', () => {
  updateTestWithSinglePK(async (testData) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(testData);
    return table;
  });
  
  updateTestWithCompositePK(async (testData) => {
    const table = new Table<Enrollment>({ primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
    await table.bulkInsert(testData);
    return table;
  });
  
  updateTestWithoutPK(async (testData) => {
    const table = new Table<any>({ primaryKey: [] });
    await table.bulkInsert(testData);
    return table;
  });
});