import { IsolationLevel } from "./transaction.type";

export type DatabaseOptions = {
  /** The isolation level for transactions. */
  isolationLevel?: IsolationLevel;
}