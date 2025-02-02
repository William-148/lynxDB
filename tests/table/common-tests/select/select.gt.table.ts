import { ITable } from "../../../../src/types/table.type";

export type ScoreRecord = {
  id: number;
  name: string;
  age: number;
  active: boolean;
  score: number;
  date: Date;
}

const scoreDataList: ScoreRecord[] = [
  { id: 1, name: 'Alice', age: 25, active: true, score: 50.5, date: new Date('2023-01-01') },
  { id: 2, name: 'Bob', age: 30, active: false, score: 75.0, date: new Date('2023-06-01') },
  { id: 3, name: 'Charlie', age: 35, active: true, score: 88.8, date: new Date('2024-01-01') },
  { id: 4, name: 'Diana', age: 28, active: false, score: 62.2, date: new Date('2022-12-31') }
];

/**
 * Common tests for the select() method with gt and gte conditions
 * 
 * @param description The description of the test
 * @param createInstance Function that creates a new instance of the Table class
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (dataTest) => {
 *  const table = new Table<ScoreRecord>({ primaryKey: [] });
 *  await table.bulkInsert(dataTest);
 *  return table;
 * }
 * ```
 */
export function selectGtGteTests(description: string, createInstance: (dataTest: ScoreRecord[]) => Promise<ITable<ScoreRecord>>) {
  describe (description, () => {
    
    let genericTable: ITable<any>;
  
    beforeEach(async () => {
      genericTable = await createInstance(scoreDataList);
    });
  
    it('filter records with gt operator for numeric values', async () => {
      const result = await genericTable.select([], { age: { gt: 28 } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.age)).toEqual([30, 35]);
    });
  
    it('filter records with gte operator for numeric values', async () => {
      const result = await genericTable.select([], { age: { gte: 28 } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.age)).toEqual([30, 35, 28]);
    });
  
    it('filter records with gt operator for float values', async () => {
      const result = await genericTable.select([], { score: { gt: 60.0 } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.score)).toEqual([75.0, 88.8, 62.2]);
    });
  
    it('filter records with gte operator for float values', async () => {
      const result = await genericTable.select([], { score: { gte: 62.2 } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.score)).toEqual([75.0, 88.8, 62.2]);
    });
  
    it('filter records with gt operator for dates', async () => {
      const result = await genericTable.select([], { date: { gt: new Date('2023-01-01') } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.date.toISOString())).toEqual([
        new Date('2023-06-01').toISOString(),
        new Date('2024-01-01').toISOString()
      ]);
    });
  
    it('filter records with gte operator for dates', async () => {
      const result = await genericTable.select([], { date: { gte: new Date('2023-01-01') } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.date.toISOString())).toEqual([
        new Date('2023-01-01').toISOString(),
        new Date('2023-06-01').toISOString(),
        new Date('2024-01-01').toISOString()
      ]);
    });
  
    it('return an empty array when no records match for gt', async () => {
      const result = await genericTable.select([], { age: { gt: 40 } });
      expect(result).toHaveLength(0);
    });
  
    it('return an empty array when no records match for gte', async () => {
      const result = await genericTable.select([], { age: { gte: 50 } });
      expect(result).toHaveLength(0);
    });
  
    it('handle edge case with gt operator for boolean values', async () => {
      const result = await genericTable.select([], { active: { gt: false } });
      expect(result).toHaveLength(2); // True values
      expect(result.map(record => record.name)).toEqual(['Alice', 'Charlie']);
    });
  
    it('handle edge case with gte operator for boolean values', async () => {
      const result = await genericTable.select([], { active: { gte: false } });
      expect(result).toHaveLength(4); // All values since false <= true
    });
  
  });
}
