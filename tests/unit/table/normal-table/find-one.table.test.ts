import { Table } from "../../../../src/core/table";
import { User } from "../../../types/user-test.type";
import { findOneTests } from "../common-tests/find-one";

describe("Table - findOne()", () => {
  findOneTests(async (testData) => {
      const table = new Table<User>({ primaryKey: ['id'] });
      await table.bulkInsert(testData);
      return table;
    });
});