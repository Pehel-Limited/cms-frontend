'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { customerService, Customer } from '@/services/api/customerService';
import { applicationService, ApplicationResponse } from '@/services/api/applicationService';
import { formatCurrency as sharedFormatCurrency } from '@/lib/format';

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
    return sharedFormatCurrency(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const statusConfig = CUSTOMER_STATUSES.find(s => s.value === status);
    if (!statusConfig) return 'bg-slate-50 text-slate-700';
    const colors: Record<string, string> = {
      green: 'bg-emerald-50 text-emerald-700',
      red: 'bg-red-50 text-red-700',
      yellow: 'bg-amber-50 text-amber-700',
      gray: 'bg-slate-50 text-slate-700',
    };
    return colors[statusConfig.color] || 'bg-slate-50 text-slate-700';
  };

  const APP_STATUS_DOT: Record<string, string> = {
    DRAFT: 'bg-slate-400',
    SUBMITTED: 'bg-amber-400',
    UNDER_REVIEW: 'bg-blue-400',
    APPROVED: 'bg-emerald-400',
    REJECTED: 'bg-red-400',
  };
  const APP_STATUS_BG: Record<string, string> = {
    DRAFT: 'bg-slate-50 text-slate-700',
    SUBMITTED: 'bg-amber-50 text-amber-700',
    UNDER_REVIEW: 'bg-blue-50 text-blue-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-red-50 text-red-700',
  };
  const getAppStatusColor = (status: string) =>
    APP_STATUS_BG[status.toUpperCase()] || 'bg-slate-50 text-slate-700';
  const getAppDot = (status: string) => APP_STATUS_DOT[status.toUpperCase()] || 'bg-slate-400';

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-8 animate-pulse">
          <div className="h-5 bg-white/20 rounded-xl w-32 mb-3" />
          <div className="h-7 bg-white/20 rounded-xl w-64" />
          <div className="h-4 bg-white/10 rounded-xl w-48 mt-2" />
        </div>
        <div className="space-y-5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3 animate-pulse"
            >
              <div className="h-5 bg-slate-200/70 rounded-xl w-40" />
              <div className="h-4 bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-100 rounded-xl w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <svg
              className="w-7 h-7 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Customer Not Found</h2>
          <p className="text-slate-500 mb-4">{error || 'Unable to load customer details'}</p>
          <Link
            href="/dashboard/customers"
            className="text-[#7f2b7b] hover:text-[#6b2568] font-medium text-sm"
          >
            ← Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#7f2b7b] via-[#6b2568] to-[#4a1747] p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative">
          <Link
            href="/dashboard/customers"
            className="text-white/60 hover:text-white text-sm mb-3 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Customers
          </Link>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-white text-xl font-bold">
                {customer.firstName?.[0]}
                {customer.lastName?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">
                    {customer.firstName} {customer.lastName}
                    {customer.businessName && ` - ${customer.businessName}`}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      customer.customerStatus === 'ACTIVE'
                        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/20'
                        : customer.customerStatus === 'SUSPENDED'
                          ? 'bg-red-400/20 text-red-200 border border-red-400/20'
                          : customer.customerStatus === 'PENDING_VERIFICATION'
                            ? 'bg-amber-400/20 text-amber-200 border border-amber-400/20'
                            : 'bg-white/10 text-white/80 border border-white/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        customer.customerStatus === 'ACTIVE'
                          ? 'bg-emerald-400'
                          : customer.customerStatus === 'SUSPENDED'
                            ? 'bg-red-400'
                            : customer.customerStatus === 'PENDING_VERIFICATION'
                              ? 'bg-amber-400'
                              : 'bg-white/60'
                      }`}
                    />
                    {customer.customerStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-white/60 text-sm mt-0.5">
                  {customer.customerNumber} &middot; {customer.customerType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
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
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors"
                  >
                    Change Status
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/20 text-red-200 text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                  <Link
                    href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                    className="px-4 py-2 bg-white text-[#7f2b7b] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors"
                  >
                    + New Application
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-white text-[#7f2b7b] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isSaving && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#7f2b7b] border-t-transparent" />
                    )}
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Tab Pills */}
          <div className="flex gap-2 mt-5">
            {[
              { id: 'details', label: 'Details' },
              { id: 'applications', label: `Applications (${applications.length})` },
              { id: 'activity', label: 'Activity' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[#7f2b7b] shadow-sm'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.firstName || ''}
                      onChange={e => handleEditChange('firstName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.firstName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Middle Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.middleName || ''}
                      onChange={e => handleEditChange('middleName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.middleName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.lastName || ''}
                      onChange={e => handleEditChange('lastName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.lastName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Date of Birth
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedCustomer.dateOfBirth || ''}
                      onChange={e => handleEditChange('dateOfBirth', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{formatDate(customer.dateOfBirth)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Gender</label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.gender || ''}
                      onChange={e => handleEditChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    >
                      <option value="">Select</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <p className="text-slate-900">{customer.gender || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Nationality
                  </label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.nationality || ''}
                      onChange={e => handleEditChange('nationality', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-900">
                      {COUNTRIES.find(c => c.value === customer.nationality)?.label ||
                        customer.nationality ||
                        'N/A'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editedCustomer.primaryEmail || ''}
                      onChange={e => handleEditChange('primaryEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.primaryEmail}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedCustomer.primaryPhone || ''}
                      onChange={e => handleEditChange('primaryPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.primaryPhone || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Mobile</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editedCustomer.mobilePhone || ''}
                      onChange={e => handleEditChange('mobilePhone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.mobilePhone || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Identity Documents */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Identity Documents</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">ID Type</label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.primaryIdentityType || ''}
                      onChange={e => handleEditChange('primaryIdentityType', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    >
                      <option value="">Select</option>
                      {IDENTITY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-900">
                      {IDENTITY_TYPES.find(t => t.value === customer.primaryIdentityType)?.label ||
                        customer.primaryIdentityType ||
                        'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">ID Number</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.primaryIdentityNumber || ''}
                      onChange={e => handleEditChange('primaryIdentityNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.primaryIdentityNumber || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Tax Reference / PPS Number
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.taxIdNumber || ''}
                      onChange={e => handleEditChange('taxIdNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.taxIdNumber || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Address Line 1
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.addressLine1 || ''}
                      onChange={e => handleEditChange('addressLine1', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.addressLine1 || 'N/A'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Address Line 2
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.addressLine2 || ''}
                      onChange={e => handleEditChange('addressLine2', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.addressLine2 || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">City</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.city || ''}
                      onChange={e => handleEditChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.city || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    County/Region
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.stateProvince || ''}
                      onChange={e => handleEditChange('stateProvince', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.stateProvince || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Eircode/Postcode
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.postalCode || ''}
                      onChange={e => handleEditChange('postalCode', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.postalCode || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Country</label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.country || ''}
                      onChange={e => handleEditChange('country', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-900">{customer.country || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Employment & Financial */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Employment & Financial</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Employment Status
                  </label>
                  {isEditing ? (
                    <select
                      value={editedCustomer.employmentStatus || ''}
                      onChange={e => handleEditChange('employmentStatus', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    >
                      <option value="">Select</option>
                      {EMPLOYMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-900">
                      {EMPLOYMENT_TYPES.find(t => t.value === customer.employmentStatus)?.label ||
                        customer.employmentStatus ||
                        'N/A'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Employer</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.employerName || ''}
                      onChange={e => handleEditChange('employerName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.employerName || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Occupation
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCustomer.occupation || ''}
                      onChange={e => handleEditChange('occupation', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{customer.occupation || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Annual Income
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editedCustomer.annualIncome || ''}
                      onChange={e =>
                        handleEditChange('annualIncome', parseFloat(e.target.value) || null)
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b]"
                    />
                  ) : (
                    <p className="text-slate-900">{formatCurrency(customer.annualIncome)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Credit Score
                  </label>
                  <p className="text-slate-900">{customer.creditScore || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Risk Rating
                  </label>
                  <p className="text-slate-900">{customer.riskRating || 'Not Rated'}</p>
                </div>
              </div>
            </div>

            {/* KYC/AML Status */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">KYC/AML Status</h2>
                <div className="flex gap-2">
                  {(!customer.kycStatus ||
                    customer.kycStatus === 'NOT_STARTED' ||
                    customer.kycStatus === 'PENDING') && (
                    <Link
                      href={`/dashboard/kyc/cases/new?customerId=${customer.customerId}`}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Initiate KYC
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/kyc/cases?customerId=${customer.customerId}`}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    View KYC Cases
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    KYC Status
                  </label>
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                      customer.kycStatus === 'APPROVED' || customer.kycStatus === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : customer.kycStatus === 'PENDING' || customer.kycStatus === 'IN_PROGRESS'
                          ? 'bg-yellow-100 text-yellow-800'
                          : customer.kycStatus === 'REJECTED' || customer.kycStatus === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {customer.kycStatus?.replace(/_/g, ' ') || 'Not Verified'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    KYC Completion Date
                  </label>
                  <p className="text-slate-900">{formatDate(customer.kycCompletionDate)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    AML Status
                  </label>
                  <span
                    className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                      customer.amlCheckStatus === 'APPROVED' || customer.amlCheckStatus === 'CLEAR'
                        ? 'bg-green-100 text-green-800'
                        : customer.amlCheckStatus === 'PENDING' ||
                            customer.amlCheckStatus === 'IN_PROGRESS'
                          ? 'bg-yellow-100 text-yellow-800'
                          : customer.amlCheckStatus === 'FLAGGED' ||
                              customer.amlCheckStatus === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {customer.amlCheckStatus?.replace(/_/g, ' ') || 'Not Checked'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">
                    Customer Since
                  </label>
                  <p className="text-slate-900">{formatDate(customer.customerSince)}</p>
                </div>
              </div>
              {/* Quick guidance message */}
              {(!customer.kycStatus || customer.kycStatus === 'NOT_STARTED') && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        KYC verification required
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        This customer has not completed KYC/AML verification. Click &quot;Initiate
                        KYC&quot; to start the verification process.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="bg-white rounded-2xl border border-slate-200">
            {applications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-slate-400"
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
                <p className="mt-2 text-slate-600">No applications found</p>
                <Link
                  href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                  className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Create First Application
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Application #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {applications.map(app => (
                      <tr key={app.applicationId} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {app.applicationNumber || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {app.product?.productName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {formatCurrency(app.requestedAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getAppStatusColor(app.status)}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${getAppDot(app.status)}`} />
                            {app.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {formatDate(app.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/dashboard/applications/${app.applicationId}`}
                            className="text-[#7f2b7b] hover:text-[#6b2568] font-medium"
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-slate-500 text-center py-8">Activity log coming soon...</p>
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Change Customer Status</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">New Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#7f2b7b] focus:border-[#7f2b7b] text-sm"
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
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isSaving}
                className="px-4 py-2 bg-[#7f2b7b] text-white rounded-xl hover:bg-[#6b2568] disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {isSaving ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Delete Customer</h2>
            <p className="text-slate-600 mb-4">How would you like to remove this customer?</p>
            <div className="space-y-3 mb-6">
              <label
                className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-colors ${deleteType === 'soft' ? 'border-[#7f2b7b] bg-[#7f2b7b]/5' : 'border-slate-200'}`}
              >
                <input
                  type="radio"
                  name="deleteType"
                  value="soft"
                  checked={deleteType === 'soft'}
                  onChange={() => setDeleteType('soft')}
                  className="mt-1 mr-3 accent-[#7f2b7b]"
                />
                <div>
                  <p className="font-medium text-slate-900">Deactivate (Soft Delete)</p>
                  <p className="text-sm text-slate-500">
                    Mark customer as inactive. Can be restored later.
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-colors ${deleteType === 'hard' ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
              >
                <input
                  type="radio"
                  name="deleteType"
                  value="hard"
                  checked={deleteType === 'hard'}
                  onChange={() => setDeleteType('hard')}
                  className="mt-1 mr-3 accent-red-600"
                />
                <div>
                  <p className="font-medium text-red-600">Permanent Delete</p>
                  <p className="text-sm text-slate-500">
                    Permanently remove all customer data. This cannot be undone!
                  </p>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className={`px-4 py-2 rounded-xl text-white disabled:opacity-50 text-sm font-medium transition-colors ${deleteType === 'hard' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#7f2b7b] hover:bg-[#6b2568]'}`}
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
