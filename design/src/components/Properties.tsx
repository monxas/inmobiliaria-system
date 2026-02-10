import { useState } from 'react';
import { Plus, Grid, List, Search, Filter, MapPin, Bed, Bath, Maximize, Edit, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { PropertyForm } from './PropertyForm';
import { ImageWithFallback } from './figma/ImageWithFallback';

type Property = {
  id: number;
  title: string;
  address: string;
  city: string;
  type: 'House' | 'Apartment' | 'Villa' | 'Condo';
  status: 'available' | 'reserved' | 'sold' | 'rented';
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  image: string;
  description: string;
};

export function Properties() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const properties: Property[] = [
    {
      id: 1,
      title: 'Luxury Modern Villa',
      address: '123 Palm Beach Boulevard',
      city: 'Miami',
      type: 'Villa',
      status: 'available',
      price: 2850000,
      bedrooms: 5,
      bathrooms: 4,
      area: 4500,
      image: 'https://images.unsplash.com/photo-1706808849827-7366c098b317?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb2Rlcm4lMjBob3VzZSUyMGV4dGVyaW9yfGVufDF8fHx8MTc3MDY1NTk3M3ww&ixlib=rb-4.1.0&q=80&w=1080',
      description: 'Stunning waterfront villa with panoramic ocean views',
    },
    {
      id: 2,
      title: 'Downtown Luxury Apartment',
      address: '456 Fifth Avenue, Unit 3402',
      city: 'New York',
      type: 'Apartment',
      status: 'reserved',
      price: 1250000,
      bedrooms: 3,
      bathrooms: 2,
      area: 2100,
      image: 'https://images.unsplash.com/photo-1614622350812-96b09c78af77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb250ZW1wb3JhcnklMjBhcGFydG1lbnQlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzA3NDUwMTN8MA&ixlib=rb-4.1.0&q=80&w=1080',
      description: 'Contemporary apartment in the heart of Manhattan',
    },
    {
      id: 3,
      title: 'Beachfront Paradise',
      address: '789 Ocean Drive',
      city: 'Malibu',
      type: 'Villa',
      status: 'available',
      price: 4500000,
      bedrooms: 6,
      bathrooms: 5,
      area: 5800,
      image: 'https://images.unsplash.com/photo-1709744873177-714d7ab0fe02?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFjaCUyMHZpbGxhJTIwb2NlYW4lMjB2aWV3fGVufDF8fHx8MTc3MDc1NjAyNnww&ixlib=rb-4.1.0&q=80&w=1080',
      description: 'Exclusive beachfront estate with private beach access',
    },
    {
      id: 4,
      title: 'Modern Urban Condo',
      address: '321 Market Street, #1505',
      city: 'San Francisco',
      type: 'Condo',
      status: 'sold',
      price: 950000,
      bedrooms: 2,
      bathrooms: 2,
      area: 1450,
      image: 'https://images.unsplash.com/photo-1601630164609-af849e05b776?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkb3dudG93biUyMGNvbmRvfGVufDF8fHx8MTc3MDc1NjAyNnww&ixlib=rb-4.1.0&q=80&w=1080',
      description: 'Sleek condo with stunning city views',
    },
    {
      id: 5,
      title: 'Suburban Family Home',
      address: '555 Maple Lane',
      city: 'Austin',
      type: 'House',
      status: 'rented',
      price: 650000,
      bedrooms: 4,
      bathrooms: 3,
      area: 3200,
      image: 'https://images.unsplash.com/photo-1765765234094-bc009a3bba62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdWJ1cmJhbiUyMGZhbWlseSUyMGhvbWV8ZW58MXx8fHwxNzcwNzM4NTIyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      description: 'Spacious family home in quiet neighborhood',
    },
    {
      id: 6,
      title: 'Penthouse Suite',
      address: '888 Park Avenue, PH',
      city: 'Chicago',
      type: 'Apartment',
      status: 'available',
      price: 3200000,
      bedrooms: 4,
      bathrooms: 4,
      area: 3800,
      image: 'https://images.unsplash.com/photo-1568115286680-d203e08a8be6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZW50aG91c2UlMjBjaXR5JTIwdmlld3xlbnwxfHx8fDE3NzA2NjU2MzF8MA&ixlib=rb-4.1.0&q=80&w=1080',
      description: 'Luxurious penthouse with 360° city views',
    },
  ];

  const getStatusBadgeVariant = (status: Property['status']) => {
    const variants = {
      available: 'success' as const,
      reserved: 'warning' as const,
      sold: 'info' as const,
      rented: 'default' as const,
    };
    return variants[status];
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch = property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         property.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || property.type === filterType;
    const matchesStatus = filterStatus === 'all' || property.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Properties Management</h1>
          <p className="text-slate-600 mt-1">{filteredProperties.length} properties found</p>
        </div>
        <Button variant="primary" onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Property
        </Button>
      </div>

      {/* Filters and View Toggle */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="House">House</option>
            <option value="Apartment">Apartment</option>
            <option value="Villa">Villa</option>
            <option value="Condo">Condo</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="rented">Rented</option>
          </select>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Properties Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <Card key={property.id} padding={false} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-48">
                <ImageWithFallback
                  src={property.image}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  <Badge variant={getStatusBadgeVariant(property.status)}>
                    {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 text-lg">{property.title}</h3>
                <div className="flex items-center gap-1 text-slate-600 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{property.address}, {property.city}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2">{property.description}</p>
                <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Bed className="w-4 h-4" />
                    <span>{property.bedrooms}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4" />
                    <span>{property.bathrooms}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Maximize className="w-4 h-4" />
                    <span>{property.area.toLocaleString()} sqft</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                  <p className="text-2xl font-semibold text-blue-600">
                    ${property.price.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <ImageWithFallback
                          src={property.image}
                          alt={property.title}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium text-slate-900">{property.title}</p>
                          <p className="text-sm text-slate-600">{property.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-900">{property.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusBadgeVariant(property.status)}>
                        {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span>{property.bedrooms} bed</span>
                        <span>•</span>
                        <span>{property.bathrooms} bath</span>
                        <span>•</span>
                        <span>{property.area.toLocaleString()} sqft</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-blue-600">
                        ${property.price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
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
      )}

      {/* Add Property Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Add New Property"
        size="xl"
      >
        <PropertyForm onClose={() => setIsFormOpen(false)} />
      </Modal>
    </div>
  );
}
