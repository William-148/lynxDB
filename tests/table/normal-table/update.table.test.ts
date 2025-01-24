import { Table } from "../../../src/core/table";
import { Enrollment } from "../../types/enrollment-test.type";
import { 
  updateTestWithCompositePK, 
  updateTestWithoutPK, 
  updateTestWithSinglePK 
} from "../common-tests/update.table";

updateTestWithSinglePK("Table with single PK - update() - should...", async (testData) => {
  const table = new Table<any>({ name: 'entities', primaryKey: ['id'] });
  await table.bulkInsert(testData);
  return table;
});

updateTestWithCompositePK("Table with composite PK - update() - should...", async (testData) => {
  const table = new Table<Enrollment>({ name: 'entities', primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
  await table.bulkInsert(testData);
  return table;
});

updateTestWithoutPK("Table without PK - update() - should...", async (testData) => {
  const table = new Table<any>({ name: 'entities' });
  await table.bulkInsert(testData);
  return table;
});