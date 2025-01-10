import { Table } from "../../../src/core/table";

type GenericData = {
  id: number;
  name: string;
  age: number;
  active: boolean;
  tags: string[];
}

const genericDataList: GenericData[] = [
  { id: 1, name: "Alice", age: 25, active: true, tags: ["developer", "mentor"] },
  { id: 2, name: "Bob", age: 30, active: false, tags: ["designer"] },
  { id: 3, name: "Charlie", age: 35, active: true, tags: ["manager"] },
  { id: 4, name: "Diana", age: 28, active: false, tags: ["developer", "manager"] }
];

let genericTable: Table<GenericData>;

describe("Table - select() with eq operator - should...", () => {

  beforeEach(() => {
    genericTable = new Table<GenericData>('generic', ['id']);
    genericTable.bulkInsert([
      { id: 1, name: "Alice", age: 25, active: true, tags: ["developer", "mentor"] },
      { id: 2, name: "Bob", age: 30, active: false, tags: ["designer"] },
      { id: 3, name: "Charlie", age: 35, active: true, tags: ["manager"] },
      { id: 4, name: "Diana", age: 28, active: false, tags: ["developer", "manager"] }
    ]);
  });

  it('filter records with numeric value', async () => {
    const expected = genericDataList[2];
    const resultList = await genericTable.select([], { id: { eq: expected.id } });
    const resultItem = resultList[0]; // This have all properties of User
    expect(resultList).toHaveLength(1);
    expect(resultItem).not.toBe(expected);
    expect(resultItem).toEqual(expected);
  });

  it("filter records with a string value", async () => {
    const expected = genericDataList[0];
    const result = await genericTable.select([], { name: { eq: expected.name } });
    const loweCaseResult = await genericTable.select([], { name: { eq: expected.name.toLowerCase() } });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expected);
    expect(loweCaseResult).toHaveLength(0);
  });

  it("filter records with a boolean value", async () => {
    const result = await genericTable.select([], { active: { eq: true } });
    expect(result).toHaveLength(2);
    expect(result.map(record => record.active).every((item)=> item)).toEqual(true);
  });

  it("filter records with an array value (tags)", async () => {
    const expected = genericDataList[1];
    const result = await genericTable.select([], { tags: { eq: expected.tags } });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expected);
  });

  it("return no records for non-matching numeric value", async () => {
    const result = await genericTable.select([], { id: { eq: -10 } });
    expect(result).toHaveLength(0);
  });

  it("handle edge case with empty table", async () => {
    const emptyTable = new Table<GenericData>('empty', ['id']);
    const result = await emptyTable.select([], { id: { eq: 1 } });
    expect(result).toHaveLength(0);
  });

  it("handle null or undefined values gracefully", async () => {
    const tableWithNulls = new Table<any>('nullTable', ['id']);
    tableWithNulls.bulkInsert([
      { id: 1, name: null },
      { id: 2, name: undefined },
      { id: 3, name: "Charlie" }
    ]);
    const resultWithNull = await tableWithNulls.select([], { name: { eq: null } });
    expect(resultWithNull).toHaveLength(1);
    expect(resultWithNull[0]).toEqual({ id: 1, name: null });

    const resultWithUndefined = await tableWithNulls.select([], { name: { eq: undefined } });
    expect(resultWithUndefined).toHaveLength(1);
    expect(resultWithUndefined[0]).toEqual({ id: 2, name: undefined });
  });

  it("filter records with nested object fields", async () => {
    const nestedTable = new Table<any>('nested', ['id']);
    nestedTable.bulkInsert([
      { id: 1, profile: { name: "Alice", age: 25 } },
      { id: 2, profile: { name: "Bob", age: 30 } }
    ]);
    const result = await nestedTable.select([], { profile: { eq: { name: "Alice", age: 25 } } });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, profile: { name: "Alice", age: 25 } });
  });

});
