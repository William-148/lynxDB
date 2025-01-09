import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User } from "../../types/user-test.type";

let userTable: Table<User>;
describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });

  it('filter records with lte operator', async () => {
    const valueLowerOrEqual = 14;
    const result = await userTable.select([], { id: { lte: valueLowerOrEqual } });
    expect(result).toHaveLength(valueLowerOrEqual);
    expect(result.every(user => Number(user.id) <= valueLowerOrEqual)).toBe(true);
  });
});