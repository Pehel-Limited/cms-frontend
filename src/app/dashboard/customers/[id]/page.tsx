'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { customerService, Customer } from '@/services/api/customerService';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';

// Constants
const COUNTRIES = [
  { value: 'IE', label: 'Ireland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'OTHER', label: 'Other' },
];

const IDENTITY_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National Identity Card' },
  { value: 'DRIVERS_LICENSE', label: 'Driving Licence' },
  { value: 'RESIDENCE_PERMIT', label: 'Residence Permit' },
];

const EMPLOYMENT_TYPES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const CUSTOMER_STATUSES = [
  { value: 'ACTIVE', label: 'Active', color: 'green' },
  { value: 'INACTIVE', label: 'Inactive', color: 'gray' },
  { value: 'SUSPENDED', label: 'Suspended', color: 'red' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification', color: 'yellow' },
];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'applications' | 'activity'>('details');

  useEffect(() => {
    fetchCustomerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const customerData = await customerService.getCustomerById(customerId);
      setCustomer(customerData);
      setEditedCustomer(customerData);
      const appsData = await applicationService.getApplicationsByCustomer(customerId);
      setApplications(appsData.content || []);
    } catch (err) {
      console.error('Failed to fetch customer data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (field: keyof Customer, value: string | number | null) => {
    setEditedCustomer(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!customer) return;
    setIsSaving(true);
    try {
      const updatedCustomer = await customerService.updateCustomer(customerId, editedCustomer);
      setCustomer(updatedCustomer);
      setIsEditing(false);
      toast.success('Customer updated successfully!');
    } catch (err) {
      console.error('Failed to update customer:', err);
      toast.error('Failed to update customer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedCustomer(customer || {});
    setIsEditing(false);
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    setIsSaving(true);
    try {
      const updatedCustomer = await customerService.updateCustomerStatus(customerId, newStatus);
      setCustomer(updatedCustomer);
      setShowStatusModal(false);
      toast.success(`Customer status updated to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      if (deleteType === 'soft') {
        await customerService.softDeleteCustomer(customerId);
        toast.success('Customer has been deactivated and marked as deleted.');
      } else {
        await customerService.hardDeleteCustomer(customerId);
        toast.success('Customer has been permanently deleted.');
      }
      router.push('/dashboard/customers');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      toast.error('Failed to delete customer. Please try again.');
    } finally {
      setIsSaving(false);
      setShowDeleteModal(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const statusConfig = CUSTOMER_STATUSES.find(s => s.value === status);
    if (!statusConfig) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return colors[statusConfig.color] || 'bg-gray-100 text-gray-800';
  };

  const getAppStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Customer Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'Unable to load customer details'}</p>
          <Link
            href="/dashboard/customers"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/customers" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {customer.firstName} {customer.lastName}
                    {customer.businessName && ` - ${customer.businessName}`}
                  </h1>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(customer.customerStatus)}`}
                  >
                    {customer.customerStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {customer.customerNumber} • {customer.customerType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setNewStatus(customer.customerStatus);
                      setShowStatusModal(true);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Change Status
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                  <Link
                    href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + New Application
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    )}
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'details', label: 'Customer Details' },
              { id: 'applications', label: `Applications (${applications.length})` },
              { id: 'activity', label: 'Activity' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">First Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.firstName || ''}
                      onChange={e => handleEditChange('firstName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.firstName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Middle Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.middleName || ''}
                      onChange={e => handleEditChange('middleName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.middleName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.lastName || ''}
                      onChange={e => handleEditChange('lastName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.lastName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Date of Birth
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedCustomer.dateOfBirth || ''}
                      onChange={e => handleEditChange('dateOfBirth', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{formatDate(customer.dateOfBirth)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Gender</label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.gender || ''}
                      onChange={e => handleEditChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">{customer.gender || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Nationality
                  </label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.nationality || ''}
                      onChange={e => handleEditChange('nationality', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {COUNTRIES.find(c => c.value === customer.nationality)?.label ||
                        customer.nationality ||
                        'N/A'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedCustomer.primaryEmail || ''}
                      onChange={e => handleEditChange('primaryEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.primaryEmail}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedCustomer.primaryPhone || ''}
                      onChange={e => handleEditChange('primaryPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.primaryPhone || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Mobile</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedCustomer.mobilePhone || ''}
                      onChange={e => handleEditChange('mobilePhone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.mobilePhone || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Identity Documents */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Identity Documents</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">ID Type</label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.primaryIdentityType || ''}
                      onChange={e => handleEditChange('primaryIdentityType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      {IDENTITY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {IDENTITY_TYPES.find(t => t.value === customer.primaryIdentityType)?.label ||
                        customer.primaryIdentityType ||
                        'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">ID Number</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.primaryIdentityNumber || ''}
                      onChange={e => handleEditChange('primaryIdentityNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.primaryIdentityNumber || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Tax Reference / PPS Number
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.taxIdNumber || ''}
                      onChange={e => handleEditChange('taxIdNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.taxIdNumber || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Address Line 1
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.addressLine1 || ''}
                      onChange={e => handleEditChange('addressLine1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.addressLine1 || 'N/A'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Address Line 2
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.addressLine2 || ''}
                      onChange={e => handleEditChange('addressLine2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.addressLine2 || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">City</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.city || ''}
                      onChange={e => handleEditChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.city || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    County/Region
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.stateProvince || ''}
                      onChange={e => handleEditChange('stateProvince', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.stateProvince || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Eircode/Postcode
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.postalCode || ''}
                      onChange={e => handleEditChange('postalCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.postalCode || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Country</label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.country || ''}
                      onChange={e => handleEditChange('country', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">{customer.country || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Employment & Financial */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Employment & Financial</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Employment Status
                  </label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.employmentStatus || ''}
                      onChange={e => handleEditChange('employmentStatus', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select</option>
                      {EMPLOYMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {EMPLOYMENT_TYPES.find(t => t.value === customer.employmentStatus)?.label ||
                        customer.employmentStatus ||
                        'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Employer</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.employerName || ''}
                      onChange={e => handleEditChange('employerName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.employerName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Occupation</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.occupation || ''}
                      onChange={e => handleEditChange('occupation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{customer.occupation || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Annual Income
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editedCustomer.annualIncome || ''}
                      onChange={e =>
                        handleEditChange('annualIncome', parseFloat(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{formatCurrency(customer.annualIncome)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Credit Score
                  </label>
                  <p className="text-gray-900">{customer.creditScore || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Risk Rating
                  </label>
                  <p className="text-gray-900">{customer.riskRating || 'Not Rated'}</p>
                </div>
              </div>
            </div>

            {/* KYC/AML Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">KYC/AML Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">KYC Status</label>
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                      customer.kycStatus === 'APPROVED'
                        ? 'bg-green-100 text-green-800'
                        : customer.kycStatus === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {customer.kycStatus || 'Not Verified'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    KYC Completion Date
                  </label>
                  <p className="text-gray-900">{formatDate(customer.kycCompletionDate)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">AML Status</label>
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                      customer.amlCheckStatus === 'APPROVED'
                        ? 'bg-green-100 text-green-800'
                        : customer.amlCheckStatus === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {customer.amlCheckStatus || 'Not Checked'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Customer Since
                  </label>
                  <p className="text-gray-900">{formatDate(customer.customerSince)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {applications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-2 text-gray-600">No applications found</p>
                <Link
                  href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                  className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create First Application
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Application #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applications.map(app => (
                      <tr key={app.applicationId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {app.applicationNumber || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {app.product?.productName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(app.requestedAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-medium rounded-full ${getAppStatusColor(app.status)}`}
                          >
                            {app.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(app.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/dashboard/applications/${app.applicationId}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-500 text-center py-8">Activity log coming soon...</p>
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Customer Status</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CUSTOMER_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Customer</h2>
            <p className="text-gray-600 mb-4">How would you like to remove this customer?</p>
            <div className="space-y-3 mb-6">
              <label
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer ${deleteType === 'soft' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                <input
                  type="radio"
                  name="deleteType"
                  value="soft"
                  checked={deleteType === 'soft'}
                  onChange={() => setDeleteType('soft')}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900">Deactivate (Soft Delete)</p>
                  <p className="text-sm text-gray-500">
                    Mark customer as inactive. Can be restored later.
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start p-4 border-2 rounded-lg cursor-pointer ${deleteType === 'hard' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
              >
                <input
                  type="radio"
                  name="deleteType"
                  value="hard"
                  checked={deleteType === 'hard'}
                  onChange={() => setDeleteType('hard')}
                  className="mt-1 mr-3"
                />
                <div>
                  <p className="font-medium text-red-600">Permanent Delete</p>
                  <p className="text-sm text-gray-500">
                    Permanently remove all customer data. This cannot be undone!
                  </p>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${deleteType === 'hard' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isSaving
                  ? 'Processing...'
                  : deleteType === 'hard'
                    ? 'Permanently Delete'
                    : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
