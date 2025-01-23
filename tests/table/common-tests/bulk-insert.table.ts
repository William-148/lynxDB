import { Table } from "../../../src/core/table";
import { thirtyItemsUserList } from "../../data/data-test";
import { User } from "../../types/user-test.type";
import { OrderDetail } from "../../types/order-test.type";
import { 
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError
} from "../../../src/core/errors/table.error";

describe("Table with single PK - bulkInsert() - should...", () => {
  let userTable: Table<User>;

  beforeEach(() => {
    userTable = new Table<User>({ name: 'user', primaryKey: ['id'] });
  });

  it("insert many registers correctly", async () => {
    await userTable.bulkInsert(thirtyItemsUserList);

    expect(userTable.size()).toBe(thirtyItemsUserList.length);
    expect(userTable.sizeMap).toBe(thirtyItemsUserList.length);
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



describe("Table with composite PK - bulkInsert() - should...", () => {
  let orderDetailTable: Table<OrderDetail>;
  const orderDetails: OrderDetail[] = [
    { orderId: 1, productId: 1, quantity: 2, price: 100 },
    { orderId: 1, productId: 2, quantity: 1, price:  50 },
    { orderId: 2, productId: 1, quantity: 1, price: 100 }
  ];

  beforeEach(() => {
    orderDetailTable = new Table<OrderDetail>({ name: 'orderDetail', primaryKey: ["orderId", "productId"] });
  });

  it("insert many registers correctly", async () => {
    await orderDetailTable.bulkInsert(orderDetails);

    expect(orderDetailTable.size()).toBe(orderDetails.length);
    expect(orderDetailTable.sizeMap).toBe(orderDetails.length);
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



describe("Table without PK - bulkInsert() - should...", () => {
  let userTable: Table<User>;

  beforeEach(() => {
    userTable = new Table<User>({ name: 'user' });
  });

  it("insert a register correctly", async () => {
    await userTable.bulkInsert(thirtyItemsUserList);

    expect(userTable.size()).toBe(thirtyItemsUserList.length);
    expect(userTable.sizeMap).toBe(thirtyItemsUserList.length);
  });

  it("insert the same register many times correctly", async () => {
    await userTable.bulkInsert(thirtyItemsUserList);
    await userTable.bulkInsert(thirtyItemsUserList);

    expect(userTable.size()).toBe(thirtyItemsUserList.length * 2);
    expect(userTable.sizeMap).toBe(thirtyItemsUserList.length * 2);
  });

});