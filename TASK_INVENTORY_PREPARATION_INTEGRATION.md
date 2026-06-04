# Inventory & Order Management Integration Task

## Overview
Restructure the inventory and order management system to create a clear separation between inventory tracking (Information Management) and order preparation (Booking & Dispatch). Implement batch-based inventory restocking and order-driven pallet preparation with automatic inventory deduction.

---

## Current State
- **Inventory Module** (`client/pages/Inventory.tsx`): Manages batches and pallets with manual item tracking
- **Order Summary** (`client/pages/modules/BookingSummary.tsx`): Displays orders but lacks pallet preparation workflow
- Data linking between batches, orders, and inventory is implicit and non-atomic
- No automatic inventory deduction upon order fulfillment

---

## Desired State

### 1. Restructured Inventory Management (`/information-management/inventory`)

#### 1.1 Inventory Products Tab (Default View)
- Display all products with current stock quantities
- Show aggregate inventory across all batches
- Support search/filter by product name or SKU
- Columns: Product Name, SKU, Unit Cost, Current Stock, Actions
- **Action**: View product details (cost, reorder point, batch breakdown)

#### 1.2 Batches Tab (New)
- View all batches created for restocking
- Display batch metadata: Batch ID, Creation Date, Status (open/closed), Total Items, Total Qty
- Click a batch to expand and view:
  - All items in the batch (product ID, name, quantity, unit cost, subtotal)
  - Batch status and timeline
  - Option to close batch (mark as complete/restocked)
- **Action**: Create New Batch → opens modal to:
  - Name/label the batch (e.g., "Morning Delivery", "Weekly Restock")
  - Add items to batch (select product + quantity)
  - Set as current active batch or archive
  - Confirm and save

#### 1.3 Batch-to-Inventory Flow
- When a batch is created, items are marked as "in preparation"
- When batch status changes to "closed/complete":
  - Items transition to "restocked"
  - Quantities automatically update the "All Products" inventory count
  - Batches become read-only (no further edits)

#### 1.4 Data Model Addition
```
Batch {
  id: string
  name: string
  created_at: string
  closed_at?: string
  status: "open" | "closed"
  items: BatchItem[]
}

BatchItem {
  id: string
  batch_id: string
  product_id: string
  qty_units: number
  unit_cost: string (from product at time of batch creation)
}
```

---

### 2. New Preparation Module (`/booking-dispatch/preparation`)

#### 2.1 Preparation Overview
- Display orders pending preparation (status: "approved")
- Show summary: Total Orders Ready, Items Pending Pallet, Pallets Created Today
- Quick filters: All, Today, This Week, This Month, Custom Date Range (matching Order Summary UI)

#### 2.2 Preparation Workflow
- **Step 1: Select Order**
  - Pick an approved order from the list
  - Display order details: Order ID, Customer, Location, Assigned Truck, Created Date
  - Show all items in the order with quantities needed

