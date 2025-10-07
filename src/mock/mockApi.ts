import { 
  GlobalScoreDataPoint, 
  AccountScoreDataPoint, 
  CampaignScoreDataPoint,
  AdGroupScoreDataPoint,
  KeywordScoreDataPoint,
  ApiResponse 
} from '../types';

const generateMockScores = <T extends { id: number; date: string; qs: number }>(
  count: number, 
  baseData: Omit<T, 'id' | 'date' | 'qs'>,
  dateOffset: number = 30
): T[] => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (count - i - 1));
    
    return {
      id: i + 1,
      date: date.toISOString().split('T')[0],
      qs: Math.min(10, Math.max(1, 5 + Math.sin(i * 0.3) * 3 + (Math.random() - 0.5))),
      ...baseData,
    } as T;
  });
};

// Mock API responses
export const mockGlobalScores = (days: number = 30): Promise<ApiResponse<GlobalScoreDataPoint[]>> => {
  const data = generateMockScores<GlobalScoreDataPoint>(days, {
    accountCount: Math.floor(Math.random() * 100) + 50,
  });
  
  return Promise.resolve({
    success: true,
    data,
  });
};

export const mockAccountScores = (accountId: number, days: number = 30): Promise<ApiResponse<AccountScoreDataPoint[]>> => {
  const data = generateMockScores<AccountScoreDataPoint>(days, {
    accountId,
    campaignCount: Math.floor(Math.random() * 20) + 5,
  });
  
  return Promise.resolve({
    success: true,
    data,
  });
};

export const mockCampaignScores = (campaignId: number, days: number = 30): Promise<ApiResponse<CampaignScoreDataPoint[]>> => {
  const data = generateMockScores<CampaignScoreDataPoint>(days, {
    campaignId,
    adGroupCount: Math.floor(Math.random() * 10) + 1,
  });
  
  return Promise.resolve({
    success: true,
    data,
  });
};

export const mockAdGroupScores = (adGroupId: string, days: number = 30): Promise<ApiResponse<AdGroupScoreDataPoint[]>> => {
  const data = generateMockScores<AdGroupScoreDataPoint>(days, {
    adGroupId,
    keywordCount: Math.floor(Math.random() * 50) + 10,
  });
  
  return Promise.resolve({
    success: true,
    data,
  });
};

export const mockKeywordScores = (keywordId: number, days: number = 30): Promise<ApiResponse<KeywordScoreDataPoint[]>> => {
  const data = generateMockScores<KeywordScoreDataPoint>(days, {
    keywordId,
  });
  
  return Promise.resolve({
    success: true,
    data,
  });
};

// Mock account data
export const mockAccounts = [
  { id: 1, name: 'Acme Corp' },
  { id: 2, name: 'Globex Corp' },
  { id: 3, name: 'Soylent Corp' },
  { id: 4, name: 'Initech' },
  { id: 5, name: 'Umbrella Corp' },
];

export const mockCampaigns = [
  { id: 1, name: 'Brand Campaign' },
  { id: 2, name: 'Performance Max' },
  { id: 3, name: 'Search Network' },
  { id: 4, name: 'Display Network' },
];

export const mockAdGroups = [
  { id: 'ag1', name: 'Ad Group 1' },
  { id: 'ag2', name: 'Ad Group 2' },
  { id: 'ag3', name: 'Ad Group 3' },
];

export const mockKeywords = [
  { id: 1, text: 'buy shoes online' },
  { id: 2, text: 'best running shoes' },
  { id: 3, text: 'shoes sale' },
];
