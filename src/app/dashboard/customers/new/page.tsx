'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { RootState } from '@/store';
import apiClient from '@/lib/api-client';

// ============================================
// TYPE DEFINITIONS
// ============================================

// Main Customer Categories
type CustomerCategory = 'INDIVIDUAL' | 'BUSINESS' | 'NON_PROFIT' | 'INSTITUTIONAL';

// Subtypes for each category
type IndividualSubtype = 'PERSONAL' | 'JOINT' | 'SOLE_TRADER';
type BusinessSubtype = 'COMPANY' | 'PARTNERSHIP';
type NonProfitSubtype = 'CHARITY' | 'CLUB' | 'ASSOCIATION';
type InstitutionalSubtype = 'FUND' | 'GOVERNMENT' | 'CREDIT_UNION';

type CustomerSubtype =
  | IndividualSubtype
  | BusinessSubtype
  | NonProfitSubtype
  | InstitutionalSubtype;

// Category Configuration
const CUSTOMER_CATEGORIES = [
  {
    value: 'INDIVIDUAL' as CustomerCategory,
    label: 'Individual',
    icon: '👤',
    description: 'Personal accounts for individuals',
    subtypes: [
      { value: 'PERSONAL', label: 'Personal', description: 'Single individual account holder' },
      { value: 'JOINT', label: 'Joint', description: 'Two or more individuals sharing an account' },
      {
        value: 'SOLE_TRADER',
        label: 'Sole Trader',
        description: 'Self-employed individual trading under a business name',
      },
    ],
  },
  {
    value: 'BUSINESS' as CustomerCategory,
    label: 'Business',
    icon: '🏢',
    description: 'Commercial and corporate entities',
    subtypes: [
      { value: 'COMPANY', label: 'Company', description: 'Limited company (Ltd, PLC, LLP, DAC)' },
      { value: 'PARTNERSHIP', label: 'Partnership', description: 'General or limited partnership' },
    ],
  },
  {
    value: 'NON_PROFIT' as CustomerCategory,
    label: 'Non-Profit',
    icon: '💚',
    description: 'Charitable and community organizations',
    subtypes: [
      { value: 'CHARITY', label: 'Charity', description: 'Registered charitable organization' },
      { value: 'CLUB', label: 'Club', description: 'Sports, social, or members club' },
      {
        value: 'ASSOCIATION',
        label: 'Association',
        description: 'Trade, professional, or community association',
      },
    ],
  },
  {
    value: 'INSTITUTIONAL' as CustomerCategory,
    label: 'Institutional',
    icon: '🏛️',
    description: 'Financial and governmental institutions',
    subtypes: [
      { value: 'FUND', label: 'Fund', description: 'Investment fund, pension fund, or trust' },
      { value: 'GOVERNMENT', label: 'Government', description: 'Government body or agency' },
      {
        value: 'CREDIT_UNION',
        label: 'Credit Union',
        description: 'Credit union or cooperative financial institution',
      },
    ],
  },
];

