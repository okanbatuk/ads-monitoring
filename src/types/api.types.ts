// API Response generic type 
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  statusCode?: number;
  timestamp?: string;
}

// ====================
// Account Types
// ====================

export interface AccountDto {
  id: string;
  accountId: string;
  name: string;
  status: string;
  parentId?: number;
  children?: AccountDto[];
  scores?: AccountScoreDto[];
}

export interface AccountScoreDto {
  id: number;
  accountId: number;
  date: string;
  qs: number;
  campaignCount: number;
}

// ====================
// Campaign Types
// ====================

export type Campaign = CampaignDto;

export interface CampaignDto {
  id: string;
  name: string;
  status: string;
  accountId: string;
  scores?: CampaignScoreDto[];
}

export interface CampaignScoreDto {
  id: number;
  campaignId: number;
  date: string;
  qs: number;
  adGroupCount: number;
}



// ====================
// Ad Group Types
// ====================

export interface AdGroupDto {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  scores?: AdGroupScoreDto[];
}

export interface AdGroupScoreDto {
  id: number;
  adGroupId: number;
  date: string;
  qs: number;
  keywordCount: number;
}

// ====================
// Keyword Types
// ====================

export interface KeywordDto {
  id: string;
  text: string;
  status: string;
  matchType: string;
  adGroupId: string;
  scores?: KeywordScoreDto[];
}

export interface KeywordScoreDto {
  id: number;
  keywordId: number;
  date: string;
  qs: number;
  impressionCount: number;
  clickCount: number;
  ctr: number;
  averageCpc: number;
}

// ====================
// Global Score Types
// ====================

export interface GlobalScoreDto {
  id: number;
  date: string;
  qs: number;
  accountCount: number;
}

// ====================
// API Response Types
// ====================

// Account Responses
export type GetAccountsResponse = ApiResponse<{
  accounts: AccountDto[];
  total: number;
}>;

export type GetAccountResponse = ApiResponse<AccountDto>;
export type GetAccountScoresResponse = ApiResponse<{
  scores: AccountScoreDto[], total: number
}>;

// Campaign Responses
export type GetCampaignsResponse = ApiResponse<{
  campaigns: CampaignDto[];
  total: number;
}>;

export type GetCampaignResponse = ApiResponse<CampaignDto>;
export type GetCampaignScoreResponse = ApiResponse<{
  scores: CampaignScoreDto[];
  total: number;
}>;

// Ad Group Responses
export type GetAdGroupsResponse = ApiResponse<{
  adGroups: AdGroupDto[];
  total: number;
}>;

export type GetAdGroupResponse = ApiResponse<AdGroupDto>;
export type GetAdGroupScoresResponse = ApiResponse<{ scores: AdGroupScoreDto[], total: number }>;

// Keyword Responses
export type GetKeywordsResponse = ApiResponse<{
  keywords: KeywordDto[];
  total: number;
}>;

export type GetKeywordResponse = ApiResponse<KeywordDto>;

export type GetKeywordScoresResponse = ApiResponse<KeywordScoreDto[]>;

// Global Responses
export type GetGlobalScoresResponse = ApiResponse<GlobalScoreDto[]>;

// Bulk Score Requests/Responses
export interface BulkScoresRequest {
  ids: number[];
  days?: number;
}

export type BulkScoresResponse<T> = ApiResponse<{
  scores: T[];
  total: number;
}>;

// GET /api/accounts
export type GetMccAccountsResponse = ApiResponse<{
  accounts: AccountDto[];
  total: number;
}>;

// GET /api/accounts/:id/accounts
export type GetSubAccountsResponse = ApiResponse<{
  subAccounts: AccountDto[];
  total: number;
}>;

// GET /api/accounts/:id/campaigns
export type GetAccountCampaignsResponse = ApiResponse<{
  campaigns: CampaignDto[];
  total: number;
}>;


// GET /api/accounts/account/:accountId
export type GetAccountByAccountIdResponse = ApiResponse<AccountDto>;


// POST /api/accounts/bulkscores?days=7
export type PostAccountBulkScoresRequest = {
  ids: number[];
}

export type PostAccountBulkScoresResponse = ApiResponse<AccountScoreDto[]>;


// GET /api/campaigns/:id/adgroups
export type GetCampaignAdGroupsResponse = ApiResponse<{
  adGroups: AdGroupDto[];
  total: number;
}>;

// POST /api/campaigns/bulkscores?days=7
export interface PostCampaignBulkScoresRequest {
  ids: number[];
}

export type PostCampaignBulkScoresResponse = ApiResponse<CampaignScoreDto[]>;

// POST /api/adgroups/bulkscores?days=7
export interface PostAdGroupBulkScoresRequest {
  ids: number[];
}

export type PostAdGroupBulkScoresResponse = ApiResponse<AdGroupScoreDto[]>;


// POST /api/keywords/bulkscores?days=7
export interface PostKeywordBulkScoresRequest {
  ids: number[];
}

export type PostKeywordBulkScoresResponse = ApiResponse<KeywordScoreDto[]>;
