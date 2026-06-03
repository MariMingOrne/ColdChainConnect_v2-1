import { useState, useRef, useEffect } from "react";
import QrScanner from "qr-scanner";
// QR Code scanning will use browser's camera API and manual entry

// Truck in transit interface
interface TruckDelivery {
  id: string;
  truckPlate: string;
  driver: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string;
  estimatedArrival: string;
  status: "in_storage" | "in_transit" | "completed";
  items: DeliveryItem[];
  lastUpdate: string;
}

interface DeliveryItem {
  id: string;
  sku: string;
  description: string;
  qrCode: string;
  quantity: number;
  status: "in_storage" | "in_transit" | "delivered" | "missing";
}

// Sales data interface
interface SalesTransaction {
  id: string;
  salesId: string;
  customerId: string;
  customerName: string;
  date: string;
  items: SalesLineItem[];
  quantity: number;
  unitPrice: number;
  total: number;
  status: "paid" | "unpaid";
  paymentMethod?: string;
  notes?: string;
}

interface SalesLineItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export function TrucksInTransit() {
  // Sample sales data - in real app, this would come from a database or API
  const [availableSales] = useState<SalesTransaction[]>([
    {
      id: "1",
      salesId: "SLS-001",
      customerId: "CUST-003",
      customerName: "KM5 Convenience Store",
      date: "2025-12-01",
      items: [
        {
          sku: "7700165",
          description: "FF Bossing Hatdogs KingSize",
          quantity: 24,
          unitPrice: 156.19,
          amount: 3748.56,
        },
      ],
      quantity: 24,
      unitPrice: 156.19,
      total: 3748.56,
      status: "paid",
      paymentMethod: "Cash",
    },
    {
      id: "2",
      salesId: "SLS-002",
      customerId: "CUST-0010",
      customerName: "Ate Rosa Sari-Sari",
      date: "2025-12-01",
      items: [
        {
          sku: "7700169",
          description: "FF Bossing Cheesedog KingSize",
          quantity: 8,
          unitPrice: 156.19,
          amount: 1249.52,
        },
      ],
      quantity: 8,
      unitPrice: 156.19,
      total: 1249.52,
      status: "unpaid",
    },
    {
      id: "3",
      salesId: "SLS-003",
      customerId: "CUST-005",
      customerName: "Aling Nena Store",
      date: "2025-12-01",
      items: [
        {
          sku: "7702041",
          description: "FF Bossing Chicken Hd Regular",
          quantity: 15,
          unitPrice: 35.34,
          amount: 530.10,
        },
      ],
      quantity: 15,
      unitPrice: 35.34,
      total: 530.10,
      status: "paid",
      paymentMethod: "30 Days Credit",
    },
    {
      id: "4",
      salesId: "SLS-004",
      customerId: "CUST-004",
      customerName: "Mang Ben Palengke",
      date: "2025-12-01",
      items: [
        {
          sku: "7700160",
          description: "FF Bossing Chicken Franks King",
          quantity: 10,
          unitPrice: 156.19,
          amount: 1561.90,
        },
      ],
      quantity: 10,
      unitPrice: 156.19,
      total: 1561.90,
      status: "paid",
      paymentMethod: "Cash",
    },
  ]);

  const [trucks, setTrucks] = useState<TruckDelivery[]>([
    {
      id: "TRK-001",
      truckPlate: "ABC 1234",
      driver: "Juan dela Cruz",
      driverId: "SLS-0001",
      origin: "ACDP Warehouse, Pampanga",
      destination: "Various Retail Stores",
      departureTime: "08:00 AM",
      estimatedArrival: "02:30 PM",
      status: "in_transit",
      lastUpdate: "2026-04-30 11:45 AM",
      items: [
        {
          id: "1",
          sku: "7700165",
          description: "FF Bossing Hatdogs KingSize",
          qrCode: "QR-20260430-001",
          quantity: 20,
          status: "in_transit",
        },
        {
          id: "2",
          sku: "7700169",
          description: "FF Bossing Cheesedog KingSize",
          qrCode: "QR-20260430-002",
          quantity: 10,
          status: "in_transit",
        },
      ],
    },
    {
      id: "TRK-002",
      truckPlate: "XYZ 5678",
      driver: "Maria Santos",
      driverId: "SLS-0002",
      origin: "ACDP Warehouse, Pampanga",
      destination: "Makati Retail Partners",
      departureTime: "08:15 AM",
      estimatedArrival: "04:00 PM",
      status: "in_transit",
      lastUpdate: "2026-04-30 11:50 AM",
      items: [
        {
          id: "3",
          sku: "770218",
          description: "McCain Fries",
          qrCode: "QR-20260430-003",
          quantity: 6,
          status: "in_transit",
        },
      ],
    },
    {
      id: "TRK-003",
      truckPlate: "DEF 9012",
      driver: "Pedro Reyes",
      driverId: "INV-0001",
      origin: "ACDP Warehouse, Pampanga",
      destination: "Cavite Distribution Center",
      departureTime: "09:00 AM",
      estimatedArrival: "01:00 PM",
      status: "in_transit",
      lastUpdate: "2026-04-30 11:55 AM",
      items: [
        {
          id: "4",
          sku: "7702039",
          description: "FF Bossing Cheesedogs",
          qrCode: "QR-20260430-004",
          quantity: 15,
          status: "in_transit",
        },
      ],
    },
  ]);

