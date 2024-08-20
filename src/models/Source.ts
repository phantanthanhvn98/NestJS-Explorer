import { UITypes } from 'plus0-sdk';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import type { DriverClient } from 'src/utils/plus0-config';
import type { BoolType, SourceType } from 'plus0-sdk';
import { Base, Model, SyncSource } from '~/models';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from 'src/Plus0';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { InstanceCommands } from '~/interface/Jobs';

// todo: hide credentials
export default class Source implements SourceType {
  id?: string;
  project_id?: string;
  alias?: string;
  type?: DriverClient;
  is_meta?: BoolType;
  config?: string;
  inflection_column?: string;
  inflection_table?: string;
  order?: number;
  erd_uuid?: string;
  enabled?: BoolType;
  meta?: any;

  constructor(source: Partial<SourceType>) {
    Object.assign(this, source);
  }

  protected static castType(source: Source): Source {
    return source && new Source(source);
  }

  public static async createBase(
    source: SourceType & {
      baseId: string;
      created_at?;
      updated_at?;
      meta?: any;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(source, [
      'id',
      'alias',
      'config',
      'type',
      'is_meta',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
    ]);

    insertObj.config = CryptoJS.AES.encrypt(
      JSON.stringify(source.config),
      Noco.getConfig()?.auth?.jwt?.secret,
    ).toString();

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.DATASETS, {
      project_id: source.baseId,
    });

    const { id } = await ncMeta.metaInsert2(
      source.baseId,
      null,
      MetaTable.DATASETS,
      insertObj,
    );

    // call before reorder to update cache
    const returnBase = await this.get(id, false, ncMeta);

    await NocoCache.appendToList(
      CacheScope.BASE,
      [source.baseId],
      `${CacheScope.BASE}:${id}`,
    );

    return returnBase;
  }

  public static async updateBase(
    sourceId: string,
    source: SourceType & {
      baseId: string;
      meta?: any;
      deleted?: boolean;
      fk_sql_executor_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const oldBase = await Source.get(sourceId, false, ncMeta);

    if (!oldBase) NcError.sourceNotFound(sourceId);

    const updateObj = extractProps(source, [
      'alias',
      'config',
      'type',
      'is_meta',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
      'deleted',
      'fk_sql_executor_id',
    ]);

    if (updateObj.config) {
      updateObj.config = CryptoJS.AES.encrypt(
        JSON.stringify(source.config),
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString();
    }

    // type property is undefined even if not provided
    if (!updateObj.type) {
      updateObj.type = oldBase.type;
    }

    // if order is missing (possible in old versions), get next order
    if (!oldBase.order && !updateObj.order) {
      updateObj.order = await ncMeta.metaGetNextOrder(MetaTable.DATASETS, {
        project_id: source.baseId,
      });

      if (updateObj.order <= 1 && !oldBase.isMeta()) {
        updateObj.order = 2;
      }
    }

    // keep order 1 for default source
    if (oldBase.isMeta()) {
      updateObj.order = 1;
    }

    // keep order 1 for default source
    if (!oldBase.isMeta()) {
      if (updateObj.order <= 1) {
        NcError.badRequest('Cannot change order to 1 or less');
      }

      // if order is 1 for non-default source, move it to last
      if (oldBase.order <= 1 && !updateObj.order) {
        updateObj.order = await ncMeta.metaGetNextOrder(MetaTable.DATASETS, {
          project_id: source.baseId,
        });
      }
    }

    await ncMeta.metaUpdate(
      source.baseId,
      null,
      MetaTable.DATASETS,
      prepareForDb(updateObj),
      oldBase.id,
    );

    await NocoCache.update(
      `${CacheScope.BASE}:${sourceId}`,
      prepareForResponse(updateObj),
    );

    if (JobsRedis.available) {
      await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, sourceId);
      await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, sourceId);
    }

    // call before reorder to update cache
    const returnBase = await this.get(oldBase.id, false, ncMeta);

    return returnBase;
  }

