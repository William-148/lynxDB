import { LocalTable, RecordWithId } from "../types/database-table.type";
import { Filter } from "../types/filter.type";
import { Table } from "./table";

export class TableManager <T> implements LocalTable <T> {

  constructor(private table: Table<T>) {}

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
    return this.update(updatedFields, where);
  }

}