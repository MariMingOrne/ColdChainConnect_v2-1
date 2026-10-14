import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Settings,
  BookOpen,
  BarChart3,
  Package,
  Users,
  Truck,
  FileText,
  DollarSign,
  Clock,
  ArrowRight,
} from "lucide-react";

export function Dashboard() {
  const hubCards = [
    {
      title: "Information Management",
      description: "Manage pricing, inventory, customers, and agents",
      icon: Settings,
      path: "/information-management/pricing",
      color: "border-blue-200 bg-blue-50",
    },
    {
      title: "Booking & Dispatch",
      description: "Create orders, invoice, and manage deliveries",
      icon: BarChart3,
      path: "/booking-dispatch/order-summary",
      color: "border-green-200 bg-green-50",
    },
    {
      title: "Audit Log",
      description: "View system actions and user activity logs",
      icon: Clock,
      path: "/audit",
      color: "border-purple-200 bg-purple-50",
    },
  ];

  return (
    <div className="flex-1 flex flex-col p-6 md:p-8 gap-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-bold text-navy">
          Cold Chain Connect
        </h1>
        <p className="text-gray-600">Order Management & Dispatch System</p>
      </div>

      {/* 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
        {hubCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.path} to={card.path}>
              <Card className={`p-8 border-2 ${card.color} hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full`}>
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-center gap-3">
                    <Icon className="w-8 h-8 text-navy" />
                    <h2 className="text-xl font-bold text-navy">
                      {card.title}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-700 flex-grow">
                    {card.description}
                  </p>
                  <div className="flex items-center text-blue-600 font-medium pt-4">
                    <span>Open Module</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
