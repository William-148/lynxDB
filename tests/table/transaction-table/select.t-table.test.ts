import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { ScoreRecord, selectGtGteTests } from "../common-tests/select/select.gt.table";

selectGtGteTests("Transaction table - select() with gt and gte condition - should...", (dataTest) => {
  const table = new Table<ScoreRecord>({ name: 'generic' });
  table.bulkInsert(dataTest);
  return new TransactionTable<ScoreRecord>(generateId(), table);
});