/**
 * Product-specific field configuration for loan applications.
 *
 * Each product type maps to a set of field sections, each with typed field
 * definitions. The UI renders fields dynamically based on the selected
 * product type, so changing a product in the dropdown instantly switches
 * the form layout.
 *
 * Fields are purely front-end data-capture metadata; values are persisted
 * as a flat JSON payload via `additionalData` on the application.
 */

// ─── Primitive field types ─────────────────────────────────────────────
export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: SelectOption[]; // only for 'select'
  step?: string; // only for 'number'
  colSpan?: 1 | 2; // grid column span (default 1)
  showWhen?: { field: string; values: string[] }; // conditional visibility
}

export interface FieldSection {
  title: string;
  fields: FieldDef[];
}

export interface ProductFieldConfig {
  /** Product-level label modification for Amount / Term */
  amountLabel?: string;
  termLabel?: string; // empty string = hide term field
  /** Purpose options specific to this product */
  purposeOptions: SelectOption[];
  /** Additional field sections beyond the common Amount/Rate/Purpose */
  sections: FieldSection[];
}

// ─── Reusable option sets ──────────────────────────────────────────────

const REPAYMENT_TYPES: SelectOption[] = [
  { value: 'AMORTISING', label: 'Amortising' },
  { value: 'INTEREST_ONLY', label: 'Interest Only' },
  { value: 'BALLOON', label: 'Balloon' },
  { value: 'BULLET', label: 'Bullet' },
];

const EMPLOYMENT_OPTIONS: SelectOption[] = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const PROPERTY_TYPES: SelectOption[] = [
  { value: 'DETACHED_HOUSE', label: 'Detached House' },
  { value: 'SEMI_DETACHED', label: 'Semi-Detached House' },
  { value: 'TERRACED', label: 'Terraced House' },
  { value: 'APARTMENT', label: 'Apartment / Flat' },
  { value: 'BUNGALOW', label: 'Bungalow' },
  { value: 'COMMERCIAL', label: 'Commercial Property' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'LAND', label: 'Land / Site' },
];

const VEHICLE_CONDITION: SelectOption[] = [
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used / Pre-Owned' },
  { value: 'DEMO', label: 'Demonstrator' },
];

const YES_NO: SelectOption[] = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
];

// ─── 1. Agri-Loan ──────────────────────────────────────────────────────
const AGRI_LOAN: ProductFieldConfig = {
  amountLabel: 'Facility Amount',
  purposeOptions: [
    { value: 'WORKING_CAPITAL', label: 'Working Capital' },
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment Purchase' },
    { value: 'LAND_IMPROVEMENT', label: 'Land Improvement' },
    { value: 'LIVESTOCK', label: 'Livestock' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility Details',
      fields: [
        {
          key: 'loan_type',
          label: 'Loan Type',
          type: 'select',
          required: true,
          options: [
            { value: 'WORKING_CAPITAL', label: 'Working Capital' },
            { value: 'EQUIPMENT', label: 'Equipment' },
            { value: 'LAND_IMPROVEMENT', label: 'Land Improvement' },
            { value: 'LIVESTOCK', label: 'Livestock' },
          ],
        },
        {
          key: 'repayment_structure',
          label: 'Repayment Structure',
          type: 'select',
          options: [
            { value: 'AMORTISING', label: 'Amortising' },
            { value: 'INTEREST_ONLY', label: 'Interest Only' },
            { value: 'SEASONAL_BALLOON', label: 'Seasonal Balloon' },
          ],
        },
        {
          key: 'subsidy_income',
          label: 'Subsidy Income (e.g. CAP payments)',
          type: 'number',
          placeholder: 'Annual subsidy amount',
        },
        {
          key: 'seasonality_profile',
          label: 'Seasonality Profile',
          type: 'textarea',
          placeholder: 'Describe monthly cashflow seasonality...',
          colSpan: 2,
        },
      ],
    },
    {
      title: 'Farm Profile',
      fields: [
        {
          key: 'farm_type',
          label: 'Farm Type',
          type: 'select',
          required: true,
          options: [
            { value: 'DAIRY', label: 'Dairy' },
            { value: 'BEEF', label: 'Beef' },
            { value: 'TILLAGE', label: 'Tillage' },
            { value: 'SHEEP', label: 'Sheep' },
            { value: 'MIXED', label: 'Mixed' },
            { value: 'OTHER', label: 'Other' },
          ],
        },
        {
          key: 'farm_area_hectares',
          label: 'Farm Area (hectares)',
          type: 'number',
          placeholder: 'Total farm area',
        },
        {
          key: 'stock_count',
          label: 'Livestock Count',
          type: 'number',
          placeholder: 'Head of livestock',
        },
        {
          key: 'farm_registration_ids',
          label: 'Farm Registration IDs',
          type: 'text',
          placeholder: 'Herd number / folio reference',
        },
        {
          key: 'commodity_exposure',
          label: 'Commodity Exposure',
          type: 'text',
          placeholder: 'e.g. milk, grain',
        },
      ],
    },
    {
      title: 'Security',
      fields: [
        {
          key: 'security_type',
          label: 'Security Type',
          type: 'select',
          options: [
            { value: 'LAND', label: 'Land' },
            { value: 'EQUIPMENT', label: 'Equipment' },
            { value: 'LIVESTOCK', label: 'Livestock' },
            { value: 'GUARANTEE', label: 'Guarantee' },
          ],
        },
        {
          key: 'farm_assets_summary',
          label: 'Farm Assets Summary',
          type: 'textarea',
          placeholder: 'Summary of farm assets offered as security...',
          colSpan: 2,
        },
      ],
    },
  ],
};

// ─── 2. Asset Leasing ──────────────────────────────────────────────────
const ASSET_LEASING: ProductFieldConfig = {
  amountLabel: 'Facility Amount',
  purposeOptions: [
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment / Asset Acquisition' },
    { value: 'BUSINESS_EXPANSION', label: 'Business Expansion' },
    { value: 'FLEET', label: 'Fleet Procurement' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Lease Structure',
      fields: [
        {
          key: 'lease_type',
          label: 'Lease Type',
          type: 'select',
          required: true,
          options: [
            { value: 'FINANCE_LEASE', label: 'Finance Lease' },
            { value: 'OPERATING_LEASE', label: 'Operating Lease' },
          ],
        },
        {
          key: 'asset_category',
          label: 'Asset Category',
          type: 'select',
          required: true,
          options: [
            { value: 'MACHINERY', label: 'Machinery' },
            { value: 'IT_EQUIPMENT', label: 'IT Equipment' },
            { value: 'MEDICAL', label: 'Medical Equipment' },
            { value: 'FLEET', label: 'Fleet / Vehicles' },
            { value: 'OFFICE', label: 'Office Equipment' },
            { value: 'OTHER', label: 'Other' },
          ],
        },
        {
          key: 'asset_description',
          label: 'Asset Description',
          type: 'textarea',
          required: true,
          placeholder: 'Describe the asset(s) to be leased...',
          colSpan: 2,
        },
        {
          key: 'supplier_name',
          label: 'Supplier Name',
          type: 'text',
          placeholder: 'Supplier / vendor name',
        },
        {
          key: 'supplier_invoice_amount',
          label: 'Supplier Invoice Amount',
          type: 'number',
          placeholder: 'Total invoice value',
        },
        {
          key: 'lease_payment_frequency',
          label: 'Payment Frequency',
          type: 'select',
          options: [
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'QUARTERLY', label: 'Quarterly' },
            { value: 'ANNUALLY', label: 'Annually' },
          ],
        },
        {
          key: 'residual_value',
          label: 'Residual Value / Purchase Option Price',
          type: 'number',
          placeholder: 'End-of-lease value',
        },
        {
          key: 'maintenance_included',
          label: 'Maintenance Included',
          type: 'select',
          options: YES_NO,
        },
        {
          key: 'maintenance_provider',
          label: 'Maintenance Provider',
          type: 'text',
          placeholder: 'If maintenance is included',
          showWhen: { field: 'maintenance_included', values: ['YES'] },
        },
        {
          key: 'vat_treatment',
          label: 'VAT Treatment',
          type: 'text',
          placeholder: 'Describe VAT recovery arrangement',
        },
      ],
    },
    {
      title: 'Risk Assessment',
      fields: [
        {
          key: 'asset_life_expectancy',
          label: 'Asset Life Expectancy (years)',
          type: 'number',
          placeholder: 'Expected useful life',
        },
        {
          key: 'asset_insurance_required',
          label: 'Asset Insurance Required',
          type: 'select',
          options: YES_NO,
        },
        {
          key: 'insurance_policy_details',
          label: 'Insurance Policy Details',
          type: 'text',
          placeholder: 'Policy reference / provider',
          showWhen: { field: 'asset_insurance_required', values: ['YES'] },
        },
      ],
    },
  ],
};

