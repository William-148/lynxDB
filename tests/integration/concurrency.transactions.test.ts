import { LynxDB } from "../../src/core/database";
import { ConfigOptions } from "../../src/types/config.type";
import { TableSchema, TablesDefinition } from "../../src/types/table.type";
import { IsolationLevel } from "../../src/types/transaction.type";

type Stock = {
  productId: number;
  quantity: number;
};

type Order = {
  orderId: number;
  productId: number;
  quantity: number;
  customerId: number;
};

type TablesList = { stock: Stock; orders: Order };

// Table configuration
const tableConfigs: TablesDefinition<TablesList> = {
  stock: { primaryKey: ["productId"] },
  orders: { primaryKey: ["orderId"] },
};

describe("High Concurrency: Simulating Concurrent Sales in E-commerce", () => {
  let db: LynxDB<TablesList>;
  let stockTable: TableSchema<Stock>;
  let ordersTable: TableSchema<Order>;

  // Before each test, reset the database and insert initial stock.
  beforeEach(async () => {
    db = new LynxDB(tableConfigs);
    stockTable = db.get("stock");
    ordersTable = db.get("orders");

    // Insert initial stock for product 1 (quantity = 100)
    await stockTable.insert({ productId: 1, quantity: 100 });
  });

  it("No more stock is sold than available under high concurrency", async () => {
    const serializableConfig: ConfigOptions = { isolationLevel: IsolationLevel.Serializable };
    const concurrentTransactions: Promise<
      { order?: Order; purchaseQuantity?: number; error?: string }
    >[] = [];
    const numConcurrentTransactions = 50;
    let nextOrderId = 1; // Counter to assign a unique ID to each order

    for (let i = 0; i < numConcurrentTransactions; i++) {
      // Each transaction simulates the purchase of a random quantity between 1 and 5.
      const purchaseQuantity = Math.floor(Math.random() * 5) + 1;

      const transactionPromise = db.transaction(async (tx) => {
        // Read the current stock for product 1
        const currentStockRecord = await tx.get("stock").findByPk({ productId: 1 });
        if (!currentStockRecord) throw new Error("Stock not found");

        // If there is not enough stock, throw an error to trigger a rollback.
        if (currentStockRecord.quantity < purchaseQuantity) {
          throw new Error("Insufficient stock");
        }

        // Update stock: subtract the purchased quantity.
        const newStockQuantity = currentStockRecord.quantity - purchaseQuantity;
        await tx.get("stock").update({ quantity: newStockQuantity }, { productId: { $eq: 1 } });

        // Insert the order with a unique ID.
        const orderId = nextOrderId++;
        const order = await tx.get("orders").insert({
          orderId,
          productId: 1,
          quantity: purchaseQuantity,
          customerId: 1000 + orderId, // Example customer ID
        });

        return { order, purchaseQuantity };
      },
        serializableConfig // Apply serializable isolation level
      ).catch((err) => {
        // Capture the error for each transaction without interrupting others.
        return { error: err.message };
      });

      concurrentTransactions.push(transactionPromise);
    }

    // Execute all transactions concurrently.
    // const results = await Promise.all(concurrentTransactions);
    await Promise.all(concurrentTransactions);

    // Retrieve the final stock record and the list of successful orders.
    const stockRecordFinal = await stockTable.findByPk({ productId: 1 });
    const orders = await ordersTable.select([], {});

    // Calculate the total quantity sold by summing up the quantity from each order.
    const totalSold = orders.reduce((acc: number, order) => acc + (order.quantity ?? 0), 0);
    const remainingStock = stockRecordFinal ? stockRecordFinal.quantity : 0;

    // Verify that the sum of the final stock and the total sold quantity equals the initial stock (100).
    expect(remainingStock + totalSold).toBe(100);

    // Additionally, verify that the final stock never goes negative.
    expect(remainingStock).toBeGreaterThanOrEqual(0);

    // (Optional) Print a summary of results to see how many transactions failed.
    // const failedTransactions = results.filter((r) => r.error);
    // console.log(
    //   `Successful transactions: ${orders.length}, failed: ${failedTransactions.length}`
    // );
  });
});
