import { Table } from "../../../../src/core/table";
import { TransactionTable } from "../../../../src/core/transaction-table";
import { generateId } from "../../../../src/utils/generate-id";
import { User } from "../../../types/user-test.type";
import { findOneTests } from "../common-tests/find-one";

describe("Transaction Table - findOne() common tests", () => {
  findOneTests(async (testData) => {
      const table = new Table<User>({ primaryKey: ['id'] });
      await table.bulkInsert(testData);
      return new TransactionTable<User>(generateId(), table);
    });
});