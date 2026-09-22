'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { type RootState } from '@/store';
import apiClient from '@/lib/api-client';
import { getCurrencySymbol } from '@/lib/format';

// ============================================
// TYPE DEFINITIONS
// ============================================

type CustomerCategory = 'INDIVIDUAL' | 'BUSINESS' | 'NON_PROFIT' | 'INSTITUTIONAL';

type IndividualSubtype = 'PERSONAL' | 'JOINT' | 'SOLE_TRADER';
type BusinessSubtype = 'COMPANY' | 'PARTNERSHIP';
type NonProfitSubtype = 'CHARITY' | 'CLUB' | 'ASSOCIATION';
type InstitutionalSubtype = 'FUND' | 'GOVERNMENT' | 'CREDIT_UNION';

type CustomerSubtype =
  | IndividualSubtype
  | BusinessSubtype
  | NonProfitSubtype
  | InstitutionalSubtype;

const CUSTOMER_CATEGORIES = [
  {
    value: 'INDIVIDUAL' as CustomerCategory,
    label: 'Individual',
    description: 'Personal accounts for individuals',
    subtypes: [
      { value: 'PERSONAL', label: 'Personal', description: 'Single individual account holder' },
      { value: 'JOINT', label: 'Joint', description: 'Two or more individuals sharing an account' },
      {
        value: 'SOLE_TRADER',
        label: 'Sole trader',
        description: 'Self-employed individual trading under a business name',
      },
    ],
  },
  {
    value: 'BUSINESS' as CustomerCategory,
    label: 'Business',
    description: 'Commercial and corporate entities',
    subtypes: [
      { value: 'COMPANY', label: 'Company', description: 'Limited company (Ltd, PLC, LLP, DAC)' },
      { value: 'PARTNERSHIP', label: 'Partnership', description: 'General or limited partnership' },
    ],
  },
  {
    value: 'NON_PROFIT' as CustomerCategory,
    label: 'Non-profit',
    description: 'Charitable and community organisations',
    subtypes: [
      { value: 'CHARITY', label: 'Charity', description: 'Registered charitable organisation' },
      { value: 'CLUB', label: 'Club', description: 'Sports, social or members club' },
      {
        value: 'ASSOCIATION',
        label: 'Association',
        description: 'Trade, professional or community association',
      },
    ],
  },
  {
    value: 'INSTITUTIONAL' as CustomerCategory,
    label: 'Institutional',
    description: 'Financial and governmental institutions',
    subtypes: [
      { value: 'FUND', label: 'Fund', description: 'Investment fund, pension fund or trust' },
      { value: 'GOVERNMENT', label: 'Government', description: 'Government body or agency' },
      {
        value: 'CREDIT_UNION',
        label: 'Credit union',
        description: 'Credit union or co-operative financial institution',
      },
    ],
  },
];