  static async list(
    args: { baseId: string },
    ncMeta = Noco.ncMeta,
  ): Promise<Source[]> {
    const cachedList = await NocoCache.getList(CacheScope.BASE, [args.baseId]);
    let { list: baseDataList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !baseDataList.length) {
      baseDataList = await ncMeta.metaList2(
        args.baseId,
        null,
        MetaTable.DATASETS,
        {
          xcCondition: {
            _or: [
              {
                deleted: {
                  neq: true,
                },
              },
              {
                deleted: {
                  eq: null,
                },
              },
            ],
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      // parse JSON metadata
      for (const source of baseDataList) {
        source.meta = parseMetaProp(source, 'meta');
      }

      await NocoCache.setList(CacheScope.BASE, [args.baseId], baseDataList);
    }

    baseDataList.sort(
      (a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity),
    );

    return baseDataList?.map((baseData) => {
      return this.castType(baseData);
    });
  }

  static async get(
    id: string,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Source> {
    let baseData =
      id &&
      (await NocoCache.get(
        `${CacheScope.BASE}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!baseData) {
      baseData = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.DATASETS,
        id,
        null,
        force
          ? {}
          : {
              _or: [
                {
                  deleted: {
                    neq: true,
                  },
                },
                {
                  deleted: {
                    eq: null,
                  },
                },
              ],
            },
      );

      if (baseData) {
        baseData.meta = parseMetaProp(baseData, 'meta');
      }

      await NocoCache.set(`${CacheScope.BASE}:${id}`, baseData);
    }
    return this.castType(baseData);
  }

  static async getByUUID(uuid: string, ncMeta = Noco.ncMeta) {
    const source = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.DATASETS,
      {
        erd_uuid: uuid,
      },
      null,
      {
        _or: [
          {
            deleted: {
              neq: true,
            },
          },
          {
            deleted: {
              eq: null,
            },
          },
        ],
      },
    );

    if (!source) return null;

    delete source.config;

    return this.castType(source);
  }

  public async getConnectionConfig(): Promise<any> {
    const config = this.getConfig();

    // todo: update sql-client args
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

    return config;
  }

  public getConfig(): any {
    if (this.is_meta) {
      const metaConfig = Noco.getConfig()?.meta?.db;
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    const config = JSON.parse(
      CryptoJS.AES.decrypt(
        this.config,
        Noco.getConfig()?.auth?.jwt?.secret,
      ).toString(CryptoJS.enc.Utf8),
    );

    return config;
  }

  getProject(ncMeta = Noco.ncMeta): Promise<Base> {
    return Base.get(this.project_id, ncMeta);
  }

  async sourceCleanup(_ncMeta = Noco.ncMeta) {
    await NcConnectionMgrv2.deleteAwait(this);

    if (JobsRedis.available) {
      await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, this.id);
      await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, this.id);
    }
  }

  async delete(ncMeta = Noco.ncMeta, { force }: { force?: boolean } = {}) {
    const sources = await Source.list({ baseId: this.project_id }, ncMeta);

    if (sources[0].id === this.id && !force) {
      NcError.badRequest('Cannot delete first source');
    }

    const models = await Model.list(
      {
        dataset_id: this.id,
        project_id: this.project_id,
      },
      ncMeta,
    );

    const relColumns = [];
    const relRank = {
      [UITypes.Lookup]: 1,
      [UITypes.Rollup]: 2,
      [UITypes.ForeignKey]: 3,
      [UITypes.LinkToAnotherRecord]: 4,
    };

    for (const model of models) {
      for (const col of await model.getColumns(ncMeta)) {
        let colOptionTableName = null;
        let cacheScopeName = null;
        switch (col.uidt) {
          case UITypes.Rollup:
            colOptionTableName = MetaTable.COL_ROLLUP;
            cacheScopeName = CacheScope.COL_ROLLUP;
            break;
          case UITypes.Lookup:
            colOptionTableName = MetaTable.COL_LOOKUP;
            cacheScopeName = CacheScope.COL_LOOKUP;
            break;
          case UITypes.ForeignKey:
          case UITypes.LinkToAnotherRecord:
            colOptionTableName = MetaTable.COL_RELATIONS;
            cacheScopeName = CacheScope.COL_RELATION;
            break;
        }
        if (colOptionTableName && cacheScopeName) {
          relColumns.push({ col, colOptionTableName, cacheScopeName });
        }
      }
    }

    relColumns.sort((a, b) => {
      return relRank[a.col.uidt] - relRank[b.col.uidt];
    });

    for (const relCol of relColumns) {
      await ncMeta.metaDelete(null, null, relCol.colOptionTableName, {
        fk_column_id: relCol.col.id,
      });
      await NocoCache.deepDel(
        `${relCol.cacheScopeName}:${relCol.col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    for (const model of models) {
      await model.delete(ncMeta, true);
    }

    const syncSources = await SyncSource.list(this.project_id, this.id, ncMeta);
    for (const syncSource of syncSources) {
      await SyncSource.delete(syncSource.id, ncMeta);
    }

    await this.sourceCleanup(ncMeta);

    const res = await ncMeta.metaDelete(null, null, MetaTable.DATASETS, this.id);

    await NocoCache.deepDel(
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  async softDelete(ncMeta = Noco.ncMeta, { force }: { force?: boolean } = {}) {
    const bases = await Base.list({ baseId: this.project_id }, ncMeta);

    if (bases[0].id === this.id && !force) {
      NcError.badRequest('Cannot delete first base');
    }

    await ncMeta.metaUpdate(
      this.project_id,
      null,
      MetaTable.DATASETS,
      {
        deleted: true,
      },
      this.id,
    );

    await NocoCache.deepDel(
      `${CacheScope.BASE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  async getModels(ncMeta = Noco.ncMeta) {
    return await Model.list(
      { project_id: this.project_id, dataset_id: this.id },
      ncMeta,
    );
  }

  async shareErd(ncMeta = Noco.ncMeta) {
    if (!this.erd_uuid) {
      const uuid = uuidv4();
      this.erd_uuid = uuid;

      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.DATASETS,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );

      await NocoCache.update(`${CacheScope.BASE}:${this.id}`, {
        erd_uuid: this.erd_uuid,
      });
    }
    return this;
  }

  async disableShareErd(ncMeta = Noco.ncMeta) {
    if (this.erd_uuid) {
      this.erd_uuid = null;

      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.DATASETS,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );

      await NocoCache.update(`${CacheScope.BASE}:${this.id}`, {
        erd_uuid: this.erd_uuid,
      });
    }
    return this;
  }

  isMeta(_only = false, _mode = 0) {
    if (_only) {
      if (_mode === 0) {
        return this.is_meta;
      }
      return false;
    } else {
      return this.is_meta;
    }
  }
}
