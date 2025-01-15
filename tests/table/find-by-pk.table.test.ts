import { Table } from "../../src/core/table";
import { defaultUser, thirtyItemsUserList, twentyOrderDetails } from "../data/data-test";
import { User } from "../types/user-test.type";
import { OrderDetail } from "../types/order-test.type";
import { 
  PrimaryKeyValueNullError
} from "../../src/core/errors/table.error";

describe("Table with single PK - findByPk() - should...", () => {
  let userTable: Table<User>;

  beforeEach(() => {
    userTable = new Table<User>('user', ['id']);
  });

  it("find registers by PK correctly", async () => {
    await userTable.bulkInsert(thirtyItemsUserList);

    for (let item of thirtyItemsUserList) {
      const found = await userTable.findByPk({ id: item.id });
      expect(found).not.toBe(item);
      expect(found).toEqual(item);
    }
  });

  it("throw an error when PK was not provided", async () => {
    const findByPkWithoutPk = async () => {
      await userTable.findByPk({} as any);
    }
    expect(findByPkWithoutPk())
      .rejects
      .toThrow(PrimaryKeyValueNullError);
  });

});



describe("Table with composite PK - findByPk() - should...", () => {
  let orderDetailTable: Table<OrderDetail>;

  beforeEach(() => {
    orderDetailTable = new Table<OrderDetail>('orderDetail', ['orderId', 'productId']);
  });

  it("find registers by PK correctly", async () => {
    await orderDetailTable.bulkInsert(twentyOrderDetails);

    for (let item of twentyOrderDetails) {
      const found = await orderDetailTable.findByPk({ 
        orderId: item.orderId, 
        productId: item.productId 
      });
      expect(found).not.toBe(item);
      expect(found).toEqual(item);
    }
  });

  it("throw an error when PK was not provided", async () => {
    const findByPkWithoutPk = async () => {
      await orderDetailTable.findByPk({} as any);
    }
    expect(findByPkWithoutPk())
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
    expect(findByPkIncompletePkA())
      .rejects
      .toThrow(PrimaryKeyValueNullError);
    expect(findByPkIncompletePkB())
      .rejects
      .toThrow(PrimaryKeyValueNullError);
  });

});



describe("Table without PK - findByPk() - should...", () => {
  type UserWithDefaultId = User & { _id?: string };

  let userTable: Table<UserWithDefaultId>;

  beforeEach(() => {
    userTable = new Table<UserWithDefaultId>('user');
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

    expect(tryToFind())
      .rejects
      .toThrow(PrimaryKeyValueNullError);
  });

});