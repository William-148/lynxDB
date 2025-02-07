import { Table } from "../../../../src/core/table";
import { OrderDetail } from "../../../types/order-test.type";
import { User } from "../../../types/user-test.type";
import { insertTestWithCompositePK, insertTestWithoutPK, insertTestWithSinglePK } from "../common-tests/insert.table";

insertTestWithSinglePK("Table with single PK - insert() - should...", () => {
  return new Table<User>({ primaryKey: ['id'] });
}); 

insertTestWithCompositePK("Table with composite PK - insert() - should...", () => {
  return new Table<OrderDetail>({ primaryKey: ['orderId', 'productId'] });
});

insertTestWithoutPK("Table without PK - insert() - should...", () => {
  return new Table<User>({ primaryKey: [] });
});