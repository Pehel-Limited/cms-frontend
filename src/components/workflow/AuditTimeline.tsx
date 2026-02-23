// components/workflow/AuditTimeline.tsx
'use client';

import React from 'react';
import { AuditEvent } from '@/types/loms';

interface AuditTimelineProps {
  events: AuditEvent[];
  maxItems?: number;
  onViewAll?: () => void;
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp: string): { date: string; time: string } {
  const dt = new Date(timestamp);
  return {
    date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

/**
 * Get icon for event type
 */
function getEventIcon(eventType: string): { icon: string; color: string } {
  const iconMap: Record<string, { icon: string; color: string }> = {
    APPLICATION_CREATED: { icon: '📝', color: 'bg-blue-100 text-blue-600' },
    APPLICATION_SUBMITTED: { icon: '📤', color: 'bg-blue-100 text-blue-600' },
    STATUS_CHANGED: { icon: '🔄', color: 'bg-purple-100 text-purple-600' },
    KYC_INITIATED: { icon: '🔍', color: 'bg-orange-100 text-orange-600' },
    KYC_COMPLETED: { icon: '✅', color: 'bg-green-100 text-green-600' },
    DECISIONING_STARTED: { icon: '⚙️', color: 'bg-purple-100 text-purple-600' },
    FICO_REQUEST_SENT: { icon: '📡', color: 'bg-indigo-100 text-indigo-600' },
    FICO_RESPONSE_RECEIVED: { icon: '📥', color: 'bg-indigo-100 text-indigo-600' },
    DECISION_APPROVED: { icon: '✅', color: 'bg-green-100 text-green-600' },
    DECISION_DECLINED: { icon: '❌', color: 'bg-red-100 text-red-600' },
    DECISION_REFERRED: { icon: '👤', color: 'bg-yellow-100 text-yellow-600' },
    TASK_CREATED: { icon: '📋', color: 'bg-amber-100 text-amber-600' },
    TASK_COMPLETED: { icon: '✓', color: 'bg-green-100 text-green-600' },
    OFFER_GENERATED: { icon: '📄', color: 'bg-blue-100 text-blue-600' },
    OFFER_ACCEPTED: { icon: '🤝', color: 'bg-green-100 text-green-600' },
    ESIGN_INITIATED: { icon: '✍️', color: 'bg-cyan-100 text-cyan-600' },
    ESIGN_COMPLETED: { icon: '✅', color: 'bg-green-100 text-green-600' },
    BOOKING_INITIATED: { icon: '📚', color: 'bg-amber-100 text-amber-600' },
    BOOKING_COMPLETED: { icon: '🎉', color: 'bg-emerald-100 text-emerald-600' },
    APPLICATION_CANCELLED: { icon: '🚫', color: 'bg-gray-100 text-gray-600' },
    NOTE_ADDED: { icon: '💬', color: 'bg-gray-100 text-gray-600' },
    APPROVAL_REQUESTED: { icon: '🔐', color: 'bg-orange-100 text-orange-600' },
    APPROVAL_GRANTED: { icon: '✅', color: 'bg-green-100 text-green-600' },
    APPROVAL_REJECTED: { icon: '❌', color: 'bg-red-100 text-red-600' },
  };

  return iconMap[eventType] || { icon: '📌', color: 'bg-gray-100 text-gray-600' };
}

/**
 * Format event type for display
 */
function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Audit Timeline Component
 * Displays chronological audit trail of application events
 */
export function AuditTimeline({ events, maxItems = 10, onViewAll }: AuditTimelineProps) {
  const displayEvents = events.slice(0, maxItems);
  const hasMore = events.length > maxItems;

  if (events.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <span className="text-4xl">📜</span>
        <p className="text-gray-500 mt-2">No audit events yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        <p className="text-sm text-gray-500">{events.length} events recorded</p>
      </div>

      <div className="p-6">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Events */}
          <div className="space-y-6">
            {displayEvents.map((event, index) => {
              const { icon, color } = getEventIcon(event.eventType);
              const { date, time } = formatTimestamp(event.eventTimestamp);

              return (
                <div key={event.id} className="relative pl-12">
                  {/* Event icon */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${color}`}
                  >
                    <span className="text-sm">{icon}</span>
                  </div>

                  {/* Event content */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {formatEventType(event.eventType)}
                        </h4>
                        {event.eventSubType && (
                          <p className="text-xs text-gray-500 mt-0.5">{event.eventSubType}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{date}</p>
                        <p className="text-xs text-gray-400">{time}</p>
                      </div>
                    </div>

                    {/* State change */}
                    {event.previousState && event.newState && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {event.previousState.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {event.newState.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}

                    {/* Actor info */}
                    {event.actorName && (
                      <p className="mt-2 text-xs text-gray-500">
                        by {event.actorName}
                        {event.actorType && ` (${event.actorType})`}
                      </p>
                    )}

                    {/* Additional details */}
                    {event.details && Object.keys(event.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* View all button */}
        {hasMore && onViewAll && (
          <div className="mt-6 text-center">
            <button
              onClick={onViewAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all {events.length} events →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditTimeline;
