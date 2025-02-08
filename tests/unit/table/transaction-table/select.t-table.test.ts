import { Table } from "../../../../src/core/table";
import { TransactionTable } from "../../../../src/core/transaction-table";
import { generateId } from "../../../../src/utils/generate-id";
import { selectTestsWithFields, selectWithWrongQueryOperatorTest } from "../common-tests/select/select.table";
import { selectEqTests, selectEqTestsWithObjects } from "../common-tests/select/select.eq.table";
import { ScoreRecord, selectGtGteTests } from "../common-tests/select/select.gt.table";
import { selectIncludesTests } from "../common-tests/select/select.includes.table";
import { selectLikeTests } from "../common-tests/select/select.like.table";
import { selectLtLteTests } from "../common-tests/select/select.lt.table";
import { User } from "../../../types/user-test.type";
import { selectNeTests, selectNeTestsWithObjects } from "../common-tests/select/select.ne.table";

describe("Transaction Table - select() method", () => {
  //#region GENERAL SELECT TESTS
  selectTestsWithFields(async (dataTest) => {
    const middle = Math.floor(dataTest.length / 2);
    const table = new Table<User>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest.slice(0, middle));
    const transactionTable = new TransactionTable<User>(generateId(), table);
    await transactionTable.bulkInsert(dataTest.slice(middle));
    return transactionTable;
  });
  
  selectWithWrongQueryOperatorTest(async () => {
    const table = new Table<any>({ primaryKey: ['id'] });
    return new TransactionTable<any>(generateId(), table);
  });
  //#endregion

  //#region TESTS WITH EQ CONDITION
  selectEqTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return new TransactionTable<any>(generateId(), table);
  });
  
  selectEqTestsWithObjects(async () => {
    const table = new Table<any>({ primaryKey: ['id'] });
    return new TransactionTable<any>(generateId(), table);
  });
  //#endregion

  //#region TESTS WITH NE CONDITION
  selectNeTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return new TransactionTable<any>(generateId(), table);
  });
  
  selectNeTestsWithObjects(async () => {
    const table = new Table<any>({ primaryKey: ['id'] });
    return new TransactionTable<any>(generateId(), table);
  });
  //#endregion
  
  selectGtGteTests(async (dataTest) => {
    const table = new Table<ScoreRecord>({ });
    await table.bulkInsert(dataTest);
    return new TransactionTable<ScoreRecord>(generateId(), table);
  });
  
  selectIncludesTests(async (dataTest) => {
    const table = new Table<any>({ });
    await table.bulkInsert(dataTest);
    return new TransactionTable<any>(generateId(), table);
  });
  
  selectLikeTests(async (dataTest) => {
    const table = new Table<any>({ });
    await table.bulkInsert(dataTest);
    return new TransactionTable<any>(generateId(), table);
  });
  
  selectLtLteTests(async (dataTest) => {
    const table = new Table<any>({ primaryKey: ['id'] });
    await table.bulkInsert(dataTest);
    return new TransactionTable<any>(generateId(), table);
  });
});
