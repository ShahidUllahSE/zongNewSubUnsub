import { ZongResponseCode } from '../constants/zongCodes';

export interface RawSubUnsubRequest {
  msisdn?: string;
  idService?: string;
  idChannel?: string;
  idChannelOption?: string;
  idBundle?: string;
  timestamp?: string;
}

export interface ValidatedSubUnsubRequest {
  msisdn: string;
  idService: string;
  idChannel: string;
  idChannelOption: '1' | '2';
  idBundle?: string;
  timestamp: string;
}

export interface SubUnsubResult {
  code: ZongResponseCode;
  description: string;
}
