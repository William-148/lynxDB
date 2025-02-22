import { TableSchema } from "../../../../../src/types/table.type";
import { PersonInfo } from "../../../../types/user-test.type";

const genericDataList: PersonInfo[] = [
  { id: 1, name: "Alice", age: 25, active: true, tags: ["developer", "mentor"] },
  { id: 2, name: "Bob", age: 30, active: false, tags: ["designer"] },
  { id: 3, name: "Charlie", age: 35, active: true, tags: ["manager"] },
  { id: 4, name: "Diana", age: 28, active: false, tags: ["developer", "manager"] }
];

/**
 * Common tests for the select() method with eq conditions
 * 
 * @param createInstance Function that creates a new instance of the Table class
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (dataTest) => {
 * const table = new Table<GenericData>({ primaryKey: ['id'] });
 * await table.bulkInsert(dataTest);
 * return table;
 * }
 * ```
 * 
 */
export function selectEqTests(createInstance: (dataTest: PersonInfo[]) => Promise<TableSchema<any>>) {
  describe("With equal condition - should...", () => {
    let genericTable: TableSchema<PersonInfo>;
  
    beforeEach(async () => {
      genericTable = await createInstance(genericDataList);
    });
  
    it('filter records with numeric value', async () => {
      const expected = genericDataList[2];
      const resultList = await genericTable.select({ id: { $eq: expected.id } });
      const resultItem = resultList[0]; // This have all properties of User
      expect(resultList).toHaveLength(1);
      expect(resultItem).not.toBe(expected);
      expect(resultItem).toEqual(expected);
    });
  
    it("filter records with a string value", async () => {
      const expected = genericDataList[0];
      const result = await genericTable.select({ name: { $eq: expected.name } });
      const loweCaseResult = await genericTable.select({ name: { $eq: expected.name.toLowerCase() } });
  
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expected);
      expect(loweCaseResult).toHaveLength(0);
    });
  
    it("filter records with a boolean value", async () => {
      const result = await genericTable.select({ active: { $eq: true } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.active).every((item)=> item)).toEqual(true);
    });
  
    it("filter records with an array value (tags)", async () => {
      const expected = genericDataList[1];
      const result = await genericTable.select({ tags: { $eq: expected.tags } });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expected);
    });
  
    it("return no records for non-matching numeric value", async () => {
      const result = await genericTable.select({ id: { $eq: -10 } });
      expect(result).toHaveLength(0);
    });
  
    it("handle edge case with empty table", async () => {
      const emptyTable = await createInstance([]);
      const result = await emptyTable.select({ id: { $eq: 1 } });
      expect(result).toHaveLength(0);
    });
  
    it("handle null or undefined values gracefully", async () => {
      const tableWithNulls = await createInstance([]);
      tableWithNulls.bulkInsert([
        { id: 1, name: null },
        { id: 2, name: undefined },
        { id: 3, name: "Charlie" }
      ] as any[]);
      const resultWithNull = await tableWithNulls.select({ name: { $eq: null } });
      expect(resultWithNull).toHaveLength(1);
      expect(resultWithNull[0]).toEqual({ id: 1, name: null });
  
      const resultWithUndefined = await tableWithNulls.select({ name: { $eq: undefined } });
      expect(resultWithUndefined).toHaveLength(1);
      expect(resultWithUndefined[0]).toEqual({ id: 2, name: undefined });
    });
  
    
  });
}


/**
 * Common tests for the select() method with eq conditions and objects
 * 
 * @param createInstance Function that creates a new instance of the Table class
 * 
 * Param Example:
 * ```ts
 * const createInstance = async () => {
 * const table = new Table<GenericData>({ primaryKey: ['id'] });
 * return table;
 * }
 * ```
 */
export function selectEqTestsWithObjects(createInstance: () => Promise<TableSchema<any>>) {
  describe("With equal condition and object as values - should...", () => {
    let genericTable: TableSchema<any>;
  
    beforeEach(async () => {
      genericTable = await createInstance();
    });
  
    it("filter records with array fields", async () => {
      genericTable as TableSchema<PersonInfo>;
      genericTable.bulkInsert(genericDataList);
      const expectedItemA = genericDataList[1];
      const expectedItemB = genericDataList[3];
  
      const resultA = await genericTable.select({ tags: { $eq: ["designer"] } });
      const resultB = await genericTable.select({ tags: { $eq: ["developer", "manager"]} });
  
      expect(resultA).toHaveLength(1);
      expect(resultA[0]).toEqual(expectedItemA);
  
      expect(resultB).toHaveLength(1);
      expect(resultB[0]).toEqual(expectedItemB);
    });
    
    it("filter records with nested object fields", async () => {
      genericTable.bulkInsert([
        { id: 1, profile: { name: "Alice", age: 25 } },
        { id: 2, profile: { name: "Bob", age: 30 } },
        { id: 3, profile: { name: "Bob", age: 30, address: 'street' } }
      ]);
      const result = await genericTable.select({ profile: { $eq: { name: "Alice", age: 25 } } });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 1, profile: { name: "Alice", age: 25 } });
    });
  
    it("filter records with nested array fields", async () => {
      type Projects = {
        id: number;
        project: string;
        team: { name: string, age: number }[];
      }
      const listdata: Projects[] = [
        { id: 1, project: "road", team: [{ name: "Alice", age: 25 }, { name: "Marcus", age: 35 }] },
        { id: 2, project: "hospital", team: [{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }] },
        { id: 3, project: "bridge", team: [{ name: "Bob", age: 38 }] }
      ];
      genericTable.bulkInsert(listdata);
      const expectedItem = { id: 2, project: "hospital", team: [{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }] }
      const teamToSearch =[{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }];
  
      const result = await genericTable.select({ team: { $eq: teamToSearch } });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expectedItem);
    });
  
  
  });
}
