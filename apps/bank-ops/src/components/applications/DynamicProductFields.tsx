'use client';

import React from 'react';
import { FieldDef, FieldSection, getProductFieldConfig } from '@/config/productFieldConfig';

// ─── Types ─────────────────────────────────────────────────────────────
export type FormValues = Record<string, string>;

interface DynamicProductFieldsProps {
  productType: string;
  values: FormValues;
  onChange: (key: string, value: string) => void;
  /** When true, every field is disabled (view-only mode) */
  readOnly?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────
function isFieldVisible(field: FieldDef, values: FormValues): boolean {
  if (!field.showWhen) return true;
  const { field: depField, values: depValues } = field.showWhen;
  const current = values[depField] || '';
  // If values array is empty, visibility is based on field having any value
  if (depValues.length === 0) return current.length > 0;
  return depValues.includes(current);
}

// ─── Field Renderers ───────────────────────────────────────────────────
function renderField(
  field: FieldDef,
  value: string,
  onChange: (key: string, value: string) => void,
  readOnly: boolean
) {
  const baseInputClasses =
    'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed';

  switch (field.type) {
    case 'select':
      return (
        <select
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          disabled={readOnly}
          className={baseInputClasses}
        >
          <option value="">Select...</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'textarea':
      return (
        <textarea
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          rows={3}
          className={baseInputClasses + ' resize-y'}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          step={field.step || 'any'}
          className={baseInputClasses}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          disabled={readOnly}
          className={baseInputClasses}
        />
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={e => onChange(field.key, e.target.checked ? 'true' : 'false')}
            disabled={readOnly}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {field.label}
        </label>
      );
    default: // text
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          className={baseInputClasses}
        />
      );
  }
}

// ─── Section Component ─────────────────────────────────────────────────
function FieldSectionView({
  section,
  values,
  onChange,
  readOnly,
}: {
  section: FieldSection;
  values: FormValues;
  onChange: (key: string, value: string) => void;
  readOnly: boolean;
}) {
  const visibleFields = section.fields.filter(f => isFieldVisible(f, values));
  if (visibleFields.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-gray-600 pb-1">
        {section.title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map(field => (
          <div key={field.key} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
            {field.type !== 'checkbox' && (
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
            )}
            {renderField(field, values[field.key] || '', onChange, readOnly)}
            {field.hint && <p className="mt-1 text-xs text-gray-400">{field.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
/**
 * Renders product-specific form sections driven by `productFieldConfig`.
 *
 * This component is used on the **Edit Application** page (and can be
 * reused in the New Application wizard). It does NOT render the common
 * Amount / Term / Rate / Purpose fields — those remain managed by the
 * parent component.
 *
 * Usage:
 * ```tsx
 * <DynamicProductFields
 *   productType="MORTGAGE"
 *   values={additionalData}
 *   onChange={(key, value) =>
 *     setAdditionalData(prev => ({ ...prev, [key]: value }))
 *   }
 * />
 * ```
 */
export default function DynamicProductFields({
  productType,
  values,
  onChange,
  readOnly = false,
}: DynamicProductFieldsProps) {
  const config = getProductFieldConfig(productType);

  if (!config.sections.length) return null;

  return (
    <div className="space-y-2">
      {config.sections.map((section, idx) => (
        <FieldSectionView
          key={`${productType}-${idx}`}
          section={section}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

/**
 * Hook-style helper: returns the config for a product type so the parent
 * can read amountLabel, termLabel, purposeOptions.
 */
export { getProductFieldConfig };
