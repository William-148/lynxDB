import { Table } from "../../../src/core/table";
import { User } from "../../types/user-test.type";
import { OrderDetail } from "../../types/order-test.type";
import { findByPkTestWithCompositePK, findByPkTestWithoutPK, findByPkTestWithSinglePK } from "../common-tests/find-by-pk";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";

findByPkTestWithSinglePK("Transaction table with single PK - findByPk() - should...", () => {
  const table = new Table<User>({ name: 'user', primaryKey: ['id'] });
  return new TransactionTable<User>(
    generateId(),
    table
  );
});


findByPkTestWithCompositePK("Transaction table with composite PK - findByPk() - should...", () => {
  const table =  new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ['orderId', 'productId'] });
  return new TransactionTable<OrderDetail>(
    generateId(),
    table
  );
});


type UserWithDefaultId = User & { _id?: string };
findByPkTestWithoutPK("Transaction table without PK - findByPk() - should...", () => {
  const table =  new Table<UserWithDefaultId>({ name: 'user' });
  return new TransactionTable<UserWithDefaultId>(
    generateId(),
    table
  );
});