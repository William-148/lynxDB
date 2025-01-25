import { IsolationLevel } from "./transaction.type";

export type ConfigOptions = {
  /** The isolation level for transactions. */
  isolationLevel?: IsolationLevel;
  /** Timeout in milliseconds for the lock of the table. Optional. */
  lockTimeout?: number;
}