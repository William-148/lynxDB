import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { generateId } from "../../../src/utils/generate-id";
import { OrderDetail } from "../../types/order-test.type";
import { User } from "../../types/user-test.type";
import { 
  bulkInsertTestsWithCompositePK,
  bulkInsertTestsWithSinglePK,
  bulkInsertTestWithoutPK 
} from "../common-tests/bulk-insert.table";

bulkInsertTestsWithSinglePK("Transaction table with single PK - bulkInsert() - should...", () =>{
  const table = new Table<User>({ name: 'user', primaryKey: ['id'] });
  return new TransactionTable<User>(generateId(), table);
});

bulkInsertTestsWithCompositePK("Transaction table with composite PK - bulkInsert() - should...", () =>{
  const table = new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ['orderId', 'productId'] });
  return new TransactionTable<OrderDetail>(generateId(), table);
});

bulkInsertTestWithoutPK("Transaction table without PK - bulkInsert() - should...", () =>{
  const table = new Table<User>({ name: 'user' });
  return new TransactionTable<User>(generateId(), table);
});
