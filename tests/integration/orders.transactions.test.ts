import { LynxDB } from "../../src/core/database";
import { TablesDefinition } from "../../src/types/table.type";

type Order = {
  orderId: number;
  productId: number;
  quantity: number;
  customerId: number;
  status: "created" | "cancelled" | "processing" | "completed";
};

type Stock = {
  productId: number;
  quantity: number;
};

type Invoice = {
  invoiceId: number;
  orderId: number;
  amount: number;
  status: "issued" | "cancelled";
};

const tableConfigs: TablesDefinition<{
  orders: Order;
  stock: Stock;
  invoices: Invoice;
}> = {
  orders: { primaryKey: ["orderId"] },
  stock: { primaryKey: ["productId"] },
  invoices: { primaryKey: ["invoiceId"] },
};

describe("Transacciones en un sistema de pedidos", () => {
  let db: LynxDB<{ orders: Order; stock: Stock; invoices: Invoice }>;

  beforeEach(() => {
    db = new LynxDB(tableConfigs);
  });

  it("Order creation and stock update - Success", async () => {
    // Preload stock: product 1 with 10 units
    await db.get("stock").insert({ productId: 1, quantity: 10 });

    const result = await db.transaction(async (t) => {
      // Insert order: 5 units of product 1
      const order = await t.get("orders").insert({
        orderId: 1,
        productId: 1,
        quantity: 5,
        customerId: 100,
        status: "created",
      });

      // Get current stock
      const stockRecord = await t.get("stock").findByPk({ productId: 1 });
      if (!stockRecord) throw new Error("Stock not found");

      // Check if there is enough stock
      if (stockRecord.quantity < order.quantity) {
        throw new Error("Insufficient stock");
      }

      // Update stock: subtract the ordered quantity
      const newQuantity = stockRecord.quantity - order.quantity;
      await t.get("stock").update(
        { quantity: newQuantity },
        { productId: { $eq: 1 } }
      );

      return { order, newStock: newQuantity };
    });

    // Verify that the order was inserted and the stock was updated
    const orderDb = await db.get("orders").findByPk({ orderId: 1 });
    const stockDb = await db.get("stock").findByPk({ productId: 1 });
    expect(orderDb).toEqual(result.order);
    expect(stockDb?.quantity).toBe(result.newStock); // 10 - 5 = 5
  });

  it("Creation of Order and Stock Update - (rollback due to insufficient stock)", async () => {
    // Preload stock: product 1 with only 3 units
    await db.get("stock").insert({ productId: 1, quantity: 3 });

    await expect(
      db.transaction(async (t) => {
        const order = await t.get("orders").insert({
          orderId: 1,
          productId: 1,
          quantity: 5, //5 units are required
          customerId: 100,
          status: "created",
        });

        const stockRecord = await t.get("stock").findByPk({ productId: 1 });
        if (!stockRecord) throw new Error("Stock not found");

        if (stockRecord.quantity < order.quantity) {
          // Forcing error to simulate insufficient stock
          throw new Error("Insufficient stock");
        }

        // The following update is never executed
        const newQuantity = stockRecord.quantity - order.quantity;
        await t.get("stock").update(
          { quantity: newQuantity },
          { productId: { $eq: 1 } }
        );
      })
    ).rejects.toThrow("Insufficient stock");

    // Verify that the order was not inserted and the stock remains unchanged
    const orderDb = await db.get("orders").findByPk({ orderId: 1 });
    const stockDb = await db.get("stock").findByPk({ productId: 1 });
    expect(orderDb).toBeNull();
    expect(stockDb?.quantity).toBe(3);
  });

  it("Order Cancellation: update the order and refund the stock", async () => {
    // Preload state: order created and stock updated previously.
    await db.get("orders").insert({
      orderId: 1,
      productId: 1,
      quantity: 5,
      customerId: 100,
      status: "created",
    });
    // Suppose there were originally 10 units and 5 were subtracted
    await db.get("stock").insert({ productId: 1, quantity: 5 });

    const result = await db.transaction(async (t) => {
      // Update order status to "cancelled"
      await t.get("orders").update(
        { status: "cancelled" },
        { orderId: { $eq: 1 } }
      );

      // Refund the quantity to the stock: add 5 units
      const stockRecord = await t.get("stock").findByPk({ productId: 1 });
      if (!stockRecord) throw new Error("Stock not found");
      const newQuantity = stockRecord.quantity + 5;
      await t.get("stock").update(
        { quantity: newQuantity },
        { productId: { $eq: 1 } }
      );

      return { newStock: newQuantity };
    });

    // Verify that the order was cancelled and the stock was updated
    const orderDb = await db.get("orders").findByPk({ orderId: 1 });
    const stockDb = await db.get("stock").findByPk({ productId: 1 });
    expect(orderDb?.status).toBe("cancelled");
    expect(stockDb?.quantity).toBe(result.newStock); // 5 + 5
  });

  // 4. 
  describe("Bulk Order or Batch of Orders", () => {
    // 4a. Successful Batch
    it("Batch of Orders - Success", async () => {
      // Pre-load stock for two products
      await db.get("stock").bulkInsert([
        { productId: 1, quantity: 10 },
        { productId: 2, quantity: 10 },
      ]);

      await db.transaction(async (t) => {
        // Order 1: product 1, 2 units
        const order1 = await t.get("orders").insert({
          orderId: 1,
          productId: 1,
          quantity: 2,
          customerId: 101,
          status: "created",
        });
        // Update stock product 1
        const stock1 = await t.get("stock").findByPk({ productId: 1 });
        if (!stock1 || stock1.quantity < order1.quantity) throw new Error("Insufficient stock");
        await t.get("stock").update(
          { quantity: stock1.quantity - order1.quantity },
          { productId: { $eq: 1 } }
        );

        // Order 2: product 2, 3 units
        const order2 = await t.get("orders").insert({
          orderId: 2,
          productId: 2,
          quantity: 3,
          customerId: 102,
          status: "created",
        });
        // Update stock product 2
        const stock2 = await t.get("stock").findByPk({ productId: 2 });
        if (!stock2 || stock2.quantity < order2.quantity) throw new Error("Insufficient stock");
        await t.get("stock").update(
          { quantity: stock2.quantity - order2.quantity },
          { productId: { $eq: 2 } }
        );

        // Order 3: product 1, 5 units
        const order3 = await t.get("orders").insert({
          orderId: 3,
          productId: 1,
          quantity: 5,
          customerId: 103,
          status: "created",
        });
        // Update stock product 1
        const stock1Updated = await t.get("stock").findByPk({ productId: 1 });
        if (!stock1Updated || stock1Updated.quantity < order3.quantity) throw new Error("Insufficient stock");
        await t.get("stock").update(
          { quantity: stock1Updated.quantity - order3.quantity },
          { productId: { $eq: 1 } }
        );
      });

      // Verify results
      const orders = await db.get("orders").select([], {});
      expect(orders).toHaveLength(3);

      const stock1 = await db.get("stock").findByPk({ productId: 1 });
      const stock2 = await db.get("stock").findByPk({ productId: 2 });
      // For product 1: 10 - 2 - 5 = 3
      expect(stock1?.quantity).toBe(3);
      // For product 2: 10 - 3 = 7
      expect(stock2?.quantity).toBe(7);
    });

    // 4b. Failed Batch: one of the orders fails due to insufficient stock and rollback is performed
    it("Batch of Orders - Rollback due to error in an order", async () => {
      // Pre-load stock
      await db.get("stock").bulkInsert([
        { productId: 1, quantity: 10 },
        { productId: 2, quantity: 2 }, // Insufficient stock for the order
      ]);

      await expect(
        db.transaction(async (t) => {
          // Order 1: product 1, 2 units
          const order1 = await t.get("orders").insert({
            orderId: 1,
            productId: 1,
            quantity: 2,
            customerId: 101,
            status: "created",
          });
          const stock1 = await t.get("stock").findByPk({ productId: 1 });
          if (!stock1 || stock1.quantity < order1.quantity) throw new Error("Insufficient stock");
          await t.get("stock").update(
            { quantity: stock1.quantity - order1.quantity },
            { productId: { $eq: 1 } }
          );

          // Order 2: product 2, 3 units (will fail)
          const order2 = await t.get("orders").insert({
            orderId: 2,
            productId: 2,
            quantity: 3,
            customerId: 102,
            status: "created",
          });
          const stock2 = await t.get("stock").findByPk({ productId: 2 });
          if (!stock2 || stock2.quantity < order2.quantity) {
            throw new Error("Insufficient stock for product 2");
          }
          await t.get("stock").update(
            { quantity: stock2.quantity - order2.quantity },
            { productId: { $eq: 2 } }
          );
        })
      ).rejects.toThrow("Insufficient stock for product 2");

      // Verify that no order was inserted and the stock remains the same
      const orders = await db.get("orders").select([], {});
      expect(orders).toHaveLength(0);

      const stock1 = await db.get("stock").findByPk({ productId: 1 });
      const stock2 = await db.get("stock").findByPk({ productId: 2 });
      expect(stock1?.quantity).toBe(10);
      expect(stock2?.quantity).toBe(2);
    });
  });

  // 5. Order with Joint Billing
  describe("Order with Joint Billing", () => {
    // 5a. Successful transaction: order and invoice are created
    it("Order with Billing - Success", async () => {
      await db.transaction(async (t) => {
        // Insert order
        const order = await t.get("orders").insert({
          orderId: 1,
          productId: 1,
          quantity: 4,
          customerId: 105,
          status: "created",
        });
        // Insert invoice associated with the order
        await t.get("invoices").insert({
          invoiceId: 1,
          orderId: order.orderId,
          amount: 100, // example amount
          status: "issued",
        });
      });

      // Verify that order and invoice were inserted
      const orderDb = await db.get("orders").findByPk({ orderId: 1 });
      const invoiceDb = await db.get("invoices").findByPk({ invoiceId: 1 });
      expect(orderDb).not.toBeNull();
      expect(invoiceDb).not.toBeNull();
      expect(invoiceDb?.orderId).toBe(1);
    });

    // 5b. Billing failure: the order is inserted, but the invoice fails, and a rollback is performed
    it("Order with Billing - Rollback due to invoice error", async () => {
      await expect(
        db.transaction(async (t) => {
          // Insert order
          await t.get("orders").insert({
            orderId: 1,
            productId: 1,
            quantity: 4,
            customerId: 105,
            status: "created",
          });
          // Simulate error when inserting invoice
          throw new Error("Error creating invoice");
        })
      ).rejects.toThrow("Error creating invoice");

      // Verify that the order was not inserted (full rollback)
      const orderDb = await db.get("orders").findByPk({ orderId: 1 });
      expect(orderDb).toBeNull();
    });
  });

  // 6. Nested or Composite Transactions
  it("Composite Transaction (Nested Simulation)", async () => {
    // In this example, "nesting" is simulated by calling another transaction within a transaction.
    await db.get("stock").insert({ productId: 1, quantity: 10 });

    const result = await db.transaction(async (t) => {
      // Insert order
      const order = await t.get("orders").insert({
        orderId: 1,
        productId: 1,
        quantity: 3,
        customerId: 110,
        status: "created",
      });

      // "Inner transaction": update stock
      const innerResult = await db.transaction(async (t2) => {
        const stockRecord = await t2.get("stock").findByPk({ productId: 1 });
        if (!stockRecord || stockRecord.quantity < order.quantity) {
          throw new Error("Insufficient stock");
        }
        await t2.get("stock").update(
          { quantity: stockRecord.quantity - order.quantity },
          { productId: { $eq: 1 } }
        );
        return stockRecord.quantity - order.quantity;
      });

      return { order, finalStock: innerResult };
    });

    // Verify that the order was inserted and the stock was updated correctly
    const orderDb = await db.get("orders").findByPk({ orderId: 1 });
    const stockDb = await db.get("stock").findByPk({ productId: 1 });
    expect(orderDb).not.toBeNull();
    expect(orderDb).toEqual(result.order);
    expect(stockDb?.quantity).toBe(7); // 10 - 3 = 7
    expect(stockDb?.quantity).toBe(result.finalStock);
  });

  // 7. Concurrent Order Update
  it("Concurrent Order Update", async () => {
    // Pre-load an order
    await db.get("orders").insert({
      orderId: 1,
      productId: 1,
      quantity: 2,
      customerId: 120,
      status: "created",
    });

    // Simulate two transactions updating the same order.
    // To simulate concurrency, introduce a delay in one of them.
    const transactionA = db.transaction(async (t) => {
      // Wait 150 ms to simulate a delay
      await new Promise((res) => setTimeout(res, 150));
      await t.get("orders").update(
        { status: "processing" },
        { orderId: { $eq: 1 } }
      );
    });

    const transactionB = db.transaction(async (t) => {
      await t.get("orders").update(
        { status: "completed" },
        { orderId: { $eq: 1 } }
      );
    });

    // Execute both transactions concurrently
    await Promise.all([transactionA, transactionB]);

    // Verify that the order was updated (the final status depends on the commit sequence)
    const orderDb = await db.get("orders").findByPk({ orderId: 1 });
    expect(orderDb?.status).not.toBe("created");
    expect(["processing", "completed"]).toContain(orderDb?.status);
  });

});