// ─── 3. Auto Loan ──────────────────────────────────────────────────────
const AUTO_LOAN: ProductFieldConfig = {
  amountLabel: 'Finance Amount',
  purposeOptions: [
    { value: 'VEHICLE_PURCHASE', label: 'New Vehicle Purchase' },
    { value: 'USED_VEHICLE', label: 'Used Vehicle Purchase' },
    { value: 'COMMERCIAL_VEHICLE', label: 'Commercial Vehicle' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Vehicle Details',
      fields: [
        {
          key: 'vehicle_type',
          label: 'Vehicle Type',
          type: 'select',
          required: true,
          options: [
            { value: 'NEW', label: 'New' },
            { value: 'USED', label: 'Used' },
          ],
        },
        {
          key: 'vehicleMake',
          label: 'Make',
          type: 'text',
          required: true,
          placeholder: 'e.g. Toyota',
        },
        {
          key: 'vehicleModel',
          label: 'Model',
          type: 'text',
          required: true,
          placeholder: 'e.g. Corolla',
        },
        {
          key: 'vehicleYear',
          label: 'Year',
          type: 'number',
          required: true,
          placeholder: 'e.g. 2026',
        },
        {
          key: 'vehicle_registration_number',
          label: 'Registration Number',
          type: 'text',
          placeholder: 'If used vehicle',
          showWhen: { field: 'vehicle_type', values: ['USED'] },
        },
        {
          key: 'vehicle_mileage',
          label: 'Mileage',
          type: 'number',
          placeholder: 'Current mileage',
          showWhen: { field: 'vehicle_type', values: ['USED'] },
        },
        {
          key: 'dealer_name',
          label: 'Dealer / Seller Name',
          type: 'text',
          placeholder: 'Dealer or private seller',
        },
        {
          key: 'purchase_price',
          label: 'Purchase Price',
          type: 'number',
          required: true,
          placeholder: 'Full purchase price',
        },
        {
          key: 'deposit_amount',
          label: 'Deposit Amount',
          type: 'number',
          placeholder: 'Deposit / down payment',
        },
        {
          key: 'trade_in_value',
          label: 'Trade-In Value',
          type: 'number',
          placeholder: 'Value of trade-in vehicle',
        },
      ],
    },
    {
      title: 'Security & Insurance',
      fields: [
        {
          key: 'security_interest_on_vehicle',
          label: 'Security Interest on Vehicle',
          type: 'select',
          options: YES_NO,
        },
        { key: 'insurance_required', label: 'Insurance Required', type: 'select', options: YES_NO },
        {
          key: 'insurance_policy_reference',
          label: 'Insurance Policy Reference',
          type: 'text',
          placeholder: 'Policy number',
          showWhen: { field: 'insurance_required', values: ['YES'] },
        },
      ],
    },
  ],
};

// ─── 4. Business Term Loan ─────────────────────────────────────────────
const BUSINESS_LOAN: ProductFieldConfig = {
  amountLabel: 'Facility Amount',
  purposeOptions: [
    { value: 'CAPEX', label: 'Capital Expenditure' },
    { value: 'EXPANSION', label: 'Business Expansion' },
    { value: 'REFINANCE', label: 'Refinance' },
    { value: 'WORKING_CAPITAL', label: 'Working Capital' },
    { value: 'ACQUISITION', label: 'Acquisition' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility Details',
      fields: [
        {
          key: 'repayment_type',
          label: 'Repayment Type',
          type: 'select',
          options: REPAYMENT_TYPES,
        },
        {
          key: 'grace_period_months',
          label: 'Grace Period (months)',
          type: 'number',
          placeholder: 'Optional grace period',
        },
        {
          key: 'use_of_funds',
          label: 'Use of Funds',
          type: 'textarea',
          required: true,
          placeholder: 'Detailed description of how funds will be used...',
          colSpan: 2,
        },
        {
          key: 'drawdown_type',
          label: 'Drawdown Type',
          type: 'select',
          options: [
            { value: 'SINGLE', label: 'Single Drawdown' },
            { value: 'TRANCHE', label: 'Multiple Tranches' },
          ],
        },
      ],
    },
    {
      title: 'Business Financials',
      fields: [
        {
          key: 'annual_turnover',
          label: 'Annual Turnover',
          type: 'number',
          required: true,
          placeholder: 'Last fiscal year turnover',
        },
        {
          key: 'ebitda',
          label: 'EBITDA',
          type: 'number',
          placeholder: 'Earnings before interest, tax, depreciation & amortisation',
        },
        {
          key: 'net_profit',
          label: 'Net Profit',
          type: 'number',
          placeholder: 'Last fiscal year net profit',
        },
        {
          key: 'existing_bank_facilities',
          label: 'Existing Bank Facilities Summary',
          type: 'textarea',
          placeholder: 'Describe existing loans, overdrafts, etc.',
          colSpan: 2,
        },
      ],
    },
    {
      title: 'Security & Guarantees',
      fields: [
        {
          key: 'security_type',
          label: 'Security Type',
          type: 'select',
          options: [
            { value: 'DEBENTURE', label: 'Debenture' },
            { value: 'PROPERTY', label: 'Property Charge' },
            { value: 'GUARANTEE', label: 'Personal Guarantee' },
            { value: 'ASSET', label: 'Asset Charge' },
            { value: 'NONE', label: 'Unsecured' },
          ],
        },
        {
          key: 'guarantors_required',
          label: 'Guarantors Required',
          type: 'select',
          options: YES_NO,
        },
        {
          key: 'guarantor_details',
          label: 'Guarantor Details',
          type: 'textarea',
          placeholder: 'Names and relationship of guarantors',
          colSpan: 2,
          showWhen: { field: 'guarantors_required', values: ['YES'] },
        },
      ],
    },
    {
      title: 'Covenants',
      fields: [
        {
          key: 'financial_covenants',
          label: 'Financial Covenants',
          type: 'textarea',
          placeholder: 'e.g. DSCR min 1.2x, leverage max 3.0x',
          colSpan: 2,
        },
        {
          key: 'reporting_frequency',
          label: 'Reporting Frequency',
          type: 'select',
          options: [
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'QUARTERLY', label: 'Quarterly' },
            { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
            { value: 'ANNUAL', label: 'Annual' },
          ],
        },
      ],
    },
  ],
};

