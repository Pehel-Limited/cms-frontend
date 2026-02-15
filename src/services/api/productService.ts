import axios from 'axios';
import config from '@/config';

const API_URL = config.api.baseUrl;

export interface Product {
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  productCategory: string;
  productStatus: string;
  shortDescription?: string;
  detailedDescription?: string;
  marketingDescription?: string;
  termsAndConditions?: string;

  // Irish/EU specific fields
  interestLogicDescription?: string;
  principalStructure?: string;
  regulatoryBody?: string;
  eligibleCustomerTypes?: string[];

  // Eligibility
  minCustomerAge?: number;
  maxCustomerAge?: number;
  minCreditScore?: number;
  minAnnualIncome?: number;
  minYearsInBusiness?: number;
  minBusinessRevenue?: number;

  // Amounts
  minLoanAmount: number;
  maxLoanAmount: number;
  defaultLoanAmount?: number;
  amountStepSize?: number;

  // Interest
  interestType: string;
  minInterestRate: number;
  maxInterestRate: number;
  defaultInterestRate?: number;

  // Terms
  minTermMonths: number;
  maxTermMonths: number;
  defaultTermMonths?: number;
  termStepMonths?: number;
  repaymentFrequency?: string;
  gracePeriodDays?: number;

  // Fees
  processingFee?: number;
  processingFeePercentage?: number;
  latePaymentFee?: number;

  // Features
  prepaymentAllowed?: boolean;
  prepaymentPenaltyPercentage?: number;
  collateralRequired?: boolean;
  collateralTypes?: string[];
  loanToValueRatio?: number;
  downPaymentRequired?: boolean;
  minDownPaymentPercentage?: number;
  requiresGuarantor?: boolean;
  minGuarantors?: number;

  // Flags
  isFeatured?: boolean;
  isOnlineApplicationEnabled?: boolean;
  autoApprovalEnabled?: boolean;
  autoApprovalMaxAmount?: number;
  autoApprovalMinCreditScore?: number;

  // SLA
  slaDays?: number;
}

export interface CreateProductRequest {
  bankId: string;
  productCode: string;
  productName: string;
  productType: string;
  productCategory?: string;
  shortDescription?: string;
  detailedDescription?: string;
  marketingDescription?: string;
  termsAndConditions?: string;
  interestLogicDescription?: string;
  principalStructure?: string;
  regulatoryBody?: string;
  eligibleCustomerTypes?: string[];
  minCustomerAge?: number;
  maxCustomerAge?: number;
  minCreditScore?: number;
  minAnnualIncome?: number;
  minYearsInBusiness?: number;
  minBusinessRevenue?: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  defaultLoanAmount?: number;
  amountStepSize?: number;
  interestType: string;
  minInterestRate: number;
  maxInterestRate: number;
  defaultInterestRate?: number;
  minTermMonths: number;
  maxTermMonths: number;
  defaultTermMonths?: number;
  termStepMonths?: number;
  repaymentFrequency?: string;
  gracePeriodDays?: number;
  processingFee?: number;
  processingFeePercentage?: number;
  latePaymentFee?: number;
  prepaymentAllowed?: boolean;
  prepaymentPenaltyPercentage?: number;
  collateralRequired?: boolean;
  collateralTypes?: string[];
  loanToValueRatio?: number;
  downPaymentRequired?: boolean;
  minDownPaymentPercentage?: number;
  requiresGuarantor?: boolean;
  minGuarantors?: number;
  isFeatured?: boolean;
  isOnlineApplicationEnabled?: boolean;
  autoApprovalEnabled?: boolean;
  autoApprovalMaxAmount?: number;
  autoApprovalMinCreditScore?: number;
  slaDays?: number;
}

