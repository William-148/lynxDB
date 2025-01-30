import { Table } from "../../../src/core/table";
import { User } from "../../types/user-test.type";
import { 
  DuplicatePrimaryKeyDefinitionError,
} from "../../../src/core/errors/table.error";
import { Config } from "../../../src/core/config";
import { IsolationLevel } from "../../../src/types/transaction.type";

describe("Table should", () => {

  it("create a table with a primary key", async () => {
    const userTb = new Table<User>({ primaryKey: ['id', 'username'] });
    expect(userTb).toBeInstanceOf(Table);
    expect(userTb.primaryKeyDef).toEqual(['id', 'username']);
  });

  it("create tables with custom config correctly", async () => {
    const customConfigA: Config = new Config({ 
      isolationLevel: IsolationLevel.StrictLocking,
      lockTimeout: 1234
    });

    const customConfigB: Config = new Config({ 
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 4321
    });

    const customConfigC: Config = new Config({
      lockTimeout: 1111
    });

    const tableA = new Table<User>({ primaryKey: ['id'] }, customConfigA);
    const tableB = new Table<User>({ primaryKey: ['id'] }, customConfigB);
    const tableC = new Table<User>({ primaryKey: ['id'] }, customConfigC);

    expect(tableA.config).toEqual(customConfigA);
    expect(tableB.config).toEqual(customConfigB);
    expect(tableC.config).toEqual(customConfigC);
  });

  it("throw an error when duplicate fields are provided for the primary key", async () => {
    const createTableWrong = async () => {
      new Table<User>({ primaryKey: ['id', 'id', 'email', 'email'] });
    }
    await expect(createTableWrong)
      .rejects
      .toThrow(DuplicatePrimaryKeyDefinitionError);
  });

});