// ─── 5. Buy Now Pay Later (BNPL) ──────────────────────────────────────
const BNPL: ProductFieldConfig = {
  amountLabel: 'Purchase Amount',
  purposeOptions: [
    { value: 'CONSUMER_PURCHASE', label: 'Consumer Purchase' },
    { value: 'ELECTRONICS', label: 'Electronics' },
    { value: 'FURNITURE', label: 'Furniture / Home' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Transaction Details',
      fields: [
        {
          key: 'merchant_name',
          label: 'Merchant Name',
          type: 'text',
          required: true,
          placeholder: 'Store / merchant name',
        },
        {
          key: 'merchant_id',
          label: 'Merchant ID',
          type: 'text',
          placeholder: 'Merchant reference',
        },
        {
          key: 'purchase_amount',
          label: 'Purchase Amount',
          type: 'number',
          required: true,
          placeholder: 'Total purchase value',
        },
        {
          key: 'down_payment_amount',
          label: 'Down Payment',
          type: 'number',
          placeholder: 'Initial payment',
        },
        {
          key: 'installment_count',
          label: 'Number of Instalments',
          type: 'number',
          required: true,
          placeholder: 'e.g. 3, 4, 6',
        },
        {
          key: 'installment_amount',
          label: 'Instalment Amount',
          type: 'number',
          placeholder: 'Per instalment',
        },
        { key: 'first_payment_date', label: 'First Payment Date', type: 'date' },
      ],
    },
    {
      title: 'Risk',
      fields: [
        {
          key: 'merchant_category_code',
          label: 'Merchant Category Code (MCC)',
          type: 'text',
          placeholder: 'e.g. 5411',
        },
        {
          key: 'credit_decision_mode',
          label: 'Credit Decision Mode',
          type: 'select',
          options: [
            { value: 'SOFT_CHECK', label: 'Soft Check' },
            { value: 'BUREAU', label: 'Bureau Check' },
            { value: 'INTERNAL', label: 'Internal Scoring' },
          ],
        },
      ],
    },
  ],
};

// ─── 6. Credit Card (Personal) ────────────────────────────────────────
const CREDIT_CARD: ProductFieldConfig = {
  amountLabel: 'Credit Limit',
  termLabel: '',
  purposeOptions: [
    { value: 'PERSONAL_SPENDING', label: 'Personal Spending' },
    { value: 'TRAVEL_REWARDS', label: 'Travel & Rewards' },
    { value: 'BALANCE_TRANSFER', label: 'Balance Transfer' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Card Limits',
      fields: [
        {
          key: 'cash_withdrawal_limit',
          label: 'Cash Withdrawal Limit',
          type: 'number',
          placeholder: 'Max cash advance',
        },
        {
          key: 'temporary_limit',
          label: 'Temporary Limit',
          type: 'number',
          placeholder: 'If requested',
        },
        {
          key: 'temporary_limit_expiry',
          label: 'Temporary Limit Expiry',
          type: 'date',
          showWhen: { field: 'temporary_limit', values: [] },
        },
      ],
    },
    {
      title: 'Card Account Setup',
      fields: [
        {
          key: 'billing_cycle_day',
          label: 'Billing Cycle Day',
          type: 'number',
          placeholder: '1-28',
          hint: 'Day of month for billing cycle',
        },
        {
          key: 'payment_due_days',
          label: 'Payment Due Days After Statement',
          type: 'number',
          placeholder: 'e.g. 21',
        },
        {
          key: 'minimum_payment_rule',
          label: 'Minimum Payment Rule',
          type: 'text',
          placeholder: 'e.g. 2% or €25 minimum',
        },
        {
          key: 'interest_free_period_days',
          label: 'Interest-Free Period (days)',
          type: 'number',
          placeholder: 'e.g. 56',
        },
      ],
    },
    {
      title: 'Pricing',
      fields: [
        {
          key: 'apr_purchase',
          label: 'APR – Purchases (%)',
          type: 'number',
          step: '0.01',
          placeholder: 'Purchase APR',
        },
        {
          key: 'apr_cash',
          label: 'APR – Cash Advances (%)',
          type: 'number',
          step: '0.01',
          placeholder: 'Cash advance APR',
        },
        {
          key: 'apr_balance_transfer',
          label: 'APR – Balance Transfer (%)',
          type: 'number',
          step: '0.01',
          placeholder: 'Balance transfer APR',
        },
        { key: 'annual_fee', label: 'Annual Fee', type: 'number', placeholder: 'Annual card fee' },
        {
          key: 'late_fee',
          label: 'Late Payment Fee',
          type: 'number',
          placeholder: 'Per-occurrence fee',
        },
      ],
    },
    {
      title: 'Card Controls',
      fields: [
        {
          key: 'contactless_limit',
          label: 'Contactless Limit',
          type: 'number',
          placeholder: 'Per-transaction limit',
        },
        {
          key: 'additional_cardholders',
          label: 'Additional Cardholders',
          type: 'textarea',
          placeholder: 'List names of additional cardholders',
          colSpan: 2,
        },
        { key: 'facility_review_date', label: 'Facility Review Date', type: 'date' },
      ],
    },
  ],
};

// ─── 7. Credit Union Loan ──────────────────────────────────────────────
const CREDIT_UNION_LOAN: ProductFieldConfig = {
  amountLabel: 'Refinance Amount',
  purposeOptions: [
    { value: 'REFINANCE', label: 'Refinance / Consolidation' },
    { value: 'TOP_UP', label: 'Top-Up' },
    { value: 'PERSONAL_USE', label: 'Personal Use' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Existing Loan Details',
      fields: [
        {
          key: 'credit_union_name',
          label: 'Credit Union Name',
          type: 'text',
          required: true,
          placeholder: 'Name of credit union',
        },
        {
          key: 'credit_union_account_number',
          label: 'Account Number',
          type: 'text',
          placeholder: 'Credit union account number',
        },
        {
          key: 'outstanding_balance',
          label: 'Outstanding Balance',
          type: 'number',
          required: true,
          placeholder: 'Current balance owed',
        },
        {
          key: 'settlement_amount',
          label: 'Settlement Amount',
          type: 'number',
          required: true,
          placeholder: 'Amount to settle',
        },
        { key: 'settlement_valid_until', label: 'Settlement Valid Until', type: 'date' },
        {
          key: 'current_interest_rate',
          label: 'Current Interest Rate (%)',
          type: 'number',
          step: '0.01',
          placeholder: 'Existing rate',
        },
        {
          key: 'remaining_term_months',
          label: 'Remaining Term (months)',
          type: 'number',
          placeholder: 'Months remaining on existing loan',
        },
      ],
    },
    {
      title: 'New Facility',
      fields: [
        {
          key: 'top_up_amount',
          label: 'Top-Up Amount',
          type: 'number',
          placeholder: 'Additional amount beyond settlement',
        },
        {
          key: 'disbursement_mode',
          label: 'Disbursement Mode',
          type: 'select',
          options: [
            { value: 'DIRECT_TO_CREDIT_UNION', label: 'Direct to Credit Union' },
            { value: 'CUSTOMER_ACCOUNT', label: 'Customer Account' },
          ],
        },
      ],
    },
  ],
};

