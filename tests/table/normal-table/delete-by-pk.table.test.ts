import { Table } from "../../../src/core/table";
import { Enrollment } from "../../types/enrollment-test.type";
import { Product } from "../../types/product-test.type";
import { 
  deleteByPkTestWithCompositePK, 
  deleteByPkTestWithDefaultPK, 
  deleteByPkTestWithSimplePK 
} from "../common-tests/delete-by-pk";

describe('Table - deleteByPk() ', () => {
  deleteByPkTestWithSimplePK(async (testData) => {
    const table = new Table<Product>({ primaryKey: ['id'] });
    await table.bulkInsert(testData);
    return table;
  });

  deleteByPkTestWithDefaultPK(async (testData) => {
    const table = new Table<Product & { _id?: string }>({ primaryKey: [] });
    await table.bulkInsert(testData);
    return table;
  });

  deleteByPkTestWithCompositePK(async (testData) => {
    const table = new Table<Enrollment>({ primaryKey: ['year', 'semester', 'courseId', 'studentId'] });
    await table.bulkInsert(testData);
    return table;
  });

});