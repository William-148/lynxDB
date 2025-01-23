import { Table } from "../../../src/core/table";
import { Enrollment } from "../../types/enrollment-test.type";
import { 
  updateTestWithCompositePK, 
  updateTestWithoutPK, 
  updateTestWithSinglePK 
} from "../common-tests/update.table";

updateTestWithSinglePK("Table with single PK - update() - should...", (testData) => {
  const table = new Table<any>({ name: 'entities', primaryKey: ['id'] });
  table.bulkInsert(testData);
  return table;
});

updateTestWithCompositePK("Table with composite PK - update() - should...", (testData) => {
  const table = new Table<Enrollment>({ name: 'entities', primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
  table.bulkInsert(testData);
  return table;
});

updateTestWithoutPK("Table without PK - update() - should...", (testData) => {
  const table = new Table<any>({ name: 'entities' });
  table.bulkInsert(testData);
  return table;
});