// ─── 8. Green Loan ─────────────────────────────────────────────────────
const GREEN_LOAN: ProductFieldConfig = {
  amountLabel: 'Loan Amount',
  purposeOptions: [
    { value: 'SOLAR', label: 'Solar Panels' },
    { value: 'INSULATION', label: 'Insulation' },
    { value: 'HEAT_PUMP', label: 'Heat Pump' },
    { value: 'EV_PURCHASE', label: 'Electric Vehicle' },
    { value: 'RETROFIT', label: 'Full Home Retrofit' },
    { value: 'ENERGY_UPGRADE', label: 'Energy Upgrade' },
    { value: 'OTHER', label: 'Other Green Purpose' },
  ],
  sections: [
    {
      title: 'Green Classification',
      fields: [
        {
          key: 'green_purpose_type',
          label: 'Green Purpose Type',
          type: 'select',
          required: true,
          options: [
            { value: 'SOLAR', label: 'Solar / Photovoltaic' },
            { value: 'INSULATION', label: 'Insulation' },
            { value: 'HEAT_PUMP', label: 'Heat Pump' },
            { value: 'EV', label: 'Electric Vehicle' },
            { value: 'RETROFIT', label: 'Full Retrofit' },
            { value: 'WINDOWS', label: 'Windows / Doors Upgrade' },
            { value: 'OTHER', label: 'Other' },
          ],
        },
        {
          key: 'expected_energy_savings',
          label: 'Expected Energy Savings (%)',
          type: 'number',
          placeholder: 'Estimated annual savings',
        },
        {
          key: 'property_current_ber',
          label: 'Current BER Rating',
          type: 'text',
          placeholder: 'e.g. D2',
        },
        {
          key: 'property_target_ber',
          label: 'Target BER Rating',
          type: 'text',
          placeholder: 'e.g. B2',
        },
        {
          key: 'contractor_name',
          label: 'Contractor / Supplier Name',
          type: 'text',
          placeholder: 'Installer name',
        },
        {
          key: 'supplier_quote_amount',
          label: 'Supplier Quote Amount',
          type: 'number',
          placeholder: 'Total quoted cost',
        },
      ],
    },
    {
      title: 'Disbursement',
      fields: [
        {
          key: 'disbursement_mode',
          label: 'Disbursement To',
          type: 'select',
          options: [
            { value: 'CONTRACTOR', label: 'Direct to Contractor' },
            { value: 'CUSTOMER', label: 'Customer Account' },
          ],
        },
      ],
    },
  ],
};

