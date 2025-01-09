import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User, userPropertyList } from "../../types/user-test.type";

let userTable: Table<User>;

describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });

  it('filter records with lt operator', async () => {
    const valueLessThan = 16;
    const result = await userTable.select([], { id: { lt: valueLessThan } });
    expect(result).toHaveLength(valueLessThan - 1);
    expect(result.every(user => Number(user.id) < valueLessThan)).toBe(true);
  });

});