import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { ZongResponseCode, ZongResponseDescription, ChannelOption } from '../constants/zongCodes';
import { RawSubUnsubRequest, SubUnsubResult, ValidatedSubUnsubRequest } from '../types/soap';
import { SubscriberStatus } from '@prisma/client';

export class ReverseFlowService {
  /**
   * Validate parameters according to Zong Reverse Flow specifications:
   * -1: Missing Parameters
   * -2: Invalid IdService
   * -3: Invalid Parameters
   */
  public static validateRequest(
    raw: RawSubUnsubRequest
  ): { isValid: true; data: ValidatedSubUnsubRequest } | { isValid: false; result: SubUnsubResult } {
    const { msisdn, idService, idChannel, idChannelOption, idBundle, timestamp } = raw;

    // 1. Check for missing mandatory parameters
    if (
      !msisdn ||
      !idService ||
      !idChannel ||
      !idChannelOption ||
      !timestamp ||
      msisdn.trim() === '' ||
      idService.trim() === '' ||
      idChannel.trim() === '' ||
      idChannelOption.trim() === '' ||
      timestamp.trim() === ''
    ) {
      return {
        isValid: false,
        result: {
          code: ZongResponseCode.MISSING_PARAMETERS,
          description: ZongResponseDescription[ZongResponseCode.MISSING_PARAMETERS],
        },
      };
    }

    const cleanMsisdn = msisdn.trim();
    const cleanIdService = idService.trim();
    const cleanIdChannel = idChannel.trim();
    const cleanIdChannelOption = idChannelOption.trim();
    const cleanTimestamp = timestamp.trim();
    const cleanIdBundle = idBundle ? idBundle.trim() : undefined;

    // 2. Validate IdService (Must be "1" as per Zong document)
    if (cleanIdService !== config.expectedServiceId) {
      return {
        isValid: false,
        result: {
          code: ZongResponseCode.INVALID_ID_SERVICE,
          description: ZongResponseDescription[ZongResponseCode.INVALID_ID_SERVICE],
        },
      };
    }

    // 3. Validate IdChannelOption (Must be '1' for Subscription or '2' for Un-subscription)
    if (
      cleanIdChannelOption !== ChannelOption.SUBSCRIPTION &&
      cleanIdChannelOption !== ChannelOption.UNSUBSCRIPTION
    ) {
      return {
        isValid: false,
        result: {
          code: ZongResponseCode.INVALID_PARAMETERS,
          description: ZongResponseDescription[ZongResponseCode.INVALID_PARAMETERS],
        },
      };
    }

    // 4. Validate MSISDN format (Pakistan format: e.g. 923001234567 - 12 digits starting with 92)
    const msisdnRegex = /^92[0-9]{10}$/;
    if (!msisdnRegex.test(cleanMsisdn)) {
      return {
        isValid: false,
        result: {
          code: ZongResponseCode.INVALID_PARAMETERS,
          description: ZongResponseDescription[ZongResponseCode.INVALID_PARAMETERS],
        },
      };
    }

    // 5. Validate Timestamp format (yyyymmddhhmmss - exactly 14 numeric digits)
    const timestampRegex = /^\d{14}$/;
    if (!timestampRegex.test(cleanTimestamp)) {
      return {
        isValid: false,
        result: {
          code: ZongResponseCode.INVALID_PARAMETERS,
          description: ZongResponseDescription[ZongResponseCode.INVALID_PARAMETERS],
        },
      };
    }

    // 6. Validate Channel (18=CRM, 19=MZA as per Zong doc)
    if (!config.allowedChannels.includes(cleanIdChannel)) {
      return {
        isValid: false,
        result: {
          code: ZongResponseCode.INVALID_PARAMETERS,
          description: ZongResponseDescription[ZongResponseCode.INVALID_PARAMETERS],
        },
      };
    }

    return {
      isValid: true,
      data: {
        msisdn: cleanMsisdn,
        idService: cleanIdService,
        idChannel: cleanIdChannel,
        idChannelOption: cleanIdChannelOption as '1' | '2',
        idBundle: cleanIdBundle,
        timestamp: cleanTimestamp,
      },
    };
  }