  const [selectedTruck, setSelectedTruck] = useState<TruckDelivery | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showAddTruckModal, setShowAddTruckModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scannedQR, setScannedQR] = useState<string>("");
  const [cameraActive, setCameraActive] = useState(false);

  // Open camera for QR scanning
  const openCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => console.error("Play error:", err));
        };
      }
    } catch (err) {
      setCameraActive(false);
      const errorMsg = err instanceof DOMException ? err.message : String(err);
      alert("Unable to access camera: " + errorMsg);
      console.error("Camera error:", err);
    }
  };

  // Close camera
  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setCameraActive(false);
    }
  };

  // Handle QR scan (simplified - in production use a QR library)
  const handleQRScan = (qrValue: string) => {
    setScannedQR(qrValue);

    if (selectedTruck) {
      const updatedTrucks = trucks.map((truck) => {
        if (truck.id === selectedTruck.id) {
          const updatedItems = truck.items.map((item) => {
            if (item.qrCode === qrValue) {
              // Cycle through statuses
              const statusCycle = [
                "in_storage",
                "in_transit",
                "delivered",
              ] as const;
              const currentIndex = statusCycle.indexOf(item.status as any);
              const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

              return { ...item, status: nextStatus };
            }
            return item;
          });

          return { ...truck, items: updatedItems };
        }
        return truck;
      });

      setTrucks(updatedTrucks);
      setSelectedTruck(
        updatedTrucks.find((t) => t.id === selectedTruck.id) || null
      );
      closeCamera();
      setShowQRScanner(false);
    }
  };

  // Handle item status change from dropdown
  const handleItemStatusChange = (
    truckId: string,
    itemId: string,
    newStatus: "in_storage" | "in_transit" | "delivered" | "missing"
  ) => {
    const updatedTrucks = trucks.map((truck) => {
      if (truck.id === truckId) {
        const updatedItems = truck.items.map((item) => {
          if (item.id === itemId) {
            return { ...item, status: newStatus };
          }
          return item;
        });

        // Check if all items are either delivered or missing, if so mark truck as completed
        const allCompleted = updatedItems.every((item) =>
          ["delivered", "missing"].includes(item.status)
        );

        return {
          ...truck,
          items: updatedItems,
          status: allCompleted ? "completed" : truck.status,
        };
      }
      return truck;
    });

    setTrucks(updatedTrucks);
    setSelectedTruck(
      updatedTrucks.find((t) => t.id === selectedTruck?.id) || null
    );
  };

  // Handle add truck
  const handleAddTruck = (newTruck: TruckDelivery) => {
    setTrucks([...trucks, newTruck]);
    setShowAddTruckModal(false);
  };

  // Handle remove truck (only if completed)
  const handleRemoveTruck = (truckId: string) => {
    const truck = trucks.find((t) => t.id === truckId);
    if (truck?.status !== "completed") {
      alert("You can only remove completed trucks");
      return;
    }
    if (confirm("Are you sure you want to remove this truck?")) {
      setTrucks(trucks.filter((t) => t.id !== truckId));
      setSelectedTruck(null);
    }
  };

  // Calculate delivery progress
  const getDeliveryProgress = (truck: TruckDelivery) => {
    const total = truck.items.length;
    const delivered = truck.items.filter((item) => item.status === "delivered").length;
    const missing = truck.items.filter((item) => item.status === "missing").length;
    return { total, delivered, missing, inTransit: total - delivered - missing };
  };

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
            Trucks in Transit
          </h1>
          <p className="text-xs text-muted mt-1">
            Monitor active deliveries and track shipments in real-time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted">
            Active: {trucks.filter((t) => t.status === "in_transit").length} | Completed: {trucks.filter((t) => t.status === "completed").length}
          </div>
          <button
            onClick={() => setShowQRScanner(true)}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            📱 Scan QR Code
          </button>
          <button
            onClick={() => setShowAddTruckModal(true)}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            ＋ Dispatch Items
          </button>
        </div>
      </div>

      {/* Trucks Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trucks.map((truck) => {
          const progress = getDeliveryProgress(truck);
          return (
            <div
              key={truck.id}
              onClick={() => setSelectedTruck(truck)}
              className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg ${
                selectedTruck?.id === truck.id
                  ? "border-accent-2 shadow-lg"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-rajdhani text-lg font-bold text-navy">
                    {truck.truckPlate}
                  </h3>
                  <p className="text-xs text-muted mt-1">{truck.driver}</p>
                </div>
                <StatusBadge status={truck.status} />
              </div>

              {/* Delivery Progress */}
              <div className="mb-4 bg-off-white rounded-lg p-3">
                <p className="text-xs font-semibold text-navy mb-2">Delivery Status</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">✅ Delivered:</span>
                    <span className="font-semibold text-green">{progress.delivered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">⚠️ Missing:</span>
                    <span className="font-semibold text-red">{progress.missing}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">🚚 In Transit:</span>
                    <span className="font-semibold text-gold">{progress.inTransit}</span>
                  </div>
                  <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between">
                    <span className="font-semibold text-navy">Total Items:</span>
                    <span className="font-semibold text-navy">{progress.total}</span>
                  </div>
                </div>
              </div>

              {/* Route Info */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span>📍</span>
                  <div>
                    <p className="text-muted">From:</p>
                    <p className="text-navy font-semibold">{truck.origin}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span>🎯</span>
                  <div>
                    <p className="text-muted">Destination:</p>
                    <p className="text-navy font-semibold">{truck.destination}</p>
                  </div>
                </div>
              </div>

              {/* Items Count */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-navy">
                  {truck.items.length} Item{truck.items.length !== 1 ? "s" : ""} ·{" "}
                  {truck.items.reduce((sum, item) => sum + item.quantity, 0)} Units
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Truck Details */}
      {selectedTruck && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-rajdhani text-2xl font-bold text-navy">
                {selectedTruck.truckPlate}
              </h2>
              <p className="text-sm text-muted mt-1">
                Agent: {selectedTruck.driver} ({selectedTruck.driverId})
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={selectedTruck.status} size="lg" />
              <p className="text-xs text-muted mt-2">
                Last updated: {selectedTruck.lastUpdate}
              </p>
            </div>
          </div>

          {/* Route Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailBox
              label="Departure"
              value={selectedTruck.departureTime}
              icon="🚀"
            />
            <DetailBox
              label="Est. Arrival"
              value={selectedTruck.estimatedArrival}
              icon="🎯"
            />
            <DetailBox label="Destination" value={selectedTruck.destination} icon="📍" />
            <DetailBox
              label="Items to Deliver"
              value={`${getDeliveryProgress(selectedTruck).total} total`}
              icon="📦"
            />
          </div>

          {/* Delivery Items Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-rajdhani text-lg font-bold text-navy">
                Items in Transit
              </h3>
              <div className="flex gap-2">
                {selectedTruck.status === "completed" && (
                  <button
                    onClick={() => handleRemoveTruck(selectedTruck.id)}
                    className="px-4 py-2 bg-red text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                  >
                    🗑 Remove Truck
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto scrollbar-visible text-xs md:text-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      SKU
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap hidden sm:table-cell">
                      Description
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      QR Code
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      Qty
                    </th>
                    <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTruck.items.map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-off-white/50">
                      <td className="px-3 py-3 text-navy font-semibold">
                        {item.sku}
                      </td>
                      <td className="px-3 py-3 text-navy hidden sm:table-cell">
                        {item.description}
                      </td>
                      <td className="px-3 py-3 text-navy font-mono text-xs">
                        {item.qrCode}
                      </td>
                      <td className="px-3 py-3 text-navy font-semibold">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3">
                        <ItemStatusDropdown
                          status={item.status}
                          onChange={(newStatus) =>
                            handleItemStatusChange(selectedTruck.id, item.id, newStatus)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          onClose={() => {
            setShowQRScanner(false);
            closeCamera();
          }}
          onScan={handleQRScan}
          videoRef={videoRef}
          cameraActive={cameraActive}
          openCamera={openCamera}
          closeCamera={closeCamera}
          scannedQR={scannedQR}
          availableQRs={selectedTruck?.items.map((item) => item.qrCode) || []}
        />
      )}

      {/* Add Truck Modal */}
      {showAddTruckModal && (
        <AddTruckModal
          onClose={() => setShowAddTruckModal(false)}
          onAdd={handleAddTruck}
          availableSales={availableSales}
        />
      )}
    </div>
  );
}

// Helper Components
// Status Badge Component
function StatusBadge({
  status,
  size = "sm",
}: {
  status: "in_storage" | "in_transit" | "completed";
  size?: "sm" | "lg";
}) {
  const statusMap = {
    in_storage: { label: "In Storage", color: "blue", icon: "📦" },
    in_transit: { label: "In Transit", color: "gold", icon: "🚚" },
    completed: { label: "Completed", color: "green", icon: "✅" },
  };

  const config = statusMap[status];
  const sizeClass = size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-0.5 text-xs";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg font-semibold badge-${config.color} ${sizeClass}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </div>
  );
}

