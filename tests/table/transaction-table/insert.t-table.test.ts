import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { OrderDetail } from "../../types/order-test.type";
import { User } from "../../types/user-test.type";
import { insertTestWithCompositePK, insertTestWithoutPK, insertTestWithSinglePK } from "../common-tests/insert.table";

insertTestWithSinglePK("Transaction table with single PK - insert() - should...", () => {
  const table = new Table<User>({ name: 'user', primaryKey: ['id'] });
  return new TransactionTable<User>(
      generateId(),
      table
    );
}); 

insertTestWithCompositePK("Transaction table with composite PK - insert() - should...", () => {
  const table = new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ['orderId', 'productId'] });
  return new TransactionTable<OrderDetail>(
    generateId(),
    table
  );
});

insertTestWithoutPK("Transaction table without PK - insert() - should...", () => {
  const table = new Table<User>({ name: 'user' });
  return new TransactionTable<User>(
    generateId(),
    table
  );
});