  /**
   * Process subscription or unsubscription against the database
   */
  public static async processSubUnsub(data: ValidatedSubUnsubRequest): Promise<SubUnsubResult> {
    try {
      const existingSubscriber = await prisma.subscriber.findUnique({
        where: { msisdn: data.msisdn },
      });

      const now = new Date();

      if (data.idChannelOption === ChannelOption.SUBSCRIPTION) {
        // Option 1: Subscription
        if (existingSubscriber && existingSubscriber.status === SubscriberStatus.ACTIVE) {
          // Already Subscribed
          return {
            code: ZongResponseCode.ALREADY_SUBSCRIBED,
            description: ZongResponseDescription[ZongResponseCode.ALREADY_SUBSCRIBED],
          };
        }

        // Activate or create subscriber
        await prisma.subscriber.upsert({
          where: { msisdn: data.msisdn },
          create: {
            msisdn: data.msisdn,
            serviceId: data.idService,
            channelId: data.idChannel,
            bundleId: data.idBundle || null,
            status: SubscriberStatus.ACTIVE,
            subscribedAt: now,
            unsubscribedAt: null,
            lastZongTimestamp: data.timestamp,
          },
          update: {
            serviceId: data.idService,
            channelId: data.idChannel,
            bundleId: data.idBundle || existingSubscriber?.bundleId || null,
            status: SubscriberStatus.ACTIVE,
            subscribedAt: now,
            unsubscribedAt: null,
            lastZongTimestamp: data.timestamp,
          },
        });

        return {
          code: ZongResponseCode.SUCCESS,
          description: ZongResponseDescription[ZongResponseCode.SUCCESS],
        };
      } else {
        // Option 2: Un-Subscription
        if (!existingSubscriber || existingSubscriber.status === SubscriberStatus.INACTIVE) {
          // Already Unsubscribed
          return {
            code: ZongResponseCode.ALREADY_UNSUBSCRIBED,
            description: ZongResponseDescription[ZongResponseCode.ALREADY_UNSUBSCRIBED],
          };
        }

        // Deactivate subscriber
        await prisma.subscriber.update({
          where: { msisdn: data.msisdn },
          data: {
            channelId: data.idChannel,
            status: SubscriberStatus.INACTIVE,
            unsubscribedAt: now,
            lastZongTimestamp: data.timestamp,
          },
        });

        return {
          code: ZongResponseCode.SUCCESS,
          description: ZongResponseDescription[ZongResponseCode.SUCCESS],
        };
      }
    } catch (error) {
      console.error('[ReverseFlowService] Database execution error:', error);
      return {
        code: ZongResponseCode.INTERNAL_ERROR,
        description: ZongResponseDescription[ZongResponseCode.INTERNAL_ERROR],
      };
    }
  }

  /**
   * Save request/response audit log safely
   */
  public static async logTransaction(params: {
    msisdn?: string;
    serviceId?: string;
    channelId?: string;
    channelOption?: string;
    bundleId?: string;
    zongTimestamp?: string;
    rawRequest: string;
    rawResponse: string;
    responseCode: number;
    responseDescription: string;
    clientIp?: string;
    executionTimeMs: number;
  }): Promise<void> {
    try {
      await prisma.reverseFlowLog.create({
        data: {
          msisdn: params.msisdn,
          serviceId: params.serviceId,
          channelId: params.channelId,
          channelOption: params.channelOption,
          bundleId: params.bundleId,
          zongTimestamp: params.zongTimestamp,
          rawRequest: params.rawRequest,
          rawResponse: params.rawResponse,
          responseCode: params.responseCode,
          responseDescription: params.responseDescription,
          clientIp: params.clientIp,
          executionTimeMs: params.executionTimeMs,
        },
      });
    } catch (error) {
      console.error('[ReverseFlowService] Failed to save reverse flow log:', error);
    }
  }
}
