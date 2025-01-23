import { Table } from "../../../../src/core/table";

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
    genericTable = new Table<GenericData>({
      name: 'generic',
      primaryKey: ['id']
    });
    genericTable.bulkInsert(genericDataList);
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
    const emptyTable = new Table<GenericData>({ name: 'empty', primaryKey: ['id'] });
    const result = await emptyTable.select([], { id: { eq: 1 } });
    expect(result).toHaveLength(0);
  });

  it("handle null or undefined values gracefully", async () => {
    const tableWithNulls = new Table<any>({ name: 'nulls', primaryKey: ['id'] });
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

  
});

describe("Table - select() with eq operator with objects  - should ...", () => {

  beforeEach(() => {
    genericTable = new Table<GenericData>({ name: 'generic', primaryKey: ['id'] });
  });

  it("filter records with array fields", async () => {
    genericTable.bulkInsert(genericDataList);
    const expectedItemA = genericDataList[1];
    const expectedItemB = genericDataList[3];

    const resultA = await genericTable.select([], { tags: { eq: ["designer"] } });
    const resultB = await genericTable.select([], { tags: { eq: ["developer", "manager"]} });

    expect(resultA).toHaveLength(1);
    expect(resultA[0]).toEqual(expectedItemA);

    expect(resultB).toHaveLength(1);
    expect(resultB[0]).toEqual(expectedItemB);
  });
  
  it("filter records with nested object fields", async () => {
    const nestedTable = new Table<any>({ name: 'nested', primaryKey: ['id'] });
    nestedTable.bulkInsert([
      { id: 1, profile: { name: "Alice", age: 25 } },
      { id: 2, profile: { name: "Bob", age: 30 } },
      { id: 3, profile: { name: "Bob", age: 30, address: 'street' } }
    ]);
    const result = await nestedTable.select([], { profile: { eq: { name: "Alice", age: 25 } } });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, profile: { name: "Alice", age: 25 } });
  });

  it("filter records with nested array fields", async () => {
    type Projects = {
      id: number;
      project: string;
      team: { name: string, age: number }[];
    }
    const nestedTable = new Table<Projects>({ name: 'nested', primaryKey: ['id'] });
    const listdata: Projects[] = [
      { id: 1, project: "road", team: [{ name: "Alice", age: 25 }, { name: "Marcus", age: 35 }] },
      { id: 2, project: "hospital", team: [{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }] },
      { id: 3, project: "bridge", team: [{ name: "Bob", age: 38 }] }
    ];
    nestedTable.bulkInsert(listdata);
    const expectedItem = { id: 2, project: "hospital", team: [{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }] }
    const teamToSearch =[{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }];

    const result = await nestedTable.select([], { team: { eq: teamToSearch } });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expectedItem);
  });


});