// ─── 9. Home Mortgage ──────────────────────────────────────────────────
const HOME_MORTGAGE: ProductFieldConfig = {
  amountLabel: 'Mortgage Amount',
  termLabel: 'Mortgage Term (years)',
  purposeOptions: [
    { value: 'HOME_PURCHASE', label: 'Home Purchase' },
    { value: 'SWITCHER', label: 'Switcher / Refinance' },
    { value: 'TOP_UP', label: 'Top-Up' },
    { value: 'SELF_BUILD', label: 'Self-Build' },
    { value: 'BUY_TO_LET', label: 'Buy to Let' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Mortgage Details',
      fields: [
        {
          key: 'mortgage_type',
          label: 'Mortgage Type',
          type: 'select',
          required: true,
          options: [
            { value: 'PURCHASE', label: 'Purchase' },
            { value: 'SWITCHER', label: 'Switcher' },
            { value: 'TOPUP', label: 'Top-Up' },
            { value: 'SELF_BUILD', label: 'Self-Build' },
          ],
        },
        {
          key: 'property_usage',
          label: 'Property Usage',
          type: 'select',
          required: true,
          options: [
            { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence' },
            { value: 'BUY_TO_LET', label: 'Buy to Let' },
          ],
        },
        {
          key: 'purchase_price',
          label: 'Purchase Price',
          type: 'number',
          required: true,
          placeholder: 'Full purchase price',
        },
        {
          key: 'deposit_amount',
          label: 'Deposit Amount',
          type: 'number',
          required: true,
          placeholder: 'Cash deposit',
        },
        {
          key: 'repayment_type',
          label: 'Repayment Type',
          type: 'select',
          options: [
            { value: 'CAPITAL_AND_INTEREST', label: 'Capital & Interest' },
            { value: 'INTEREST_ONLY', label: 'Interest Only' },
          ],
        },
        {
          key: 'rate_type',
          label: 'Rate Type',
          type: 'select',
          options: [
            { value: 'FIXED', label: 'Fixed' },
            { value: 'VARIABLE', label: 'Variable' },
          ],
        },
        {
          key: 'fixed_period_years',
          label: 'Fixed Period (years)',
          type: 'number',
          placeholder: 'e.g. 3, 5, 7',
          showWhen: { field: 'rate_type', values: ['FIXED'] },
        },
      ],
    },
    {
      title: 'Property Details',
      fields: [
        {
          key: 'propertyAddress',
          label: 'Property Address',
          type: 'text',
          required: true,
          placeholder: 'Full property address',
          colSpan: 2,
        },
        {
          key: 'propertyCity',
          label: 'City',
          type: 'text',
          required: true,
          placeholder: 'e.g. Dublin',
        },
        {
          key: 'propertyState',
          label: 'County / Region',
          type: 'text',
          required: true,
          placeholder: 'e.g. Co. Dublin',
        },
        {
          key: 'propertyPostalCode',
          label: 'Eircode / Postcode',
          type: 'text',
          placeholder: 'e.g. D02 X285',
        },
        {
          key: 'propertyType',
          label: 'Property Type',
          type: 'select',
          required: true,
          options: PROPERTY_TYPES,
        },
        { key: 'ber_rating', label: 'BER Rating', type: 'text', placeholder: 'e.g. B2' },
        {
          key: 'propertyValue',
          label: 'Estimated Property Value',
          type: 'number',
          required: true,
          placeholder: 'Market valuation',
        },
        { key: 'valuation_required', label: 'Valuation Required', type: 'select', options: YES_NO },
        {
          key: 'solicitor_details',
          label: 'Solicitor Details',
          type: 'text',
          placeholder: 'Solicitor name / firm',
        },
      ],
    },
    {
      title: 'Underwriting Metrics',
      fields: [
        {
          key: 'rental_income',
          label: 'Rental Income (if BTL)',
          type: 'number',
          placeholder: 'Expected monthly rent',
          showWhen: { field: 'property_usage', values: ['BUY_TO_LET'] },
        },
        {
          key: 'existing_mortgage_details',
          label: 'Existing Mortgage Details',
          type: 'textarea',
          placeholder: 'Details of existing mortgage(s) if switcher...',
          colSpan: 2,
          showWhen: { field: 'mortgage_type', values: ['SWITCHER'] },
        },
      ],
    },
    {
      title: 'Drawdown',
      fields: [
        { key: 'drawdown_date_target', label: 'Target Drawdown Date', type: 'date' },
        {
          key: 'staged_drawdown_plan',
          label: 'Staged Drawdown Plan',
          type: 'textarea',
          placeholder: 'For self-build: describe drawdown stages...',
          colSpan: 2,
          showWhen: { field: 'mortgage_type', values: ['SELF_BUILD'] },
        },
        {
          key: 'conditions_precedent',
          label: 'Conditions Precedent',
          type: 'textarea',
          placeholder: 'List any conditions that must be met before drawdown...',
          colSpan: 2,
        },
      ],
    },
  ],
};

// ─── 10. Invoice Finance ───────────────────────────────────────────────
const INVOICE_FINANCE: ProductFieldConfig = {
  amountLabel: 'Facility Limit',
  purposeOptions: [
    { value: 'WORKING_CAPITAL', label: 'Working Capital' },
    { value: 'GROWTH_FINANCE', label: 'Growth Finance' },
    { value: 'CASHFLOW', label: 'Cash Flow Management' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility Structure',
      fields: [
        {
          key: 'advance_rate_percent',
          label: 'Advance Rate (%)',
          type: 'number',
          step: '0.1',
          required: true,
          placeholder: 'e.g. 80',
        },
        {
          key: 'discount_rate',
          label: 'Discount Rate (%)',
          type: 'number',
          step: '0.01',
          placeholder: 'Rate on drawn amount',
        },
        {
          key: 'service_fee_percent',
          label: 'Service Fee (%)',
          type: 'number',
          step: '0.01',
          placeholder: 'Percentage of turnover',
        },
        {
          key: 'recourse_type',
          label: 'Recourse Type',
          type: 'select',
          required: true,
          options: [
            { value: 'RECOURSE', label: 'With Recourse' },
            { value: 'NON_RECOURSE', label: 'Non-Recourse' },
          ],
        },
        {
          key: 'minimum_ledger_turnover',
          label: 'Minimum Ledger Turnover',
          type: 'number',
          placeholder: 'Annual minimum',
        },
        {
          key: 'clean_down_requirement',
          label: 'Clean-Down Requirement',
          type: 'text',
          placeholder: 'e.g. facility must be nil for 30 days annually',
        },
      ],
    },
    {
      title: 'Debtor / Concentration Controls',
      fields: [
        {
          key: 'single_debtor_concentration_limit',
          label: 'Single Debtor Concentration Limit (%)',
          type: 'number',
          placeholder: 'Max per debtor',
        },
        {
          key: 'top_debtor_limits',
          label: 'Top Debtor Limits',
          type: 'textarea',
          placeholder: 'List top debtors and individual limits...',
          colSpan: 2,
        },
        {
          key: 'eligible_invoice_criteria',
          label: 'Eligible Invoice Criteria',
          type: 'textarea',
          placeholder: 'Max invoice age, excluded sectors, dispute rules...',
          colSpan: 2,
        },
      ],
    },
    {
      title: 'Operations',
      fields: [
        {
          key: 'notification_of_assignment',
          label: 'Notification of Assignment',
          type: 'select',
          options: YES_NO,
        },
        {
          key: 'collections_handling',
          label: 'Collections Handling',
          type: 'select',
          options: [
            { value: 'BANK', label: 'Bank Managed' },
            { value: 'CUSTOMER', label: 'Customer Managed' },
          ],
        },
        {
          key: 'invoice_upload_method',
          label: 'Invoice Upload Method',
          type: 'select',
          options: [
            { value: 'API', label: 'API Integration' },
            { value: 'PORTAL', label: 'Online Portal' },
            { value: 'FILE', label: 'File Upload' },
          ],
        },
      ],
    },
  ],
};

// ─── 11. Microfinance Loan ─────────────────────────────────────────────
const MICROFINANCE: ProductFieldConfig = {
  amountLabel: 'Loan Amount',
  purposeOptions: [
    { value: 'BUSINESS_START', label: 'Business Start-Up' },
    { value: 'EDUCATION', label: 'Education' },
    { value: 'EMERGENCY', label: 'Emergency' },
    { value: 'AGRICULTURE', label: 'Agriculture' },
    { value: 'HOUSEHOLD', label: 'Household' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility Details',
      fields: [
        {
          key: 'purpose_category',
          label: 'Purpose Category',
          type: 'select',
          required: true,
          options: [
            { value: 'BUSINESS_START', label: 'Business Start-Up' },
            { value: 'EDUCATION', label: 'Education' },
            { value: 'EMERGENCY', label: 'Emergency' },
            { value: 'AGRICULTURE', label: 'Agriculture' },
            { value: 'HOUSEHOLD', label: 'Household Improvement' },
          ],
        },
        {
          key: 'repayment_frequency',
          label: 'Repayment Frequency',
          type: 'select',
          options: [
            { value: 'WEEKLY', label: 'Weekly' },
            { value: 'FORTNIGHTLY', label: 'Fortnightly' },
            { value: 'MONTHLY', label: 'Monthly' },
          ],
        },
        {
          key: 'repayment_channel',
          label: 'Repayment Channel',
          type: 'select',
          options: [
            { value: 'DIRECT_DEBIT', label: 'Direct Debit' },
            { value: 'CASH_AGENT', label: 'Cash Agent' },
            { value: 'MOBILE_MONEY', label: 'Mobile Money' },
          ],
        },
      ],
    },
    {
      title: 'Risk Assessment',
      fields: [
        {
          key: 'alternative_income_verification',
          label: 'Alternative Income Verification',
          type: 'textarea',
          placeholder: 'Cashflow declaration, micro-statements, transaction history...',
          colSpan: 2,
        },
        {
          key: 'household_size',
          label: 'Household Size',
          type: 'number',
          placeholder: 'Number of persons',
        },
        {
          key: 'dependents',
          label: 'Number of Dependents',
          type: 'number',
          placeholder: 'Financial dependents',
        },
        { key: 'group_guarantee', label: 'Group Guarantee', type: 'select', options: YES_NO },
        {
          key: 'group_members',
          label: 'Group Members',
          type: 'textarea',
          placeholder: 'List group members...',
          colSpan: 2,
          showWhen: { field: 'group_guarantee', values: ['YES'] },
        },
      ],
    },
  ],
};

// ─── 12. Personal Contract Purchase (PCP) ──────────────────────────────
const PCP: ProductFieldConfig = {
  amountLabel: 'Finance Amount',
  purposeOptions: [
    { value: 'VEHICLE_PURCHASE', label: 'New Vehicle (PCP)' },
    { value: 'USED_VEHICLE', label: 'Used Vehicle (PCP)' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Vehicle Details',
      fields: [
        {
          key: 'vehicleMake',
          label: 'Make',
          type: 'text',
          required: true,
          placeholder: 'e.g. BMW',
        },
        {
          key: 'vehicleModel',
          label: 'Model',
          type: 'text',
          required: true,
          placeholder: 'e.g. 3 Series',
        },
        {
          key: 'vehicleYear',
          label: 'Year',
          type: 'number',
          required: true,
          placeholder: 'e.g. 2026',
        },
        {
          key: 'vehicleCondition',
          label: 'Condition',
          type: 'select',
          required: true,
          options: VEHICLE_CONDITION,
        },
        {
          key: 'vehicleValue',
          label: 'Vehicle Value',
          type: 'number',
          required: true,
          placeholder: 'On-the-road price',
        },
        { key: 'dealer_name', label: 'Dealer Name', type: 'text', placeholder: 'Dealer name' },
      ],
    },
    {
      title: 'PCP Structure',
      fields: [
        {
          key: 'deposit_amount',
          label: 'Deposit Amount',
          type: 'number',
          required: true,
          placeholder: 'Initial deposit',
        },
        {
          key: 'monthly_payment_amount',
          label: 'Monthly Payment',
          type: 'number',
          placeholder: 'Estimated monthly payment',
        },
        {
          key: 'gmfv',
          label: 'GMFV / Balloon Payment',
          type: 'number',
          required: true,
          placeholder: 'Guaranteed Minimum Future Value',
        },
        {
          key: 'annual_mileage_limit',
          label: 'Annual Mileage Limit',
          type: 'number',
          placeholder: 'e.g. 20000',
        },
        {
          key: 'excess_mileage_fee',
          label: 'Excess Mileage Fee (per km)',
          type: 'number',
          step: '0.01',
          placeholder: 'Fee per excess km',
        },
        {
          key: 'optional_purchase_at_end',
          label: 'Option to Purchase at End',
          type: 'select',
          options: YES_NO,
        },
        {
          key: 'wear_and_tear_acknowledged',
          label: 'Wear & Tear Policy Acknowledged',
          type: 'select',
          options: YES_NO,
        },
      ],
    },
  ],
};

// ─── 13. Personal Loan ────────────────────────────────────────────────
const PERSONAL_LOAN: ProductFieldConfig = {
  amountLabel: 'Loan Amount',
  purposeOptions: [
    { value: 'HOME_IMPROVEMENT', label: 'Home Improvement' },
    { value: 'WEDDING', label: 'Wedding' },
    { value: 'EDUCATION', label: 'Education' },
    { value: 'DEBT_CONSOLIDATION', label: 'Debt Consolidation' },
    { value: 'MEDICAL', label: 'Medical Expenses' },
    { value: 'TRAVEL', label: 'Travel' },
    { value: 'PERSONAL_USE', label: 'Personal Use' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility Details',
      fields: [
        {
          key: 'repayment_type',
          label: 'Repayment Type',
          type: 'select',
          options: [{ value: 'AMORTISING', label: 'Amortising' }],
        },
        {
          key: 'consolidation_details',
          label: 'Consolidation Details',
          type: 'textarea',
          placeholder: 'List debts being consolidated: lender, balance, monthly payment...',
          colSpan: 2,
          showWhen: { field: 'loanPurpose', values: ['DEBT_CONSOLIDATION'] },
        },
      ],
    },
    {
      title: 'Disbursement',
      fields: [
        {
          key: 'disbursement_account_iban',
          label: 'Disbursement Account IBAN',
          type: 'text',
          placeholder: 'IBAN for fund transfer',
        },
        { key: 'pay_to_third_party', label: 'Pay to Third Party', type: 'select', options: YES_NO },
        {
          key: 'payee_details',
          label: 'Payee Details',
          type: 'textarea',
          placeholder: 'Third-party payee name, IBAN, reference...',
          colSpan: 2,
          showWhen: { field: 'pay_to_third_party', values: ['YES'] },
        },
      ],
    },
    {
      title: 'Employment & Income',
      fields: [
        {
          key: 'employmentStatus',
          label: 'Employment Status',
          type: 'select',
          options: EMPLOYMENT_OPTIONS,
        },
        {
          key: 'employerName',
          label: 'Employer Name',
          type: 'text',
          placeholder: 'Current employer',
        },
        {
          key: 'annualIncome',
          label: 'Annual Income',
          type: 'number',
          placeholder: 'Gross annual income',
        },
      ],
    },
  ],
};

// ─── 14. SME Term Loan ─────────────────────────────────────────────────
const SME_TERM_LOAN: ProductFieldConfig = {
  ...BUSINESS_LOAN,
  purposeOptions: [
    ...BUSINESS_LOAN.purposeOptions,
    { value: 'STARTUP', label: 'Business Start-Up' },
  ],
  sections: [
    ...BUSINESS_LOAN.sections,
    {
      title: 'SME Classification',
      fields: [
        {
          key: 'sme_size_band',
          label: 'SME Size Band',
          type: 'select',
          required: true,
          options: [
            { value: 'MICRO', label: 'Micro (< 10 employees)' },
            { value: 'SMALL', label: 'Small (10-49 employees)' },
            { value: 'MEDIUM', label: 'Medium (50-249 employees)' },
          ],
        },
        {
          key: 'government_scheme_flag',
          label: 'Government Scheme',
          type: 'select',
          options: [
            { value: 'NONE', label: 'None' },
            { value: 'SBCI', label: 'SBCI Scheme' },
            { value: 'MICROFINANCE_IRELAND', label: 'Microfinance Ireland' },
            { value: 'OTHER', label: 'Other Government Scheme' },
          ],
        },
      ],
    },
  ],
};

// ─── 15. Business Credit Card ──────────────────────────────────────────
const BUSINESS_CREDIT_CARD: ProductFieldConfig = {
  amountLabel: 'Company Credit Limit',
  termLabel: '',
  purposeOptions: [
    { value: 'BUSINESS_SPENDING', label: 'Business Spending' },
    { value: 'TRAVEL', label: 'Travel & Entertainment' },
    { value: 'PROCUREMENT', label: 'Procurement' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility',
      fields: [
        {
          key: 'cash_limit',
          label: 'Cash Limit',
          type: 'number',
          placeholder: 'Max cash withdrawal',
        },
        {
          key: 'billing_cycle_day',
          label: 'Billing Cycle Day',
          type: 'number',
          placeholder: '1-28',
        },
        {
          key: 'payment_terms_days',
          label: 'Payment Terms (days)',
          type: 'number',
          placeholder: 'e.g. 30',
        },
      ],
    },
    {
      title: 'Card Programme',
      fields: [
        {
          key: 'number_of_cards_requested',
          label: 'Number of Cards Requested',
          type: 'number',
          required: true,
          placeholder: 'Total cards',
        },
        {
          key: 'cardholder_list',
          label: 'Cardholder List',
          type: 'textarea',
          required: true,
          placeholder: 'Name, role, spend limit per cardholder (one per line)...',
          colSpan: 2,
        },
        {
          key: 'expense_policy_tags',
          label: 'Expense Policy Tags',
          type: 'text',
          placeholder: 'e.g. travel, meals, supplies',
        },
      ],
    },
    {
      title: 'Pricing',
      fields: [
        {
          key: 'annual_fee_per_card',
          label: 'Annual Fee Per Card',
          type: 'number',
          placeholder: 'Per-card annual fee',
        },
        { key: 'apr_purchase', label: 'APR – Purchases (%)', type: 'number', step: '0.01' },
        { key: 'apr_cash', label: 'APR – Cash (%)', type: 'number', step: '0.01' },
      ],
    },
  ],
};

// ─── 16. Business Overdraft ────────────────────────────────────────────
const BUSINESS_OVERDRAFT: ProductFieldConfig = {
  amountLabel: 'Permanent Limit',
  termLabel: '',
  purposeOptions: [
    { value: 'WORKING_CAPITAL', label: 'Cash Flow Management' },
    { value: 'SEASONAL', label: 'Seasonal Needs' },
    { value: 'BUSINESS_OPERATIONS', label: 'Business Operations' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Limits',
      fields: [
        { key: 'permanent_review_date', label: 'Permanent Review / Renewal Date', type: 'date' },
        {
          key: 'temporary_limit',
          label: 'Temporary Limit',
          type: 'number',
          placeholder: 'Short-term increase',
        },
        {
          key: 'temporary_limit_start_date',
          label: 'Temporary Limit Start',
          type: 'date',
          showWhen: { field: 'temporary_limit', values: [] },
        },
        {
          key: 'temporary_limit_end_date',
          label: 'Temporary Limit End',
          type: 'date',
          showWhen: { field: 'temporary_limit', values: [] },
        },
      ],
    },
    {
      title: 'Pricing',
      fields: [
        {
          key: 'interest_rate_type',
          label: 'Interest Rate Type',
          type: 'select',
          options: [
            { value: 'VARIABLE', label: 'Variable' },
            { value: 'FIXED', label: 'Fixed' },
          ],
        },
        {
          key: 'base_rate_index',
          label: 'Base Rate Index',
          type: 'text',
          placeholder: 'e.g. EURIBOR 3M',
        },
        { key: 'margin_bps', label: 'Margin (bps)', type: 'number', placeholder: 'e.g. 250' },
        { key: 'arrangement_fee', label: 'Arrangement Fee', type: 'number' },
        {
          key: 'utilisation_fee',
          label: 'Utilisation Fee',
          type: 'number',
          placeholder: 'If applicable',
        },
        { key: 'excess_fee', label: 'Unauthorised Excess Fee', type: 'number' },
      ],
    },
    {
      title: 'Account & Controls',
      fields: [
        {
          key: 'operating_account_iban',
          label: 'Operating Account IBAN',
          type: 'text',
          placeholder: 'Linked current account',
        },
        {
          key: 'clean_up_period_days',
          label: 'Clean-Up Period (days)',
          type: 'number',
          placeholder: 'Must return to credit for X days',
        },
        {
          key: 'monitoring_frequency',
          label: 'Monitoring Frequency',
          type: 'select',
          options: [
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'QUARTERLY', label: 'Quarterly' },
            { value: 'ANNUAL', label: 'Annual' },
          ],
        },
        {
          key: 'security_overdraft',
          label: 'Security',
          type: 'select',
          options: [
            { value: 'PG', label: 'Personal Guarantee' },
            { value: 'DEBENTURE', label: 'Debenture' },
            { value: 'NONE', label: 'None' },
          ],
        },
      ],
    },
  ],
};

