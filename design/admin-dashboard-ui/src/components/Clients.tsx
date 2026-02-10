import { useState } from 'react';
import { Plus, Search, Mail, Phone, MapPin, Building2, Eye, Edit, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  type: 'Buyer' | 'Seller' | 'Renter';
  status: 'Active' | 'Inactive' | 'Lead';
  interests: string[];
  assignedAgent: string;
};

export function Clients() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const clients: Client[] = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '+1 (555) 123-4567',
      location: 'Miami, FL',
      type: 'Buyer',
      status: 'Active',
      interests: ['Luxury Modern Villa', 'Beachfront Paradise'],
      assignedAgent: 'John Smith',
    },
    {
      id: 2,
      name: 'Robert Chen',
      email: 'robert.chen@email.com',
      phone: '+1 (555) 234-5678',
      location: 'New York, NY',
      type: 'Buyer',
      status: 'Lead',
      interests: ['Downtown Luxury Apartment', 'Penthouse Suite'],
      assignedAgent: 'Emily Davis',
    },
    {
      id: 3,
      name: 'Maria Garcia',
      email: 'maria.g@email.com',
      phone: '+1 (555) 345-6789',
      location: 'Los Angeles, CA',
      type: 'Seller',
      status: 'Active',
      interests: [],
      assignedAgent: 'Michael Brown',
    },
    {
      id: 4,
      name: 'James Wilson',
      email: 'james.w@email.com',
      phone: '+1 (555) 456-7890',
      location: 'San Francisco, CA',
      type: 'Renter',
      status: 'Active',
      interests: ['Modern Urban Condo'],
      assignedAgent: 'Jessica Lee',
    },
    {
      id: 5,
      name: 'Emily Thompson',
      email: 'emily.t@email.com',
      phone: '+1 (555) 567-8901',
      location: 'Austin, TX',
      type: 'Buyer',
      status: 'Inactive',
      interests: ['Suburban Family Home'],
      assignedAgent: 'David Miller',
    },
  ];

  const getStatusBadgeVariant = (status: Client['status']) => {
    const variants = {
      Active: 'success' as const,
      Lead: 'warning' as const,
      Inactive: 'default' as const,
    };
    return variants[status];
  };

  const filteredClients = clients.filter((client) => {
    return (
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients Management</h1>
          <p className="text-slate-600 mt-1">{filteredClients.length} clients found</p>
        </div>
        <Button variant="primary" onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Clients Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Assigned Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Interests
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                        {client.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{client.name}</p>
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <MapPin className="w-3 h-3" />
                          {client.location}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4" />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4" />
                        {client.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-900">{client.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getStatusBadgeVariant(client.status)}>
                      {client.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-900">{client.assignedAgent}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        {client.interests.length} {client.interests.length === 1 ? 'property' : 'properties'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedClient(client)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Client Details Modal */}
      {selectedClient && (
        <Modal
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          title="Client Profile"
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-medium">
                {selectedClient.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900">{selectedClient.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getStatusBadgeVariant(selectedClient.status)}>
                    {selectedClient.status}
                  </Badge>
                  <span className="text-sm text-slate-600">• {selectedClient.type}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <p className="text-slate-900 mt-1">{selectedClient.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Phone</label>
                <p className="text-slate-900 mt-1">{selectedClient.phone}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location</label>
                <p className="text-slate-900 mt-1">{selectedClient.location}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Assigned Agent</label>
                <p className="text-slate-900 mt-1">{selectedClient.assignedAgent}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Property Interests</label>
              {selectedClient.interests.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {selectedClient.interests.map((interest, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-slate-900">{interest}</span>
                      <Badge variant="warning">Viewing</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 mt-2 text-sm">No property interests yet</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add Client Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Add New Client"
        size="lg"
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="john@email.com"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Location
              </label>
              <input
                type="text"
                placeholder="City, State"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Client Type
              </label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Buyer</option>
                <option>Seller</option>
                <option>Renter</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Save Client
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
