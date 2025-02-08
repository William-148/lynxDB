import { ITable } from "../../../../../src/types/table.type";

type UserTags = {
  id: number;
  tag: string;
  number: number;
  name: string;
}

const defaultData: UserTags[] = [
  { id: 1, tag: 'red', number: 1, name: 'Alpha' },
  { id: 2, tag: 'blue', number: 2, name: 'Beta' },
  { id: 3, tag: 'yellow', number: 3, name: 'Gamma' },
  { id: 4, tag: 'green', number: 4, name: 'Delta' }
];

/**
 * Common tests for the select() method with include condition
 * 
 * @param createInstance Function that creates a new instance of the Table class
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (dataTest) => {
 * const table = new Table<UserTags>({ primaryKey: [] });
 * await table.bulkInsert(dataTest);
 * return table;
 * }
 * ```
 */
export function selectIncludesTests(createInstance: (dataTest: UserTags[]) => Promise<ITable<any>>) {
  describe("With include condition - should...", () => {
    let genericTable: ITable<UserTags>;
  
    beforeEach(async () => {
      genericTable = await createInstance(defaultData);
    });
  
    it('filter records when a string property is included in the array', async () => {
      const result = await genericTable.select([], { tag: { $includes: ['red', 'blue'] } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.name)).toEqual(['Alpha', 'Beta']);
    });
  
    it('filter records when a numeric property is included in the array', async () => {
      const result = await genericTable.select([], { number: { $includes: [2, 3] } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.name)).toEqual(['Beta', 'Gamma']);
    });
  
    it('return all records when all values are included', async () => {
      const result = await genericTable.select([], { tag: { $includes: ['red', 'blue', 'yellow', 'green'] } });
      expect(result).toHaveLength(4);
      expect(result.map(record => record.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    });
  
    it('return an empty array when no values match', async () => {
      const result = await genericTable.select([], { tag: { $includes: ['purple', 'orange'] } });
      expect(result).toHaveLength(0);
    });
  
    it('handle cases with a single value matching', async () => {
      const result = await genericTable.select([], { tag: { $includes: ['yellow'] } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Gamma');
    });
  
    it('handle cases with empty include values', async () => {
      const result = await genericTable.select([], { tag: { $includes: [] } });
      expect(result).toHaveLength(0);
    });
  
    it('handle cases with duplicates in the include array', async () => {
      const result = await genericTable.select([], { number: { $includes: [3, 3, 4] } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.name)).toEqual(['Gamma', 'Delta']);
    });
  
    it('return an empty array if the property does not exist in any record', async () => {
      const result = await genericTable.select([], { nonexistent: { $includes: ['value'] } } as any);
      expect(result).toHaveLength(0);
    });
  
  });
}