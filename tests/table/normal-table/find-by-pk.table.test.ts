import { Table } from "../../../src/core/table";
import { User } from "../../types/user-test.type";
import { OrderDetail } from "../../types/order-test.type";
import { findByPkTestWithCompositePK, findByPkTestWithoutPK, findByPkTestWithSinglePK } from "../common-tests/find-by-pk";

findByPkTestWithSinglePK("Table with single PK - findByPk() - should...", () => {
  return new Table<User>({ name: 'user', primaryKey: ['id'] });
});


findByPkTestWithCompositePK("Table with composite PK - findByPk() - should...", () => {
  return new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ['orderId', 'productId'] });
});


type UserWithDefaultId = User & { _id?: string };
findByPkTestWithoutPK("Table without PK - findByPk() - should...", () => {
  return new Table<UserWithDefaultId>({ name: 'user' });
});
