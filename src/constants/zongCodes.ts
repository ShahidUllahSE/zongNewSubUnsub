export enum ZongResponseCode {
  INVALID_PARAMETERS = -3,
  INVALID_ID_SERVICE = -2,
  MISSING_PARAMETERS = -1,
  SUCCESS = 0,
  INTERNAL_ERROR = 1,
  ALREADY_SUBSCRIBED = 2,
  ALREADY_UNSUBSCRIBED = 3,
  LOW_BALANCE = 4,
}

export const ZongResponseDescription: Record<ZongResponseCode, string> = {
  [ZongResponseCode.INVALID_PARAMETERS]: 'Invalid Parameters',
  [ZongResponseCode.INVALID_ID_SERVICE]: 'Invalid IdService',
  [ZongResponseCode.MISSING_PARAMETERS]: 'Missing Parameters',
  [ZongResponseCode.SUCCESS]: 'success',
  [ZongResponseCode.INTERNAL_ERROR]: 'Internal error',
  [ZongResponseCode.ALREADY_SUBSCRIBED]: 'Already Subscribed',
  [ZongResponseCode.ALREADY_UNSUBSCRIBED]: 'Already Unsubscribed',
  [ZongResponseCode.LOW_BALANCE]: 'Low Balance',
};

export enum ChannelOption {
  SUBSCRIPTION = '1',
  UNSUBSCRIPTION = '2',
}
