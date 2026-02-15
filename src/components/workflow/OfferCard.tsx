// components/workflow/OfferCard.tsx
'use client';

import React from 'react';
import { Offer, OfferCondition, STATUS_CONFIG, getProductLabel } from '@/types/loms';

interface OfferCardProps {
  offer: Offer;
  conditions?: OfferCondition[];
  onAccept?: () => void;
  onViewConditions?: () => void;
  loading?: boolean;
  productName?: string;
}

/**
 * Format currency value
 */
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Offer Card Component
 * Displays offer details with conditions checklist
 */
export function OfferCard({
  offer,
  conditions = [],
  onAccept,
  onViewConditions,
  loading = false,
  productName,
}: OfferCardProps) {
  const isExpired = new Date(offer.expiryAt) < new Date();
  const isAccepted = offer.status === 'ACCEPTED';
  const isVoided = offer.status === 'VOIDED';

  const satisfiedConditions = conditions.filter(
    c => c.status === 'SATISFIED' || c.status === 'WAIVED'
  );
  const pendingConditions = conditions.filter(c => c.status === 'PENDING');
  const allConditionsMet = pendingConditions.length === 0;

  const getStatusBadge = () => {
    if (isAccepted) return { text: 'Accepted', class: 'bg-green-100 text-green-800' };
    if (isVoided) return { text: 'Voided', class: 'bg-gray-100 text-gray-800' };
    if (isExpired) return { text: 'Expired', class: 'bg-red-100 text-red-800' };
    return { text: 'Active', class: 'bg-blue-100 text-blue-800' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {getProductLabel(productName)} Offer
            </h3>
            <p className="text-blue-100 text-sm">Version {offer.version}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge.class}`}>
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* Offer details */}
      <div className="p-6">
        {/* Amount and terms */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">{getProductLabel(productName)} Amount</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(offer.amount, offer.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Term</p>
            <p className="text-xl font-bold text-gray-900">{offer.termMonths} months</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Interest Rate</p>
            <p className="text-xl font-bold text-gray-900">
              {offer.interestRate}% <span className="text-sm font-normal">({offer.rateType})</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Payment</p>
            <p className="text-xl font-bold text-gray-900">
              {offer.repaymentEstimate
                ? formatCurrency(offer.repaymentEstimate, offer.currency)
                : 'TBD'}
            </p>
          </div>
        </div>

        {/* APR and fees */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">APR</p>
            <p className="text-lg font-semibold text-gray-900">
              {offer.apr || offer.interestRate}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Repayment</p>
            <p className="text-lg font-semibold text-gray-900">{offer.repaymentFrequency}</p>
          </div>
        </div>

        {/* Expiry */}
        <div className="flex items-center justify-between mb-6 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">⏰</span>
            <span className="text-sm text-amber-800">
              {isExpired ? 'Expired on' : 'Valid until'} {formatDate(offer.expiryAt)}
            </span>
          </div>
          {!isExpired && !isAccepted && (
            <span className="text-xs text-amber-600 font-medium">
              {Math.ceil((new Date(offer.expiryAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}{' '}
              days remaining
            </span>
          )}
        </div>

        {/* Conditions checklist */}
        {conditions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Conditions Precedent</h4>
              <span className="text-xs text-gray-500">
                {satisfiedConditions.length}/{conditions.length} completed
              </span>
            </div>
            <div className="space-y-2">
              {conditions.slice(0, 3).map(condition => (
                <div
                  key={condition.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    condition.status === 'SATISFIED'
                      ? 'bg-green-50'
                      : condition.status === 'WAIVED'
                        ? 'bg-blue-50'
                        : 'bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      condition.status === 'SATISFIED'
                        ? 'bg-green-500 text-white'
                        : condition.status === 'WAIVED'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {condition.status === 'SATISFIED' || condition.status === 'WAIVED' ? '✓' : ''}
                  </span>
                  <span
                    className={`text-sm ${
                      condition.status === 'PENDING' ? 'text-gray-600' : 'text-gray-800'
                    }`}
                  >
                    {condition.conditionType.replace(/_/g, ' ')}
                  </span>
                  {condition.status === 'WAIVED' && (
                    <span className="text-xs text-blue-600 ml-auto">Waived</span>
                  )}
                </div>
              ))}
              {conditions.length > 3 && (
                <button
                  onClick={onViewConditions}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all {conditions.length} conditions →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isExpired && !isAccepted && !isVoided && onAccept && (
          <div className="flex gap-3">
            <button
              onClick={onAccept}
              disabled={loading || !allConditionsMet}
              className={`flex-1 py-3 px-4 rounded-lg font-medium text-white transition-all ${
                allConditionsMet
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {allConditionsMet ? 'Accept Offer' : 'Conditions Pending'}
            </button>
            {onViewConditions && (
              <button
                onClick={onViewConditions}
                className="py-3 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                View Details
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OfferCard;
