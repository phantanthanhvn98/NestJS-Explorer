import { Injectable } from '@nestjs/common';
import getSwaggerJSON from './swagger/getSwaggerJSON';
import getSwaggerJSONV2 from './swaggerV2/getSwaggerJSONV2';
import { NcError } from '~/helpers/catchError';
import { Base, Model } from '~/models';

@Injectable()
export class ApiDocsService {
  async swaggerJson(param: { baseId: string; siteUrl: string }) {
    const base = await Base.get(param.baseId);

    if (!base) NcError.baseNotFound(param.baseId);

    const models = await Model.list({
      project_id: param.baseId,
      dataset_id: null,
    });

    const swagger = await getSwaggerJSON(base, models);

    swagger.servers = [
      {
        url: param.siteUrl,
      },
      {
        url: '{customUrl}',
        variables: {
          customUrl: {
            default: param.siteUrl,
            description: 'Provide custom plus0-service app base url',
          },
        },
      },
    ] as any;

    return swagger;
  }
  async swaggerJsonV2(param: { baseId: string; siteUrl: string }) {
    const base = await Base.get(param.baseId);

    if (!base) NcError.baseNotFound(param.baseId);

    const models = await Model.list({
      project_id: param.baseId,
      dataset_id: null,
    });

    const swagger = await getSwaggerJSONV2(base, models);

    swagger.servers = [
      {
        url: param.siteUrl,
      },
      {
        url: '{customUrl}',
        variables: {
          customUrl: {
            default: param.siteUrl,
            description: 'Provide custom plus0-service app base url',
          },
        },
      },
    ] as any;

    return swagger;
  }
}
