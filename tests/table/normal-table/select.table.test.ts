import { Table } from "../../../src/core/table";
import { selectGtGteTests } from "../common-tests/select/select.gt.table";

selectGtGteTests("Table - select() with gt and gte condition - should...", (dataTest) => {
  const table = new Table<any>({ name: 'generic' });
  table.bulkInsert(dataTest);
  return table;
});