// ─── 17. Commercial Mortgage ───────────────────────────────────────────
const COMMERCIAL_MORTGAGE: ProductFieldConfig = {
  amountLabel: 'Loan Amount',
  termLabel: 'Term (years)',
  purposeOptions: [
    { value: 'PURCHASE', label: 'Property Purchase' },
    { value: 'REFINANCE', label: 'Refinance' },
    { value: 'DEVELOPMENT', label: 'Development' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Facility Details',
      fields: [
        {
          key: 'repayment_type',
          label: 'Repayment Type',
          type: 'select',
          options: REPAYMENT_TYPES,
        },
        {
          key: 'rate_type',
          label: 'Rate Type',
          type: 'select',
          options: [
            { value: 'FIXED', label: 'Fixed' },
            { value: 'VARIABLE', label: 'Variable' },
          ],
        },
        {
          key: 'fixed_period_years',
          label: 'Fixed Period (years)',
          type: 'number',
          placeholder: 'If fixed rate',
          showWhen: { field: 'rate_type', values: ['FIXED'] },
        },
        {
          key: 'interest_only_period',
          label: 'Interest-Only Period (months)',
          type: 'number',
          placeholder: 'Initial I/O period',
        },
      ],
    },
    {
      title: 'Property Details',
      fields: [
        {
          key: 'propertyAddress',
          label: 'Property Address',
          type: 'text',
          required: true,
          placeholder: 'Full property address',
          colSpan: 2,
        },
        { key: 'propertyCity', label: 'City', type: 'text' },
        { key: 'propertyState', label: 'County / Region', type: 'text' },
        { key: 'propertyPostalCode', label: 'Eircode / Postcode', type: 'text' },
        {
          key: 'commercial_property_type',
          label: 'Property Type',
          type: 'select',
          required: true,
          options: [
            { value: 'OFFICE', label: 'Office' },
            { value: 'RETAIL', label: 'Retail' },
            { value: 'INDUSTRIAL', label: 'Industrial' },
            { value: 'WAREHOUSE', label: 'Warehouse' },
            { value: 'MIXED_USE', label: 'Mixed Use' },
          ],
        },
        {
          key: 'purchase_price',
          label: 'Purchase Price / Market Value',
          type: 'number',
          required: true,
        },
        {
          key: 'valuation_details',
          label: 'Valuation Details',
          type: 'text',
          placeholder: 'Valuer name and date',
        },
        { key: 'solicitor_details', label: 'Solicitor / Title Details', type: 'text' },
      ],
    },
    {
      title: 'Income & Tenancy',
      fields: [
        {
          key: 'rental_income_schedule',
          label: 'Rental Income Schedule',
          type: 'textarea',
          placeholder: 'Monthly/annual rental income breakdown...',
          colSpan: 2,
        },
        {
          key: 'tenant_details',
          label: 'Tenant List & Lease Details',
          type: 'textarea',
          placeholder: 'Tenant name, lease start/end, rent, break clauses, rent review dates...',
          colSpan: 2,
        },
        {
          key: 'vacancy_assumption',
          label: 'Vacancy Assumption (%)',
          type: 'number',
          placeholder: 'e.g. 5',
        },
      ],
    },
    {
      title: 'Security & Guarantees',
      fields: [
        { key: 'charge_on_property', label: 'Charge on Property', type: 'select', options: YES_NO },
        { key: 'debenture_required', label: 'Debenture Required', type: 'select', options: YES_NO },
        {
          key: 'guarantor_details',
          label: 'Guarantor Details',
          type: 'textarea',
          placeholder: 'Personal guarantee details...',
          colSpan: 2,
        },
      ],
    },
  ],
};

