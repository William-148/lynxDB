import { Table } from "../../../src/core/table";
import { OrderDetail } from "../../types/order-test.type";
import { User } from "../../types/user-test.type";
import { 
  bulkInsertTestsWithCompositePK,
  bulkInsertTestsWithSinglePK,
  bulkInsertTestWithoutPK 
} from "../common-tests/bulk-insert.table";

bulkInsertTestsWithSinglePK("Table with single PK - bulkInsert() - should...", () =>{
  return new Table<User>({ primaryKey: ['id'] });
});

bulkInsertTestsWithCompositePK("Table with composite PK - bulkInsert() - should...", () =>{
 return new Table<OrderDetail>({ primaryKey: ['orderId', 'productId'] });
});

bulkInsertTestWithoutPK("Table without PK - bulkInsert() - should...", () =>{
  return new Table<User>({ primaryKey: [] });
});
