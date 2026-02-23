'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { customerService, type Customer } from '@/services/api/customerService';
import {
  SortableHeader,
  SortConfig,
  handleSortToggle,
  sortData,
} from '@/components/SortableHeader';

const RISK_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  VERY_HIGH: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
};

const getRiskStyle = (rating: string | undefined) =>
  (rating && RISK_STYLE[rating.toUpperCase()]) || {
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
  };

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: '', direction: null });

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerService.searchCustomers({ searchTerm });
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const name = customerService.getCustomerName(customer).toLowerCase();
    const email = customer.primaryEmail.toLowerCase();
    const phone = customer.primaryPhone.toLowerCase();

    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  const onSort = (field: string) => {
    setSortConfig(handleSortToggle(field, sortConfig));
  };

  const sortedCustomers = sortData(filteredCustomers, sortConfig);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      {/* ──── Gradient header banner ──── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1a3a7a] via-[#1e4da0] to-[#3b82f6]">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 w-56 h-56 bg-blue-400/10 rounded-full blur-2xl" />
        <svg
          className="absolute bottom-0 left-0 right-0 text-slate-100"
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
        >
          <path fill="currentColor" d="M0,48 L0,24 Q360,0 720,24 Q1080,48 1440,24 L1440,48 Z" />
        </svg>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-14">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Customer Management</h1>
              <p className="text-blue-200 text-sm mt-1">
                {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} in
                portfolio
              </p>
            </div>
            <Link
              href="/dashboard/customers/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Customer
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 space-y-4">
        {/* ──── Search card ──── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* ──── Loading ──── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Loading customers...</p>
            </div>
          </div>
        )}

        {/* ──── Empty state ──── */}
        {!loading && filteredCustomers.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm py-20 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-slate-900 font-semibold text-lg">
              {searchTerm ? 'No customers found' : 'No customers yet'}
            </p>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              {searchTerm
                ? 'Try adjusting your search term.'
                : 'Get started by adding your first customer.'}
            </p>
            {!searchTerm && (
              <Link
                href="/dashboard/customers/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Customer
              </Link>
            )}
          </div>
        )}

        {/* ──── Customer table ──── */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <SortableHeader
                      label="Customer"
                      field="firstName"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Type"
                      field="customerType"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Contact"
                      field="primaryEmail"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Risk Rating"
                      field="riskRating"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <SortableHeader
                      label="Status"
                      field="customerStatus"
                      currentSort={sortConfig}
                      onSort={onSort}
                    />
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedCustomers.map(customer => {
                    const risk = getRiskStyle(customer.riskRating);
                    return (
                      <tr
                        key={customer.customerId}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => {
                          window.location.href = `/dashboard/customers/${customer.customerId}`;
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                              <span className="text-white font-semibold text-sm">
                                {customerService.getCustomerName(customer).charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {customerService.getCustomerName(customer)}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {customer.customerNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            {customer.customerType === 'INDIVIDUAL' ? (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                            )}
                            {customerService.formatCustomerType(customer.customerType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-slate-700">{customer.primaryEmail}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{customer.primaryPhone}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${risk.bg} ${risk.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                            {customer.riskRating || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              customer.customerStatus === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                customer.customerStatus === 'ACTIVE'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {customer.customerStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/dashboard/customers/${customer.customerId}`}
                            onClick={e => e.stopPropagation()}
                            className="text-blue-600 font-medium hover:text-blue-800 transition-colors mr-4"
                          >
                            View
                          </Link>
                          <Link
                            href={`/dashboard/applications/new?customerId=${customer.customerId}`}
                            onClick={e => e.stopPropagation()}
                            className="text-emerald-600 font-medium hover:text-emerald-800 transition-colors"
                          >
                            New App
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
