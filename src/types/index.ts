export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  statusCode?: number;
  timestamp?: string;
}

export interface ScoreDataPoint {
  id: number;
  date: string;
  qs: number;
}

export interface GlobalScoreDataPoint extends ScoreDataPoint {
  accountCount: number;
}

export interface AccountScoreDataPoint extends ScoreDataPoint {
  accountId: number;
  campaignCount: number;
}

export interface CampaignScoreDataPoint extends ScoreDataPoint {
  campaignId: number;
  adGroupCount: number;
}

export interface AdGroupScoreDataPoint extends ScoreDataPoint {
  adGroupId: string;
  keywordCount: number;
}

export interface KeywordScoreDataPoint extends ScoreDataPoint {
  keywordId: number;
}

export type DateRange = '7d' | '30d' | '90d' | '1y';

export interface BreadcrumbItem {
  label: string;
  path: string;
  id: string | number;
  type: 'dashboard' | 'account' | 'campaign' | 'adGroup' | 'keyword';
}
