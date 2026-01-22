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
  shortDescription: string;
  detailedDescription?: string;

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

  // Interest
  interestType: string;
  minInterestRate: number;
  maxInterestRate: number;
  defaultInterestRate?: number;

  // Terms
  minTermMonths: number;
  maxTermMonths: number;
  defaultTermMonths?: number;
  repaymentFrequency: string;

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

  private getHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
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
      return `${(minRate * 100).toFixed(2)}% - ${(maxRate * 100).toFixed(2)}%`;
    }
    return `${(minRate * 100).toFixed(2)}%`;
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
