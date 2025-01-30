import { Config } from "../../../src/core/config";
import { Table } from "../../../src/core/table";
import { TransactionTable } from "../../../src/core/transaction-table";
import { IsolationLevel } from "../../../src/types/transaction.type";
import { generateId } from "../../../src/utils/generate-id";
import { User } from "../../types/user-test.type";

describe("Transaction table should", () => {

  it("create transaction tables correctly", async () => {
    const table = new Table<User>({ primaryKey: ['id', 'username'] });
    const transactionId = generateId();
    const ttable = new TransactionTable(transactionId, table);

    expect(ttable).toBeInstanceOf(TransactionTable);
    expect(ttable.transactionId).toEqual(transactionId);
    expect(ttable.primaryKeyDef).toEqual(['id', 'username']);
    expect(ttable.size()).toEqual(0);
  });

  it("create a transaction table with custom config correctly", async () => {
    const table = new Table<User>({ primaryKey: ['id'] });
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
    const ttableA = new TransactionTable(generateId(), table, customConfigA);
    const ttableB = new TransactionTable(generateId(), table, customConfigB);
    const ttableC = new TransactionTable(generateId(), table, customConfigC);

    expect(ttableA.config).toEqual(customConfigA);
    expect(ttableB.config).toEqual(customConfigB);
    expect(ttableC.config).toEqual(customConfigC);
  });

});