import { Table } from "../../../src/core/table";
import { selectTestsWithFields, selectWithOperatorTest } from "../common-tests/select/select.table";
import { selectEqTests, selectEqTestsWithObjects } from "../common-tests/select/select.eq.table";
import { selectGtGteTests } from "../common-tests/select/select.gt.table";
import { selectIncludesTests } from "../common-tests/select/select.includes.table";
import { selectLikeTests } from "../common-tests/select/select.like.table";
import { selectLtLteTests } from "../common-tests/select/select.lt.table";

//#region GENERAL SELECT TESTS
selectTestsWithFields("Table - select() with fields - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: ['id'] });
  await table.bulkInsert(dataTest);
  return table;
});

selectWithOperatorTest("Table - select() with operator - should...", async () => {
  const table = new Table<any>({ primaryKey: ['id'] });
  return table;
});
//#endregion


//#region TESTS WITH EQ CONDITION
selectEqTests("Table - select() with eq condition - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: ['id'] });
  await table.bulkInsert(dataTest);
  return table;
});

selectEqTestsWithObjects("Table - select() with eq condition and objects - should...", async () => {
  const table = new Table<any>({ primaryKey: ['id'] });
  return table;
});
//#endregion


selectGtGteTests("Table - select() with gt and gte condition - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: [] });
  await table.bulkInsert(dataTest);
  return table;
});

selectIncludesTests("Table - select() with include condition - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: [] });
  await table.bulkInsert(dataTest);
  return table;
});

selectLikeTests("Table - select() with like condition - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: [] });
  await table.bulkInsert(dataTest);
  return table;
});

selectLtLteTests("Table - select() with lt and lte conditions - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: ['id'] });
  await table.bulkInsert(dataTest);
  return table;
});