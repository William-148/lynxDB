import { Table } from "../../src/core/table";
import { User } from "../types/user-test.type";
import { 
  DuplicatePrimaryKeyDefinitionError,
} from "../../src/core/errors/table.error";

describe("Table should", () => {

  it("create a table with a primary key", async () => {
    const userTb = new Table<User>('user', ['id']);
    expect(userTb).toBeInstanceOf(Table);
  });

  it("throw an error when duplicate fields are provided for the primary key", async () => {
    const createTableWrong = async () => {
      new Table<User>('user', ['id', 'id', 'email', 'email']);
    }
    expect(createTableWrong).rejects.toThrow(DuplicatePrimaryKeyDefinitionError);
  });

});