// ─── 18. Hire Purchase ─────────────────────────────────────────────────
const HIRE_PURCHASE: ProductFieldConfig = {
  amountLabel: 'Finance Amount',
  purposeOptions: [
    { value: 'EQUIPMENT_PURCHASE', label: 'Equipment Purchase' },
    { value: 'VEHICLE', label: 'Vehicle' },
    { value: 'MACHINERY', label: 'Machinery' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Asset Details',
      fields: [
        {
          key: 'asset_category',
          label: 'Asset Category',
          type: 'select',
          required: true,
          options: [
            { value: 'VEHICLE', label: 'Vehicle' },
            { value: 'MACHINERY', label: 'Machinery' },
            { value: 'EQUIPMENT', label: 'Equipment' },
            { value: 'IT', label: 'IT / Technology' },
            { value: 'OTHER', label: 'Other' },
          ],
        },
        {
          key: 'asset_description',
          label: 'Asset Description',
          type: 'textarea',
          required: true,
          placeholder: 'Describe the asset...',
          colSpan: 2,
        },
        {
          key: 'supplier_name',
          label: 'Supplier / Dealer',
          type: 'text',
          required: true,
          placeholder: 'Name of supplier',
        },
        {
          key: 'invoice_amount',
          label: 'Invoice Amount',
          type: 'number',
          required: true,
          placeholder: 'Supplier invoice total',
        },
        {
          key: 'deposit_amount',
          label: 'Deposit Amount',
          type: 'number',
          placeholder: 'Upfront deposit',
        },
      ],
    },
    {
      title: 'HP Structure',
      fields: [
        {
          key: 'installment_amount',
          label: 'Instalment Amount',
          type: 'number',
          placeholder: 'Per-period payment',
        },
        {
          key: 'final_option_fee',
          label: 'Final Option-to-Purchase Fee',
          type: 'number',
          placeholder: 'Usually nominal',
        },
        {
          key: 'balloon_payment',
          label: 'Balloon Payment',
          type: 'number',
          placeholder: 'If applicable',
        },
        {
          key: 'ownership_transfer',
          label: 'Ownership Transfer at End',
          type: 'select',
          options: [
            { value: 'YES', label: 'Yes (standard HP)' },
            { value: 'NO', label: 'No' },
          ],
        },
      ],
    },
    {
      title: 'Insurance',
      fields: [
        {
          key: 'asset_insurance_required',
          label: 'Asset Insurance Required',
          type: 'select',
          options: YES_NO,
        },
        {
          key: 'insurance_details',
          label: 'Insurance Details',
          type: 'text',
          placeholder: 'Policy provider / reference',
          showWhen: { field: 'asset_insurance_required', values: ['YES'] },
        },
      ],
    },
  ],
};

