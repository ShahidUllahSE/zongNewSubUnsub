import { Request, Response } from 'express';
import { getWsdlXml } from '../utils/wsdl';
import { parseSoapRequest } from '../utils/xmlParser';
import { buildSoapResponse } from '../utils/xmlBuilder';
import { ReverseFlowService } from '../services/reverseFlowService';
import { ZongResponseCode, ZongResponseDescription } from '../constants/zongCodes';

export class SoapController {
  /**
   * Serves WSDL definition for GET /api/zong?wsdl
   */
  public static handleWsdl(req: Request, res: Response): void {
    const host = req.get('host') || 'localhost:8089';
    const protocol = req.protocol || 'http';
    const serviceUrl = `${protocol}://${host}/api/zong`;

    const wsdl = getWsdlXml(serviceUrl);
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.status(200).send(wsdl);
  }

  /**
   * Handles SOAP POST requests for /api/zong
   */
  public static async handleSoapPost(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    // Check if query is ?wsdl on POST
    if (req.query.wsdl !== undefined || req.query.WSDL !== undefined) {
      return SoapController.handleWsdl(req, res);
    }

    const rawBody = typeof req.body === 'string' ? req.body : '';

    if (!rawBody || rawBody.trim().length === 0) {
      const responseXml = buildSoapResponse(
        ZongResponseCode.MISSING_PARAMETERS,
        ZongResponseDescription[ZongResponseCode.MISSING_PARAMETERS]
      );
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      res.status(200).send(responseXml);
      return;
    }

    // 1. Parse raw XML
    const parsedRequest = parseSoapRequest(rawBody);

    // 2. Validate extracted parameters
    const validation = ReverseFlowService.validateRequest(parsedRequest);

    let finalCode: ZongResponseCode;
    let finalDescription: string;

    if (!validation.isValid) {
      finalCode = validation.result.code;
      finalDescription = validation.result.description;
    } else {
      // 3. Process subscription/unsubscription
      const processResult = await ReverseFlowService.processSubUnsub(validation.data);
      finalCode = processResult.code;
      finalDescription = processResult.description;
    }

    // 4. Build standard SOAP response
    const responseXml = buildSoapResponse(finalCode, finalDescription);
    const executionTimeMs = Date.now() - startTime;

    // 5. Asynchronously log transaction
    ReverseFlowService.logTransaction({
      msisdn: parsedRequest.msisdn,
      serviceId: parsedRequest.idService,
      channelId: parsedRequest.idChannel,
      channelOption: parsedRequest.idChannelOption,
      bundleId: parsedRequest.idBundle,
      zongTimestamp: parsedRequest.timestamp,
      rawRequest: rawBody,
      rawResponse: responseXml,
      responseCode: finalCode,
      responseDescription: finalDescription,
      clientIp,
      executionTimeMs,
    }).catch((err) => {
      console.error('[SoapController] Audit log error:', err);
    });

    // 6. Return response
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.status(200).send(responseXml);
  }
}
