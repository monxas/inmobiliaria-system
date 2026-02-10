import { useState } from 'react';
import { Upload, FileText, File, Image, Download, Eye, Trash2, Link as LinkIcon, Clock } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

type Document = {
  id: number;
  name: string;
  type: string;
  category: 'property' | 'contract' | 'client';
  size: string;
  uploadedBy: string;
  uploadedDate: string;
  relatedTo?: string;
};

export function Documents() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string>('');

  const documents: Document[] = [
    {
      id: 1,
      name: 'Property_Contract_123_Oak_Street.pdf',
      type: 'PDF',
      category: 'contract',
      size: '2.4 MB',
      uploadedBy: 'John Smith',
      uploadedDate: '2026-02-08',
      relatedTo: 'Luxury Modern Villa',
    },
    {
      id: 2,
      name: 'Floor_Plans_Downtown_Condo.pdf',
      type: 'PDF',
      category: 'property',
      size: '5.1 MB',
      uploadedBy: 'Emily Davis',
      uploadedDate: '2026-02-07',
      relatedTo: 'Downtown Luxury Apartment',
    },
    {
      id: 3,
      name: 'Client_ID_Sarah_Johnson.jpg',
      type: 'Image',
      category: 'client',
      size: '890 KB',
      uploadedBy: 'Michael Brown',
      uploadedDate: '2026-02-06',
      relatedTo: 'Sarah Johnson',
    },
    {
      id: 4,
      name: 'Inspection_Report_Beachfront_Villa.pdf',
      type: 'PDF',
      category: 'property',
      size: '3.7 MB',
      uploadedBy: 'Jessica Lee',
      uploadedDate: '2026-02-05',
      relatedTo: 'Beachfront Paradise',
    },
    {
      id: 5,
      name: 'Purchase_Agreement_Template.docx',
      type: 'Word',
      category: 'contract',
      size: '145 KB',
      uploadedBy: 'David Miller',
      uploadedDate: '2026-02-04',
    },
  ];

  const getFileIcon = (type: string) => {
    if (type === 'PDF') return <FileText className="w-10 h-10 text-red-600" />;
    if (type === 'Image') return <Image className="w-10 h-10 text-blue-600" />;
    return <File className="w-10 h-10 text-slate-600" />;
  };

  const getCategoryBadgeVariant = (category: Document['category']) => {
    const variants = {
      property: 'info' as const,
      contract: 'warning' as const,
      client: 'success' as const,
    };
    return variants[category];
  };

  const filteredDocuments = selectedCategory === 'all' 
    ? documents 
    : documents.filter(doc => doc.category === selectedCategory);

  const generateShareLink = (doc: Document) => {
    const randomId = Math.random().toString(36).substring(7);
    const link = `https://estatehub.app/share/${randomId}`;
    setGeneratedLink(link);
    setSelectedDoc(doc);
    setIsLinkModalOpen(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Document Center</h1>
          <p className="text-slate-600 mt-1">{filteredDocuments.length} documents</p>
        </div>
      </div>

      {/* Upload Area */}
      <Card>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer">
          <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Documents</h3>
          <p className="text-sm text-slate-600 mb-4">
            Drag and drop your files here, or click to browse
          </p>
          <Button variant="primary">
            Choose Files
          </Button>
          <p className="text-xs text-slate-500 mt-4">
            Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 25MB)
          </p>
        </div>
      </Card>

      {/* Category Filter */}
      <div className="flex gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'primary' : 'secondary'}
          onClick={() => setSelectedCategory('all')}
        >
          All Documents
        </Button>
        <Button
          variant={selectedCategory === 'property' ? 'primary' : 'secondary'}
          onClick={() => setSelectedCategory('property')}
        >
          Property Docs
        </Button>
        <Button
          variant={selectedCategory === 'contract' ? 'primary' : 'secondary'}
          onClick={() => setSelectedCategory('contract')}
        >
          Contracts
        </Button>
        <Button
          variant={selectedCategory === 'client' ? 'primary' : 'secondary'}
          onClick={() => setSelectedCategory('client')}
        >
          Client Docs
        </Button>
      </div>

      {/* Documents List */}
      <Card padding={false}>
        <div className="divide-y divide-slate-200">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-100 rounded-lg">
                  {getFileIcon(doc.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{doc.name}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
                        <Badge variant={getCategoryBadgeVariant(doc.category)}>
                          {doc.category.charAt(0).toUpperCase() + doc.category.slice(1)}
                        </Badge>
                        <span>{doc.size}</span>
                        {doc.relatedTo && (
                          <>
                            <span>•</span>
                            <span className="truncate">Related: {doc.relatedTo}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <span>Uploaded by {doc.uploadedBy}</span>
                        <span>•</span>
                        <span>{new Date(doc.uploadedDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => generateShareLink(doc)}>
                        <LinkIcon className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Share Link Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Generate Secure Share Link"
        size="md"
      >
        {selectedDoc && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getFileIcon(selectedDoc.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{selectedDoc.name}</p>
                  <p className="text-sm text-slate-600">{selectedDoc.size}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Link Expiration
              </label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>1 hour</option>
                <option>24 hours</option>
                <option>7 days</option>
                <option>30 days</option>
                <option>Never</option>
              </select>
            </div>

            {generatedLink && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Shareable Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                  />
                  <Button variant="primary" onClick={copyToClipboard}>
                    Copy
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span>Expires in 24 hours</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setIsLinkModalOpen(false)}>
                Close
              </Button>
              {!generatedLink && (
                <Button variant="primary" onClick={() => generateShareLink(selectedDoc)}>
                  Generate Link
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
