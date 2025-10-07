// Base entity interface
export interface BaseEntity {
  id: number;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Base account interface
export interface BaseAccount extends BaseEntity {
  accountId: string;
  name: string;
  status: string;
  scores?: AccountScore[];
  parentId?: number;
}

// Account with children (for MCC accounts)
export interface Account extends BaseAccount {
  children?: SubAccount[];
  campaigns?: Campaign[];
}

// Sub-account interface
export interface SubAccount extends BaseAccount {
  parentId: number;
  children?: never; // Sub-accounts don't have children
  campaigns?: Campaign[];
}

// Campaign entity
export interface Campaign extends BaseEntity {
  campaignId: number;
  accountId: number;
  scores?: CampaignScore[];
}

// AdGroup entity
export interface AdGroup extends BaseEntity {
  adGroupId: number;
  campaignId: number;
  scores?: AdGroupScore[];
}

// Score interfaces
export interface AccountScore {
  id: number;
  accountId: number;
  date: string;
  qs: number;
  campaignCount: number;
}

export interface CampaignScore {
  id: number;
  campaignId: number;
  date: string;
  qs: number;
  adGroupCount: number;
}

export interface AdGroupScore {
  id: number;
  adGroupId: number;
  date: string;
  qs: number;
  keywordCount: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  statusCode?: number;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// DTOs for API responses
export interface AccountsResponse {
  accounts: Account[];
  total: number;
}

export interface AccountHierarchyResponse {
  success: boolean;
  statusCode: number;
  data: {
    accounts: Account[];
    total: number;
  };
  message: string;
  timestamp: string;
}

export interface AccountCampaignsResponse {
  campaigns: Campaign[];
  total: number;
}

export interface CampaignAdGroupsResponse {
  adGroups: AdGroup[];
  total: number;
}

// Mapper functions
export const mapAccountDto = (dto: any): Account => ({
  ...dto,
  id: Number(dto.id),
  accountId: Number(dto.accountId),
  scores: dto.scores?.map((s: any) => ({
    ...s,
    id: Number(s.id),
    accountId: Number(s.accountId),
    campaignCount: Number(s.campaignCount)
  }))
});

export const mapCampaignDto = (dto: any): Campaign => ({
  ...dto,
  id: Number(dto.id),
  campaignId: Number(dto.campaignId),
  accountId: Number(dto.accountId),
  scores: dto.scores?.map((s: any) => ({
    ...s,
    id: Number(s.id),
    campaignId: Number(s.campaignId),
    adGroupCount: Number(s.adGroupCount)
  }))
});

export const mapAdGroupDto = (dto: any): AdGroup => ({
  ...dto,
  id: Number(dto.id),
  adGroupId: Number(dto.adGroupId),
  campaignId: Number(dto.campaignId),
  scores: dto.scores?.map((s: any) => ({
    ...s,
    id: Number(s.id),
    adGroupId: Number(s.adGroupId),
    keywordCount: Number(s.keywordCount)
  }))
});
