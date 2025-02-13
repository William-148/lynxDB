import { TableSchema } from "../../../../../src/types/table.type";

type Element = {
  id: number;
  name: string;
  description: string;
}

const defaultData: Element[] = [
  { id: 1, name: 'Alpha', description: 'The first element' },
  { id: 2, name: 'Beta', description: 'A secondary component' },
  { id: 3, name: 'Gamma', description: 'A tertiary element' },
  { id: 4, name: 'Delta', description: 'The final element' }
];

/**
 * Common tests for the select() method with like condition
 * 
 * @param createInstance Function that creates a new instance of the table
 * 
 * Param Example:
 * ```ts
 * const createInstance = async (data) => {
 *  const table = new Table<Element>({ primaryKey: [] });
 *  await table.bulkInsert(data);
 *  return table;
 * }
 * ```
 */
export function selectLikeTests(createInstance: (data: Element[]) => Promise<TableSchema<any>>) {
  describe("with like condition - should...", () => {
    let genericTable: TableSchema<Element>;
  
    beforeEach(async () => {
      genericTable = await createInstance(defaultData);
    });
  
    it('filter records where string starts with a pattern', async () => {
      const result = await genericTable.select([], { name: { $like: 'Al%' } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Alpha');
    });
  
    it('filter records where string ends with a pattern', async () => {
      const result = await genericTable.select([], { name: { $like: '%ta' } });
      expect(result).toHaveLength(2);
      expect(result.map(record => record.name)).toEqual(['Beta', 'Delta']);
    });
  
    it('filter records where string contains a pattern', async () => {
      const result = await genericTable.select([], { description: { $like: '%element%' } });
      expect(result).toHaveLength(3);
      expect(result.map(record => record.description)).toEqual([
        'The first element',
        'A tertiary element',
        'The final element'
      ]);
    });
  
    it('return all records when pattern matches all', async () => {
      const result = await genericTable.select([], { name: { $like: '%' } });
      expect(result).toHaveLength(4);
      expect(result.map(record => record.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    });
  
    it('return an empty array when no matches are found', async () => {
      const result = await genericTable.select([], { name: { $like: 'Z%' } });
      expect(result).toHaveLength(0);
    });
  
    it('handle cases with special characters in the pattern', async () => {
      genericTable.bulkInsert([
        { id: 5, name: 'Epsilon$', description: 'Special character' },
        { id: 6, name: 'Zeta%', description: 'Another special character' },
        { id: 19, name: 'Oblivion$', description: 'Special character' }
      ]);
      const result = await genericTable.select([], { name: { $like: '%$' } });
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(['Epsilon$', 'Oblivion$']);
    });
  
    it('handle patterns with underscores as wildcards', async () => {
      const result = await genericTable.select([], { name: { $like: '_eta' } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Beta');
    });
  
    it('handle patterns with mixed wildcards', async () => {
      const result = await genericTable.select([], { name: { $like: '%a%' } });
      expect(result).toHaveLength(4);
      expect(result.map(record => record.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    });
  
    it('return an empty array when searching with an empty pattern', async () => {
      const result = await genericTable.select([], { name: { $like: '' } });
      expect(result).toHaveLength(0);
    });
  
    it('handle patterns with case sensitivity', async () => {
      genericTable.insert({ id: 7, name: 'ALPHA', description: 'Uppercase match' });
      const result = await genericTable.select([], { name: { $like: 'Alpha' } });
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(['Alpha', 'ALPHA']);
    });
  });
}
