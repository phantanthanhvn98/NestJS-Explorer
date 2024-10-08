import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { AuditsService } from '~/services/audits.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get(['/api/v1/db/meta/audits/', '/api/v2/meta/audits/'])
  @Acl('auditList')
  async auditListRow(@Req() req: Request) {
    return new PagedResponseImpl(
      await this.auditsService.auditOnlyList({ query: req.query as any }),
    );
  }

  @Post([
    '/api/v1/db/meta/audits/rows/:rowId/update',
    '/api/v2/meta/audits/rows/:rowId/update',
  ])
  @HttpCode(200)
  @Acl('auditRowUpdate')
  async auditRowUpdate(@Param('rowId') rowId: string, @Body() body: any) {
    return await this.auditsService.auditRowUpdate({
      rowId,
      body,
    });
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/audits/',
    '/api/v2/meta/bases/:baseId/audits/',
  ])
  @Acl('auditList')
  async auditList(@Req() req: Request, @Param('baseId') baseId: string) {
    return new PagedResponseImpl(
      await this.auditsService.auditList({
        query: req.query,
        baseId,
      }),
      {
        count: await this.auditsService.auditCount({ baseId }),
        ...req.query,
      },
    );
  }
}
