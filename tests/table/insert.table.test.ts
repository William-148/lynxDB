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
    userTable = new Table<User>('user', ['id']);
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

    expect(insertDuplicated())
      .rejects
      .toThrow(DuplicatePrimaryKeyValueError);
  });

  it("throw an error when PK was not provided", async () => {
    const userWrong: any = {};
    const insertWithoutPk = async () => {
      await userTable.insert(userWrong);
    }
    expect(insertWithoutPk())
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
    orderDetailTable = new Table<OrderDetail>('orderDetail', ["orderId", "productId"]);
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

    expect(insertDuplicated())
      .rejects
      .toThrow(DuplicatePrimaryKeyValueError);
  });

  it("throw an error when composite PK was not provided", async () => {
    const insertWithoutPk = async () => {
      await orderDetailTable.insert({} as OrderDetail);
    }
    expect(insertWithoutPk())
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
    expect(insertIncompletePkA())
      .rejects
      .toThrow(PrimaryKeyValueNullError);
    expect(insertIncompletePkB())
      .rejects
      .toThrow(PrimaryKeyValueNullError);
  });

});



describe("Table without PK - insert() - should...", () => {
  let userTable: Table<User>;

  beforeEach(() => {
    userTable = new Table<User>('user');
  });

  it("insert a register correctly", async () => {
    for (let item of thirtyItemsUserList) {
      await userTable.insert(item);
    }

    expect(userTable.size()).toBe(thirtyItemsUserList.length);
    expect(userTable.sizeMap).toBe(0);
  });

  it("insert the same register many times correctly", async () => {
    await userTable.insert(defaultUser);
    await userTable.insert(defaultUser);
    await userTable.insert(defaultUser);

    expect(userTable.size()).toBe(3);
    expect(userTable.sizeMap).toBe(0);
  });

});