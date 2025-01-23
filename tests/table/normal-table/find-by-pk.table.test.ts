import { Table } from "../../../src/core/table";
import { User } from "../../types/user-test.type";
import { OrderDetail } from "../../types/order-test.type";
import { 
  findByPkTestWithCompositePK,
  findByPkTestWithoutPK,
  findByPkTestWithSinglePK
} from "../common-tests/find-by-pk";

findByPkTestWithSinglePK("Table with single PK - findByPk() - should...", (testData) => {
  const table = new Table<User>({ name: 'user', primaryKey: ['id'] });
  table.bulkInsert(testData);
  return table;
});


findByPkTestWithCompositePK("Table with composite PK - findByPk() - should...", (testData) => {
  const table = new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ['orderId', 'productId'] });
  table.bulkInsert(testData);
  return table;
});


type UserWithDefaultId = User & { _id?: string };
findByPkTestWithoutPK("Table without PK - findByPk() - should...", (testData) => {
  const table = new Table<UserWithDefaultId>({ name: 'user' });
  table.bulkInsert(testData);
  return table;
});
