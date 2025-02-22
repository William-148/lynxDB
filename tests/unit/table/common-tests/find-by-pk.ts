import { TableSchema } from "../../../../src/types/table.type";
import { defaultUser, thirtyItemsUserList, twentyOrderDetails } from "../../../data/data-test";
import { OrderDetail } from "../../../types/order-test.type";
import { User } from "../../../types/user-test.type";
import { PrimaryKeyValueNullError } from "../../../../src/core/errors/table.error";

/**
 * Common tests for findByPk() method using a single PK
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
export function findByPkTestWithSinglePK(createInstance: (testData: User[]) => Promise<TableSchema<User>>) {
  describe("With single primary key - Should...", () => {
    let userTable: TableSchema<User>; // primaryKey: ['id']

    beforeEach(async () => {
      userTable = await createInstance(thirtyItemsUserList);
    });

    it("find registers by PK correctly", async () => {
      for (let item of thirtyItemsUserList) {
        const found = await userTable.findByPk({ id: item.id });
        expect(found).not.toBe(item);
        expect(found).toEqual(item);
      }
    });

    it("try to find a register that does not exist", async () => {
      const notExist = await userTable.findByPk({ id: 1000 });
      expect(notExist).toBeNull();
    });

    it("throw an error when PK was not provided", async () => {
      const findByPkWithoutPk = async () => {
        await userTable.findByPk({} as any);
      }
      await expect(findByPkWithoutPk())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  });
}

/**
 * Common tests for findByPk() method using a composite PK
 * 
 * @param createInstance Function that return a new instance of Table< OrderDetail > with "orderId" and "productId" as composite PK.
 * It is used to create a new instance of Table< OrderDetail > for each test.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<OrderDetail>({ primaryKey: ['orderId', 'productId'] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * 
 * ```
 */
export function findByPkTestWithCompositePK(createInstance: (testData: OrderDetail[]) => Promise<TableSchema<OrderDetail>>) {
  describe("With composite primary key - Should...", () => {
    let orderDetailTable: TableSchema<OrderDetail>; // primaryKey: ['orderId', 'productId']

    beforeEach(async () => {
      orderDetailTable = await createInstance(twentyOrderDetails);
    });

    it("find registers by PK correctly", async () => {
      for (let item of twentyOrderDetails) {
        const found = await orderDetailTable.findByPk({
          orderId: item.orderId,
          productId: item.productId
        });
        expect(found).not.toBe(item);
        expect(found).toEqual(item);
      }
    });

    it("try to find a register that does not exist", async () => {
      const notExist = await orderDetailTable.findByPk({ orderId: 1000, productId: 1000 });
      expect(notExist).toBeNull();
    });

    it("throw an error when PK was not provided", async () => {
      const findByPkWithoutPk = async () => {
        await orderDetailTable.findByPk({} as any);
      }
      await expect(findByPkWithoutPk())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });

    it("throw an error when the composite PK is not complete", async () => {
      const findByPkIncompletePkA = async () => {
        await orderDetailTable.findByPk({ orderId: 1 } as any);
      }
      const findByPkIncompletePkB = async () => {
        await orderDetailTable.findByPk({ productId: 1 } as any);
      }
      await expect(findByPkIncompletePkA())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
      await expect(findByPkIncompletePkB())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  });
}

/**
 * Common tests for findByPk() method whitout a PK defined
 * 
 * @description Describe the test
 * @param createInstance Function that return a new instance of Table< User & { _id?: string } > without a PK defined.
 * It is used to create a new instance of Table< User & { _id?: string } > for each test.
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (testData) => {
 *  const table = new Table<User & { _id?: string }>({ primaryKey: [] });
 *  await table.bulkInsert(testData);
 *  return table;
 * }
 * 
 * ```
 */
export function findByPkTestWithoutPK( 
  createInstance: (testData: Array<User & { _id?: string }>) => Promise<TableSchema<User & { _id?: string }>>
) {
  describe("With default primary key - Should...", () => {
    type UserWithDefaultId = User & { _id?: string };

    let userTable: TableSchema<UserWithDefaultId>;

    beforeEach(async () => {
      userTable = await createInstance(thirtyItemsUserList);
    });

    it("find a register with the default '_id' created", async () => {
      const insertedData = await userTable.insert(defaultUser);
      const found = await userTable.findByPk({ _id: insertedData._id });
      expect(found?._id).toBeDefined();
      expect(found).toEqual({ ...defaultUser, _id: insertedData._id });

    });

    it("throw an error because the table do not have a PK", async () => {
      await userTable.insert(defaultUser);
      const tryToFind = async () => {
        await userTable.findByPk({ id: defaultUser.id });
      };

      await expect(tryToFind())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  });
}