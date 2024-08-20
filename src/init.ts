import { MetaService } from './meta/meta.service';
import { Plus0Config } from './utils/plus0-config';
import Plus0 from './Plus0';

// run upgrader
import NcUpgrader from '~/version-upgrader/NcUpgrader';

export default async () => {
  const config = await Plus0Config.createByEnv();
  Plus0._ncMeta = new MetaService(config);
  await NcUpgrader.upgrade({ ncMeta: Plus0._ncMeta });
};