export interface UpdateProductRequest {
  productCode?: string;
  productName?: string;
  productType?: string;
  productCategory?: string;
  productStatus?: string;
  shortDescription?: string;
  detailedDescription?: string;
  marketingDescription?: string;
  termsAndConditions?: string;
  interestLogicDescription?: string;
  principalStructure?: string;
  regulatoryBody?: string;
  eligibleCustomerTypes?: string[];
  minCustomerAge?: number;
  maxCustomerAge?: number;
  minCreditScore?: number;
  minAnnualIncome?: number;
  minYearsInBusiness?: number;
  minBusinessRevenue?: number;
  minLoanAmount?: number;
  maxLoanAmount?: number;
  defaultLoanAmount?: number;
  amountStepSize?: number;
  interestType?: string;
  minInterestRate?: number;
  maxInterestRate?: number;
  defaultInterestRate?: number;
  minTermMonths?: number;
  maxTermMonths?: number;
  defaultTermMonths?: number;
  termStepMonths?: number;
  repaymentFrequency?: string;
  gracePeriodDays?: number;
  processingFee?: number;
  processingFeePercentage?: number;
  latePaymentFee?: number;
  prepaymentAllowed?: boolean;
  prepaymentPenaltyPercentage?: number;
  collateralRequired?: boolean;
  collateralTypes?: string[];
  loanToValueRatio?: number;
  downPaymentRequired?: boolean;
  minDownPaymentPercentage?: number;
  requiresGuarantor?: boolean;
  minGuarantors?: number;
  isFeatured?: boolean;
  isOnlineApplicationEnabled?: boolean;
  autoApprovalEnabled?: boolean;
  autoApprovalMaxAmount?: number;
  autoApprovalMinCreditScore?: number;
  slaDays?: number;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
}

class ProductService {
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(config.auth.tokenKey);
    }
    return null;
  }

  private getUserId(): string | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(config.auth.userKey);
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.userId;
      }
    }
    return null;
  }

  private getHeaders() {
    const token = this.getAuthToken();
    const userId = this.getUserId();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(userId && { 'X-User-Id': userId }),
    };
  }

  async createProduct(request: CreateProductRequest): Promise<Product> {
    try {
      const response = await axios.post(`${API_URL}/api/admin/products`, request, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, request: UpdateProductRequest): Promise<Product> {
    try {
      const response = await axios.put(`${API_URL}/api/admin/products/${productId}`, request, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/api/admin/products/${productId}`, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  async getAllProducts(bankId: string): Promise<Product[]> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getActiveProducts(bankId: string): Promise<Product[]> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/active`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching active products:', error);
      throw error;
    }
  }

  async getProductsByCustomerType(bankId: string, customerType: string): Promise<Product[]> {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/products/customer-type/${customerType}`,
        {
          params: { bankId },
          headers: this.getHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching products by customer type:', error);
      throw error;
    }
  }

  async getFeaturedProducts(bankId: string): Promise<Product[]> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/featured`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching featured products:', error);
      throw error;
    }
  }

  async getProductById(productId: string): Promise<Product> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/${productId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async getProductByCode(productCode: string, bankId: string): Promise<Product> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/code/${productCode}`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching product by code:', error);
      throw error;
    }
  }

  async getProductsByCategory(category: string, bankId: string): Promise<Product[]> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/category/${category}`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }

  async getProductsByType(type: string, bankId: string): Promise<Product[]> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/type/${type}`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching products by type:', error);
      throw error;
    }
  }

  async countActiveProducts(bankId: string): Promise<number> {
    try {
      const response = await axios.get(`${API_URL}/api/admin/products/count`, {
        params: { bankId },
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('Error counting products:', error);
      throw error;
    }
  }

  // Helper methods for formatting
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatInterestRate(minRate: number, maxRate?: number): string {
    if (maxRate && minRate !== maxRate) {
      return `${minRate.toFixed(2)}% - ${maxRate.toFixed(2)}%`;
    }
    return `${minRate.toFixed(2)}%`;
  }

  formatLoanAmount(minAmount: number, maxAmount?: number): string {
    if (maxAmount && minAmount !== maxAmount) {
      return `€${minAmount.toLocaleString('en-IE')} - €${maxAmount.toLocaleString('en-IE')}`;
    }
    return `€${minAmount.toLocaleString('en-IE')}`;
  }

  formatTenure(minMonths: number, maxMonths?: number): string {
    const formatMonths = (months: number): string => {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (years === 0) return `${months} months`;
      if (remainingMonths === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
      return `${years}y ${remainingMonths}m`;
    };

    if (maxMonths && minMonths !== maxMonths) {
      return `${formatMonths(minMonths)} - ${formatMonths(maxMonths)}`;
    }
    return formatMonths(minMonths);
  }
}

export const productService = new ProductService();
