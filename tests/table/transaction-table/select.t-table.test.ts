import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { selectEqTests, selectEqTestsWithObjects } from "../common-tests/select/select.eq.table";
import { ScoreRecord, selectGtGteTests } from "../common-tests/select/select.gt.table";

//#region TESTS WITH EQ CONDITION
selectEqTests("Transaction table - select() with eq condition - should...", (dataTest) => {
  const table = new Table<any>({ name: 'generic', primaryKey: ['id'] });
  table.bulkInsert(dataTest);
  return new TransactionTable<any>(generateId(), table);
});

selectEqTestsWithObjects("Transaction table - select() with eq condition and objects - should...", () => {
  const table = new Table<any>({ name: 'generic', primaryKey: ['id'] });
  return new TransactionTable<any>(generateId(), table);
});
//#endregion

//#region TESTS WITH GT AND GTE CONDITIONS
selectGtGteTests("Transaction table - select() with gt and gte condition - should...", (dataTest) => {
  const table = new Table<ScoreRecord>({ name: 'generic' });
  table.bulkInsert(dataTest);
  return new TransactionTable<ScoreRecord>(generateId(), table);
});
//#endregion