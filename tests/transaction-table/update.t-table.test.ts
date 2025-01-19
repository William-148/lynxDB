import { Table } from "../../src/core/table";
import { TransactionTable } from "../../src/core/transaction-table";
import { User } from "../types/user-test.type";


describe("Transaction Table Update", () => {
  const TestData: User[] = [
    { id: 1, fullName: "John", gender: "Male", age: 20, email: "jhon@some.com", username: "jhon", password: "123" },
    { id: 2, fullName: "Jane", gender: "Female", age: 25, email: "jane@some.com", username: "jane", password: "456" },
    { id: 3, fullName: "Alice", gender: "Female", age: 30, email: "alice@some.com", username: "alice", password: "789" },
    { id: 4, fullName: "Bob", gender: "Male", age: 35, email: "bob@some.com", username: "bob", password: "101" },
    { id: 5, fullName: "Charlie", gender: "Male", age: 40, email: "charlie@some.com", username: "charlie", password: "112" }
  ];

  let table: Table<User>;
  let transactionTable: TransactionTable<User>;

  beforeEach(() => {
    table = new Table<User>("user", ["id"]);
    table.bulkInsert(TestData);

    transactionTable = new TransactionTable<User>(
      table.name,
      table.recordsMap,
      table.recordsArray,
      table.lockManager,
      table.pkDefinition
    );
  });

  it("should update a record", async () => {
    const RecordTest = TestData[2];
    const updatedFields: Partial<User> = { fullName: "Alice Wonderland", username: "alice_wonderland", password: "lss$$asf&&a11_Alice" };
    const affectedRows = await transactionTable.update(
      updatedFields, 
      { id: { eq: RecordTest.id } }
    );

    const updatedRecord = await transactionTable.findByPk({ id: RecordTest.id });

    expect(affectedRows).toBe(1);
    expect(updatedRecord).toEqual({ ...RecordTest, ...updatedFields });
  });


  it("should update the PK of a record and insert a new record with the old PK", async () => {
    const InitialRegisteredPk = 4;
    const newUnregisteredPk = 1000;
    const userToInsert: User = { id: InitialRegisteredPk, fullName: "Arnold", gender: "Male", age: 42, email: "arnold@some.com", username: "arnold", password: "456" };

    // Update a field different from the PK
    const firstUpdateAffectedRows = await transactionTable.update(
      {fullName: "Bob Marley"}, 
      { id: { eq: InitialRegisteredPk } }
    );

    // Update the PK
    const updatedPkAffectedRows = await transactionTable.update(
      { id: newUnregisteredPk },
      { id: { eq: InitialRegisteredPk } }
    );

    // Find the record with the new PK
    const updatedPkRecord = await transactionTable.findByPk({ id: newUnregisteredPk });

    // Find the record with the old PK
    const oldPkRecord = await transactionTable.findByPk({ id: InitialRegisteredPk });

    expect(firstUpdateAffectedRows).toBe(1);
    expect(updatedPkAffectedRows).toBe(1);
    expect(updatedPkRecord).not.toBeNull();
    expect(oldPkRecord).toBeNull();
    // Insert a new record with the old PK
    await expect(transactionTable.insert(userToInsert)).resolves.not.toThrow();


  });

});
