import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { uploadMiddleware, handleUpload } from "./routes/upload";
import {
  handleLogin,
  handleMfaSetup,
  handleMfaVerify,
  handleLogout,
  handleRefresh,
  updateUserPassword,
  resetUserMfa,
} from "./routes/auth";
import { handleCreateAccount } from "./routes/users";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "./routes/customers";
import { importCustomers, importProducts, importInventory } from "./routes/excel-imports";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./routes/products";
import {
  listBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  deletePallet,
  deletePalletItem,
  archiveBatch,
} from "./routes/batches";
import {
  listDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "./routes/drivers";
import { getDriverSchedule } from "./routes/driver-schedule";
import { getAgentSchedule } from "./routes/agent-schedule";
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
} from "./routes/agents";
import {
  listTrucks,
  createTruck,
  updateTruck,
  deleteTruck,
} from "./routes/trucks";
import {
  listBookings,
  createBooking,
  updateBookingStatus,
  deleteBooking,
} from "./routes/bookings";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoiceStatus,
  updateInvoicePaymentStatus,
} from "./routes/invoices";
import {
  listDeliveries,
  createDelivery,
  updateDeliveryStatus,
  updateDeliveryItemStatus,
  assignDelivery,
} from "./routes/deliveries";
import { listReceipts, confirmDeliveryItem } from "./routes/receipts";
import { listAuditLogs } from "./routes/audit";
import { downloadBackup } from "./routes/backup";
import {
  listAccountsReceivable,
  getCustomerBalance,
  updateARStatus,
} from "./routes/accounts-receivable";
import {
  listAgentReturns,
  createAgentReturn,
  acceptAgentReturn,
  rejectAgentReturn,
} from "./routes/agent-returns";
import {
  listInventoryBatches,
  getInventoryBatch,
  createInventoryBatch,
  updateInventoryBatch,
  deleteInventoryBatch,
  addInventoryBatchItem,
  removeInventoryBatchItem,
} from "./routes/inventory-batches";
import {
  listPallets,
  getPallet,
  createPallet,
  updatePalletStatus,
  approvePallet,
  deletePalletForOrder,
  getProductInventory,
  getProductStock,
  suggestBatches,
} from "./routes/pallets";
import { getSalesForecast } from "./routes/forecast";
import { authMiddleware, requireRole } from "./middleware/auth";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "6mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static("public"));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Upload route
  app.post("/api/upload", uploadMiddleware, handleUpload);

  // Auth routes (no auth required)
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/mfa/setup", handleMfaSetup);
  app.post("/api/auth/mfa/verify", handleMfaVerify);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/refresh", authMiddleware, handleRefresh);
  app.post("/api/users", authMiddleware, requireRole("admin"), handleCreateAccount);
  app.patch("/api/users/:userId/password", authMiddleware, requireRole("admin"), updateUserPassword);
  app.post("/api/users/:userId/mfa/reset", authMiddleware, requireRole("admin"), resetUserMfa);

  // Customers routes
  app.get("/api/customers", authMiddleware, listCustomers);
  app.post("/api/customers", authMiddleware, requireRole("admin"), createCustomer);
  app.patch("/api/customers/:id", authMiddleware, requireRole("admin"), updateCustomer);
  app.delete("/api/customers/:id", authMiddleware, requireRole("admin"), deleteCustomer);
  app.post("/api/customers/import", authMiddleware, requireRole("admin"), importCustomers);

  // Products routes
  app.get("/api/products", authMiddleware, listProducts);
  app.post("/api/products", authMiddleware, requireRole("admin"), createProduct);
  app.patch("/api/products/:id", authMiddleware, requireRole("admin"), updateProduct);
  app.delete("/api/products/:id", authMiddleware, requireRole("admin"), deleteProduct);
  app.post("/api/products/import", authMiddleware, requireRole("admin"), importProducts);

  // Batches routes
  app.get("/api/batches", authMiddleware, listBatches);
  app.post("/api/batches/import", authMiddleware, requireRole("admin"), importInventory);
  app.post("/api/batches", authMiddleware, requireRole("admin"), createBatch);
  app.patch("/api/batches/:id", authMiddleware, requireRole("admin"), updateBatch);
  app.patch("/api/batches/:id/archive", authMiddleware, requireRole("admin"), archiveBatch);
  app.delete("/api/batches/:id", authMiddleware, requireRole("admin"), deleteBatch);
  app.delete("/api/batches/pallets/:id", authMiddleware, requireRole("admin"), deletePallet);
  app.delete("/api/batches/pallet-items/:id", authMiddleware, requireRole("admin"), deletePalletItem);

  // Drivers routes
  app.get("/api/drivers", authMiddleware, listDrivers);
  app.post("/api/drivers", authMiddleware, requireRole("admin"), createDriver);
  app.patch("/api/drivers/:id", authMiddleware, requireRole("admin"), updateDriver);
  app.delete("/api/drivers/:id", authMiddleware, requireRole("admin"), deleteDriver);
  app.get("/api/driver-schedule", authMiddleware, requireRole("admin", "driver"), getDriverSchedule);
  app.get("/api/agent-schedule", authMiddleware, requireRole("agent"), getAgentSchedule);

  // Agents routes
  app.get("/api/agents", authMiddleware, listAgents);
  app.post("/api/agents", authMiddleware, requireRole("admin"), createAgent);
  app.patch("/api/agents/:id", authMiddleware, requireRole("admin"), updateAgent);
  app.delete("/api/agents/:id", authMiddleware, requireRole("admin"), deleteAgent);

  // Trucks routes
  app.get("/api/trucks", authMiddleware, listTrucks);
  app.post("/api/trucks", authMiddleware, requireRole("admin"), createTruck);
  app.patch("/api/trucks/:id", authMiddleware, requireRole("admin"), updateTruck);
  app.delete("/api/trucks/:id", authMiddleware, requireRole("admin"), deleteTruck);

  // Bookings routes
  app.get("/api/bookings", authMiddleware, listBookings);
  app.post("/api/bookings", authMiddleware, createBooking);
  app.patch("/api/bookings/:id/status", authMiddleware, requireRole("admin"), updateBookingStatus);
  app.delete("/api/bookings/:id", authMiddleware, deleteBooking);

  // Invoices routes
  app.get("/api/invoices", authMiddleware, listInvoices);
  app.get("/api/invoices/:id", authMiddleware, getInvoice);
  app.post("/api/invoices", authMiddleware, requireRole("admin"), createInvoice);
  app.patch("/api/invoices/:id/status", authMiddleware, requireRole("admin"), updateInvoiceStatus);
  app.patch("/api/invoices/:id/payment-status", authMiddleware, requireRole("admin"), updateInvoicePaymentStatus);

  // Sales forecast routes
  app.get("/api/sales/forecast", authMiddleware, getSalesForecast);

  // Deliveries routes
  app.get("/api/deliveries", authMiddleware, listDeliveries);
  app.post("/api/deliveries", authMiddleware, createDelivery);
  app.patch("/api/deliveries/:id/status", authMiddleware, updateDeliveryStatus);
  app.patch("/api/deliveries/:id/assign", authMiddleware, assignDelivery);
  app.patch("/api/deliveries/:deliveryId/items/:itemId/status", authMiddleware, updateDeliveryItemStatus);

  // Receipts routes
  app.get("/api/receipts", authMiddleware, listReceipts);
  app.post("/api/deliveries/:id/items/:itemId/confirm", authMiddleware, confirmDeliveryItem);

  // Audit logs routes
  app.get("/api/audit-logs", authMiddleware, requireRole("admin"), listAuditLogs);
  app.get("/api/backup", authMiddleware, requireRole("admin"), downloadBackup);

  // Accounts Receivable routes
  app.get("/api/accounts-receivable", authMiddleware, listAccountsReceivable);
  app.get("/api/accounts-receivable/customer/:customerId", authMiddleware, getCustomerBalance);
  app.patch("/api/accounts-receivable/:id/status", authMiddleware, requireRole("admin"), updateARStatus);

  app.get("/api/agent-returns", authMiddleware, listAgentReturns);
  app.post("/api/agent-returns", authMiddleware, createAgentReturn);
  app.post("/api/agent-returns/:id/accept", authMiddleware, requireRole("admin"), acceptAgentReturn);
  app.post("/api/agent-returns/:id/reject", authMiddleware, requireRole("admin"), rejectAgentReturn);

  // Inventory Batch routes
  app.get("/api/inventory-batches", authMiddleware, listInventoryBatches);
  app.get("/api/inventory-batches/:id", authMiddleware, getInventoryBatch);
  app.post("/api/inventory-batches", authMiddleware, requireRole("admin"), createInventoryBatch);
  app.patch("/api/inventory-batches/:id", authMiddleware, requireRole("admin"), updateInventoryBatch);
  app.delete("/api/inventory-batches/:id", authMiddleware, requireRole("admin"), deleteInventoryBatch);
  app.post("/api/inventory-batches/:id/items", authMiddleware, requireRole("admin"), addInventoryBatchItem);
  app.delete("/api/inventory-batches/:id/items/:itemId", authMiddleware, requireRole("admin"), removeInventoryBatchItem);

  // Pallet routes (order preparation)
  app.get("/api/pallets", authMiddleware, listPallets);
  app.get("/api/pallets/:id", authMiddleware, getPallet);
  app.post("/api/pallets", authMiddleware, createPallet);
  app.patch("/api/pallets/:id/status", authMiddleware, requireRole("admin", "agent"), updatePalletStatus);
  app.patch("/api/pallets/:id/approve", authMiddleware, requireRole("admin", "agent"), approvePallet);
  app.delete("/api/pallets/:id", authMiddleware, requireRole("admin"), deletePalletForOrder);
  app.get("/api/products/inventory", authMiddleware, getProductInventory);
  app.get("/api/products/:productId/stock", authMiddleware, getProductStock);
  app.get("/api/orders/:orderId/suggested-batches", authMiddleware, suggestBatches);

  return app;
}
