import { ITable } from "../../../../../src/types/table.type";

const defaultData = [
  { id: 1, name: 'Alpha', value: 100, active: true, score: 45.6, date: new Date('2022-01-01') },
  { id: 2, name: 'Beta', value: 200, active: false, score: 78.9, date: new Date('2023-01-01') },
  { id: 3, name: 'Gamma', value: 150, active: true, score: 33.3, date: new Date('2024-01-01') },
  { id: 4, name: 'Delta', value: 50, active: false, score: 95.1, date: new Date('2021-01-01') }
];

/**
 * Common tests for select() with lt and lte conditions
 * 
 * @param createInstance Function that receives an array of data and returns a new instance of the Table
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (data) => {
 * const table = new Table<any>({ primaryKey: ['id'] });
 * await table.bulkInsert(dataTest);
 * return table;
 * }
 * ```
 */
export function selectLtLteTests(createInstance: (data: any[]) => Promise<ITable<any>>) {
  describe("With lt and lte conditions - should...", () => {
    let genericTable: ITable<any>;
  
    beforeEach(async () => {
      genericTable = await createInstance(defaultData);
    });
  
    it('filter records with lt operator for numeric values', async () => {
      const result = await genericTable.select([], { value: { $lt: 150 } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.value)).toEqual([100, 50]);
    });
  
    it('filter records with lte operator for numeric values', async () => {
      const result = await genericTable.select([], { value: { $lte: 150 } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.value)).toEqual([100, 150, 50]);
    });
  
    it('filter records with lt operator for float values', async () => {
      const result = await genericTable.select([], { score: { $lt: 50.0 } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.score)).toEqual([45.6, 33.3]);
    });
  
    it('filter records with lte operator for float values', async () => {
      const result = await genericTable.select([], { score: { $lte: 45.6 } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.score)).toEqual([45.6, 33.3]);
    });
  
    it('filter records with lt operator for dates', async () => {
      const result = await genericTable.select([], { date: { $lt: new Date('2023-01-01') } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.date.toISOString())).toEqual([
        new Date('2022-01-01').toISOString(),
        new Date('2021-01-01').toISOString()
      ]);
    });
  
    it('filter records with lte operator for dates', async () => {
      const result = await genericTable.select([], { date: { $lte: new Date('2023-01-01') } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.date.toISOString())).toEqual([
        new Date('2022-01-01').toISOString(),
        new Date('2023-01-01').toISOString(),
        new Date('2021-01-01').toISOString()
      ]);
    });
  
    it('filter records with lt operator for boolean values (false < true)', async () => {
      const result = await genericTable.select([], { active: { $lt: true } });
      expect(result).toHaveLength(2); // All false values
      expect(result.map(record => record.name)).toEqual(['Beta', 'Delta']);
    });
  
    it('filter records with lte operator for boolean values (false <= true)', async () => {
      const result = await genericTable.select([], { active: { $lte: true } });
      expect(result).toHaveLength(4); // All records
    });
  
    it('return an empty array when no records match for lt', async () => {
      const result = await genericTable.select([], { value: { $lt: 0 } });
      expect(result).toHaveLength(0);
    });
  
    it('return an empty array when no records match for lte', async () => {
      const result = await genericTable.select([], { value: { $lte: -1 } });
      expect(result).toHaveLength(0);
    });
  });
}