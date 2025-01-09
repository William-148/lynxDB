import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User } from "../../types/user-test.type";

let userTable: Table<User>;

describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });

  it('filter records with eq operator', async () => {
    const expected = thirtyItemsUserList[2];
    const resultList = await userTable.select([], { id: { eq: expected.id } });
    const resultItem = resultList[0]; // This should have all properties of User
    expect(resultList).toHaveLength(1);
    expect(resultItem).not.toBe(expected);
    expect(resultItem).toEqual(expected);
  });

});
