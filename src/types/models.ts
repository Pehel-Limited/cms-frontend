export interface Bank {
  bankId: string;
  bankCode: string;
  bankName: string;
  bankType: string;
  country?: string;
  website?: string;
  logo?: string;
  primaryColor?: string;
  isActive: boolean;
}

export interface Customer {
  customerId: string;
  bankId: string;
  customerNumber: string;
  customerName: string;
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  email?: string;
  phoneNumber?: string;
  status: string;
  createdAt: string;
}
