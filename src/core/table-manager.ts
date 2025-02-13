import { TableSchema } from "../types/table.type";
import { Query } from "../types/query.type";
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

  select(where?: Query<RecordWithId<T>>): Promise<T[]>;
  select(fields?: (keyof T)[], where?: Query<RecordWithId<T>>): Promise<Partial<T>[]>;
  select(arg1?: (keyof T)[] | Query<RecordWithId<T>>, arg2?: Query<RecordWithId<T>>): Promise<Partial<T>[] | T[]> {
    return this.table.select(arg1 as any, arg2);
  }

  update(updatedFields: Partial<T>, where: Query<RecordWithId<T>>): Promise<number> {
    return this.table.update(updatedFields, where);
  }

  deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    return this.table.deleteByPk(primaryKey);
  }

}