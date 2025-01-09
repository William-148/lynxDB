import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User, userPropertyList } from "../../types/user-test.type";

let userTable: Table<User>;

describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });

  it('filter records with gt operator', async () => {
    const valueGreaterThan = 7;
    const result = await userTable.select([], { id: { gt: valueGreaterThan } });
    expect(result).toHaveLength(thirtyItemsUserList.length - valueGreaterThan);
    expect(result.every(user => Number(user.id) > valueGreaterThan)).toBe(true);
  });

});