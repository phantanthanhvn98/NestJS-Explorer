import { Test, TestingModule } from '@nestjs/testing';
import { FusionAuthService } from '../fusion.auth/fusion.auth.service';

describe('FusionAuthService', () => {
  let service: FusionAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FusionAuthService],
    }).compile();

    service = module.get<FusionAuthService>(FusionAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
