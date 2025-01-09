import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User } from "../../types/user-test.type";

let userTable: Table<User>;


describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });


  it('filter records with includes operator', async () => {
    const expected = [
      thirtyItemsUserList[0].id, 
      thirtyItemsUserList[2].id,
      thirtyItemsUserList[4].id
    ];
    const result = await userTable.select([], { id: { includes: expected} });
    expect(result).toHaveLength(expected.length);
    for (let test of result) {
      expect(expected).toContain(test.id);
    }
  });

  });