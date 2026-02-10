import { useState } from 'react';
import { Plus, Search, Shield, User, UserCheck, Edit, Trash2, Clock } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

type User = {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Agent' | 'Client';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  permissions: string[];
};

export function Users() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const users: User[] = [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@estatehub.com',
      role: 'Admin',
      status: 'Active',
      lastLogin: '2026-02-10 09:15',
      permissions: ['Full Access', 'User Management', 'System Settings'],
    },
    {
      id: 2,
      name: 'John Smith',
      email: 'john.smith@estatehub.com',
      role: 'Agent',
      status: 'Active',
      lastLogin: '2026-02-10 08:45',
      permissions: ['Properties', 'Clients', 'Documents'],
    },
    {
      id: 3,
      name: 'Emily Davis',
      email: 'emily.davis@estatehub.com',
      role: 'Agent',
      status: 'Active',
      lastLogin: '2026-02-09 16:30',
      permissions: ['Properties', 'Clients', 'Documents'],
    },
    {
      id: 4,
      name: 'Michael Brown',
      email: 'michael.brown@estatehub.com',
      role: 'Agent',
      status: 'Active',
      lastLogin: '2026-02-09 14:20',
      permissions: ['Properties', 'Clients'],
    },
    {
      id: 5,
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      role: 'Client',
      status: 'Active',
      lastLogin: '2026-02-08 10:00',
      permissions: ['View Properties', 'View Documents'],
    },
  ];

  const getRoleBadgeVariant = (role: User['role']) => {
    const variants = {
      Admin: 'danger' as const,
      Agent: 'info' as const,
      Client: 'default' as const,
    };
    return variants[role];
  };

  const getRoleIcon = (role: User['role']) => {
    if (role === 'Admin') return <Shield className="w-5 h-5 text-red-600" />;
    if (role === 'Agent') return <UserCheck className="w-5 h-5 text-blue-600" />;
    return <User className="w-5 h-5 text-slate-600" />;
  };

  const filteredUsers = users.filter((user) => {
    return (
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="text-slate-600 mt-1">{filteredUsers.length} users in system</p>
        </div>
        <Button variant="primary" onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-lg">
                  {getRoleIcon(user.role)}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{user.name}</h3>
                  <p className="text-sm text-slate-600">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Role</span>
                <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Status</span>
                <Badge variant={user.status === 'Active' ? 'success' : 'default'}>
                  {user.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4" />
                <span>Last login: {user.lastLogin}</span>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-2">Permissions</p>
                <div className="flex flex-wrap gap-1">
                  {user.permissions.slice(0, 2).map((permission, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded"
                    >
                      {permission}
                    </span>
                  ))}
                  {user.permissions.length > 2 && (
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      +{user.permissions.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setSelectedUser(user)}>
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <Button variant="ghost" size="sm">
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title="Edit User Permissions"
          size="md"
        >
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  {getRoleIcon(selectedUser.role)}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-sm text-slate-600">{selectedUser.email}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                User Role
              </label>
              <select
                defaultValue={selectedUser.role}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Admin</option>
                <option>Agent</option>
                <option>Client</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Permissions
              </label>
              <div className="space-y-2">
                {['Properties', 'Clients', 'Documents', 'User Management', 'System Settings', 'Reports'].map((permission) => (
                  <label key={permission} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={selectedUser.permissions.includes(permission)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-900">{permission}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button variant="primary">
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Add New User"
        size="md"
      >
        <form className="space-y-4">
          <div>
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
              placeholder="john@estatehub.com"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Role
            </label>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Agent</option>
              <option>Admin</option>
              <option>Client</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Initial Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
