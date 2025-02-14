export { LynxDB } from "./core/database";
export { generateId } from "./utils/generate-id";

// Errors
export * from "./core/errors";

// Enums
export { ComparisonOp } from "./types/query.type";
export { LogicalOp } from "./types/query.type";
export { IsolationLevel } from "./types/transaction.type";

// Types e interfaces
export type { TableSchema } from "./types/table.type";
export type { TransactionHandler } from "./types/transaction.type";
export type { TablesDefinition, TableConfig } from "./types/table.type";
export type { ConfigOptions } from "./types/config.type";
export type { RecordWithId } from "./types/record.type";