import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User } from "../../types/user-test.type";
import { OrderDetail } from "../../types/order-test.type";
import { 
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError
} from "../../../src/core/errors/table.error";

/**
 * Common tests for bulkInsert() method with single PK
 * 
 * @param description The description of the test
 * @param createInstance Function that returns a new instance of the table
 * 
 * Param Example:
 * ```ts
 * const createInstance = () => new Table<User>({ primaryKey: ['id'] });
 * ```
 */
export function bulkInsertTestsWithSinglePK(description: string, createInstance: () => Table<User>): void {
  describe(description, () => {
    let userTable: Table<User>;
  
    beforeEach(() => {
      userTable = createInstance();
    });
  
    it("insert many registers correctly", async () => {
      await userTable.bulkInsert(thirtyItemsUserList);
  
      expect(userTable.size()).toBe(thirtyItemsUserList.length);
    });
  
    it("throw an error when insert many registers with PK duplicated", async () => {
      const insertDuplicated = async () => {
        await userTable.bulkInsert(
          thirtyItemsUserList.map((item) => ({ ...item, id: 1 }) )
        );
      }
      await expect(insertDuplicated())
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);
    });
  
    it("throw an error when PK was not provided", async () => {
      const bulkInsertWithoutPk = async () => {
        await userTable.bulkInsert(
          thirtyItemsUserList.map((item) => ({ ...item, id: undefined } as any) )
        );
      }
      await expect(bulkInsertWithoutPk())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  
  });
}


const orderDetails: OrderDetail[] = [
  { orderId: 1, productId: 1, quantity: 2, price: 100 },
  { orderId: 1, productId: 2, quantity: 1, price:  50 },
  { orderId: 2, productId: 1, quantity: 1, price: 100 }
];

/**
 * Common tests for bulkInsert() method with composite PK
 * 
 * @param description The description of the test
 * @param createInstance Function that returns a new instance of the table
 * 
 * Param Example:
 * ```ts
 * const createInstance = () => new Table<OrderDetail>({ primaryKey: ["orderId", "productId"] });
 * ```
 */
export function bulkInsertTestsWithCompositePK(description: string, createInstance: () => Table<OrderDetail>): void {
  describe(description, () => {
    let orderDetailTable: Table<OrderDetail>;
  
    beforeEach(() => {
      orderDetailTable = createInstance();
    });
  
    it("insert many registers correctly", async () => {
      await orderDetailTable.bulkInsert(orderDetails);
  
      expect(orderDetailTable.size()).toBe(orderDetails.length);
    });
  
    it("throw an error when insert many registers with PK duplicated", async () => {
      const insertDuplicated = async () => {
        await orderDetailTable.bulkInsert(orderDetails);
        await orderDetailTable.bulkInsert(orderDetails);
      }
  
      await expect(insertDuplicated())
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);
    });
  
    it("throw an error when PK was not provided", async () => {
      const bulkInsertWithoutPk = async () => {
        await orderDetailTable.bulkInsert([
          {} as any,
          {} as any,
        ]);
      }
      await expect(bulkInsertWithoutPk())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  
    it("throw an error when the composite PK is not complete", async () => {
      const insertIncompletePkA = async () => {
        await orderDetailTable.bulkInsert([{ orderId: 1 } as OrderDetail]);
      }
      const insertIncompletePkB = async () => {
        await orderDetailTable.bulkInsert([{ productId: 1 } as OrderDetail]);
      }
      await expect(insertIncompletePkA())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
      await expect(insertIncompletePkB())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  
  });
}


/**
 * Common tests for bulkInsert() method without PK
 * 
 * @param description The description of the test
 * @param createInstance Function that returns a new instance of the table
 * 
 * Param Example:
 * ```ts
 * const createInstance = () => new Table<User>({ primaryKey: [] });
 * ```
 * 
 */
export function bulkInsertTestWithoutPK(description: string, createInstance: () => Table<User>): void {
  describe(description, () => {
    let userTable: Table<User>;
  
    beforeEach(() => {
      userTable = createInstance();
    });
  
    it("insert a register correctly", async () => {
      await userTable.bulkInsert(thirtyItemsUserList);
  
      expect(userTable.size()).toBe(thirtyItemsUserList.length);
    });
  
    it("insert the same register many times correctly", async () => {
      await userTable.bulkInsert(thirtyItemsUserList);
      await userTable.bulkInsert(thirtyItemsUserList);
  
      expect(userTable.size()).toBe(thirtyItemsUserList.length * 2);
    });
  
  });
}
