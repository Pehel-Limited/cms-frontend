'use client';

interface Props {
  caseData: Record<string, unknown>;
}

function fmt(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function fmtCurrency(value: unknown): string {
  if (value == null) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] break-words">
        {value}
      </span>
    </div>
  );
}

export default function OfferPanel({ caseData }: Props) {
  const productName = fmt(caseData.loanProduct);
  const borrowerName = fmt(caseData.borrowerDisplayName ?? caseData.borrowerName);
  const borrowerType = fmt(caseData.borrowerType);
  const caseType = fmt(caseData.caseType);
  const propertyAddress = fmt(caseData.propertyAddress);
  const loanAmount = fmtCurrency(caseData.loanAmount);
  const loanTermMonths =
    caseData.loanTermMonths != null ? `${caseData.loanTermMonths} months` : '—';
  const interestType = fmt(caseData.interestType);
  const facilityType = fmt(caseData.facilityType);
  const securityType = fmt(caseData.securityType);
  const specialConditions = caseData.specialConditions as string | undefined;
  const completionTarget = caseData.completionTargetDate as string | undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-blue-600"
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
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {productName !== '—' ? productName : 'Loan Offer'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {caseType !== '—' ? caseType.replace(/_/g, ' ') : 'Legal Case'} ·{' '}
            {borrowerType !== '—' ? borrowerType.replace(/_/g, ' ') : ''}
          </p>
        </div>
      </div>

      {/* Loan Summary Banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-xs text-blue-500 font-medium mb-1">Loan Amount</p>
          <p className="text-xl font-bold text-blue-700">{loanAmount}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">Term</p>
          <p className="text-xl font-bold text-gray-700">{loanTermMonths}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-500 font-medium mb-1">Interest Type</p>
          <p className="text-base font-bold text-gray-700">
            {interestType !== '—' ? interestType.replace(/_/g, ' ') : '—'}
          </p>
        </div>
      </div>

      {/* Borrower Details */}
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Borrower
        </h4>
        <DetailRow label="Name" value={borrowerName} />
        <DetailRow
          label="Type"
          value={borrowerType !== '—' ? borrowerType.replace(/_/g, ' ') : '—'}
        />
      </div>

      {/* Loan Details */}
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Loan Details
        </h4>
        <DetailRow label="Product" value={productName} />
        <DetailRow
          label="Facility Type"
          value={facilityType !== '—' ? facilityType.replace(/_/g, ' ') : '—'}
        />
        <DetailRow
          label="Security Type"
          value={securityType !== '—' ? securityType.replace(/_/g, ' ') : '—'}
        />
        <DetailRow label="Property Address" value={propertyAddress} />
        {!!caseData.eircode && <DetailRow label="Eircode" value={fmt(caseData.eircode)} />}
        {!!caseData.folioNumber && (
          <DetailRow label="Folio Number" value={fmt(caseData.folioNumber)} />
        )}
        {!!caseData.titleType && <DetailRow label="Title Type" value={fmt(caseData.titleType)} />}
        {completionTarget && (
          <DetailRow
            label="Completion Target"
            value={new Date(completionTarget).toLocaleDateString('en-IE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          />
        )}
      </div>

      {/* Special Conditions */}
      {specialConditions && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Special Conditions
          </h4>
          <p className="text-sm text-amber-900 whitespace-pre-line">{specialConditions}</p>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-gray-400 italic text-center">
        This is a summary of the loan offer associated with this legal case. Full offer
        documentation will be attached to the case.
      </p>
    </div>
  );
}
