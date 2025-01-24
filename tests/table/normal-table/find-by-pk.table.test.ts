import { Table } from "../../../src/core/table";
import { User } from "../../types/user-test.type";
import { OrderDetail } from "../../types/order-test.type";
import { 
  findByPkTestWithCompositePK,
  findByPkTestWithoutPK,
  findByPkTestWithSinglePK
} from "../common-tests/find-by-pk";

findByPkTestWithSinglePK("Table with single PK - findByPk() - should...", async (testData) => {
  const table = new Table<User>({ name: 'user', primaryKey: ['id'] });
  await table.bulkInsert(testData);
  return table;
});


findByPkTestWithCompositePK("Table with composite PK - findByPk() - should...", async (testData) => {
  const table = new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ['orderId', 'productId'] });
  await table.bulkInsert(testData);
  return table;
});


findByPkTestWithoutPK("Table without PK - findByPk() - should...", async (testData) => {
  const table = new Table<User & { _id?: string }>({ name: 'user' });
  await table.bulkInsert(testData);
  return table;
});
