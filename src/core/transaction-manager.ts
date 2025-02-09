import { TableSchema } from "../types/table.type";
import { TransactionHandler } from "../types/transaction.type";
import { Transaction } from "./transaction";

export class TransactionManager <T extends Record<string, any>> implements TransactionHandler <T> {

  constructor(private transaction: Transaction<T>) {}

  get<K extends keyof T>(name: K): TableSchema<T[K]> {
    return this.transaction.get(name);
  }

  commit(): Promise<void> {
    return this.transaction.commit();
  }

  rollback(): Promise<void> {
    return this.transaction.rollback();
  }
}