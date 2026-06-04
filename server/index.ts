import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { uploadMiddleware, handleUpload } from "./routes/upload";
import {
  handleLogin,
  handleLogout,
  handleRefresh,
  handleCreateUser,
  updateUserPassword,   // ← add this
} from "./routes/auth";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "./routes/customers";
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
} from "./routes/bookings";
import {
  listInvoices,
  createInvoice,
  updateInvoiceStatus,
  updateInvoicePaymentStatus,
} from "./routes/invoices";
import {
  listDeliveries,
  createDelivery,
  updateDeliveryStatus,
  updateDeliveryItemStatus,
} from "./routes/deliveries";
import { listReceipts, confirmDeliveryItem } from "./routes/receipts";
import { listAuditLogs } from "./routes/audit";
import {
  listAccountsReceivable,
  getCustomerBalance,
  updateARStatus,
} from "./routes/accounts-receivable";
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
  deletePallet,
  getProductInventory,
  suggestBatches,
} from "./routes/pallets";
import { authMiddleware, requireRole } from "./middleware/auth";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
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
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/refresh", authMiddleware, handleRefresh);
  app.post("/api/auth/users", handleCreateUser);
  app.patch("/api/users/:userId/password", authMiddleware, requireRole("admin"), updateUserPassword);

  // Customers routes
  app.get("/api/customers", authMiddleware, listCustomers);
  app.post("/api/customers", authMiddleware, requireRole("admin"), createCustomer);
  app.patch("/api/customers/:id", authMiddleware, requireRole("admin"), updateCustomer);
  app.delete("/api/customers/:id", authMiddleware, requireRole("admin"), deleteCustomer);

  // Products routes
  app.get("/api/products", authMiddleware, listProducts);
  app.post("/api/products", authMiddleware, requireRole("admin"), createProduct);
  app.patch("/api/products/:id", authMiddleware, requireRole("admin"), updateProduct);
  app.delete("/api/products/:id", authMiddleware, requireRole("admin"), deleteProduct);

  // Batches routes
  app.get("/api/batches", authMiddleware, listBatches);
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
  app.patch("/api/bookings/:id/status", authMiddleware, updateBookingStatus);

  // Invoices routes
  app.get("/api/invoices", authMiddleware, listInvoices);
  app.post("/api/invoices", authMiddleware, requireRole("admin"), createInvoice);
  app.patch("/api/invoices/:id/status", authMiddleware, requireRole("admin"), updateInvoiceStatus);
  app.patch("/api/invoices/:id/payment-status", authMiddleware, requireRole("admin"), updateInvoicePaymentStatus);

  // Deliveries routes
  app.get("/api/deliveries", authMiddleware, listDeliveries);
  app.post("/api/deliveries", authMiddleware, createDelivery);
  app.patch("/api/deliveries/:id/status", authMiddleware, updateDeliveryStatus);
  app.patch("/api/deliveries/:deliveryId/items/:itemId/status", authMiddleware, updateDeliveryItemStatus);

  // Receipts routes
  app.get("/api/receipts", authMiddleware, listReceipts);
  app.post("/api/deliveries/:id/items/:itemId/confirm", authMiddleware, confirmDeliveryItem);

  // Audit logs routes
  app.get("/api/audit-logs", authMiddleware, requireRole("admin"), listAuditLogs);

  // Accounts Receivable routes
  app.get("/api/accounts-receivable", authMiddleware, listAccountsReceivable);
  app.get("/api/accounts-receivable/customer/:customerId", authMiddleware, getCustomerBalance);
  app.patch("/api/accounts-receivable/:id/status", authMiddleware, requireRole("admin"), updateARStatus);

  // Inventory Batch routes
  app.get("/api/inventory-batches", authMiddleware, listInventoryBatches);
  app.get("/api/inventory-batches/:id", authMiddleware, getInventoryBatch);
  app.post("/api/inventory-batches", authMiddleware, requireRole("admin"), createInventoryBatch);
  app.patch("/api/inventory-batches/:id", authMiddleware, requireRole("admin"), updateInventoryBatch);
  app.delete("/api/inventory-batches/:id", authMiddleware, requireRole("admin"), deleteInventoryBatch);
  app.post("/api/inventory-batches/:id/items", authMiddleware, requireRole("admin"), addInventoryBatchItem);
  app.delete("/api/inventory-batches/:id/items/:itemId", authMiddleware, requireRole("admin"), removeInventoryBatchItem);

  // Pallet routes
  app.get("/api/pallets", authMiddleware, listPallets);
  app.get("/api/pallets/:id", authMiddleware, getPallet);
  app.post("/api/pallets", authMiddleware, createPallet);
  app.patch("/api/pallets/:id/status", authMiddleware, updatePalletStatus);
  app.patch("/api/pallets/:id/approve", authMiddleware, approvePallet);
  app.delete("/api/pallets/:id", authMiddleware, requireRole("admin"), deletePallet);
  app.get("/api/products/inventory", authMiddleware, getProductInventory);
  app.get("/api/orders/:orderId/suggested-batches", authMiddleware, suggestBatches);

  return app;
}
