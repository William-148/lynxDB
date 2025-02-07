import { Table } from "../../../../src/core/table";
import { User } from "../../../types/user-test.type";
import { OrderDetail } from "../../../types/order-test.type";
import { TransactionTable } from "../../../../src/core/transaction-table";
import { generateId } from "../../../../src/utils/generate-id";
import { 
  findByPkTestWithCompositePK,
  findByPkTestWithoutPK,
  findByPkTestWithSinglePK
} from "../common-tests/find-by-pk";

findByPkTestWithSinglePK("Transaction table with single PK - findByPk() - should...", async (testData) => {
  const table = new Table<User>({ primaryKey: ['id'] });
  await table.bulkInsert(testData);
  return new TransactionTable<User>(generateId(), table);
});


findByPkTestWithCompositePK("Transaction table with composite PK - findByPk() - should...", async (testData) => {
  const table =  new Table<OrderDetail>({ primaryKey: ['orderId', 'productId'] });
  await table.bulkInsert(testData);
  return new TransactionTable<OrderDetail>(generateId(), table);
});


findByPkTestWithoutPK("Transaction table without PK - findByPk() - should...", async (testData) => {
  const table =  new Table<User & { _id?: string }>({ primaryKey: [] });
  await table.bulkInsert(testData);
  return new TransactionTable<User & { _id?: string }>(generateId(), table);
});