const COMPANY_TYPES = [
  { value: 'PRIVATE_LIMITED', label: 'Private company limited by shares (Ltd)' },
  { value: 'PUBLIC_LIMITED', label: 'Public limited company (PLC)' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited liability partnership (LLP)' },
  { value: 'DESIGNATED_ACTIVITY', label: 'Designated activity company (DAC)' },
  { value: 'COMPANY_LIMITED_GUARANTEE', label: 'Company limited by guarantee (CLG)' },
  { value: 'UNLIMITED', label: 'Unlimited company' },
];

const PARTNERSHIP_TYPES = [
  { value: 'GENERAL_PARTNERSHIP', label: 'General partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited partnership (LP)' },
  { value: 'INVESTMENT_LIMITED_PARTNERSHIP', label: 'Investment limited partnership (ILP)' },
];

const FUND_TYPES = [
  { value: 'UCITS', label: 'UCITS fund' },
  { value: 'AIF', label: 'Alternative investment fund (AIF)' },
  { value: 'PENSION_FUND', label: 'Pension fund' },
  { value: 'INVESTMENT_TRUST', label: 'Investment trust' },
  { value: 'UNIT_TRUST', label: 'Unit trust' },
];

const MEMBER_ROLES: Record<string, { value: string; label: string }[]> = {
  JOINT: [
    { value: 'PRIMARY_HOLDER', label: 'Primary account holder' },
    { value: 'JOINT_HOLDER', label: 'Joint account holder' },
  ],
  COMPANY: [
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'COMPANY_SECRETARY', label: 'Company secretary' },
    { value: 'SHAREHOLDER', label: 'Shareholder' },
    { value: 'BENEFICIAL_OWNER', label: 'Beneficial owner (UBO)' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
  PARTNERSHIP: [
    { value: 'GENERAL_PARTNER', label: 'General partner' },
    { value: 'LIMITED_PARTNER', label: 'Limited partner' },
    { value: 'MANAGING_PARTNER', label: 'Managing partner' },
    { value: 'BENEFICIAL_OWNER', label: 'Beneficial owner (UBO)' },
  ],
  CHARITY: [
    { value: 'TRUSTEE', label: 'Trustee' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'CHAIRPERSON', label: 'Chairperson' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
  CLUB: [
    { value: 'CHAIRPERSON', label: 'Chairperson / President' },
    { value: 'VICE_CHAIRPERSON', label: 'Vice chairperson' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'COMMITTEE_MEMBER', label: 'Committee member' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
  ASSOCIATION: [
    { value: 'PRESIDENT', label: 'President' },
    { value: 'VICE_PRESIDENT', label: 'Vice president' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'BOARD_MEMBER', label: 'Board member' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
  FUND: [
    { value: 'FUND_MANAGER', label: 'Fund manager' },
    { value: 'INVESTMENT_MANAGER', label: 'Investment manager' },
    { value: 'TRUSTEE', label: 'Trustee' },
    { value: 'CUSTODIAN', label: 'Custodian' },
    { value: 'ADMINISTRATOR', label: 'Administrator' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
  GOVERNMENT: [
    { value: 'AUTHORISED_OFFICER', label: 'Authorised officer' },
    { value: 'DEPARTMENT_HEAD', label: 'Department head' },
    { value: 'FINANCE_OFFICER', label: 'Finance officer' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
  CREDIT_UNION: [
    { value: 'CHAIRPERSON', label: 'Chairperson' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'SUPERVISORY_COMMITTEE', label: 'Supervisory committee member' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised signatory' },
  ],
};

const IDENTITY_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National identity card' },
  { value: 'DRIVING_LICENCE', label: 'Driving licence' },
  { value: 'RESIDENCE_PERMIT', label: 'Residence permit' },
];

const COUNTRIES = [
  { value: 'IE', label: 'Ireland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'PT', label: 'Portugal' },
  { value: 'AT', label: 'Austria' },
  { value: 'PL', label: 'Poland' },
  { value: 'OTHER', label: 'Other' },
];

const EMPLOYMENT_TYPES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
];

const RELATIONSHIPS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'CHILD', label: 'Child' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'OTHER', label: 'Other' },
];

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

// ============================================
// INTERFACES
// ============================================

interface IndividualFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  email: string;
  phone: string;
  identityType: string;
  identityNumber: string;
  identityExpiry: string;
  taxReferenceNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  employmentStatus: string;
  employerName: string;
  occupation: string;
  annualIncome: string;
}

interface JointHolderData extends IndividualFormData {
  relationship: string;
}

interface EntityMember {
  id: string;
  customerId?: string;
  customerName?: string;
  role: string;
  ownershipPercentage?: number;
  isSignatory: boolean;
  isPrimaryContact: boolean;
  newMember?: IndividualFormData;
  isExisting: boolean;
}

interface EntityFormData {
  legalName: string;
  tradingName: string;
  entitySubtype: string;
  registrationNumber: string;
  taxNumber: string;
  vatNumber: string;
  charityNumber: string;
  dateOfIncorporation: string;
  countryOfIncorporation: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredCity: string;
  registeredCounty: string;
  registeredPostcode: string;
  registeredCountry: string;
  tradingAddressLine1: string;
  tradingAddressLine2: string;
  tradingCity: string;
  tradingCounty: string;
  tradingPostcode: string;
  tradingCountry: string;
  sameAsRegistered: boolean;
  businessEmail: string;
  businessPhone: string;
  website: string;
  industryCode: string;
  businessDescription: string;
  annualTurnover: string;
  numberOfEmployees: string;
  members: EntityMember[];
}

interface ExistingCustomer {
  customerId: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

const EMPTY_INDIVIDUAL: IndividualFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  nationality: 'IE',
  email: '',
  phone: '',
  identityType: 'PASSPORT',
  identityNumber: '',
  identityExpiry: '',
  taxReferenceNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  country: 'IE',
  employmentStatus: '',
  employerName: '',
  occupation: '',
  annualIncome: '',
};

const EMPTY_ENTITY: EntityFormData = {
  legalName: '',
  tradingName: '',
  entitySubtype: '',
  registrationNumber: '',
  taxNumber: '',
  vatNumber: '',
  charityNumber: '',
  dateOfIncorporation: '',
  countryOfIncorporation: 'IE',
  registeredAddressLine1: '',
  registeredAddressLine2: '',
  registeredCity: '',
  registeredCounty: '',
  registeredPostcode: '',
  registeredCountry: 'IE',
  tradingAddressLine1: '',
  tradingAddressLine2: '',
  tradingCity: '',
  tradingCounty: '',
  tradingPostcode: '',
  tradingCountry: 'IE',
  sameAsRegistered: true,
  businessEmail: '',
  businessPhone: '',
  website: '',
  industryCode: '',
  businessDescription: '',
  annualTurnover: '',
  numberOfEmployees: '',
  members: [],
};

// ============================================
// Reusable form primitives
// ============================================

const FIELD_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--rm-input)',
  border: '1px solid var(--rm-border)',
  color: 'var(--rm-text)',
};

function fieldStyle(error?: string): React.CSSProperties {
  return {
    ...FIELD_STYLE,
    border: `1px solid ${error ? 'rgba(239,68,68,0.6)' : 'var(--rm-border)'}`,
  };
}

const FIELD_CLASS = 'w-full rounded-xl px-4 py-2.5 text-sm';

function RequiredMark({ required }: { required?: boolean }) {
  if (!required) return null;
  return (
    <>
      <span aria-hidden="true" className="text-red-600 dark:text-red-400">
        {' '}
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-xs mt-1.5 text-red-700 dark:text-red-300">
      {error}
    </p>
  );
}

function Label({
  id,
  label,
  required,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm mb-1.5" style={{ color: 'var(--rm-text-secondary)' }}>
      {label}
      <RequiredMark required={required} />
      {hint && (
        <span className="block text-xs mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

type TextProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
};

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
  placeholder,
  min,
  max,
  step,
}: TextProps) {
  return (
    <div>
      <Label id={id} label={label} required={required} />
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={e => onChange(e.target.value)}
        className={FIELD_CLASS}
        style={fieldStyle(error)}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

type SelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  placeholder?: string;
};

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
  placeholder,
}: SelectProps) {
  return (
    <div>
      <Label id={id} label={label} required={required} />
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={e => onChange(e.target.value)}
        className={FIELD_CLASS}
        style={fieldStyle(error)}
      >
        <option value="">{placeholder || 'Select an option'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={id} error={error} />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 3,
  required,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <Label id={id} label={label} required={required} />
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={e => onChange(e.target.value)}
        className={FIELD_CLASS}
        style={fieldStyle(error)}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl p-6 sm:p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--rm-text)' }}>
            {title}
          </h2>
          {description && (
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SecondaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: 'var(--rm-accent)' }}
    >
      {children}
    </button>
  );
}

function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = `dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.55)' }}
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-7"
        style={{ backgroundColor: 'var(--rm-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id={titleId}
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--rm-text)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--rm-input)', color: 'var(--rm-text-secondary)' }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export default function NewCustomerPage() {
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);

  const [selectedCategory, setSelectedCategory] = useState<CustomerCategory | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<CustomerSubtype | null>(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [individualData, setIndividualData] = useState<IndividualFormData>(EMPTY_INDIVIDUAL);
  const [jointHolders, setJointHolders] = useState<JointHolderData[]>([]);
  const [entityData, setEntityData] = useState<EntityFormData>(EMPTY_ENTITY);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExistingCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberType, setAddMemberType] = useState<'existing' | 'new'>('existing');
  const [newMemberData, setNewMemberData] = useState<IndividualFormData>(EMPTY_INDIVIDUAL);
  const [selectedMemberRole, setSelectedMemberRole] = useState('');
  const [memberOwnership, setMemberOwnership] = useState('');
  const [memberIsSignatory, setMemberIsSignatory] = useState(false);
  const [memberIsPrimaryContact, setMemberIsPrimaryContact] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const handleCategorySelect = (category: CustomerCategory) => {
    setSelectedCategory(category);
    setSelectedSubtype(null);
    setStep(1);
    setError(null);
    setFieldErrors({});
  };

  const handleSubtypeSelect = (subtype: CustomerSubtype) => {
    setSelectedSubtype(subtype);
    setStep(2);
    setError(null);
    setFieldErrors({});
    if (subtype === 'COMPANY')
      setEntityData(prev => ({ ...prev, entitySubtype: 'PRIVATE_LIMITED' }));
    else if (subtype === 'PARTNERSHIP')
      setEntityData(prev => ({ ...prev, entitySubtype: 'GENERAL_PARTNERSHIP' }));
    else if (subtype === 'FUND') setEntityData(prev => ({ ...prev, entitySubtype: 'AIF' }));
  };

  const handleIndividualChange = (field: keyof IndividualFormData, value: string) => {
    setIndividualData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      const key = `ind-${field}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleEntityChange = (field: keyof EntityFormData, value: string | boolean) => {
    setEntityData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => {
      const key = `ent-${field}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (field === 'sameAsRegistered' && value === true) {
      setEntityData(prev => ({
        ...prev,
        tradingAddressLine1: prev.registeredAddressLine1,
        tradingAddressLine2: prev.registeredAddressLine2,
        tradingCity: prev.registeredCity,
        tradingCounty: prev.registeredCounty,
        tradingPostcode: prev.registeredPostcode,
        tradingCountry: prev.registeredCountry,
      }));
    }
  };

  const searchExistingCustomers = async (query: string) => {
    setSearchError(null);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await apiClient.get<ExistingCustomer[]>(
        `/api/admin/customers/search?q=${encodeURIComponent(query)}`
      );
      setSearchResults(response.data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
      setSearchError('The customer search is unavailable right now. You can add a new person instead.');
    } finally {
      setIsSearching(false);
    }
  };

  const addJointHolder = () => {
    setJointHolders(prev => [...prev, { ...EMPTY_INDIVIDUAL, relationship: '' }]);
  };

  const removeJointHolder = (index: number) =>
    setJointHolders(prev => prev.filter((_, i) => i !== index));

  const updateJointHolder = (index: number, field: keyof JointHolderData, value: string) => {
    setJointHolders(prev =>
      prev.map((holder, i) => (i === index ? { ...holder, [field]: value } : holder))
    );
  };

  const addExistingMember = (customer: ExistingCustomer) => {
    if (!selectedMemberRole) {
      setMemberError('Choose a role before adding this person.');
      return;
    }
    const newMember: EntityMember = {
      id: `member-${Date.now()}`,
      customerId: customer.customerId,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      role: selectedMemberRole,
      ownershipPercentage: memberOwnership ? parseFloat(memberOwnership) : undefined,
      isSignatory: memberIsSignatory,
      isPrimaryContact: memberIsPrimaryContact,
      isExisting: true,
    };
    setEntityData(prev => ({ ...prev, members: [...prev.members, newMember] }));
    resetMemberForm();
  };

  const addNewMember = () => {
    if (!selectedMemberRole) {
      setMemberError('Choose a role before adding this person.');
      return;
    }
    if (!newMemberData.firstName.trim() || !newMemberData.lastName.trim()) {
      setMemberError('Enter the person’s first and last name.');
      return;
    }
    const newMember: EntityMember = {
      id: `member-${Date.now()}`,
      customerName: `${newMemberData.firstName} ${newMemberData.lastName}`.trim(),
      role: selectedMemberRole,
      ownershipPercentage: memberOwnership ? parseFloat(memberOwnership) : undefined,
      isSignatory: memberIsSignatory,
      isPrimaryContact: memberIsPrimaryContact,
      newMember: { ...newMemberData },
      isExisting: false,
    };
    setEntityData(prev => ({ ...prev, members: [...prev.members, newMember] }));
    resetMemberForm();
  };

  const removeMember = (memberId: string) => {
    setEntityData(prev => ({ ...prev, members: prev.members.filter(m => m.id !== memberId) }));
  };

  const resetMemberForm = () => {
    setShowAddMemberModal(false);
    setAddMemberType('existing');
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setMemberError(null);
    setSelectedMemberRole('');
    setMemberOwnership('');
    setMemberIsSignatory(false);
    setMemberIsPrimaryContact(false);
    setNewMemberData(EMPTY_INDIVIDUAL);
  };

  // -------------------------------------------------------------------------
  // Validation — errors are linked to their fields and announced
  // -------------------------------------------------------------------------

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const required = (id: string, value: string | undefined, label: string) => {
      if (!value || !String(value).trim()) errors[id] = `${label} is required.`;
    };

    if (selectedCategory === 'INDIVIDUAL') {
      required('ind-firstName', individualData.firstName, 'First name');
      required('ind-lastName', individualData.lastName, 'Last name');
      required('ind-dateOfBirth', individualData.dateOfBirth, 'Date of birth');
      required('ind-nationality', individualData.nationality, 'Nationality');
      required('ind-email', individualData.email, 'Email');
      required('ind-phone', individualData.phone, 'Phone number');
      required('ind-identityType', individualData.identityType, 'ID type');
      required('ind-identityNumber', individualData.identityNumber, 'ID number');
      required('ind-addressLine1', individualData.addressLine1, 'Address line 1');
      required('ind-city', individualData.city, 'City or town');
      required('ind-country', individualData.country, 'Country');
      if (selectedSubtype !== 'SOLE_TRADER')
        required('ind-employmentStatus', individualData.employmentStatus, 'Employment status');
      if (selectedSubtype === 'SOLE_TRADER')
        required('ent-tradingName', entityData.tradingName, 'Trading name');
      if (individualData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(individualData.email))
        errors['ind-email'] = 'Enter a valid email address.';
      jointHolders.forEach((h, i) => {
        required(`jh-${i}-firstName`, h.firstName, `Joint holder ${i + 1} first name`);
        required(`jh-${i}-lastName`, h.lastName, `Joint holder ${i + 1} last name`);
        required(`jh-${i}-email`, h.email, `Joint holder ${i + 1} email`);
        required(`jh-${i}-phone`, h.phone, `Joint holder ${i + 1} phone`);
        required(`jh-${i}-dateOfBirth`, h.dateOfBirth, `Joint holder ${i + 1} date of birth`);
      });
    } else {
      required('ent-legalName', entityData.legalName, 'Legal name');
      required(
        selectedSubtype === 'CHARITY' ? 'ent-charityNumber' : 'ent-registrationNumber',
        selectedSubtype === 'CHARITY' ? entityData.charityNumber : entityData.registrationNumber,
        selectedSubtype === 'CHARITY' ? 'CHY number' : 'Registration number'
      );
      required('ent-dateOfIncorporation', entityData.dateOfIncorporation, 'Date of incorporation');
      required(
        'ent-countryOfIncorporation',
        entityData.countryOfIncorporation,
        'Country of incorporation'
      );
      required('ent-businessEmail', entityData.businessEmail, 'Business email');
      required('ent-businessPhone', entityData.businessPhone, 'Business phone');
      required('ent-registeredAddressLine1', entityData.registeredAddressLine1, 'Address line 1');
      required('ent-registeredCity', entityData.registeredCity, 'City');
      required('ent-registeredCountry', entityData.registeredCountry, 'Country');
      if (entityData.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entityData.businessEmail))
        errors['ent-businessEmail'] = 'Enter a valid email address.';
      if (!entityData.sameAsRegistered) {
        required('ent-tradingAddressLine1', entityData.tradingAddressLine1, 'Trading address line 1');
        required('ent-tradingCity', entityData.tradingCity, 'Trading city');
        required('ent-tradingCountry', entityData.tradingCountry, 'Trading country');
      }
    }
    return errors;
  };

  const goToReview = () => {
    const errors = validate();
    setFieldErrors(errors);
    const count = Object.keys(errors).length;
    if (count > 0) {
      setError(
        `${count} field${count === 1 ? '' : 's'} still need attention. Everything you typed has been kept.`
      );
      const first = document.getElementById(Object.keys(errors)[0]);
      first?.focus();
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setError(null);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const errors = validate();
    setFieldErrors(errors);
    const count = Object.keys(errors).length;
    if (count > 0) {
      setError(
        `${count} field${count === 1 ? '' : 's'} still need attention. Nothing was submitted and your input has been kept.`
      );
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (selectedCategory === 'INDIVIDUAL') {
        const customerData = {
          customerType: 'INDIVIDUAL',
          customerSubtype: selectedSubtype,
          ...individualData,
          annualIncome: individualData.annualIncome
            ? parseFloat(individualData.annualIncome)
            : null,
        };
        const response = await apiClient.post('/api/admin/customers', customerData);
        if (selectedSubtype === 'JOINT' && jointHolders.length > 0) {
          const primaryCustomerId = response.data.customerId;
          for (const holder of jointHolders) {
            const holderData = {
              customerType: 'INDIVIDUAL',
              customerSubtype: 'JOINT',
              ...holder,
              annualIncome: holder.annualIncome ? parseFloat(holder.annualIncome) : null,
              linkedCustomerId: primaryCustomerId,
            };
            await apiClient.post('/api/admin/customers', holderData);
          }
        }
        toast.success('Customer created');
        router.push(`/dashboard/customers/${response.data.customerId}`);
      } else {
        const entityPayload = {
          entityType: selectedSubtype,
          entitySubtype: entityData.entitySubtype,
          legalName: entityData.legalName,
          tradingName: entityData.tradingName || entityData.legalName,
          registrationNumber: entityData.registrationNumber,
          taxNumber: entityData.taxNumber,
          vatNumber: entityData.vatNumber,
          charityNumber: entityData.charityNumber,
          dateOfIncorporation: entityData.dateOfIncorporation,
          countryOfIncorporation: entityData.countryOfIncorporation,
          registeredAddress: {
            addressLine1: entityData.registeredAddressLine1,
            addressLine2: entityData.registeredAddressLine2,
            city: entityData.registeredCity,
            county: entityData.registeredCounty,
            postcode: entityData.registeredPostcode,
            country: entityData.registeredCountry,
          },
          tradingAddress: entityData.sameAsRegistered
            ? null
            : {
                addressLine1: entityData.tradingAddressLine1,
                addressLine2: entityData.tradingAddressLine2,
                city: entityData.tradingCity,
                county: entityData.tradingCounty,
                postcode: entityData.tradingPostcode,
                country: entityData.tradingCountry,
              },
          contactEmail: entityData.businessEmail,
          contactPhone: entityData.businessPhone,
          website: entityData.website,
          industryCode: entityData.industryCode,
          businessDescription: entityData.businessDescription,
          annualTurnover: entityData.annualTurnover ? parseFloat(entityData.annualTurnover) : null,
          numberOfEmployees: entityData.numberOfEmployees
            ? parseInt(entityData.numberOfEmployees)
            : null,
          bankId: user?.bankId,
        };
        const entityResponse = await apiClient.post('/api/admin/entities', entityPayload);
        const entityId = entityResponse.data.entityId;
        for (const member of entityData.members) {
          if (member.isExisting && member.customerId) {
            await apiClient.post(`/api/admin/entities/${entityId}/members`, {
              customerId: member.customerId,
              role: member.role,
              ownershipPercentage: member.ownershipPercentage,
              isSignatory: member.isSignatory,
              isPrimaryContact: member.isPrimaryContact,
            });
          } else if (member.newMember) {
            const newCustomerData = {
              customerType: 'INDIVIDUAL',
              customerSubtype: 'PERSONAL',
              ...member.newMember,
              annualIncome: member.newMember.annualIncome
                ? parseFloat(member.newMember.annualIncome)
                : null,
            };
            const customerResponse = await apiClient.post(
              '/api/admin/customers',
              newCustomerData
            );
            await apiClient.post(`/api/admin/entities/${entityId}/members`, {
              customerId: customerResponse.data.customerId,
              role: member.role,
              ownershipPercentage: member.ownershipPercentage,
              isSignatory: member.isSignatory,
              isPrimaryContact: member.isPrimaryContact,
            });
          }
        }
        toast.success('Entity created');
        router.push(`/dashboard/entities/${entityId}`);
      }
    } catch (err: unknown) {
      console.error('Error creating customer/entity:', err);
      setError(
        err instanceof Error
          ? `${err.message} Nothing was submitted — your input has been kept.`
          : 'We could not create this record. Nothing was submitted — your input has been kept.'
      );
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Steps
  // -------------------------------------------------------------------------

  const steps = [
    { n: 1, label: 'Type' },
    { n: 2, label: 'Details' },
    { n: 3, label: 'Review' },
  ];

  const categoryMeta = CUSTOMER_CATEGORIES.find(c => c.value === selectedCategory);
  const subtypeMeta = categoryMeta?.subtypes.find(s => s.value === selectedSubtype);

  const renderCategorySelection = () => (
    <Card
      title="Choose a customer type"
      description="Pick the category that best describes the customer you are onboarding."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CUSTOMER_CATEGORIES.map(category => {
          const selected = selectedCategory === category.value;
          return (
            <button
              key={category.value}
              type="button"
              onClick={() => handleCategorySelect(category.value)}
              aria-pressed={selected}
              className="rounded-2xl p-5 text-left transition-opacity hover:opacity-90"
              style={{
                backgroundColor: selected ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
              }}
            >
              <span className="flex items-start gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: selected ? 'var(--rm-card)' : 'var(--rm-card)',
                    color: 'var(--rm-accent)',
                  }}
                  aria-hidden="true"
                >
                  <CategoryIcon value={category.value} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    {category.label}
                  </span>
                  <span className="block text-sm mt-0.5" style={{ color: 'var(--rm-text-muted)' }}>
                    {category.description}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );

  const renderSubtypeSelection = () => {
    if (!categoryMeta) return null;
    return (
      <div className="space-y-6">
        <Card
          title={`Choose a ${categoryMeta.label.toLowerCase()} type`}
          description={`Select the specific type of ${categoryMeta.label.toLowerCase()}.`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categoryMeta.subtypes.map(subtype => {
              const selected = selectedSubtype === subtype.value;
              return (
                <button
                  key={subtype.value}
                  type="button"
                  onClick={() => handleSubtypeSelect(subtype.value as CustomerSubtype)}
                  aria-pressed={selected}
                  className="rounded-2xl p-5 text-left transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: selected ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                  }}
                >
                  <span className="block text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                    {subtype.label}
                  </span>
                  <span className="block text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
                    {subtype.description}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg"
          style={{ color: 'var(--rm-text-secondary)' }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to categories
        </button>
      </div>
    );
  };

  const renderIndividualForm = () => (
    <div className="space-y-6">
      <Card title="Personal information">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <TextField id="ind-firstName" label="First name" required value={individualData.firstName} error={fieldErrors['ind-firstName']} onChange={v => handleIndividualChange('firstName', v)} />
          <TextField id="ind-middleName" label="Middle name" value={individualData.middleName} error={fieldErrors['ind-middleName']} onChange={v => handleIndividualChange('middleName', v)} />
          <TextField id="ind-lastName" label="Last name" required value={individualData.lastName} error={fieldErrors['ind-lastName']} onChange={v => handleIndividualChange('lastName', v)} />
          <TextField id="ind-dateOfBirth" label="Date of birth" type="date" required value={individualData.dateOfBirth} error={fieldErrors['ind-dateOfBirth']} onChange={v => handleIndividualChange('dateOfBirth', v)} />
          <SelectField id="ind-gender" label="Gender" placeholder="Prefer not to say" value={individualData.gender} options={GENDERS} onChange={v => handleIndividualChange('gender', v)} />
          <SelectField id="ind-nationality" label="Nationality" required placeholder="Select a nationality" value={individualData.nationality} options={COUNTRIES} error={fieldErrors['ind-nationality']} onChange={v => handleIndividualChange('nationality', v)} />
        </div>
      </Card>

      <Card title="Contact information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField id="ind-email" label="Email" type="email" required value={individualData.email} error={fieldErrors['ind-email']} onChange={v => handleIndividualChange('email', v)} />
          <TextField id="ind-phone" label="Phone number" type="tel" required placeholder="+353 1 234 5678" value={individualData.phone} error={fieldErrors['ind-phone']} onChange={v => handleIndividualChange('phone', v)} />
        </div>
      </Card>

      <Card title="Identity documents">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SelectField id="ind-identityType" label="ID type" required placeholder="Select an ID type" value={individualData.identityType} options={IDENTITY_TYPES} error={fieldErrors['ind-identityType']} onChange={v => handleIndividualChange('identityType', v)} />
          <TextField id="ind-identityNumber" label="ID number" required value={individualData.identityNumber} error={fieldErrors['ind-identityNumber']} onChange={v => handleIndividualChange('identityNumber', v)} />
          <TextField id="ind-identityExpiry" label="ID expiry date" type="date" value={individualData.identityExpiry} error={fieldErrors['ind-identityExpiry']} onChange={v => handleIndividualChange('identityExpiry', v)} />
          <TextField
            id="ind-taxReferenceNumber"
            label={
              individualData.country === 'IE'
                ? 'PPS number'
                : individualData.country === 'GB'
                  ? 'National insurance number'
                  : 'Tax reference number'
            }
            placeholder={
              individualData.country === 'IE'
                ? '1234567T'
                : individualData.country === 'GB'
                  ? 'AB123456C'
                  : undefined
            }
            value={individualData.taxReferenceNumber}
            error={fieldErrors['ind-taxReferenceNumber']}
            onChange={v => handleIndividualChange('taxReferenceNumber', v)}
          />
        </div>
      </Card>

      <Card title="Address">
        <div className="grid grid-cols-1 gap-5">
          <TextField id="ind-addressLine1" label="Address line 1" required value={individualData.addressLine1} error={fieldErrors['ind-addressLine1']} onChange={v => handleIndividualChange('addressLine1', v)} />
          <TextField id="ind-addressLine2" label="Address line 2" value={individualData.addressLine2} error={fieldErrors['ind-addressLine2']} onChange={v => handleIndividualChange('addressLine2', v)} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <TextField id="ind-city" label="City or town" required value={individualData.city} error={fieldErrors['ind-city']} onChange={v => handleIndividualChange('city', v)} />
            <TextField id="ind-county" label="County or region" value={individualData.county} error={fieldErrors['ind-county']} onChange={v => handleIndividualChange('county', v)} />
            <TextField id="ind-postcode" label={individualData.country === 'IE' ? 'Eircode' : 'Postcode'} placeholder={individualData.country === 'IE' ? 'D02 XY00' : undefined} value={individualData.postcode} error={fieldErrors['ind-postcode']} onChange={v => handleIndividualChange('postcode', v)} />
            <SelectField id="ind-country" label="Country" required placeholder="Select a country" value={individualData.country} options={COUNTRIES} error={fieldErrors['ind-country']} onChange={v => handleIndividualChange('country', v)} />
          </div>
        </div>
      </Card>

      {selectedSubtype !== 'SOLE_TRADER' && (
        <Card title="Employment information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SelectField id="ind-employmentStatus" label="Employment status" required placeholder="Select a status" value={individualData.employmentStatus} options={EMPLOYMENT_TYPES} error={fieldErrors['ind-employmentStatus']} onChange={v => handleIndividualChange('employmentStatus', v)} />
            <TextField id="ind-occupation" label="Occupation" value={individualData.occupation} error={fieldErrors['ind-occupation']} onChange={v => handleIndividualChange('occupation', v)} />
            {individualData.employmentStatus === 'EMPLOYED' && (
              <TextField id="ind-employerName" label="Employer name" value={individualData.employerName} error={fieldErrors['ind-employerName']} onChange={v => handleIndividualChange('employerName', v)} />
            )}
            <TextField
              id="ind-annualIncome"
              label={`Annual income (${getCurrencySymbol()})`}
              type="number"
              min="0"
              step="0.01"
              value={individualData.annualIncome}
              error={fieldErrors['ind-annualIncome']}
              onChange={v => handleIndividualChange('annualIncome', v)}
            />
          </div>
        </Card>
      )}

      {selectedSubtype === 'SOLE_TRADER' && (
        <Card title="Business details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TextField id="ent-tradingName" label="Trading name" required value={entityData.tradingName} error={fieldErrors['ent-tradingName']} onChange={v => handleEntityChange('tradingName', v)} />
            <TextField id="ent-taxNumber-st" label="Tax registration number" value={entityData.taxNumber} onChange={v => handleEntityChange('taxNumber', v)} />
            <TextField id="ent-vatNumber-st" label="VAT number" placeholder="IE1234567X" value={entityData.vatNumber} onChange={v => handleEntityChange('vatNumber', v)} />
            <TextField id="ent-industryCode-st" label="Industry or sector" value={entityData.industryCode} onChange={v => handleEntityChange('industryCode', v)} />
            <div className="md:col-span-2">
              <TextAreaField id="ent-businessDescription-st" label="Business description" value={entityData.businessDescription} onChange={v => handleEntityChange('businessDescription', v)} />
            </div>
            <TextField id="ent-annualTurnover-st" label={`Annual turnover (${getCurrencySymbol()})`} type="number" min="0" step="0.01" value={entityData.annualTurnover} onChange={v => handleEntityChange('annualTurnover', v)} />
          </div>
        </Card>
      )}

      {selectedSubtype === 'JOINT' && (
        <Card
          title="Joint account holders"
          description="Add anyone who will share this account."
          action={<SecondaryButton onClick={addJointHolder}>Add joint holder</SecondaryButton>}
        >
          {jointHolders.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--rm-text-muted)' }}>
              No joint holders added yet.
            </p>
          ) : (
            <ul className="space-y-5">
              {jointHolders.map((holder, index) => (
                <li
                  key={index}
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: 'var(--rm-input)' }}
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-base font-medium" style={{ color: 'var(--rm-text)' }}>
                      Joint holder {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeJointHolder(index)}
                      className="rounded-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
                    >
                      Remove holder
                      <span className="sr-only"> {index + 1}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <TextField id={`jh-${index}-firstName`} label="First name" required value={holder.firstName} error={fieldErrors[`jh-${index}-firstName`]} onChange={v => updateJointHolder(index, 'firstName', v)} />
                    <TextField id={`jh-${index}-lastName`} label="Last name" required value={holder.lastName} error={fieldErrors[`jh-${index}-lastName`]} onChange={v => updateJointHolder(index, 'lastName', v)} />
                    <SelectField id={`jh-${index}-relationship`} label="Relationship to primary holder" placeholder="Select a relationship" value={holder.relationship} options={RELATIONSHIPS} onChange={v => updateJointHolder(index, 'relationship', v)} />
                    <TextField id={`jh-${index}-email`} label="Email" type="email" required value={holder.email} error={fieldErrors[`jh-${index}-email`]} onChange={v => updateJointHolder(index, 'email', v)} />
                    <TextField id={`jh-${index}-phone`} label="Phone" type="tel" required value={holder.phone} error={fieldErrors[`jh-${index}-phone`]} onChange={v => updateJointHolder(index, 'phone', v)} />
                    <TextField id={`jh-${index}-dateOfBirth`} label="Date of birth" type="date" required value={holder.dateOfBirth} error={fieldErrors[`jh-${index}-dateOfBirth`]} onChange={v => updateJointHolder(index, 'dateOfBirth', v)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );

  const renderEntityForm = () => {
    const subtypeOptions =
      selectedSubtype === 'COMPANY'
        ? COMPANY_TYPES
        : selectedSubtype === 'PARTNERSHIP'
          ? PARTNERSHIP_TYPES
          : selectedSubtype === 'FUND'
            ? FUND_TYPES
            : null;

    return (
      <div className="space-y-6">
        {subtypeOptions && (
          <Card
            title={
              selectedSubtype === 'COMPANY'
                ? 'Company type'
                : selectedSubtype === 'PARTNERSHIP'
                  ? 'Partnership type'
                  : 'Fund type'
            }
          >
            <fieldset>
              <legend className="sr-only">Entity legal form</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subtypeOptions.map(type => {
                  const checked = entityData.entitySubtype === type.value;
                  return (
                    <label
                      key={type.value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl px-5 py-4"
                      style={{
                        backgroundColor: checked ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                      }}
                    >
                      <input
                        type="radio"
                        name="entitySubtype"
                        value={type.value}
                        checked={checked}
                        onChange={e => handleEntityChange('entitySubtype', e.target.value)}
                        style={{ accentColor: 'var(--rm-accent)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--rm-text)' }}>
                        {type.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Card>
        )}

        <Card title="Basic information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TextField id="ent-legalName" label="Legal name" required value={entityData.legalName} error={fieldErrors['ent-legalName']} onChange={v => handleEntityChange('legalName', v)} />
            <TextField id="ent-tradingName" label="Trading name" placeholder="If different from the legal name" value={entityData.tradingName} onChange={v => handleEntityChange('tradingName', v)} />
            <TextField
              id={selectedSubtype === 'CHARITY' ? 'ent-charityNumber' : 'ent-registrationNumber'}
              label={selectedSubtype === 'CHARITY' ? 'CHY number' : 'Registration number'}
              required
              placeholder={selectedSubtype === 'COMPANY' ? 'CRO number' : undefined}
              value={
                selectedSubtype === 'CHARITY'
                  ? entityData.charityNumber
                  : entityData.registrationNumber
              }
              error={
                fieldErrors[
                  selectedSubtype === 'CHARITY' ? 'ent-charityNumber' : 'ent-registrationNumber'
                ]
              }
              onChange={v =>
                handleEntityChange(
                  selectedSubtype === 'CHARITY' ? 'charityNumber' : 'registrationNumber',
                  v
                )
              }
            />
            <TextField id="ent-taxNumber" label="Tax number" value={entityData.taxNumber} onChange={v => handleEntityChange('taxNumber', v)} />
            <TextField id="ent-vatNumber" label="VAT number" placeholder="IE1234567X" value={entityData.vatNumber} onChange={v => handleEntityChange('vatNumber', v)} />
            <TextField id="ent-dateOfIncorporation" label="Date of incorporation" type="date" required value={entityData.dateOfIncorporation} error={fieldErrors['ent-dateOfIncorporation']} onChange={v => handleEntityChange('dateOfIncorporation', v)} />
            <SelectField id="ent-countryOfIncorporation" label="Country of incorporation" required placeholder="Select a country" value={entityData.countryOfIncorporation} options={COUNTRIES} error={fieldErrors['ent-countryOfIncorporation']} onChange={v => handleEntityChange('countryOfIncorporation', v)} />
          </div>
        </Card>

        <Card title="Contact information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <TextField id="ent-businessEmail" label="Business email" type="email" required value={entityData.businessEmail} error={fieldErrors['ent-businessEmail']} onChange={v => handleEntityChange('businessEmail', v)} />
            <TextField id="ent-businessPhone" label="Business phone" type="tel" required value={entityData.businessPhone} error={fieldErrors['ent-businessPhone']} onChange={v => handleEntityChange('businessPhone', v)} />
            <TextField id="ent-website" label="Website" type="url" placeholder="https://" value={entityData.website} onChange={v => handleEntityChange('website', v)} />
          </div>
        </Card>

        <Card title="Registered address">
          <div className="grid grid-cols-1 gap-5">
            <TextField id="ent-registeredAddressLine1" label="Address line 1" required value={entityData.registeredAddressLine1} error={fieldErrors['ent-registeredAddressLine1']} onChange={v => handleEntityChange('registeredAddressLine1', v)} />
            <TextField id="ent-registeredAddressLine2" label="Address line 2" value={entityData.registeredAddressLine2} onChange={v => handleEntityChange('registeredAddressLine2', v)} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <TextField id="ent-registeredCity" label="City" required value={entityData.registeredCity} error={fieldErrors['ent-registeredCity']} onChange={v => handleEntityChange('registeredCity', v)} />
              <TextField id="ent-registeredCounty" label="County" value={entityData.registeredCounty} onChange={v => handleEntityChange('registeredCounty', v)} />
              <TextField id="ent-registeredPostcode" label={entityData.registeredCountry === 'IE' ? 'Eircode' : 'Postcode'} value={entityData.registeredPostcode} onChange={v => handleEntityChange('registeredPostcode', v)} />
              <SelectField id="ent-registeredCountry" label="Country" required placeholder="Select a country" value={entityData.registeredCountry} options={COUNTRIES} error={fieldErrors['ent-registeredCountry']} onChange={v => handleEntityChange('registeredCountry', v)} />
            </div>
          </div>
        </Card>

        <Card title="Trading address">
          <label
            htmlFor="ent-sameAsRegistered"
            className="flex items-center gap-3 cursor-pointer mb-5"
          >
            <input
              id="ent-sameAsRegistered"
              type="checkbox"
              checked={entityData.sameAsRegistered}
              onChange={e => handleEntityChange('sameAsRegistered', e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: 'var(--rm-accent)' }}
            />
            <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
              Same as the registered address
            </span>
          </label>

          {!entityData.sameAsRegistered && (
            <div className="grid grid-cols-1 gap-5">
              <TextField id="ent-tradingAddressLine1" label="Address line 1" required value={entityData.tradingAddressLine1} error={fieldErrors['ent-tradingAddressLine1']} onChange={v => handleEntityChange('tradingAddressLine1', v)} />
              <TextField id="ent-tradingAddressLine2" label="Address line 2" value={entityData.tradingAddressLine2} onChange={v => handleEntityChange('tradingAddressLine2', v)} />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <TextField id="ent-tradingCity" label="City" required value={entityData.tradingCity} error={fieldErrors['ent-tradingCity']} onChange={v => handleEntityChange('tradingCity', v)} />
                <TextField id="ent-tradingCounty" label="County" value={entityData.tradingCounty} onChange={v => handleEntityChange('tradingCounty', v)} />
                <TextField id="ent-tradingPostcode" label={entityData.tradingCountry === 'IE' ? 'Eircode' : 'Postcode'} value={entityData.tradingPostcode} onChange={v => handleEntityChange('tradingPostcode', v)} />
                <SelectField id="ent-tradingCountry" label="Country" required placeholder="Select a country" value={entityData.tradingCountry} options={COUNTRIES} error={fieldErrors['ent-tradingCountry']} onChange={v => handleEntityChange('tradingCountry', v)} />
              </div>
            </div>
          )}
        </Card>

        <Card title="Business details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TextField id="ent-industryCode" label="Industry or sector" value={entityData.industryCode} onChange={v => handleEntityChange('industryCode', v)} />
            <TextField id="ent-numberOfEmployees" label="Number of employees" type="number" min="0" step="1" value={entityData.numberOfEmployees} onChange={v => handleEntityChange('numberOfEmployees', v)} />
            <TextField id="ent-annualTurnover" label={`Annual turnover (${getCurrencySymbol()})`} type="number" min="0" step="0.01" value={entityData.annualTurnover} onChange={v => handleEntityChange('annualTurnover', v)} />
            <div className="md:col-span-2">
              <TextAreaField id="ent-businessDescription" label="Business description" value={entityData.businessDescription} onChange={v => handleEntityChange('businessDescription', v)} />
            </div>
          </div>
        </Card>

        <Card
          title="Key people"
          description="Add directors, shareholders, partners or other key individuals."
          action={
            <SecondaryButton
              onClick={() => {
                setMemberError(null);
                setShowAddMemberModal(true);
              }}
            >
              Add person
            </SecondaryButton>
          }
        >
          {entityData.members.length === 0 ? (
            <div
              className="rounded-2xl py-10 text-center"
              style={{ border: '1px dashed var(--rm-border)' }}
            >
              <svg
                className="mx-auto h-8 w-8"
                style={{ color: 'var(--rm-text-muted)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3"
                />
              </svg>
              <p className="mt-3 text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                No key people added yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {entityData.members.map(member => {
                const roleLabel =
                  MEMBER_ROLES[selectedSubtype || '']?.find(r => r.value === member.role)?.label ||
                  member.role;
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
                    style={{ backgroundColor: 'var(--rm-input)' }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        style={{
                          backgroundColor: 'var(--rm-accent-muted)',
                          color: 'var(--rm-accent)',
                        }}
                        aria-hidden="true"
                      >
                        {(member.customerName?.charAt(0) || '?').toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span
                          className="block truncate text-base font-medium"
                          style={{ color: 'var(--rm-text)' }}
                        >
                          {member.customerName}
                        </span>
                        <span className="block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                          {roleLabel}
                          {member.ownershipPercentage != null &&
                            ` · ${member.ownershipPercentage}% ownership`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {member.isSignatory && <Tag>Signatory</Tag>}
                      {member.isPrimaryContact && <Tag>Primary contact</Tag>}
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        aria-label={`Remove ${member.customerName || 'this person'}`}
                        className="rounded-full p-2 text-red-600 dark:text-red-400 transition-opacity hover:opacity-80"
                        style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    );
  };

  const renderReview = () => (
    <div className="space-y-6">
      <Card title="Review the details" description="Check everything before creating the record.">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <ReviewFact label="Customer type" value={`${categoryMeta?.label || '—'} · ${subtypeMeta?.label || '—'}`} />
          {selectedCategory === 'INDIVIDUAL' ? (
            <>
              <ReviewFact
                label="Name"
                value={`${individualData.firstName} ${individualData.lastName}`.trim() || '—'}
              />
              <ReviewFact label="Email" value={individualData.email || '—'} />
              <ReviewFact label="Phone" value={individualData.phone || '—'} />
              <ReviewFact label="Date of birth" value={individualData.dateOfBirth || '—'} />
              <ReviewFact
                label="Address"
                value={
                  [
                    individualData.addressLine1,
                    individualData.city,
                    individualData.postcode,
                    COUNTRIES.find(c => c.value === individualData.country)?.label,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              {selectedSubtype === 'JOINT' && (
                <ReviewFact
                  label="Joint holders"
                  value={`${jointHolders.length} added`}
                />
              )}
            </>
          ) : (
            <>
              <ReviewFact label="Legal name" value={entityData.legalName || '—'} />
              <ReviewFact
                label={selectedSubtype === 'CHARITY' ? 'CHY number' : 'Registration number'}
                value={entityData.registrationNumber || entityData.charityNumber || '—'}
              />
              <ReviewFact label="Business email" value={entityData.businessEmail || '—'} />
              <ReviewFact
                label="Key people"
                value={`${entityData.members.length} added`}
              />
            </>
          )}
        </dl>
      </Card>

      <div className="flex justify-between gap-3 flex-wrap">
        <SecondaryButton onClick={() => setStep(2)}>Back to details</SecondaryButton>
        <PrimaryButton onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create customer'}
        </PrimaryButton>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-3xl p-7" style={{ backgroundColor: 'var(--rm-card)' }}>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg"
          style={{ color: 'var(--rm-text-muted)' }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to customers
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--rm-text)' }}
            >
              Add customer
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--rm-text-muted)' }}>
              {categoryMeta && subtypeMeta
                ? `${categoryMeta.label} · ${subtypeMeta.label}`
                : 'Choose a customer type to begin onboarding.'}
            </p>
          </div>

          {selectedCategory && (
            <ol
              aria-label="Progress"
              className="flex items-center gap-2 flex-wrap"
              style={{ color: 'var(--rm-text-muted)' }}
            >
              {steps.map((s, i) => (
                <li key={s.n} className="flex items-center gap-2">
                  <span
                    aria-current={step === s.n ? 'step' : undefined}
                    className="rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums"
                    style={{
                      backgroundColor:
                        step === s.n ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                      color: step === s.n ? 'var(--rm-accent)' : 'var(--rm-text-muted)',
                    }}
                  >
                    {s.n}. {s.label}
                    {step === s.n && <span className="sr-only"> (current step)</span>}
                  </span>
                  {i < steps.length - 1 && (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-3xl px-6 py-5 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.10)' }}
        >
          <svg
            className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm" style={{ color: 'var(--rm-text)' }}>
            {error}
          </p>
        </div>
      )}

      {!selectedCategory && renderCategorySelection()}
      {selectedCategory && !selectedSubtype && renderSubtypeSelection()}

      {selectedCategory && selectedSubtype && step === 2 && (
        <div className="space-y-6">
          {selectedCategory === 'INDIVIDUAL' ? renderIndividualForm() : renderEntityForm()}
          <div className="flex justify-between gap-3 flex-wrap">
            <SecondaryButton onClick={() => setSelectedSubtype(null)}>Back</SecondaryButton>
            <PrimaryButton onClick={goToReview}>Review details</PrimaryButton>
          </div>
        </div>
      )}

      {selectedCategory && selectedSubtype && step === 3 && renderReview()}

      {/* Add key person dialog */}
      {showAddMemberModal && (
        <Dialog
          title="Add a key person"
          onClose={resetMemberForm}
          footer={
            <>
              <SecondaryButton onClick={resetMemberForm}>Cancel</SecondaryButton>
              {addMemberType === 'new' && (
                <PrimaryButton onClick={addNewMember}>Add person</PrimaryButton>
              )}
            </>
          }
        >
          <div className="space-y-5">
            <SelectField
              id="member-role"
              label="Role"
              required
              placeholder="Select a role"
              value={selectedMemberRole}
              options={MEMBER_ROLES[selectedSubtype || ''] || []}
              onChange={v => {
                setSelectedMemberRole(v);
                setMemberError(null);
              }}
            />

            <div
              role="group"
              aria-label="How to add the person"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {(
                [
                  { key: 'existing' as const, label: 'Search an existing customer' },
                  { key: 'new' as const, label: 'Add a new person' },
                ]
              ).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setAddMemberType(opt.key);
                    setMemberError(null);
                  }}
                  aria-pressed={addMemberType === opt.key}
                  className="rounded-2xl px-5 py-4 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor:
                      addMemberType === opt.key ? 'var(--rm-accent-muted)' : 'var(--rm-input)',
                    color:
                      addMemberType === opt.key ? 'var(--rm-accent)' : 'var(--rm-text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {addMemberType === 'existing' ? (
              <div>
                <Label id="member-search" label="Search customers" />
                <input
                  id="member-search"
                  type="search"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    searchExistingCustomers(e.target.value);
                  }}
                  placeholder="Search by name or email"
                  className={FIELD_CLASS}
                  style={FIELD_STYLE}
                  aria-describedby="member-search-status"
                />
                <p
                  id="member-search-status"
                  role="status"
                  className="text-xs mt-2"
                  style={{ color: 'var(--rm-text-muted)' }}
                >
                  {isSearching
                    ? 'Searching…'
                    : searchQuery.length < 2
                      ? 'Type at least two characters to search.'
                      : `${searchResults.length} match${searchResults.length === 1 ? '' : 'es'} found.`}
                </p>
                {searchError && (
                  <p
                    role="alert"
                    className="rounded-2xl px-5 py-4 text-sm mt-3"
                    style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
                  >
                    {searchError}
                  </p>
                )}
                {searchResults.length > 0 && (
                  <ul
                    className="mt-3 overflow-y-auto rounded-2xl"
                    style={{ maxHeight: '12rem', backgroundColor: 'var(--rm-input)' }}
                  >
                    {searchResults.map(customer => (
                      <li key={customer.customerId}>
                        <button
                          type="button"
                          onClick={() => addExistingMember(customer)}
                          className="w-full px-5 py-4 text-left transition-opacity hover:opacity-80"
                          style={{ borderBottom: '1px solid var(--rm-border)' }}
                        >
                          <span
                            className="block text-base font-medium"
                            style={{ color: 'var(--rm-text)' }}
                          >
                            {`${customer.firstName} ${customer.lastName}`.trim()}
                          </span>
                          <span className="block text-sm" style={{ color: 'var(--rm-text-muted)' }}>
                            {customer.email || customer.customerNumber}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <TextField
                  id="nm-firstName"
                  label="First name"
                  required
                  value={newMemberData.firstName}
                  onChange={v => setNewMemberData(prev => ({ ...prev, firstName: v }))}
                />
                <TextField
                  id="nm-lastName"
                  label="Last name"
                  required
                  value={newMemberData.lastName}
                  onChange={v => setNewMemberData(prev => ({ ...prev, lastName: v }))}
                />
                <TextField
                  id="nm-email"
                  label="Email"
                  type="email"
                  value={newMemberData.email}
                  onChange={v => setNewMemberData(prev => ({ ...prev, email: v }))}
                />
                <TextField
                  id="nm-phone"
                  label="Phone"
                  type="tel"
                  value={newMemberData.phone}
                  onChange={v => setNewMemberData(prev => ({ ...prev, phone: v }))}
                />
                <TextField
                  id="nm-dateOfBirth"
                  label="Date of birth"
                  type="date"
                  value={newMemberData.dateOfBirth}
                  onChange={v => setNewMemberData(prev => ({ ...prev, dateOfBirth: v }))}
                />
                <SelectField
                  id="nm-nationality"
                  label="Nationality"
                  placeholder="Select a nationality"
                  value={newMemberData.nationality}
                  options={COUNTRIES}
                  onChange={v => setNewMemberData(prev => ({ ...prev, nationality: v }))}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <TextField
                id="member-ownership"
                label="Ownership percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={memberOwnership}
                onChange={setMemberOwnership}
              />
              <div className="flex items-end gap-5">
                <label
                  htmlFor="member-isSignatory"
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <input
                    id="member-isSignatory"
                    type="checkbox"
                    checked={memberIsSignatory}
                    onChange={e => setMemberIsSignatory(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--rm-accent)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    Signatory
                  </span>
                </label>
                <label
                  htmlFor="member-isPrimaryContact"
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <input
                    id="member-isPrimaryContact"
                    type="checkbox"
                    checked={memberIsPrimaryContact}
                    onChange={e => setMemberIsPrimaryContact(e.target.checked)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--rm-accent)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--rm-text-secondary)' }}>
                    Primary contact
                  </span>
                </label>
              </div>
            </div>

            {memberError && (
              <p
                role="alert"
                className="rounded-2xl px-5 py-4 text-sm"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--rm-text)' }}
              >
                {memberError}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ============================================
// Small presentational helpers
// ============================================

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-medium"
      style={{ backgroundColor: 'var(--rm-accent-muted)', color: 'var(--rm-accent)' }}
    >
      {children}
    </span>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: 'var(--rm-text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-medium" style={{ color: 'var(--rm-text)' }}>
        {value}
      </dd>
    </div>
  );
}

function CategoryIcon({ value }: { value: CustomerCategory }) {
  const common = {
    className: 'w-5 h-5',
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24',
    strokeWidth: 1.8,
    'aria-hidden': true,
  } as const;
  if (value === 'INDIVIDUAL')
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z"
        />
      </svg>
    );
  if (value === 'BUSINESS')
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 21V7.5l7.5-4.5 7.5 4.5V21M9 9h1.5m-1.5 4h1.5m3.75-4H15m-1.5 4H15"
        />
      </svg>
    );
  if (value === 'NON_PROFIT')
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    );
  return (
    <svg {...common}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6v3H3V9zM3 21h18"
      />
    </svg>
  );
}
