import { LynxDB } from "../../src/core/database";
import { DuplicatePrimaryKeyValueError } from "../../src/core/errors/table.error";
import { TablesDefinition } from "../../src/types/table.type";
import { User } from "../types/user-test.type";
import { createRandomUser } from "../utils/user.utils";


const tableConfigs: TablesDefinition<{ users: User }> = {
  users: {
    primaryKey: ["id"]
  }
};

describe("LynxDB Integration Tests - Transactions", () => {
  let db: LynxDB<{ users: User }>;

  beforeEach(() => {
    db = new LynxDB(tableConfigs);
  });

  it("Transactional commit", async () => {
    const transaction = db.createTransaction();
    const newRecord: User = createRandomUser(1);

    try {
      await transaction.get("users").insert(newRecord);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
    }
    const user = await db.get("users").findByPk({ id: 1 });
    expect(user).toEqual(newRecord);
  });

  it("Transactional rollback", async () => {
    const transaction = db.createTransaction();
    const newRecord: User = createRandomUser(1);

    try {
      await transaction.get("users").insert(newRecord);
      await transaction.get("users").insert(newRecord);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      expect(error).toBeInstanceOf(DuplicatePrimaryKeyValueError);
    }
    const user = await db.get("users").findByPk({ id: 1 });
    expect(user).toBeNull();
  });

  it("Transactional callbacks commit", async () => {
    const newRecord1: User = createRandomUser(1);
    const newRecord2: User = createRandomUser(2);
    const updatedData: Partial<User> = { 
      id: 1, 
      email: "hacker001@data.com", 
      username: "hacker001" 
    };

    try{
      await db.transaction(async (t) => {
        t.get("users").insert(newRecord1);
        t.get("users").insert(newRecord2);
        t.get("users").update(updatedData, { id: { $eq: 1 } });
      });
    }
    catch(error){
      console.error('Transaction error:', error);
    }
    
    expect(db.get("users").size()).toBe(2);
    expect(await db.get("users").findByPk({ id: 1 })).toEqual({ ...newRecord1, ...updatedData });
    expect(await db.get("users").findByPk({ id: 2 })).toEqual(newRecord2);
  });

  it("Transactional callbacks rollback", async () => {
    const newRecord1: User = createRandomUser(1);
    const newRecord2: User = createRandomUser(2);
    const updatedData: Partial<User> = { 
      id: 1, 
      email: "hacker001@data.com", 
      username: "hacker001" 
    };

    try{
      await db.transaction(async (t) => {
        await t.get("users").insert(newRecord1);
        await t.get("users").insert(newRecord2);
        await t.get("users").update(updatedData, { id: { $eq: 2 } });
      });
    }
    catch(error){
      expect(error).toBeInstanceOf(DuplicatePrimaryKeyValueError);
    }
    
    expect(db.get("users").size()).toBe(0);
    expect(await db.get("users").findByPk({ id: 1 })).toBeNull();
    expect(await db.get("users").findByPk({ id: 2 })).toBeNull();
  });

  it("Data consistency with concurrent operations", async () => {
    const users = db.get("users");
    const generatedUsers = Array.from({ length: 10 }, (_, i) => createRandomUser(i));

    const promises = generatedUsers.map(async (user) => {
      return db.transaction(async (t) => {
        await t.get("users").insert(user);
      });
    });
    await Promise.all(promises);

    expect(users.size()).toBe(generatedUsers.length);
    for (const user of generatedUsers) {
      expect(await users.findByPk({ id: user.id })).toEqual(user);
    }
  });  

});