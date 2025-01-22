import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User, userPropertyList } from "../../types/user-test.type";

let userTable: Table<User>;

describe("Table - select() with fields - should...", () => {

  beforeEach(async () => {
    userTable = new Table<User>({ name: 'user', primaryKey: ['id'] });
    await userTable.bulkInsert(thirtyItemsUserList);
  });

  function generatePartialUser(user: User, propertiesToAdd: (keyof User)[]): Partial<User> {
    const partialUser: Partial<User> = {};
    for (let property of propertiesToAdd) {
      partialUser[property] = user[property] as any;
    }
    return partialUser;
  }

  it("return all registers when no conditions are provided", async () => {
    const resultList = await userTable.select([], {});
    const resultItem = resultList[3];

    expect(resultList.length).toBe(thirtyItemsUserList.length);
    for (let property of userPropertyList) {
      expect(resultItem).toHaveProperty(property);
    } 
  });

  it("returns the correct fields when the fields parameter is provided", async () => {
    const itemUsedForTesting = thirtyItemsUserList[2];
    const propertiesToSelect: (keyof User)[] = ["email", "id", "password"];
    const expectedResult = generatePartialUser(itemUsedForTesting, propertiesToSelect);

    const resultList = await userTable.select(propertiesToSelect, {});
    const resultItem = resultList.find(u => u.id === itemUsedForTesting.id);

    expect(resultList.length).toBe(thirtyItemsUserList.length);
    for (let item of userPropertyList) {
      expect(resultItem?.[item]).toBe(expectedResult[item]);
    }
  });

  it("returns the correct fields when the fields parameter has duplicated items", async () => {
    const itemUsedForTesting = thirtyItemsUserList[8];
    const propertiesToSelect: (keyof User)[] = ["id", "username", "age", "id", "age", "username", "id"];
    const expectedResult = generatePartialUser(itemUsedForTesting, propertiesToSelect);

    const resultList = await userTable.select(propertiesToSelect, {});
    const resultItem = resultList.find(u => u.id === itemUsedForTesting.id);

    expect(resultList.length).toBe(thirtyItemsUserList.length);
    for (let item of userPropertyList) {
      expect(resultItem?.[item]).toBe(expectedResult[item]);
    }
  });

});

describe("Table - select() with nonexistent operator as condition - should...", () => {
  
  it("throw an error when the operator is not recognized", async () => {
    const table = new Table<any>({ name: 'test', primaryKey: ['id'] });
    
    const tryToFilter = async () => {
      await table.select([], { 
        id: { unexistent_operator: 1 } as any 
      });
    }

    await expect(tryToFilter)
      .rejects
      .toThrow(/^Unsupported operator:/);
    
  });
});
