import { ITable } from "../../../../../src/types/table.type";
import { PersonInfo } from "../../../../types/user-test.type";

const personInfoList: PersonInfo[] = [
  { id: 1, name: "Alice", age: 25, active: true, tags: ["developer", "mentor"] },
  { id: 2, name: "Bob", age: 30, active: false, tags: ["designer"] },
  { id: 3, name: "Charlie", age: 35, active: true, tags: ["manager"] },
  { id: 4, name: "Diana", age: 28, active: false, tags: ["developer", "manager"] }
];

/**
 * Common tests for the select() method with not equal conditions
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
export function selectNeTests(createInstance: (dataTest: PersonInfo[]) => Promise<ITable<any>>) {
  describe("With not equal condition - should...", () => {
    let personInfoTable: ITable<PersonInfo>;
  
    beforeEach(async () => {
      personInfoTable = await createInstance(personInfoList);
    });
  
    it('filter records with numeric value', async () => {
      const testItem = personInfoList[2];
      const listExpected = personInfoList.filter(item => item.id !== testItem.id);

      const resultList = await personInfoTable.select([], { id: { $ne: testItem.id } });

      expect(resultList).toHaveLength(listExpected.length);
      expect(resultList).toEqual(expect.arrayContaining(listExpected));
    });
  
    it("filter records with a string value", async () => {
      const testItem = personInfoList[0];
      const listExpected = personInfoList.filter(item => item.name !== testItem.name);

      const result = await personInfoTable.select([], { name: { $ne: testItem.name } });
      const loweCaseResult = await personInfoTable.select([], { name: { $ne: testItem.name.toLowerCase() } });
  
      expect(result).toHaveLength(listExpected.length);
      expect(loweCaseResult).toHaveLength(personInfoList.length);
      expect(result).toEqual(expect.arrayContaining(listExpected));
    });
  
    it("filter records with a boolean value", async () => {
      const expectedList = personInfoList.filter(item => item.active !== true);

      const result = await personInfoTable.select([], { active: { $ne: true } });

      expect(result).toHaveLength(expectedList.length);
      expect(result.map(record => record.active).every((item)=> item === false)).toEqual(true);
    });
  
    it("filter records with an array value (tags)", async () => {
      const itemToTest = personInfoList[1];
      const expectedList = personInfoList.filter(item => item.tags !== itemToTest.tags);

      const result = await personInfoTable.select([], { tags: { $ne: itemToTest.tags } });

      expect(result).toHaveLength(personInfoList.length - 1);
      expect(result).toEqual(expect.arrayContaining(expectedList));
    });
  
    it("return all records for non-matching numeric value", async () => {
      const result = await personInfoTable.select([], { id: { $ne: -10 } });
      expect(result).toHaveLength(personInfoList.length);
    });
  
    it("handle edge case with empty table", async () => {
      const emptyTable = await createInstance([]);
      const result = await emptyTable.select([], { id: { $ne: 1 } });
      expect(result).toHaveLength(0);
    });
  
    it("handle null or undefined values gracefully", async () => {
      const tableWithNulls = await createInstance([]);
      const dataToInsert: any[] = [
        { id: 1, name: null },
        { id: 2, name: undefined },
        { id: 3, name: "Charlie" }
      ]
      tableWithNulls.bulkInsert(dataToInsert);

      const expectedNullList = dataToInsert.filter(item => item.name !== null);
      const resultWithoutNull = await tableWithNulls.select([], { name: { $ne: null } });
      expect(resultWithoutNull).toHaveLength(dataToInsert.length - 1);
      expect(resultWithoutNull).toEqual(expect.arrayContaining(expectedNullList));
      
      const expectedUndefinedList = dataToInsert.filter(item => item.name !== undefined);
      const resultWithoutUndefined = await tableWithNulls.select([], { name: { $ne: undefined } });
      expect(resultWithoutUndefined).toHaveLength(dataToInsert.length - 1);
      expect(resultWithoutUndefined).toEqual(expect.arrayContaining(expectedUndefinedList));
    });
  });
}


/**
 * Common tests for the select() method with not equal conditions and objects
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
export function selectNeTestsWithObjects(createInstance: () => Promise<ITable<any>>) {
  describe("With not equal condition and object as values - should...", () => {
    let genericTable: ITable<any>;
  
    beforeEach(async () => {
      genericTable = await createInstance();
    });
  
    it("filter records with array fields", async () => {
      genericTable as ITable<PersonInfo>;
      genericTable.bulkInsert(personInfoList);
      const itemToTestA = personInfoList[1];
      const itemToTestB = personInfoList[3];
      const expectedA = personInfoList.filter(item => item.tags !== itemToTestA.tags);
      const expectedB = personInfoList.filter(item => item.tags !== itemToTestB.tags);
  
      const resultA = await genericTable.select([], { tags: { $ne: ["designer"] } });
      const resultB = await genericTable.select([], { tags: { $ne: ["developer", "manager"]} });
  
      expect(resultA).toHaveLength(personInfoList.length - 1);
      expect(resultA).toEqual(expect.arrayContaining(expectedA));
  
      expect(resultB).toHaveLength(personInfoList.length - 1);
      expect(resultB).toEqual(expect.arrayContaining(expectedB));
    });
    
    it("filter records with nested object fields", async () => {
      const dataToInsert = [
        { id: 1, profile: { name: "Alice", age: 25 } },
        { id: 2, profile: { name: "Bob", age: 30 } },
        { id: 3, profile: { name: "Bob", age: 30, address: 'street' } }
      ]
      genericTable.bulkInsert(dataToInsert);
      const expectedList = dataToInsert.filter(item => !(item.profile.name === "Alice" && item.profile.age === 25));

      const result = await genericTable.select([], { profile: { $ne: { name: "Alice", age: 25 } } });
      expect(result).toHaveLength(dataToInsert.length - 1);
      expect(result).toEqual(expect.arrayContaining(expectedList));
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
      const expectedList = [listdata[0], listdata[2]];
      const teamToSearch =[{ name: "Rob", age: 30 }, { name: "Tom", age: 41 }];
  
      const result = await genericTable.select([], { team: { $ne: teamToSearch } });
      expect(result).toHaveLength(listdata.length - 1);
      expect(result.sort((a, b) => a.id - b.id)).toEqual(expectedList);
    });
  
  
  });
}