// ─── 19. Personal Overdraft ────────────────────────────────────────────
const PERSONAL_OVERDRAFT: ProductFieldConfig = {
  amountLabel: 'Overdraft Limit',
  termLabel: '',
  purposeOptions: [
    { value: 'CASH_FLOW', label: 'Cash Flow Buffer' },
    { value: 'PERSONAL_USE', label: 'Personal Use' },
    { value: 'EMERGENCY', label: 'Emergency Fund' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Limits',
      fields: [
        { key: 'permanent_review_date', label: 'Review Date', type: 'date' },
        {
          key: 'temporary_limit',
          label: 'Temporary Limit',
          type: 'number',
          placeholder: 'Short-term increase',
        },
        {
          key: 'temporary_limit_start_date',
          label: 'Temporary Start Date',
          type: 'date',
          showWhen: { field: 'temporary_limit', values: [] },
        },
        {
          key: 'temporary_limit_end_date',
          label: 'Temporary End Date',
          type: 'date',
          showWhen: { field: 'temporary_limit', values: [] },
        },
      ],
    },
    {
      title: 'Pricing',
      fields: [
        {
          key: 'overdraft_interest_rate',
          label: 'Overdraft Interest Rate (%)',
          type: 'number',
          step: '0.01',
        },
        { key: 'monthly_fee', label: 'Monthly Maintenance Fee', type: 'number' },
        { key: 'unauthorised_overdraft_fee', label: 'Unauthorised Overdraft Fee', type: 'number' },
      ],
    },
    {
      title: 'Account Linkage',
      fields: [
        {
          key: 'current_account_iban',
          label: 'Current Account IBAN',
          type: 'text',
          required: true,
          placeholder: 'Linked current account',
        },
      ],
    },
    {
      title: 'Affordability',
      fields: [
        {
          key: 'employmentStatus',
          label: 'Employment Status',
          type: 'select',
          options: EMPLOYMENT_OPTIONS,
        },
        {
          key: 'annualIncome',
          label: 'Annual Income',
          type: 'number',
          placeholder: 'Gross annual income',
        },
      ],
    },
  ],
};

// ─── Master mapping ────────────────────────────────────────────────────
const PRODUCT_FIELD_CONFIGS: Record<string, ProductFieldConfig> = {
  // Primary types (matching DB enum credit.loan_product_type)
  AGRICULTURE_LOAN: AGRI_LOAN,
  PERSONAL_LOAN,
  AUTO_LOAN,
  CREDIT_CARD,
  OVERDRAFT: PERSONAL_OVERDRAFT,
  TERM_LOAN: BUSINESS_LOAN,

  // Extended types (frontend-defined product types)
  AGRI_LOAN,
  ASSET_LEASING,
  BUSINESS_LOAN,
  BNPL,
  BUSINESS_CREDIT_CARD,
  BUSINESS_OVERDRAFT,
  COMMERCIAL_MORTGAGE,
  CREDIT_UNION_LOAN,
  GREEN_LOAN,
  HIRE_PURCHASE,
  HOME_LOAN: HOME_MORTGAGE,
  INVOICE_FINANCE,
  MICROFINANCE,
  MORTGAGE: HOME_MORTGAGE,
  PCP,
  SME_TERM_LOAN,

  // DB enum aliases
  BUSINESS_LINE_OF_CREDIT: BUSINESS_OVERDRAFT,
  WORKING_CAPITAL_LOAN: BUSINESS_LOAN,
  EQUIPMENT_FINANCING: HIRE_PURCHASE,
  COMMERCIAL_REAL_ESTATE: COMMERCIAL_MORTGAGE,
  CONSTRUCTION_LOAN: BUSINESS_LOAN,
  STUDENT_LOAN: PERSONAL_LOAN,
  BRIDGE_LOAN: BUSINESS_LOAN,
  REVOLVING_CREDIT: BUSINESS_OVERDRAFT,
};

/** Fallback config for unrecognised product types */
const DEFAULT_CONFIG: ProductFieldConfig = {
  amountLabel: 'Loan Amount',
  purposeOptions: [
    { value: 'PERSONAL_USE', label: 'Personal Use' },
    { value: 'BUSINESS_EXPANSION', label: 'Business Expansion' },
    { value: 'WORKING_CAPITAL', label: 'Working Capital' },
    { value: 'DEBT_CONSOLIDATION', label: 'Debt Consolidation' },
    { value: 'OTHER', label: 'Other' },
  ],
  sections: [
    {
      title: 'Employment & Income',
      fields: [
        {
          key: 'employmentStatus',
          label: 'Employment Status',
          type: 'select',
          options: EMPLOYMENT_OPTIONS,
        },
        {
          key: 'employerName',
          label: 'Employer Name',
          type: 'text',
          placeholder: 'Current employer',
        },
        {
          key: 'annualIncome',
          label: 'Annual Income',
          type: 'number',
          placeholder: 'Gross annual income',
        },
      ],
    },
  ],
};

/**
 * Get the product-specific field configuration for a given product type.
 */
export function getProductFieldConfig(productType: string): ProductFieldConfig {
  return PRODUCT_FIELD_CONFIGS[productType] || DEFAULT_CONFIG;
}

/**
 * Get all keys from all sections of a product config (useful for
 * initialising empty form state).
 */
export function getAllFieldKeys(config: ProductFieldConfig): string[] {
  const keys: string[] = [];
  for (const section of config.sections) {
    for (const field of section.fields) {
      keys.push(field.key);
    }
  }
  return keys;
}
