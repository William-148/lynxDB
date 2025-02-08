import { Table } from "../../../../src/core/table";
import { selectTestsWithFields, selectWithWrongQueryOperatorTest } from "../common-tests/select/select.table";
import { selectEqTests, selectEqTestsWithObjects } from "../common-tests/select/select.eq.table";
import { selectGtGteTests } from "../common-tests/select/select.gt.table";
import { selectIncludesTests } from "../common-tests/select/select.includes.table";
import { selectLikeTests } from "../common-tests/select/select.like.table";
import { selectLtLteTests } from "../common-tests/select/select.lt.table";
import { selectNeTests, selectNeTestsWithObjects } from "../common-tests/select/select.ne.table";

describe("Table - select() method", () => {
  //#region GENERAL SELECT TESTS
  selectTestsWithFields(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return table;
  });
  
  selectWithWrongQueryOperatorTest(async () => {
    const table = new Table<any>({ primaryKey: ['id'] });
    return table;
  });
  //#endregion

  //#region TESTS WITH EQ CONDITION
  selectEqTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return table;
  });
  
  selectEqTestsWithObjects(async () => {
    const table = new Table<any>({ primaryKey: ['id'] });
    return table;
  });
  //#endregion

  //#region TESTS WITH NE CONDITION
  selectNeTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return table;
  });
  
  selectNeTestsWithObjects(async () => {
    const table = new Table<any>({ primaryKey: ['id'] });
    return table;
  });
  //#endregion
  
  selectGtGteTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: [] });
    await table.bulkInsert(dataTest);
    return table;
  });

  selectIncludesTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: [] });
    await table.bulkInsert(dataTest);
    return table;
  });
  
  selectLikeTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: [] });
    await table.bulkInsert(dataTest);
    return table;
  });
  
  selectLtLteTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return table;
  });
});
