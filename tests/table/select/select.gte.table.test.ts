import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User, userPropertyList } from "../../types/user-test.type";

let userTable: Table<User>;

describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });

  it('filter records with gte operator', async () => {
    const valueGreaterOrEqual = 7;
    const result = await userTable.select([], { id: { gte: valueGreaterOrEqual } });
    expect(result).toHaveLength(thirtyItemsUserList.length - valueGreaterOrEqual + 1);
    expect(result.every(user => Number(user.id) >= valueGreaterOrEqual)).toBe(true);
  });

});