import { TableSchema } from "../../../../src/types/table.type";
import { defaultUser, thirtyItemsUserList } from "../../../data/data-test";
import { User } from "../../../types/user-test.type";
import { OrderDetail } from "../../../types/order-test.type";
import { 
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError
} from "../../../../src/core/errors/table.error";

/**
 * Common tests for insert() method using a single PK
 * 
 * @param description Describe the test
 * @param createInstance Function that return a new instance of Table< User > with "id" as PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = () => new Table<User>({ primaryKey: ['id'] });
 * ```
 */
export function insertTestWithSinglePK(description: string, createInstance: () => TableSchema<User>) {
  describe(description, () => {
    let userTable: TableSchema<User>;
  
    beforeEach(() => {
      userTable = createInstance();
    });
  
    it("insert a register correctly", async () => {
      await userTable.insert(thirtyItemsUserList[3]);
      await userTable.insert(defaultUser);
      await userTable.insert(thirtyItemsUserList[5]);
  
      expect(userTable.size()).toBe(3);
    });
  
    it("throw an error when insert a PK duplicated", async () => {
      const insertDuplicated = async () => {
        await userTable.insert(defaultUser);
        await userTable.insert(
          { ...thirtyItemsUserList[3], id: defaultUser.id }
        );
      }
  
      await expect(insertDuplicated())
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);
    });
  
    it("throw an error when PK was not provided", async () => {
      const userWrong: any = {};
      const insertWithoutPk = async () => {
        await userTable.insert(userWrong);
      }
      await expect(insertWithoutPk())
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
 * Common tests for insert() method using a composite PK
 * 
 * @param description Describe the test
 * @param createInstance Function that return a new instance of Table< OrderDetail > with "orderId" and "productId" as composite PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = () => new Table<OrderDetail>({ primaryKey: ['orderId', 'productId'] });
 */
export function insertTestWithCompositePK(description: string, createInstance: () => TableSchema<OrderDetail>) {
  describe(description, () => {
    let orderDetailTable: TableSchema<OrderDetail>;
  
    beforeEach(() => {
      orderDetailTable = createInstance();
    });
  
    it("insert a register correctly", async () => {
      for(let item of orderDetails) {
        await orderDetailTable.insert(item);
      }
        
      expect(orderDetailTable.size()).toBe(orderDetails.length);
    });
  
    it("throw an error when insert a composite PK duplicated", async () => {
      const insertDuplicated = async () => {
        await orderDetailTable.insert(orderDetails[0]);
        await orderDetailTable.insert(orderDetails[0]);
      }
  
      await expect(insertDuplicated())
        .rejects
        .toThrow(DuplicatePrimaryKeyValueError);
    });
  
    it("throw an error when composite PK was not provided", async () => {
      const insertWithoutPk = async () => {
        await orderDetailTable.insert({} as OrderDetail);
      }
      await expect(insertWithoutPk())
        .rejects
        .toThrow(PrimaryKeyValueNullError);
    });
  
    it("throw an error when the composite PK is not complete", async () => {
      const insertIncompletePkA = async () => {
        await orderDetailTable.insert({ orderId: 1 } as OrderDetail);
      }
      const insertIncompletePkB = async () => {
        await orderDetailTable.insert({ productId: 1 } as OrderDetail);
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
 * Common tests for insert() method without a PK defined
 * 
 * @param description The description of the test
 * @param createInstance Function that return a new instance of Table< User & { _id?: string } > without PK.
 * 
 * Param Example:
 * ```ts
 * const createInstance = () => new Table<User & { _id?: string }>({ primaryKey: [] });
 * ```
 */
export function insertTestWithoutPK(description: string, createInstance: () => TableSchema<User & { _id?: string }>) {
  describe(description, () => {
    type UserWithDefaultId = User & { _id?: string };
    let userTable: TableSchema<UserWithDefaultId>;
  
    beforeEach(() => {
      userTable = createInstance();
    });
  
    it("insert a register correctly", async () => {
      const DataInserted: UserWithDefaultId[] = [];
      for (let item of thirtyItemsUserList) {
        const inserted = await userTable.insert(item);
        DataInserted.push(inserted);
      }
  
      expect(userTable.size()).toBe(thirtyItemsUserList.length);
      for (let inserted of DataInserted) {
        expect(inserted._id).not.toBeUndefined();
      }
    });
  
    it("insert the same register many times correctly", async () => {
      const NumberOfInserts = 3;
      const DataInserted: any[] = [];
      for (let i = 0; i < NumberOfInserts; i++) {
        const inserted = await userTable.insert(defaultUser);
        DataInserted.push(inserted);
      }
  
      expect(userTable.size()).toBe(NumberOfInserts);
      
      for (let inserted of DataInserted) {
        expect(inserted._id).not.toBeUndefined();
      }
    });
  
  });
}
