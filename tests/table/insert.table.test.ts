import { Table } from "../../src/core/table";
import { defaultUser, thirtyItemsUserList } from "../data/data-test";
import { User } from "../types/user-test.type";
import { OrderDetail } from "../types/order-test.type";
import { 
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError
} from "../../src/core/errors/table.error";

describe("Table with single PK - insert() - should...", () => {
  let userTable: Table<User>;

  beforeEach(() => {
    userTable = new Table<User>({ name: 'user', primaryKey: ['id'] });
  });

  it("insert a register correctly", async () => {
    await userTable.insert(thirtyItemsUserList[3]);
    await userTable.insert(defaultUser);
    await userTable.insert(thirtyItemsUserList[5]);

    expect(userTable.size()).toBe(3);
    expect(userTable.sizeMap).toBe(3);
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



describe("Table with composite PK - insert() - should...", () => {
  let orderDetailTable: Table<OrderDetail>;
  const orderDetails: OrderDetail[] = [
    { orderId: 1, productId: 1, quantity: 2, price: 100 },
    { orderId: 1, productId: 2, quantity: 1, price:  50 },
    { orderId: 2, productId: 1, quantity: 1, price: 100 }
  ];

  beforeEach(() => {
    orderDetailTable = new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ["orderId", "productId"] });
  });

  it("insert a register correctly", async () => {
    for(let item of orderDetails) {
      await orderDetailTable.insert(item);
    }
      
    expect(orderDetailTable.size()).toBe(orderDetails.length);
    expect(orderDetailTable.sizeMap).toBe(orderDetails.length);
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



describe("Table without PK - insert() - should...", () => {
  type UserWithDefaultId = User & { _id?: string };
  let userTable: Table<UserWithDefaultId>;

  beforeEach(() => {
    userTable = new Table<UserWithDefaultId>({ name: 'user' });
  });

  it("insert a register correctly", async () => {
    const DataInserted: UserWithDefaultId[] = [];
    for (let item of thirtyItemsUserList) {
      const inserted = await userTable.insert(item);
      DataInserted.push(inserted);
    }

    expect(userTable.size()).toBe(thirtyItemsUserList.length);
    expect(userTable.sizeMap).toBe(thirtyItemsUserList.length);
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
    expect(userTable.sizeMap).toBe(NumberOfInserts);
    
    for (let inserted of DataInserted) {
      expect(inserted._id).not.toBeUndefined();
    }
  });

});