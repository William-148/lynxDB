import { TableSchema } from "../../../../src/types/table.type";
import { thirtyItemsUserList } from "../../../data/data-test";
import { User } from "../../../types/user-test.type";
import { createRandomUser } from "../../../utils/user.utils";

/**
 * Common tests for findOne() method
 * 
 * @param createInstance Function that return a new instance of Table< User > with "id" as PK.
 * It is used to create a new instance of Table<User> for each test.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<User>({ primaryKey: ['id'] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * 
 * ```
 */
export function findOneTests(createInstance: (testData: User[]) => Promise<TableSchema<User>>) {

  describe("findOne()", () => {
    let userTable: TableSchema<User>; // primaryKey: ['id']
    beforeEach(async () => {
      userTable = await createInstance(thirtyItemsUserList);
    });

    it("should return the first match", async () => {
      const itemTest = thirtyItemsUserList[1];
      const found = await userTable.findOne({
        username: itemTest.username
      });

      expect(found).toEqual(itemTest);
    });

    it("should return the first match of many", async () => {
      const itemTest = thirtyItemsUserList[2];
      const found = await userTable.findOne({
        gender: itemTest.gender
      });

      expect(found).toEqual(itemTest);
    });

    it("should return the first match with multiple conditions", async () => {
      const itemTest = thirtyItemsUserList[9];
      const found = await userTable.findOne({
        username: itemTest.username,
        password: itemTest.password
      });

      expect(found).toEqual(itemTest);
    });

    it("should return the first match with new inserted records", async () => {
      const inserted1 = await userTable.insert(createRandomUser(1001));
      const inserted2 = await userTable.insert(createRandomUser(1002));

      const found1 = await userTable.findOne({
        $and: [
          { fullName: inserted1.fullName },
          { username: inserted1.username },
          { password: inserted1.password }
        ]
      });
      const found2 = await userTable.findOne({
        $and: [
          { fullName: inserted2.fullName },
          { username: inserted2.username },
          { password: inserted2.password }
        ]
      });

      expect(found1).toEqual(inserted1);
      expect(found2).toEqual(inserted2);
    });

    it("should return null if not found", async () => {
      const itemTest = thirtyItemsUserList[13];
      const notFound = await userTable.findOne({
        username: itemTest.username,
        password: 'not-exist'
      });
      const notExist = await userTable.findOne({
        username: 'not-exist'
      });

      expect(notFound).toBeNull();
      expect(notExist).toBeNull();
    });

  });
}