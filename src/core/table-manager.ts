import { TableSchema } from "../types/table.type";
import { Filter } from "../types/filter.type";
import { RecordWithId } from "../types/record.type";

export class TableManager <T> implements TableSchema <T> {

  constructor(private table: TableSchema<T>) {}

  size(): number {
    return this.table.size();
  }

  insert(record: T): Promise<T> {
    return this.table.insert(record);
  }

  bulkInsert(records: T[]): Promise<void> {
    return this.table.bulkInsert(records);
  }

  findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    return this.table.findByPk(primaryKey);
  }

  select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    return this.table.select(fields, where);
  }

  update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    return this.table.update(updatedFields, where);
  }

  deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    return this.table.deleteByPk(primaryKey);
  }

}