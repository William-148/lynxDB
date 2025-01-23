import { Table } from "../../../src/core/table";
import { User } from "../../types/user-test.type";
import { 
  DuplicatePrimaryKeyDefinitionError,
} from "../../../src/core/errors/table.error";

describe("Table should", () => {

  it("create a table with a primary key", async () => {
    const userTb = new Table<User>({ name: 'user', primaryKey: ['id'] });
    expect(userTb).toBeInstanceOf(Table);
    expect(userTb.name).toBe('user');
  });

  it("throw an error when duplicate fields are provided for the primary key", async () => {
    const createTableWrong = async () => {
      new Table<User>({ name: 'user', primaryKey: ['id', 'id', 'email', 'email'] });
    }
    await expect(createTableWrong)
      .rejects
      .toThrow(DuplicatePrimaryKeyDefinitionError);
  });

});

