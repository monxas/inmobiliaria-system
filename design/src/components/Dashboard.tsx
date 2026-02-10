import { Building2, Users, FileText, TrendingUp, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function Dashboard() {
  const kpiData = [
    {
      title: 'Total Properties',
      value: '247',
      change: '+12.5%',
      trend: 'up',
      icon: Building2,
      color: 'blue',
    },
    {
      title: 'Active Clients',
      value: '1,429',
      change: '+8.2%',
      trend: 'up',
      icon: Users,
      color: 'green',
    },
    {
      title: 'Documents',
      value: '3,842',
      change: '+24.1%',
      trend: 'up',
      icon: FileText,
      color: 'purple',
    },
    {
      title: 'Monthly Revenue',
      value: '$124,580',
      change: '-3.1%',
      trend: 'down',
      icon: TrendingUp,
      color: 'orange',
    },
  ];

  const propertyStatusData = [
    { name: 'Available', value: 98, color: '#10b981' },
    { name: 'Reserved', value: 45, color: '#f59e0b' },
    { name: 'Sold', value: 68, color: '#3b82f6' },
    { name: 'Rented', value: 36, color: '#8b5cf6' },
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'property',
      title: 'New Property Added',
      description: 'Luxury Villa in Palm Beach',
      time: '5 minutes ago',
      user: 'John Smith',
    },
    {
      id: 2,
      type: 'client',
      title: 'New Client Registered',
      description: 'Sarah Johnson - Premium Buyer',
      time: '2 hours ago',
      user: 'Emily Davis',
    },
    {
      id: 3,
      type: 'document',
      title: 'Document Uploaded',
      description: 'Property Contract - 123 Oak Street',
      time: '4 hours ago',
      user: 'Michael Brown',
    },
    {
      id: 4,
      type: 'property',
      title: 'Property Status Updated',
      description: 'Downtown Condo - Reserved → Sold',
      time: '6 hours ago',
      user: 'Jessica Lee',
    },
    {
      id: 5,
      type: 'client',
      title: 'Viewing Scheduled',
      description: 'Beach House Tour - Client: Robert Chen',
      time: '1 day ago',
      user: 'David Miller',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary">
            <FileText className="w-4 h-4" />
            Upload Documents
          </Button>
          <Button variant="secondary">
            <Users className="w-4 h-4" />
            New Client
          </Button>
          <Button variant="primary">
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          const isPositive = kpi.trend === 'up';
          return (
            <Card key={kpi.title}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600">{kpi.title}</p>
                  <p className="text-3xl font-semibold text-slate-900 mt-2">{kpi.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {isPositive ? (
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {kpi.change}
                    </span>
                    <span className="text-sm text-slate-500">vs last month</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${colorMap[kpi.color]} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${colorMap[kpi.color].replace('bg-', 'text-')}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Property Status Chart */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Properties by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={propertyStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {propertyStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {propertyStatusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0">
                <div className="p-2 bg-blue-50 rounded-lg">
                  {activity.type === 'property' && <Building2 className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'client' && <Users className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'document' && <FileText className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{activity.time}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">by {activity.user}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
