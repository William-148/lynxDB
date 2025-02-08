import { ITable } from "../../../../../src/types/table.type";
import { thirtyItemsUserList } from "../../../../data/data-test";
import { User, userPropertyList } from "../../../../types/user-test.type";

/**
 * Common test for the select() method with fields
 * @param createInstance Function that receives the data to be inserted and returns a new instance of the Table
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData: User) => {
 *  const table = new Table<User>({ primaryKey: ['id'] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * ```
 */
export function selectTestsWithFields(createInstance: (testData: User[]) => Promise<ITable<User>>) {
  describe("With select specific fields - should...", () => {
    let userTable: ITable<User>;
    
    beforeEach(async () => {
      userTable = await createInstance(thirtyItemsUserList);
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
}

/**
 * Common test for the select() method with wrong query operator
 * 
 * @param createInstance Function that returns a new instance of the Table
 * 
 * Param Example:
 * ```ts
 * const createInstance = async () => new Table<any>({ primaryKey: ['id'] });
 * ```
 */
export function selectWithWrongQueryOperatorTest(createInstance: () => Promise<ITable<any>>) {
  describe("With wrong query operator", () => {
    let defaultTable: ITable<any>;

    beforeEach(async () => {
      defaultTable = await createInstance();
    });
    
    it("throw an error when the operator is not recognized", async () => {
      
      const tryToFilter = async () => {
        await defaultTable.select([], { 
          id: { unexistent_operator: 1 } as any 
        });
      }
  
      await expect(tryToFilter)
        .rejects
        .toThrow(/^Unsupported operator:/);
      
    });
  });
}
