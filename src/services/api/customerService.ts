import apiClient from '@/lib/api-client';

export interface Customer {
  customerId: string;
  customerNumber: string;
  customerType: 'INDIVIDUAL' | 'BUSINESS' | 'CORPORATE';

  // Individual fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;

  // Business fields
  businessName?: string;
  businessLegalName?: string;
  businessRegistrationNumber?: string;
  businessRegistrationDate?: string;
  businessType?: string;
  industrySector?: string;
  yearsInBusiness?: number;
  numberOfEmployees?: number;

  // Contact
  primaryEmail: string;
  secondaryEmail?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  mobilePhone?: string;
  preferredContactMethod?: string;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;

  // Identity
  primaryIdentityType?: string;
  primaryIdentityNumber?: string;
  taxIdNumber?: string;

  // Financial
  annualIncome?: number;
  annualRevenue?: number;
  netWorth?: number;
  employmentStatus?: string;
  employerName?: string;
  occupation?: string;

  // Credit
  creditScore?: number;
  creditScoreDate?: string;
  riskRating?: string;
  riskRatingDate?: string;

  // Status
  customerStatus: string;
  customerSince?: string;
  customerSegment?: string;
  referralSource?: string;

  // KYC/AML
  kycStatus?: string;
  kycCompletionDate?: string;
  amlCheckStatus?: string;
  amlCheckDate?: string;

  // Computed fields
  displayName?: string;
  age?: number;
  fullAddress?: string;
}

export interface CustomerSearchParams {
  searchTerm?: string;
  customerType?: string;
  status?: string;
  riskRating?: string;
  kycStatus?: string;
  segment?: string;
}

class CustomerService {
  /**
   * Search customers by term (name, email, phone, etc.)
   */
  async searchCustomers(params: CustomerSearchParams): Promise<Customer[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params.searchTerm) {
        queryParams.append('q', params.searchTerm);
      }

      const response = await apiClient.get<Customer[]>(
        `/api/admin/customers/search?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  /**
   * Get all active customers
   */
  async getAllCustomers(): Promise<Customer[]> {
    try {
      const response = await apiClient.get<Customer[]>('/api/admin/customers');
      return response.data;
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<Customer> {
    try {
      const response = await apiClient.get<Customer>(`/api/admin/customers/${customerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  }

  /**
   * Get customer by customer number
   */
  async getCustomerByNumber(customerNumber: string): Promise<Customer> {
    try {
      const response = await apiClient.get<Customer>(
        `/api/admin/customers/number/${customerNumber}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  }

  /**
   * Get customers by type
   */
  async getCustomersByType(customerType: string): Promise<Customer[]> {
    try {
      const response = await apiClient.get<Customer[]>(`/api/admin/customers/type/${customerType}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customers by type:', error);
      throw error;
    }
  }

  /**
   * Get customers by risk rating
   */
  async getCustomersByRiskRating(riskRating: string): Promise<Customer[]> {
    try {
      const response = await apiClient.get<Customer[]>(
        `/api/admin/customers/risk-rating/${riskRating}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching customers by risk rating:', error);
      throw error;
    }
  }

  /**
   * Get customers by status
   */
  async getCustomersByStatus(status: string): Promise<Customer[]> {
    try {
      const response = await apiClient.get<Customer[]>(`/api/admin/customers/status/${status}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customers by status:', error);
      throw error;
    }
  }

  /**
   * Get customers by KYC status
   */
  async getCustomersByKycStatus(kycStatus: string): Promise<Customer[]> {
    try {
      const response = await apiClient.get<Customer[]>(
        `/api/admin/customers/kyc-status/${kycStatus}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching customers by KYC status:', error);
      throw error;
    }
  }

  /**
   * Get customers by segment
   */
  async getCustomersBySegment(segment: string): Promise<Customer[]> {
    try {
      const response = await apiClient.get<Customer[]>(`/api/admin/customers/segment/${segment}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customers by segment:', error);
      throw error;
    }
  }

  /**
   * Get customer count
   */
  async getCustomerCount(): Promise<number> {
    try {
      const response = await apiClient.get<{ count: number }>('/api/admin/customers/count');
      return response.data.count;
    } catch (error) {
      console.error('Error fetching customer count:', error);
      throw error;
    }
  }

  // Helper methods

  /**
   * Get customer display name
   */
  getCustomerName(customer: Customer): string {
    if (customer.displayName) {
      return customer.displayName;
    }
    if (customer.customerType === 'INDIVIDUAL') {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return customer.businessName || customer.businessLegalName || 'Unknown';
  }

  /**
   * Format customer type
   */
  formatCustomerType(type: string): string {
    const types: Record<string, string> = {
      INDIVIDUAL: 'Individual',
      BUSINESS: 'Business',
      CORPORATE: 'Corporate',
    };
    return types[type] || type;
  }

  /**
   * Get risk rating color for UI
   */
  getRiskRatingColor(rating?: string): string {
    const colors: Record<string, string> = {
      EXCELLENT: 'green',
      GOOD: 'blue',
      FAIR: 'yellow',
      POOR: 'orange',
      BAD: 'red',
      NOT_RATED: 'gray',
    };
    return rating ? colors[rating] || 'gray' : 'gray';
  }

  /**
   * Get KYC status color for UI
   */
  getKycStatusColor(status?: string): string {
    const colors: Record<string, string> = {
      APPROVED: 'green',
      PENDING: 'yellow',
      REJECTED: 'red',
      EXPIRED: 'orange',
    };
    return status ? colors[status] || 'gray' : 'gray';
  }

  /**
   * Format phone number for display
   */
  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';
    // Simple formatting - can be enhanced
    return phone.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  }

  /**
   * Calculate age from date of birth
   */
  calculateAge(dateOfBirth?: string): number | null {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Update customer details
   */
  async updateCustomer(customerId: string, updateData: Partial<Customer>): Promise<Customer> {
    try {
      const response = await apiClient.put<Customer>(
        `/api/admin/customers/${customerId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  /**
   * Update customer status (activate/deactivate/suspend)
   */
  async updateCustomerStatus(customerId: string, status: string): Promise<Customer> {
    try {
      const response = await apiClient.patch<Customer>(
        `/api/admin/customers/${customerId}/status`,
        { status }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating customer status:', error);
      throw error;
    }
  }

  /**
   * Soft delete customer (mark as deleted, recoverable)
   */
  async softDeleteCustomer(customerId: string): Promise<{ message: string; customerId: string }> {
    try {
      const response = await apiClient.delete<{ message: string; customerId: string }>(
        `/api/admin/customers/${customerId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error soft deleting customer:', error);
      throw error;
    }
  }

  /**
   * Permanently delete customer (irreversible)
   */
  async hardDeleteCustomer(customerId: string): Promise<{ message: string; customerId: string }> {
    try {
      const response = await apiClient.delete<{ message: string; customerId: string }>(
        `/api/admin/customers/${customerId}/permanent`
      );
      return response.data;
    } catch (error) {
      console.error('Error permanently deleting customer:', error);
      throw error;
    }
  }
}

export const customerService = new CustomerService();
