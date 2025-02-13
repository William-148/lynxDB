import { Table } from "../../../../src/core/table";
import { User } from "../../../types/user-test.type";
import { OrderDetail } from "../../../types/order-test.type";
import { 
  findByPkTestWithCompositePK,
  findByPkTestWithoutPK,
  findByPkTestWithSinglePK
} from "../common-tests/find-by-pk";

describe("Table - findByPk()", () => {
  findByPkTestWithSinglePK(async (testData) => {
    const table = new Table<User>({ primaryKey: ['id'] });
    await table.bulkInsert(testData);
    return table;
  });
  
  
  findByPkTestWithCompositePK(async (testData) => {
    const table = new Table<OrderDetail>({ primaryKey: ['orderId', 'productId'] });
    await table.bulkInsert(testData);
    return table;
  });
  
  
  findByPkTestWithoutPK(async (testData) => {
    const table = new Table<User & { _id?: string }>({ primaryKey: [] });
    await table.bulkInsert(testData);
    return table;
  });
});

