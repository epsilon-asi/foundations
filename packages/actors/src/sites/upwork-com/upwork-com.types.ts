import {UpworkProposalQuestionAnswers} from "./util/parseJobApplicationDetails.js";

export enum JobSearchSort {
  BestMatch = 'best_match',
}

export enum DomesticFilter {
  USOnly = 'us_only',
}

export enum ContractorTier {
  EntryLevel = '1',
  Intermediate = '2',
  Expert = '3',
}

export enum JobType {
  Hourly = 'hourly',
  FixedPrice = 'fixed_price',
}

export enum FixedPriceRange {
  LessThan100 = 'lt_100',
  From100To500 = '100_to_500',
  From500To1000 = '500_to_1000',
  From1000To5000 = '1000_to_5000',
  GreaterThan5000 = 'gte_5000',
}

export enum ProposalRange {
  FewerThan5 = '0-4',
  From5To10 = '5-9',
  From10To15 = '10-14',
  From15To20 = '15-19',
  From20To50 = '20-49',
}

export enum ClientInfoFilter {
  PreviousClients = 'previous_clients',
  PaymentVerified = 'payment_verified',
}

export enum ClientHiresRange {
  NoHires = '0',
  From1To9 = '1-9',
  TenPlus = '10-',
}

export enum ProjectLength {
  LessThanOneMonth = 'week',
  OneToThreeMonths = 'month',
  ThreeToSixMonths = 'semester',
  MoreThanSixMonths = 'ongoing',
}

export enum HoursPerWeek {
  LessThan30 = 'as_needed',
  MoreThan30 = 'full_time',
}

export enum JobDuration {
  ContractToHire = 'contract_to_hire',
}

export type MoneyRange = {
  min?: number;
  max?: number;
  currency?: 'USD';
};

export type UpworkJobSearchFields = {
  sort?: JobSearchSort;
  domestic?: DomesticFilter;
  categories?: string[];
  contractorTier?: ContractorTier[];
  jobType?: JobType[];
  hourlyRate?: MoneyRange;
  fixedPriceRanges?: FixedPriceRange[];
  fixedPriceCustom?: MoneyRange;
  proposals?: ProposalRange[];
  clientInfo?: ClientInfoFilter[];
  clientHires?: ClientHiresRange[];
  clientLocations?: string[];
  clientTimezones?: string[];
  projectLength?: ProjectLength[];
  hoursPerWeek?: HoursPerWeek[];
  jobDuration?: JobDuration[];
};

export interface UpworkJobSearchResult {
  searchUrl: string;
  query: string;
  filters: UpworkJobSearchFields;
}

export interface UpworkJobSelector {
  jobId: string;
}

export interface UpworkApplyToJobInput {
  jobId: string;
  rate: number | string;
  answers: UpworkProposalQuestionAnswers
}

export interface UpworkApplyToJobResult {
  success: boolean;
  coverLetter: string;
}
