import { Table } from "../../../src/core/table";
import { selectEqTests, selectEqTestsWithObjects } from "../common-tests/select/select.eq.table";
import { selectGtGteTests } from "../common-tests/select/select.gt.table";

//#region TESTS WITH EQ CONDITION
selectEqTests("Table - select() with eq condition - should...", (dataTest) => {
  const table = new Table<any>({ name: 'generic', primaryKey: ['id'] });
  table.bulkInsert(dataTest);
  return table;
});

selectEqTestsWithObjects("Table - select() with eq condition and objects - should...", () => {
  const table = new Table<any>({ name: 'generic', primaryKey: ['id'] });
  return table;
});
//#endregion

//#region TESTS WITH GT AND GTE CONDITIONS
selectGtGteTests("Table - select() with gt and gte condition - should...", (dataTest) => {
  const table = new Table<any>({ name: 'generic' });
  table.bulkInsert(dataTest);
  return table;
});
//#endregion