// Company Types (for COMPANY subtype)
const COMPANY_TYPES = [
  { value: 'PRIVATE_LIMITED', label: 'Private Company Limited by Shares (Ltd)' },
  { value: 'PUBLIC_LIMITED', label: 'Public Limited Company (PLC)' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited Liability Partnership (LLP)' },
  { value: 'DESIGNATED_ACTIVITY', label: 'Designated Activity Company (DAC)' },
  { value: 'COMPANY_LIMITED_GUARANTEE', label: 'Company Limited by Guarantee (CLG)' },
  { value: 'UNLIMITED', label: 'Unlimited Company' },
];

// Partnership Types (for PARTNERSHIP subtype)
const PARTNERSHIP_TYPES = [
  { value: 'GENERAL_PARTNERSHIP', label: 'General Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited Partnership (LP)' },
  { value: 'INVESTMENT_LIMITED_PARTNERSHIP', label: 'Investment Limited Partnership (ILP)' },
];

// Fund Types (for FUND subtype)
const FUND_TYPES = [
  { value: 'UCITS', label: 'UCITS Fund' },
  { value: 'AIF', label: 'Alternative Investment Fund (AIF)' },
  { value: 'PENSION_FUND', label: 'Pension Fund' },
  { value: 'INVESTMENT_TRUST', label: 'Investment Trust' },
  { value: 'UNIT_TRUST', label: 'Unit Trust' },
];

// Member roles based on entity subtype
const MEMBER_ROLES: Record<string, { value: string; label: string }[]> = {
  // Individual - Joint Account
  JOINT: [
    { value: 'PRIMARY_HOLDER', label: 'Primary Account Holder' },
    { value: 'JOINT_HOLDER', label: 'Joint Account Holder' },
  ],
  // Business - Company
  COMPANY: [
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'COMPANY_SECRETARY', label: 'Company Secretary' },
    { value: 'SHAREHOLDER', label: 'Shareholder' },
    { value: 'BENEFICIAL_OWNER', label: 'Beneficial Owner (UBO)' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
  // Business - Partnership
  PARTNERSHIP: [
    { value: 'GENERAL_PARTNER', label: 'General Partner' },
    { value: 'LIMITED_PARTNER', label: 'Limited Partner' },
    { value: 'MANAGING_PARTNER', label: 'Managing Partner' },
    { value: 'BENEFICIAL_OWNER', label: 'Beneficial Owner (UBO)' },
  ],
  // Non-Profit - Charity
  CHARITY: [
    { value: 'TRUSTEE', label: 'Trustee' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'CHAIRPERSON', label: 'Chairperson' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
  // Non-Profit - Club
  CLUB: [
    { value: 'CHAIRPERSON', label: 'Chairperson / President' },
    { value: 'VICE_CHAIRPERSON', label: 'Vice Chairperson' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'COMMITTEE_MEMBER', label: 'Committee Member' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
  // Non-Profit - Association
  ASSOCIATION: [
    { value: 'PRESIDENT', label: 'President' },
    { value: 'VICE_PRESIDENT', label: 'Vice President' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'BOARD_MEMBER', label: 'Board Member' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
  // Institutional - Fund
  FUND: [
    { value: 'FUND_MANAGER', label: 'Fund Manager' },
    { value: 'INVESTMENT_MANAGER', label: 'Investment Manager' },
    { value: 'TRUSTEE', label: 'Trustee' },
    { value: 'CUSTODIAN', label: 'Custodian' },
    { value: 'ADMINISTRATOR', label: 'Administrator' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
  // Institutional - Government
  GOVERNMENT: [
    { value: 'AUTHORISED_OFFICER', label: 'Authorised Officer' },
    { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
    { value: 'FINANCE_OFFICER', label: 'Finance Officer' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
  // Institutional - Credit Union
  CREDIT_UNION: [
    { value: 'CHAIRPERSON', label: 'Chairperson' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'SUPERVISORY_COMMITTEE', label: 'Supervisory Committee Member' },
    { value: 'AUTHORISED_SIGNATORY', label: 'Authorised Signatory' },
  ],
};

// Identity Document Types (EU/UK/Ireland)
const IDENTITY_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National Identity Card' },
  { value: 'DRIVING_LICENCE', label: 'Driving Licence' },
  { value: 'RESIDENCE_PERMIT', label: 'Residence Permit' },
];

// Countries
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

// Employment Types
const EMPLOYMENT_TYPES = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
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
  appointmentDate?: string;
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

  const [individualData, setIndividualData] = useState<IndividualFormData>({
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
  });

  const [jointHolders, setJointHolders] = useState<JointHolderData[]>([]);

  const [entityData, setEntityData] = useState<EntityFormData>({
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
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExistingCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberType, setAddMemberType] = useState<'existing' | 'new'>('existing');
  const [newMemberData, setNewMemberData] = useState<IndividualFormData>({
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
  });
  const [selectedMemberRole, setSelectedMemberRole] = useState('');
  const [memberOwnership, setMemberOwnership] = useState('');
  const [memberIsSignatory, setMemberIsSignatory] = useState(false);
  const [memberIsPrimaryContact, setMemberIsPrimaryContact] = useState(false);

  const handleCategorySelect = (category: CustomerCategory) => {
    setSelectedCategory(category);
    setSelectedSubtype(null);
    setStep(1);
  };

  const handleSubtypeSelect = (subtype: CustomerSubtype) => {
    setSelectedSubtype(subtype);
    setStep(2);
    if (subtype === 'COMPANY')
      setEntityData(prev => ({ ...prev, entitySubtype: 'PRIVATE_LIMITED' }));
    else if (subtype === 'PARTNERSHIP')
      setEntityData(prev => ({ ...prev, entitySubtype: 'GENERAL_PARTNERSHIP' }));
    else if (subtype === 'FUND') setEntityData(prev => ({ ...prev, entitySubtype: 'AIF' }));
  };

  const handleIndividualChange = (field: keyof IndividualFormData, value: string) => {
    setIndividualData(prev => ({ ...prev, [field]: value }));
  };

  const handleEntityChange = (field: keyof EntityFormData, value: string | boolean) => {
    setEntityData(prev => ({ ...prev, [field]: value }));
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
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await apiClient.get(
        `/api/admin/customers/search?q=${encodeURIComponent(query)}`
      );
      setSearchResults(response.data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addJointHolder = () => {
    setJointHolders(prev => [
      ...prev,
      {
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
        relationship: '',
      },
    ]);
  };

  const removeJointHolder = (index: number) =>
    setJointHolders(prev => prev.filter((_, i) => i !== index));

  const updateJointHolder = (index: number, field: keyof JointHolderData, value: string) => {
    setJointHolders(prev =>
      prev.map((holder, i) => (i === index ? { ...holder, [field]: value } : holder))
    );
  };

  const addExistingMember = (customer: ExistingCustomer) => {
    const newMember: EntityMember = {
      id: `member-${Date.now()}`,
      customerId: customer.customerId,
      customerName: `${customer.firstName} ${customer.lastName}`,
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
    const newMember: EntityMember = {
      id: `member-${Date.now()}`,
      customerName: `${newMemberData.firstName} ${newMemberData.lastName}`,
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
    setSelectedMemberRole('');
    setMemberOwnership('');
    setMemberIsSignatory(false);
    setMemberIsPrimaryContact(false);
    setNewMemberData({
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
    });
  };

  const handleSubmit = async () => {
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
        toast.success('Customer created successfully!');
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
            const customerResponse = await apiClient.post('/api/admin/customers', newCustomerData);
            await apiClient.post(`/api/admin/entities/${entityId}/members`, {
              customerId: customerResponse.data.customerId,
              role: member.role,
              ownershipPercentage: member.ownershipPercentage,
              isSignatory: member.isSignatory,
              isPrimaryContact: member.isPrimaryContact,
            });
          }
        }
        toast.success('Entity created successfully!');
        router.push(`/dashboard/entities/${entityId}`);
      }
    } catch (err: unknown) {
      console.error('Error creating customer/entity:', err);
      setError(err instanceof Error ? err.message : 'Failed to create. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategorySelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Select Customer Type</h2>
        <p className="mt-2 text-gray-600">Choose the category that best describes your customer</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CUSTOMER_CATEGORIES.map(category => (
          <button
            key={category.value}
            onClick={() => handleCategorySelect(category.value)}
            className={`p-6 border-2 rounded-xl text-left transition-all hover:shadow-lg ${
              selectedCategory === category.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{category.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{category.label}</h3>
                <p className="text-sm text-gray-500">{category.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSubtypeSelection = () => {
    const category = CUSTOMER_CATEGORIES.find(c => c.value === selectedCategory);
    if (!category) return null;
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Select {category.label} Type</h2>
          <p className="mt-2 text-gray-600">
            Choose the specific type of {category.label.toLowerCase()}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {category.subtypes.map(subtype => (
            <button
              key={subtype.value}
              onClick={() => handleSubtypeSelect(subtype.value as CustomerSubtype)}
              className={`p-6 border-2 rounded-xl text-left transition-all hover:shadow-lg ${
                selectedSubtype === subtype.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <h3 className="text-lg font-semibold text-gray-900">{subtype.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{subtype.description}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-start">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to categories
          </button>
        </div>
      </div>
    );
  };

  const renderIndividualForm = () => (
    <div className="space-y-8">
      {/* Personal Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              type="text"
              value={individualData.firstName}
              onChange={e => handleIndividualChange('firstName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
            <input
              type="text"
              value={individualData.middleName}
              onChange={e => handleIndividualChange('middleName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input
              type="text"
              value={individualData.lastName}
              onChange={e => handleIndividualChange('lastName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
            <input
              type="date"
              value={individualData.dateOfBirth}
              onChange={e => handleIndividualChange('dateOfBirth', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select
              value={individualData.gender}
              onChange={e => handleIndividualChange('gender', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nationality *</label>
            <select
              value={individualData.nationality}
              onChange={e => handleIndividualChange('nationality', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {COUNTRIES.map(country => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={individualData.email}
              onChange={e => handleIndividualChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              value={individualData.phone}
              onChange={e => handleIndividualChange('phone', e.target.value)}
              placeholder="+353 1 234 5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>
      </div>

      {/* Identity Documents */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Identity Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Type *</label>
            <select
              value={individualData.identityType}
              onChange={e => handleIndividualChange('identityType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {IDENTITY_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Number *</label>
            <input
              type="text"
              value={individualData.identityNumber}
              onChange={e => handleIndividualChange('identityNumber', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Expiry Date</label>
            <input
              type="date"
              value={individualData.identityExpiry}
              onChange={e => handleIndividualChange('identityExpiry', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {individualData.country === 'IE'
                ? 'PPS Number'
                : individualData.country === 'GB'
                  ? 'National Insurance Number'
                  : 'Tax Reference Number'}
            </label>
            <input
              type="text"
              value={individualData.taxReferenceNumber}
              onChange={e => handleIndividualChange('taxReferenceNumber', e.target.value)}
              placeholder={
                individualData.country === 'IE'
                  ? '1234567T'
                  : individualData.country === 'GB'
                    ? 'AB123456C'
                    : ''
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Address</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
            <input
              type="text"
              value={individualData.addressLine1}
              onChange={e => handleIndividualChange('addressLine1', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={individualData.addressLine2}
              onChange={e => handleIndividualChange('addressLine2', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City/Town *</label>
              <input
                type="text"
                value={individualData.city}
                onChange={e => handleIndividualChange('city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County/Region</label>
              <input
                type="text"
                value={individualData.county}
                onChange={e => handleIndividualChange('county', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {individualData.country === 'IE' ? 'Eircode' : 'Postcode'}
              </label>
              <input
                type="text"
                value={individualData.postcode}
                onChange={e => handleIndividualChange('postcode', e.target.value)}
                placeholder={individualData.country === 'IE' ? 'D02 XY00' : ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
              <select
                value={individualData.country}
                onChange={e => handleIndividualChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {COUNTRIES.map(country => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Employment */}
      {selectedSubtype !== 'SOLE_TRADER' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Status *
              </label>
              <select
                value={individualData.employmentStatus}
                onChange={e => handleIndividualChange('employmentStatus', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select status</option>
                {EMPLOYMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
              <input
                type="text"
                value={individualData.occupation}
                onChange={e => handleIndividualChange('occupation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {individualData.employmentStatus === 'EMPLOYED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employer Name
                </label>
                <input
                  type="text"
                  value={individualData.employerName}
                  onChange={e => handleIndividualChange('employerName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual Income (€)
              </label>
              <input
                type="number"
                value={individualData.annualIncome}
                onChange={e => handleIndividualChange('annualIncome', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sole Trader Business Details */}
      {selectedSubtype === 'SOLE_TRADER' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name *</label>
              <input
                type="text"
                value={entityData.tradingName}
                onChange={e => handleEntityChange('tradingName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Registration Number
              </label>
              <input
                type="text"
                value={entityData.taxNumber}
                onChange={e => handleEntityChange('taxNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
              <input
                type="text"
                value={entityData.vatNumber}
                onChange={e => handleEntityChange('vatNumber', e.target.value)}
                placeholder="IE1234567X"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry/Sector
              </label>
              <input
                type="text"
                value={entityData.industryCode}
                onChange={e => handleEntityChange('industryCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Description
              </label>
              <textarea
                value={entityData.businessDescription}
                onChange={e => handleEntityChange('businessDescription', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual Turnover (€)
              </label>
              <input
                type="number"
                value={entityData.annualTurnover}
                onChange={e => handleEntityChange('annualTurnover', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Joint Account Holders */}
      {selectedSubtype === 'JOINT' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Joint Account Holders</h3>
            <button
              type="button"
              onClick={addJointHolder}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Add Joint Holder
            </button>
          </div>
          {jointHolders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No joint holders added yet. Click the button above to add a joint account holder.
            </p>
          ) : (
            <div className="space-y-6">
              {jointHolders.map((holder, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-900">Joint Holder {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeJointHolder(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={holder.firstName}
                        onChange={e => updateJointHolder(index, 'firstName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={holder.lastName}
                        onChange={e => updateJointHolder(index, 'lastName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Relationship
                      </label>
                      <select
                        value={holder.relationship}
                        onChange={e => updateJointHolder(index, 'relationship', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select relationship</option>
                        <option value="SPOUSE">Spouse</option>
                        <option value="PARTNER">Partner</option>
                        <option value="PARENT">Parent</option>
                        <option value="CHILD">Child</option>
                        <option value="SIBLING">Sibling</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={holder.email}
                        onChange={e => updateJointHolder(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={holder.phone}
                        onChange={e => updateJointHolder(index, 'phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Birth *
                      </label>
                      <input
                        type="date"
                        value={holder.dateOfBirth}
                        onChange={e => updateJointHolder(index, 'dateOfBirth', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderEntityForm = () => (
    <div className="space-y-8">
      {/* Entity Type Selection */}
      {(selectedSubtype === 'COMPANY' ||
        selectedSubtype === 'PARTNERSHIP' ||
        selectedSubtype === 'FUND') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedSubtype === 'COMPANY'
              ? 'Company Type'
              : selectedSubtype === 'PARTNERSHIP'
                ? 'Partnership Type'
                : 'Fund Type'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(selectedSubtype === 'COMPANY'
              ? COMPANY_TYPES
              : selectedSubtype === 'PARTNERSHIP'
                ? PARTNERSHIP_TYPES
                : FUND_TYPES
            ).map(type => (
              <label
                key={type.value}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  entityData.entitySubtype === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="entitySubtype"
                  value={type.value}
                  checked={entityData.entitySubtype === type.value}
                  onChange={e => handleEntityChange('entitySubtype', e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-gray-900">{type.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name *</label>
            <input
              type="text"
              value={entityData.legalName}
              onChange={e => handleEntityChange('legalName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name</label>
            <input
              type="text"
              value={entityData.tradingName}
              onChange={e => handleEntityChange('tradingName', e.target.value)}
              placeholder="If different from legal name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {selectedSubtype === 'CHARITY' ? 'CHY Number' : 'Registration Number'} *
            </label>
            <input
              type="text"
              value={
                selectedSubtype === 'CHARITY'
                  ? entityData.charityNumber
                  : entityData.registrationNumber
              }
              onChange={e =>
                handleEntityChange(
                  selectedSubtype === 'CHARITY' ? 'charityNumber' : 'registrationNumber',
                  e.target.value
                )
              }
              placeholder={selectedSubtype === 'COMPANY' ? 'CRO Number' : ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Number</label>
            <input
              type="text"
              value={entityData.taxNumber}
              onChange={e => handleEntityChange('taxNumber', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
            <input
              type="text"
              value={entityData.vatNumber}
              onChange={e => handleEntityChange('vatNumber', e.target.value)}
              placeholder="IE1234567X"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Incorporation *
            </label>
            <input
              type="date"
              value={entityData.dateOfIncorporation}
              onChange={e => handleEntityChange('dateOfIncorporation', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country of Incorporation *
            </label>
            <select
              value={entityData.countryOfIncorporation}
              onChange={e => handleEntityChange('countryOfIncorporation', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {COUNTRIES.map(country => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Email *</label>
            <input
              type="email"
              value={entityData.businessEmail}
              onChange={e => handleEntityChange('businessEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone *</label>
            <input
              type="tel"
              value={entityData.businessPhone}
              onChange={e => handleEntityChange('businessPhone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={entityData.website}
              onChange={e => handleEntityChange('website', e.target.value)}
              placeholder="https://"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Registered Address */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Registered Address</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
            <input
              type="text"
              value={entityData.registeredAddressLine1}
              onChange={e => handleEntityChange('registeredAddressLine1', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={entityData.registeredAddressLine2}
              onChange={e => handleEntityChange('registeredAddressLine2', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={entityData.registeredCity}
                onChange={e => handleEntityChange('registeredCity', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <input
                type="text"
                value={entityData.registeredCounty}
                onChange={e => handleEntityChange('registeredCounty', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {entityData.registeredCountry === 'IE' ? 'Eircode' : 'Postcode'}
              </label>
              <input
                type="text"
                value={entityData.registeredPostcode}
                onChange={e => handleEntityChange('registeredPostcode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
              <select
                value={entityData.registeredCountry}
                onChange={e => handleEntityChange('registeredCountry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {COUNTRIES.map(country => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Address */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Trading Address</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={entityData.sameAsRegistered}
              onChange={e => handleEntityChange('sameAsRegistered', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Same as registered address</span>
          </label>
        </div>
        {!entityData.sameAsRegistered && (
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={entityData.tradingAddressLine1}
                onChange={e => handleEntityChange('tradingAddressLine1', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                type="text"
                value={entityData.tradingAddressLine2}
                onChange={e => handleEntityChange('tradingAddressLine2', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  value={entityData.tradingCity}
                  onChange={e => handleEntityChange('tradingCity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <input
                  type="text"
                  value={entityData.tradingCounty}
                  onChange={e => handleEntityChange('tradingCounty', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {entityData.tradingCountry === 'IE' ? 'Eircode' : 'Postcode'}
                </label>
                <input
                  type="text"
                  value={entityData.tradingPostcode}
                  onChange={e => handleEntityChange('tradingPostcode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <select
                  value={entityData.tradingCountry}
                  onChange={e => handleEntityChange('tradingCountry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {COUNTRIES.map(country => (
                    <option key={country.value} value={country.value}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Business Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry/Sector</label>
            <input
              type="text"
              value={entityData.industryCode}
              onChange={e => handleEntityChange('industryCode', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Employees
            </label>
            <input
              type="number"
              value={entityData.numberOfEmployees}
              onChange={e => handleEntityChange('numberOfEmployees', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annual Turnover (€)
            </label>
            <input
              type="number"
              value={entityData.annualTurnover}
              onChange={e => handleEntityChange('annualTurnover', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Description
            </label>
            <textarea
              value={entityData.businessDescription}
              onChange={e => handleEntityChange('businessDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Key Personnel */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Key Personnel</h3>
            <p className="text-sm text-gray-500">
              Add directors, shareholders, partners, or other key individuals
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddMemberModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + Add Person
          </button>
        </div>
        {entityData.members.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-2 text-gray-500">No key personnel added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entityData.members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {member.customerName?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.customerName}</p>
                    <p className="text-sm text-gray-500">
                      {MEMBER_ROLES[selectedSubtype!]?.find(r => r.value === member.role)?.label ||
                        member.role}
                      {member.ownershipPercentage && ` • ${member.ownershipPercentage}% ownership`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.isSignatory && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Signatory
                    </span>
                  )}
                  {member.isPrimaryContact && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      Primary Contact
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAddMemberModal = () => {
    if (!showAddMemberModal) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Add Key Person</h2>
              <button onClick={resetMemberForm} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={selectedMemberRole}
                onChange={e => setSelectedMemberRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select role</option>
                {(MEMBER_ROLES[selectedSubtype!] || []).map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setAddMemberType('existing')}
                className={`flex-1 p-4 border-2 rounded-lg text-center ${addMemberType === 'existing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                <span className="font-medium">Search Existing Customer</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMemberType('new')}
                className={`flex-1 p-4 border-2 rounded-lg text-center ${addMemberType === 'new' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
              >
                <span className="font-medium">Add New Person</span>
              </button>
            </div>
            {addMemberType === 'existing' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Customer
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    searchExistingCustomers(e.target.value);
                  }}
                  placeholder="Search by name or email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {isSearching && <p className="text-sm text-gray-500 mt-2">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map(customer => (
                      <button
                        key={customer.customerId}
                        type="button"
                        onClick={() => addExistingMember(customer)}
                        disabled={!selectedMemberRole}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0 disabled:opacity-50"
                      >
                        <p className="font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{customer.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newMemberData.firstName}
                      onChange={e =>
                        setNewMemberData(prev => ({ ...prev, firstName: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={newMemberData.lastName}
                      onChange={e =>
                        setNewMemberData(prev => ({ ...prev, lastName: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={newMemberData.email}
                      onChange={e => setNewMemberData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      type="tel"
                      value={newMemberData.phone}
                      onChange={e => setNewMemberData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={newMemberData.dateOfBirth}
                      onChange={e =>
                        setNewMemberData(prev => ({ ...prev, dateOfBirth: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality
                    </label>
                    <select
                      value={newMemberData.nationality}
                      onChange={e =>
                        setNewMemberData(prev => ({ ...prev, nationality: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {COUNTRIES.map(country => (
                        <option key={country.value} value={country.value}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ownership % (if applicable)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={memberOwnership}
                  onChange={e => setMemberOwnership(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberIsSignatory}
                    onChange={e => setMemberIsSignatory(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Signatory</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberIsPrimaryContact}
                    onChange={e => setMemberIsPrimaryContact(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Primary Contact</span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetMemberForm}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            {addMemberType === 'new' && (
              <button
                type="button"
                onClick={addNewMember}
                disabled={
                  !selectedMemberRole || !newMemberData.firstName || !newMemberData.lastName
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Person
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
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
                <h1 className="text-2xl font-bold text-gray-900">Add Customer</h1>
                {selectedCategory && selectedSubtype && (
                  <p className="text-sm text-gray-500">
                    {CUSTOMER_CATEGORIES.find(c => c.value === selectedCategory)?.label} →{' '}
                    {
                      CUSTOMER_CATEGORIES.find(c => c.value === selectedCategory)?.subtypes.find(
                        s => s.value === selectedSubtype
                      )?.label
                    }
                  </p>
                )}
              </div>
            </div>
            {selectedCategory && (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  1. Type
                </span>
                <span className="text-gray-300">→</span>
                <span
                  className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  2. Details
                </span>
                <span className="text-gray-300">→</span>
                <span
                  className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  3. Review
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {!selectedCategory && renderCategorySelection()}
        {selectedCategory && !selectedSubtype && renderSubtypeSelection()}
        {selectedCategory && selectedSubtype && step === 2 && (
          <>
            {selectedCategory === 'INDIVIDUAL' ? renderIndividualForm() : renderEntityForm()}
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setSelectedSubtype(null)}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Review & Submit
              </button>
            </div>
          </>
        )}
        {selectedCategory && selectedSubtype && step === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Customer Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-2 font-medium">
                      {CUSTOMER_CATEGORIES.find(c => c.value === selectedCategory)?.label} -{' '}
                      {
                        CUSTOMER_CATEGORIES.find(c => c.value === selectedCategory)?.subtypes.find(
                          s => s.value === selectedSubtype
                        )?.label
                      }
                    </span>
                  </div>
                </div>
                {selectedCategory === 'INDIVIDUAL' ? (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium text-gray-900 mb-2">Personal Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Name:</span>{' '}
                        <span className="ml-2">
                          {individualData.firstName} {individualData.lastName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Email:</span>{' '}
                        <span className="ml-2">{individualData.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Phone:</span>{' '}
                        <span className="ml-2">{individualData.phone}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">DOB:</span>{' '}
                        <span className="ml-2">{individualData.dateOfBirth}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium text-gray-900 mb-2">Entity Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Legal Name:</span>{' '}
                        <span className="ml-2">{entityData.legalName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Registration #:</span>{' '}
                        <span className="ml-2">
                          {entityData.registrationNumber || entityData.charityNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Email:</span>{' '}
                        <span className="ml-2">{entityData.businessEmail}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Key Personnel:</span>{' '}
                        <span className="ml-2">{entityData.members.length} added</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        )}
      </div>
      {renderAddMemberModal()}
    </div>
  );
}
