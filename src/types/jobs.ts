export enum JobType {
  AMFI_INGEST = 'AMFI_INGEST',
  YAHOO_INGEST = 'YAHOO_INGEST',
  NEWS_INGEST = 'NEWS_INGEST',
  REMINDER_CHECK = 'REMINDER_CHECK',
  SEND_EMAIL = 'SEND_EMAIL',
}

export interface AMFIIngestJobData {
  url?: string;
  date?: string;
}

export interface YahooIngestJobData {
  symbol: string;
  from: string;
  to: string;
}

export interface NewsIngestJobData {
  category?: string;
  keywords?: string[];
}

export interface ReminderCheckJobData {
  userId?: string;
}

export interface SendEmailJobData {
  to: string;
  subject: string;
  template: 'verification' | 'reminder' | 'digest';
  data: Record<string, any>;
}

export type JobData =
  | AMFIIngestJobData
  | YahooIngestJobData
  | NewsIngestJobData
  | ReminderCheckJobData
  | SendEmailJobData;
