import { TableSchema } from "../types/table.type";
import { TransactionHandler } from "../types/transaction.type";
import { Transaction } from "./transaction";

/**
 * Encapsulates a transaction in the database.
 * 
 * @template Tables An object where keys are table names and values are the types 
 * of objects stored in the tables.
 * 
 * Example:
 * ```typescript
 * type Person { id: number; name: string; }
 * type MyTables = { persons: Person; ... }
 * const tx = new TransactionManager<MyTables>(...);
 * ```
 */
export class TransactionManager <Tables extends Record<string, any>> implements TransactionHandler <Tables> {

  constructor(private transaction: Transaction<Tables>) {}

  get<K extends keyof Tables>(name: K): TableSchema<Tables[K]> {
    return this.transaction.get(name);
  }

  commit(): Promise<void> {
    return this.transaction.commit();
  }

  rollback(): Promise<void> {
    return this.transaction.rollback();
  }
}