// Item Status Dropdown
function ItemStatusDropdown({
  status,
  onChange,
}: {
  status: "in_storage" | "in_transit" | "delivered" | "missing";
  onChange: (status: "in_storage" | "in_transit" | "delivered" | "missing") => void;
}) {
  const statusOptions = [
    { value: "in_storage", label: "In Storage", icon: "📦" },
    { value: "in_transit", label: "In Transit", icon: "🚚" },
    { value: "delivered", label: "Delivered", icon: "✅" },
    { value: "missing", label: "Missing", icon: "⚠️" },
  ];

  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as "in_storage" | "in_transit" | "delivered" | "missing")}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-white text-navy hover:border-accent-2 focus:outline-none focus:border-accent-2 cursor-pointer"
    >
      {statusOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.icon} {option.label}
        </option>
      ))}
    </select>
  );
}

// Detail Box Component
function DetailBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-off-white rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <p className="text-xs text-muted font-semibold uppercase">{label}</p>
      </div>
      <p className="font-rajdhani text-lg font-bold text-navy">{value}</p>
    </div>
  );
}

// QR Scanner Modal
function QRScannerModal({
  onClose,
  onScan,
  videoRef,
  cameraActive,
  openCamera,
  closeCamera,
  scannedQR,
  availableQRs,
}: {
  onClose: () => void;
  onScan: (qr: string) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraActive: boolean;
  openCamera: () => void;
  closeCamera: () => void;
  scannedQR: string;
  availableQRs: string[];
}) {
  const [manualQR, setManualQR] = useState("");
  const [detectedQR, setDetectedQR] = useState<string | null>(null);

  // Scan video frames for QR codes with qr-scanner (more robust)
  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;

    let scanner: QrScanner | null = null;

    const initScanner = async () => {
      try {
        scanner = new QrScanner(
          videoRef.current!,
          (result) => {
            if (result && availableQRs.includes(result.data)) {
              setDetectedQR(result.data);
            }
          },
          {
            onDecodeError: () => {}, // Suppress error logs
            preferredCamera: "environment",
            highlightCodeOutline: false,
            maxScansPerSecond: 1,
          }
        );

        await scanner.start();
      } catch (err) {
        console.error("Scanner init error:", err);
      }
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.stop();
      }
    };
  }, [cameraActive, availableQRs]);

  const handleDetectedQRScan = () => {
    if (detectedQR && availableQRs.includes(detectedQR)) {
      onScan(detectedQR);
      setDetectedQR(null);
      setManualQR("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-rajdhani text-lg font-bold text-navy">
            Scan QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-navy hover:opacity-70 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Camera Section */}
        <div className="space-y-2">
          <p className="text-sm text-muted">Point your camera at the QR code</p>
          {!cameraActive ? (
            <button
              onClick={openCamera}
              className="w-full px-4 py-3 bg-accent-2 text-white rounded-lg font-semibold hover:opacity-90 flex items-center justify-center gap-2"
            >
              📱 Open Camera
            </button>
          ) : (
            <>
              <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ height: "300px" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {detectedQR && (
                  <div className="absolute inset-0 border-4 border-green flex items-center justify-center">
                    <div className="text-white text-center">
                      <div className="text-lg font-bold">✓ QR Detected</div>
                      <div className="text-sm">{detectedQR}</div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={closeCamera}
                className="w-full px-4 py-2 bg-red text-white rounded-lg font-semibold hover:opacity-90"
              >
                Close Camera
              </button>
            </>
          )}
        </div>

        {/* Detected QR Action */}
        {detectedQR && (
          <div className="bg-green/10 border border-green/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted">QR Code Detected:</p>
            <p className="font-semibold text-green text-sm font-mono">{detectedQR}</p>
            <button
              onClick={handleDetectedQRScan}
              className="w-full px-4 py-2 bg-green text-white rounded-lg font-semibold hover:opacity-90 text-sm"
            >
              ✓ Confirm & Submit
            </button>
          </div>
        )}

        {/* Manual Entry */}
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-sm text-muted">Or enter QR code manually</p>
          <input
            type="text"
            value={manualQR}
            onChange={(e) => setManualQR(e.target.value)}
            placeholder="e.g., QR-20260430-001"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          />
          <button
            onClick={() => {
              if (availableQRs.includes(manualQR)) {
                onScan(manualQR);
                setManualQR("");
              } else {
                alert("QR code not found in this truck's items");
              }
            }}
            className="w-full px-4 py-2 bg-green text-white rounded-lg font-semibold hover:opacity-90"
          >
            Confirm Scan
          </button>
        </div>

        {/* Last Scan */}
        {scannedQR && (
          <div className="bg-green/10 border border-green/30 rounded-lg p-3">
            <p className="text-xs text-muted">Last scanned:</p>
            <p className="font-semibold text-green text-sm">{scannedQR}</p>
            <p className="text-xs text-muted mt-1">✅ Status updated successfully</p>
          </div>
        )}

        {/* Available QRs List */}
        <div className="space-y-2 pt-4 border-t border-border max-h-32 overflow-y-auto">
          <p className="text-xs text-muted font-semibold">Available QR Codes:</p>
          <div className="space-y-1">
            {availableQRs.map((qr) => (
              <button
                key={qr}
                onClick={() => {
                  onScan(qr);
                  setManualQR("");
                }}
                className="w-full text-left px-3 py-2 rounded bg-off-white hover:bg-navy/10 text-xs font-mono text-navy transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-off-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Add Truck Modal
function AddTruckModal({
  onClose,
  onAdd,
  availableSales,
}: {
  onClose: () => void;
  onAdd: (truck: TruckDelivery) => void;
  availableSales: SalesTransaction[];
}) {
  const [formData, setFormData] = useState({
    truckPlate: "",
    driver: "",
    driverId: "",
    origin: "ACDP Warehouse, Pampanga",
    destination: "",
    departureTime: "",
    estimatedArrival: "",
  });

  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [showSalesError, setShowSalesError] = useState(false);

  // Get items from selected sales
  const getItemsFromSales = () => {
    const items: DeliveryItem[] = [];
    let itemId = 1;

    selectedSales.forEach((saleId) => {
      const sale = availableSales.find((s) => s.id === saleId);
      if (sale) {
        sale.items.forEach((item) => {
          items.push({
            id: String(itemId),
            sku: item.sku,
            description: item.description,
            qrCode: `QR-${item.sku}-${Date.now()}-${itemId}`,
            quantity: item.quantity,
            status: "in_storage",
          });
          itemId++;
        });
      }
    });

    return items;
  };

  const handleAdd = () => {
    if (
      !formData.truckPlate ||
      !formData.driver ||
      !formData.origin ||
      !formData.destination ||
      selectedSales.length === 0
    ) {
      setShowSalesError(selectedSales.length === 0);
      alert("Please fill in all required fields and select at least one sales order");
      return;
    }

    const items = getItemsFromSales();

    const newTruck: TruckDelivery = {
      id: `TRK-${Date.now()}`,
      truckPlate: formData.truckPlate,
      driver: formData.driver,
      driverId: formData.driverId,
      origin: formData.origin,
      destination: formData.destination,
      departureTime: formData.departureTime,
      estimatedArrival: formData.estimatedArrival,
      status: "in_storage",
      items,
      lastUpdate: new Date().toLocaleString(),
    };

    onAdd(newTruck);
  };

  const toggleSaleSelection = (saleId: string) => {
    setSelectedSales((prev) =>
      prev.includes(saleId) ? prev.filter((id) => id !== saleId) : [...prev, saleId]
    );
    setShowSalesError(false);
  };

  const selectedSalesData = availableSales.filter((s) => selectedSales.includes(s.id));
  const totalItems = selectedSalesData.reduce(
    (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border">
          <h2 className="font-rajdhani text-lg font-bold text-white">Add New Truck</h2>
          <button
            onClick={onClose}
            className="text-white hover:opacity-70 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Truck Details */}
          <div>
            <h3 className="font-rajdhani text-lg font-bold text-navy mb-4">
              Truck Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Truck Plate *
                </label>
                <input
                  type="text"
                  value={formData.truckPlate}
                  onChange={(e) =>
                    setFormData({ ...formData, truckPlate: e.target.value })
                  }
                  placeholder="ABC 1234"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.driver}
                  onChange={(e) =>
                    setFormData({ ...formData, driver: e.target.value })
                  }
                  placeholder="Juan dela Cruz"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Agent ID
                </label>
                <input
                  type="text"
                  value={formData.driverId}
                  onChange={(e) =>
                    setFormData({ ...formData, driverId: e.target.value })
                  }
                  placeholder="SLS-0001"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Origin *
                </label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) =>
                    setFormData({ ...formData, origin: e.target.value })
                  }
                  placeholder="ACDP Warehouse, Pampanga"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Destination *
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) =>
                    setFormData({ ...formData, destination: e.target.value })
                  }
                  placeholder="Various Retail Stores"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Departure Time
                </label>
                <input
                  type="time"
                  value={formData.departureTime}
                  onChange={(e) =>
                    setFormData({ ...formData, departureTime: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Est. Arrival Time
                </label>
                <input
                  type="time"
                  value={formData.estimatedArrival}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedArrival: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                />
              </div>
            </div>
          </div>

          {/* Sales Selection Section */}
          <div>
            <h3 className={`font-rajdhani text-lg font-bold ${showSalesError ? "text-red" : "text-navy"} mb-4`}>
              Select Sales Orders to Deliver *
            </h3>
            <p className="text-xs text-muted mb-3">
              Select one or more sales orders. Items from selected sales will be automatically added to the truck.
            </p>

            <div className={`border-2 rounded-lg p-4 space-y-2 ${showSalesError ? "border-red bg-red/5" : "border-border"}`}>
              {availableSales.length === 0 ? (
                <p className="text-sm text-muted italic">No sales orders available</p>
              ) : (
                availableSales.map((sale) => (
                  <label
                    key={sale.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-off-white cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSales.includes(sale.id)}
                      onChange={() => toggleSaleSelection(sale.id)}
                      className="mt-1 w-4 h-4 rounded border-border cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-navy text-sm">
                            {sale.salesId} - {sale.customerName}
                          </p>
                          <p className="text-xs text-muted">{sale.customerId}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-navy text-sm">
                            {sale.items.reduce((sum, item) => sum + item.quantity, 0)} units
                          </p>
                          <p className="text-xs text-muted">₱{sale.total.toLocaleString("en-PH")}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted">
                        {sale.items.map((item) => `${item.quantity}x ${item.description}`).join(" | ")}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            {selectedSalesData.length > 0 && (
              <div className="mt-4 bg-off-white rounded-lg p-4">
                <h4 className="font-semibold text-navy text-sm mb-2">Selected Sales Summary:</h4>
                <div className="space-y-1 text-xs">
                  {selectedSalesData.map((sale) => (
                    <div key={sale.id} className="flex justify-between">
                      <span className="text-muted">{sale.salesId} ({sale.customerName}):</span>
                      <span className="font-semibold text-navy">
                        {sale.items.reduce((sum, item) => sum + item.quantity, 0)} units
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold">
                    <span className="text-navy">Total Items:</span>
                    <span className="text-navy">{totalItems} units</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
            disabled={!formData.truckPlate || !formData.driver || selectedSales.length === 0}
          >
            Create Truck
          </button>
        </div>
      </div>
    </div>
  );
}