- **Step 2: Create/Assign Pallet**
  - System auto-suggests batch(es) containing the required items
  - Show batch compatibility: "Batch A has 50 qty Product X (need 40) ✓ Compatible"
  - User can:
    - Assign items to a new pallet (auto-link to suggested batch)
    - Assign items to an existing pallet (if partial fulfillment)
    - Create custom batch assignment (if batch doesn't exist)

- **Step 3: Pallet Preparation Confirmation**
  - Confirm pallet contents before approval:
    - Pallet ID (auto-generated or user-assigned)
    - Items on pallet (product, qty, unit cost, subtotal)
    - Total pallet value
    - Linked batch(es)
  - Option to print pallet label/receipt

- **Step 4: Approval & Inventory Deduction**
  - On "Approve Pallet" click:
    1. System deducts quantities from batch (batch_item.qty_units -= pallet.qty_per_product)
    2. If batch becomes empty, mark batch as partially-used or archive
    3. Update product inventory count in main inventory
    4. Mark pallet as "approved" and ready for dispatch
    5. Log audit entry (who approved, when, what was deducted)

#### 2.3 Pallet Data Model
```
Pallet {
  id: string
  order_id: string
  truck_id?: string
  status: "draft" | "approved" | "shipped"
  created_at: string
  items: PalletItem[]
  batch_links: { batch_id, items_from_batch }[]
}

PalletItem {
  id: string
  pallet_id: string
  product_id: string
  qty_units: number
  unit_cost: string (snapshot at time of pallet creation)
  batch_item_id: string (link back to batch for inventory deduction)
}
```

#### 2.4 Inventory Deduction Logic
```
On Pallet Approval:
  for each PalletItem in pallet:
    batch_item = BatchItem.find(id: pallet_item.batch_item_id)
    batch_item.qty_units -= pallet_item.qty_units
    
    if batch_item.qty_units <= 0:
      mark batch_item as "consumed"
      
    product = Product.find(id: pallet_item.product_id)
    product.current_stock -= pallet_item.qty_units
    
  pallet.status = "approved"
  create AuditLog entry
```

---

## User Flows

### Flow A: Restock Inventory with New Batch
1. Navigate to `/information-management/inventory`
2. Click "Batches" tab
3. Click "Create New Batch"
4. Fill in batch name (e.g., "Morning Delivery")
5. Add items: Select Product → Enter Qty → Add
6. Review batch summary
7. Click "Save & Activate" (or "Save as Draft")
8. Batch transitions to status "open"
9. Items visible in batch view but not yet in main product inventory
10. Click "Close Batch" when restocking is complete → items auto-add to inventory

### Flow B: Prepare Order for Dispatch
1. Navigate to `/booking-dispatch/preparation`
2. View list of approved orders
3. Click an order → see all items needed
4. System suggests: "Batch A contains all items for this order"
5. Review batch contents and click "Create Pallet from Batch"
6. System auto-populates pallet with batch items
7. Review pallet details and click "Approve Pallet"
8. Inventory deduction occurs automatically
9. Pallet marked as "approved" → ready for truck assignment/dispatch

### Flow C: Partial Fulfillment (Order Spans Multiple Batches)
1. Order needs 100 qty Product A + 50 qty Product B
2. Batch A has 60 qty Product A (not enough)
3. Batch B has 40 qty Product A + 60 qty Product B
4. User selects items from both batches to fulfill order
5. System creates one pallet linked to both batches
6. On approval: deducts from Batch A (40 qty) + Batch B (60 qty + 50 qty)

---

## Data Relationships

```
Batch (1) ──→ (N) BatchItem (product instance in batch)
          ├──→ (N) PalletItem (when items allocated to pallet)
          └──→ Status: open/closed

Order (1) ──→ (N) OrderItem (products customer ordered)
       └──→ (1) Pallet (prepared for dispatch)

Pallet (1) ──→ (N) PalletItem (actual items on pallet)
       ├──→ (1) Order (the order being fulfilled)
       ├──→ (N) BatchLink (which batches contributed items)
       └──→ Status: draft/approved/shipped

Product ─┬─→ (N) BatchItem (instances in batches)
         ├─→ (N) OrderItem (ordered by customers)
         └─→ current_stock (aggregate from all closed batches)
```

---

## API Endpoints Required

### Batch Management
- `POST /api/batches` - Create new batch
- `GET /api/batches` - List all batches
- `GET /api/batches/:id` - Get batch details with items
- `PATCH /api/batches/:id` - Update batch (name, status)
- `DELETE /api/batches/:id` - Archive batch

### Batch Items
- `POST /api/batches/:id/items` - Add item to batch
- `DELETE /api/batches/:id/items/:itemId` - Remove item from batch

### Pallet Management
- `POST /api/pallets` - Create pallet (with items)
- `GET /api/pallets` - List pallets
- `GET /api/pallets/:id` - Get pallet details
- `PATCH /api/pallets/:id/approve` - Approve & deduct inventory
- `GET /api/orders/:id/suggested-batches` - Get compatible batches for order

### Inventory
- `GET /api/products/inventory` - Get current stock per product
- `GET /api/inventory/audit` - View inventory deduction history

---

## UI/UX Considerations

1. **Visual Clarity**: Use color-coding for batch status (open=blue, closed=green, partially-used=yellow)
2. **Batch-to-Pallet Flow**: Show visual diagram or checklist indicating which batch items → pallet
3. **Confirmation Dialog**: Before approving pallet, confirm inventory deduction with clear breakdown
4. **Audit Trail**: Log all inventory movements for compliance and troubleshooting
5. **Search & Filter**: Support batch name/ID search and date range filtering
6. **Mobile-Friendly**: Ensure batch creation and pallet approval work on mobile/tablet

---

## Implementation Phases

### Phase 1: Batch Management
- Create Batch and BatchItem database tables/models
- Build Batches tab in Inventory module
- Add "Create New Batch" and "Close Batch" functionality

### Phase 2: Pallet Preparation UI
- Create Preparation module stub in Booking & Dispatch
- Build order list with item details
- Build batch suggestion logic

### Phase 3: Inventory Deduction
- Implement pallet approval endpoint with inventory deduction
- Add audit logging
- Test multi-batch fulfillment scenarios

### Phase 4: Polish & Integration
- Add visual batch-to-pallet mapping
- Implement search/filter for all views
- Add confirmation dialogs and warnings
- Performance optimization and testing

---

## Testing Checklist

- [ ] Create batch with multiple items and verify inventory doesn't change
- [ ] Close batch and verify product inventory counts update correctly
- [ ] Create order and receive correct batch suggestions
- [ ] Approve pallet from single batch and verify deduction
- [ ] Approve pallet from multiple batches and verify deductions across all
- [ ] Attempt to overfulfill (more items on pallet than in batch) → error
- [ ] Verify audit log records all inventory movements
- [ ] Batch becomes read-only after closure
- [ ] Deleted/archived batches don't appear in suggestions but remain in history

---

## Success Criteria

✓ Users can manage inventory restocking via batches without affecting current stock
✓ Users can prepare pallets for orders with automatic batch suggestions
✓ Inventory automatically deducts upon pallet approval
✓ System prevents overfulfillment from batches
✓ Clear audit trail of all inventory movements
✓ No confusion between Information Management (inventory) and Booking & Dispatch (preparation)
✓ System handles partial fulfillment across multiple batches seamlessly
