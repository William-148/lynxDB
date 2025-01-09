import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User, userPropertyList } from "../../types/user-test.type";

let userTable: Table<User>;

describe ("Table - select() with conditions - should...", () => {
  
  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
    userTable.bulkInsert(thirtyItemsUserList);
  });

  it('should filter records with like operator', async () => {
    const filterTest: User[] = [
      { id: 1, fullName: "Huntlee Philpott", gender: "Male", age: 53, email: "hphilpott0@topsy.com", username: "hphilpott0", password: "gW9{L*&AL" },
      { id: 2, fullName: "Catharina Glandon", gender: "Female", age: 79, email: "cglandon1@facebook.com", username: "cglandon1", password: "uY1&wvYZNg" },
      { id: 3, fullName: "Reid Espadate", gender: "Male", age: 30, email: "respadate2@eepurl.com", username: "respadate2", password: "eQ0~a)~>O" }
    ];
    const table = new Table<User>('user', ['id']);
    table.bulkInsert(filterTest);
    const result = await table.select([], { fullName: { like: 'Reid%' } });
    expect(result).toEqual([filterTest[2]]);
  });

});