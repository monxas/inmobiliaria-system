import { useState } from 'react';
import { Upload, X, Star } from 'lucide-react';
import { Button } from './ui/Button';

interface PropertyFormProps {
  onClose: () => void;
}

export function PropertyForm({ onClose }: PropertyFormProps) {
  const [images, setImages] = useState<string[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map((file) => URL.createObjectURL(file));
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > index) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    }
  };

  return (
    <form className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Property Title
            </label>
            <input
              type="text"
              placeholder="e.g., Luxury Modern Villa"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe the property..."
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Address
            </label>
            <input
              type="text"
              placeholder="Street address"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              City
            </label>
            <input
              type="text"
              placeholder="City"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Property Type
            </label>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>House</option>
              <option>Apartment</option>
              <option>Villa</option>
              <option>Condo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Available</option>
              <option>Reserved</option>
              <option>Sold</option>
              <option>Rented</option>
            </select>
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Property Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Price ($)
            </label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bedrooms
            </label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bathrooms
            </label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Area (sqft)
            </label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Image Gallery Upload */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Image Gallery</h3>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            id="image-upload"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <label htmlFor="image-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-sm text-slate-600">
              <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
          </label>
        </div>

        {images.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-600 mb-2">
              Uploaded Images ({images.length}) - Click the star to set as primary
            </p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryImageIndex(index)}
                    className="absolute top-1 left-1 p-1 bg-white rounded-full shadow-sm"
                  >
                    <Star
                      className={`w-3 h-3 ${
                        primaryImageIndex === index ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary">
          Save Property
        </Button>
      </div>
    </form>
  );
}
