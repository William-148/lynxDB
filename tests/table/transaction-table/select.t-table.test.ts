import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { selectTestsWithFields, selectWithOperatorTest } from "../common-tests/select/select.table";
import { selectEqTests, selectEqTestsWithObjects } from "../common-tests/select/select.eq.table";
import { ScoreRecord, selectGtGteTests } from "../common-tests/select/select.gt.table";
import { selectIncludesTests } from "../common-tests/select/select.includes.table";
import { selectLikeTests } from "../common-tests/select/select.like.table";
import { selectLtLteTests } from "../common-tests/select/select.lt.table";
import { User } from "../../types/user-test.type";

//#region GENERAL SELECT TESTS
selectTestsWithFields("Transaction table - select() with fields - should...", async (dataTest) => {
  const middle = Math.floor(dataTest.length / 2);
  const table = new Table<User>({ primaryKey: ['id'] });
  await table.bulkInsert(dataTest.slice(0, middle));
  const transactionTable = new TransactionTable<User>(generateId(), table);
  await transactionTable.bulkInsert(dataTest.slice(middle));
  return transactionTable;
});

selectWithOperatorTest("Transaction table - select() with operator - should...", async () => {
  const table = new Table<any>({ primaryKey: ['id'] });
  return new TransactionTable<any>(generateId(), table);
});
//#endregion


//#region TESTS WITH EQ CONDITION
selectEqTests("Transaction table - select() with eq condition - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: ['id'] });
  await table.bulkInsert(dataTest);
  return new TransactionTable<any>(generateId(), table);
});

selectEqTestsWithObjects("Transaction table - select() with eq condition and objects - should...", async () => {
  const table = new Table<any>({ primaryKey: ['id'] });
  return new TransactionTable<any>(generateId(), table);
});
//#endregion


selectGtGteTests("Transaction table - select() with gt and gte condition - should...", async (dataTest) => {
  const table = new Table<ScoreRecord>({ });
  await table.bulkInsert(dataTest);
  return new TransactionTable<ScoreRecord>(generateId(), table);
});

selectIncludesTests("Transaction table - select() with include condition - should...", async (dataTest) => {
  const table = new Table<any>({ });
  await table.bulkInsert(dataTest);
  return new TransactionTable<any>(generateId(), table);
});

selectLikeTests("Transaction table - select() with like condition - should...", async (dataTest) => {
  const table = new Table<any>({ });
  await table.bulkInsert(dataTest);
  return new TransactionTable<any>(generateId(), table);
});

selectLtLteTests("Transaction table - select() with lt and lte conditions - should...", async (dataTest) => {
  const table = new Table<any>({ primaryKey: ['id'] });
  await table.bulkInsert(dataTest);
  return new TransactionTable<any>(generateId(), table);
});