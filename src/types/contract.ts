export type DataDomainValue = 'O' | 'X' | 'null';

export interface Contract {
  id: string;
  region: string;
  country: string;
  entity_code: string;
  brand: string;
  entity_name: string;
  data_domain_vehicle: DataDomainValue;
  data_domain_customer: DataDomainValue;
  data_domain_sales: DataDomainValue;
  data_domain_quality: DataDomainValue;
  data_domain_production: DataDomainValue;
  contract_status: string | null;
  transfer_purpose: string | null;
  transferable_data: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  files?: ContractFile[];
  versions?: ContractVersion[];
}

export interface ContractVersion {
  id: string;
  contract_id: string;
  version_number: number;
  change_reason: string | null;
  transfer_purpose: string | null;
  transferable_data: string | null;
  effective_date: string | null;
  added_domains: string | null; // JSON: e.g. ["customer","sales"]
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
  files?: ContractFile[];
}

export interface ContractFile {
  id: string;
  contract_id: string;
  version_id: string | null;
  file_category: 'final_contract' | 'related_document' | 'correspondence';
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface CreateContractInput {
  region: string;
  country: string;
  entity_code: string;
  brand: string;
  entity_name: string;
  data_domain_vehicle?: DataDomainValue;
  data_domain_customer?: DataDomainValue;
  data_domain_sales?: DataDomainValue;
  data_domain_quality?: DataDomainValue;
  data_domain_production?: DataDomainValue;
  contract_status?: string;
  transfer_purpose?: string;
  transferable_data?: string;
}

export type UpdateContractInput = Partial<CreateContractInput>;
