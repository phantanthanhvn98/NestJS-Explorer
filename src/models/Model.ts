import {
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  UITypes,
  ViewTypes,
} from 'plus0-sdk';
import dayjs from 'dayjs';
import type { BoolType, TableReqType, TableType } from 'plus0-sdk';
import type { XKnex } from '~/db/CustomKnex';
import type { LinksColumn, LinkToAnotherRecordColumn } from '~/models/index';
import Hook from '~/models/Hook';
import View from '~/models/View';
import Comment from '~/models/Comment';
import Column from '~/models/Column';
import { extractProps } from '~/helpers/extractProps';
import { sanitize } from '~/helpers/sqlSanitize';
import { NcError } from '~/helpers/catchError';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from 'src/Plus0';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';

export default class Model implements TableType {
  copy_enabled: BoolType;
  dataset_id: 'db' | string;
  deleted: BoolType;
  enabled: BoolType;
  export_enabled: BoolType;
  id: string;
  order: number;
  parent_id: string;
  password: string;
  pin: BoolType;
  project_id: string;
  schema: any;
  show_all_fields: boolean;
  tags: string;
  type: ModelTypes;

  table_name: string;
  title: string;

  mm: BoolType;

  uuid: string;

  columns?: Column[];
  columnsById?: { [id: string]: Column };
  views?: View[];
  meta?: Record<string, any> | string;

  constructor(data: Partial<TableType | Model>) {
    Object.assign(this, data);
  }

  public async getColumns(
    ncMeta = Noco.ncMeta,
    defaultViewId = undefined,
  ): Promise<Column[]> {
    this.columns = await Column.list(
      {
        fk_model_id: this.id,
        fk_default_view_id: defaultViewId,
      },
      ncMeta,
    );
    return this.columns;
  }

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async getViews(force = false, ncMeta = Noco.ncMeta): Promise<View[]> {
    this.views = await View.listWithInfo(this.id, ncMeta);
    return this.views;
  }

  public get primaryKey(): Column {
    if (!this.columns) return null;
    //  return first auto increment or augto generated column
    // if not found return first pk column
    return (
      this.columns.find((c) => c.pk && (c.ai || c.meta?.ag)) ||
      this.columns?.find((c) => c.pk)
    );
  }

  public get primaryKeys(): Column[] {
    if (!this.columns) return null;
    return this.columns?.filter((c) => c.pk);
  }

  // If there is no column marked as display value,
  // we are getting the immediate next column to pk as display value
  // or the first column(if pk is the last column).
  public get displayValue(): Column {
    if (!this.columns) return null;
    const pCol = this.columns?.find((c) => c.pv);
    if (pCol) return pCol;
    if (this.mm) {
      // by default, there is no default value in m2m table
      // take the first column instead
      return this.columns[0];
    }
    const pkIndex = this.columns.indexOf(this.primaryKey);
    if (pkIndex < this.columns.length - 1) return this.columns[pkIndex + 1];
    return this.columns[0];
  }

  public static async insert(
    projectId,
    datasetId,
    model: Partial<TableReqType> & {
      mm?: BoolType;
      type?: ModelTypes;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(model, [
      'table_name',
      'title',
      'mm',
      'order',
      'type',
      'id',
      'meta',
    ]);

    insertObj.mm = !!insertObj.mm;

    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(
        MetaTable.FORM_VIEW_COLUMNS,
        {
          project_id: projectId,
          dataset_id: datasetId,
        },
      );
    }

    if (!insertObj.type) {
      insertObj.type = ModelTypes.TABLE;
    }

    const { id } = await ncMeta.metaInsert2(
      projectId,
      datasetId,
      MetaTable.MODELS,
      insertObj,
    );

    const insertedColumns = await Column.bulkInsert(
      {
        columns: (model?.columns || []) as Column[],
        fk_model_id: id,
        dataset_id: datasetId,
        project_id: projectId,
      },
      ncMeta,
    );

    await View.insertMetaOnly(
      {
        fk_model_id: id,
        title: model.title || model.table_name,
        is_default: true,
        type: ViewTypes.GRID,
        project_id: projectId,
        dataset_id: datasetId,
      },
      {
        getColumns: async () => insertedColumns,
      },
      ncMeta,
    );

    const modelRes = await this.getWithInfo({ id }, ncMeta);

    // append to model list since model list cache will be there already
    if (projectId) {
      await NocoCache.appendToList(
        CacheScope.MODEL,
        [projectId, datasetId],
        `${CacheScope.MODEL}:${id}`,
      );
    }
    // cater cases where sourceId is not required
    // e.g. xcVisibilityMetaGet
    await NocoCache.appendToList(
      CacheScope.MODEL,
      [projectId],
      `${CacheScope.MODEL}:${id}`,
    );

    return modelRes;
  }

  public static async list(
    {
      project_id,
      dataset_id,
    }: {
      project_id: string;
      dataset_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      project_id,
      dataset_id,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(project_id, dataset_id, MetaTable.MODELS, {
        orderBy: {
          order: 'asc',
        },
      });

      // parse meta of each model
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      // set cache based on dataset_id presence
      if (dataset_id) {
        await NocoCache.setList(
          CacheScope.MODEL,
          [project_id, dataset_id],
          modelList,
        );
      } else {
        await NocoCache.setList(CacheScope.MODEL, [project_id], modelList);
      }
    }
    modelList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );

    for (const model of modelList) {
      if (model.meta?.hasNonDefaultViews === undefined) {
        model.meta = {
          ...(model.meta ?? {}),
          hasNonDefaultViews: await Model.getNonDefaultViewsCountAndReset(
            { modelId: model.id },
            ncMeta,
          ),
        };
      }
    }

    return modelList.map((m) => new Model(m));
  }

  public static async listWithInfo(
    {
      project_id,
      db_alias,
    }: {
      project_id: string;
      db_alias: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      project_id,
      db_alias,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(project_id, db_alias, MetaTable.MODELS);

      // parse meta of each model
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      await NocoCache.setList(CacheScope.MODEL, [project_id], modelList);
    }

    for (const model of modelList) {
      if (model.meta?.hasNonDefaultViews === undefined) {
        model.meta = {
          ...(model.meta ?? {}),
          hasNonDefaultViews: await Model.getNonDefaultViewsCountAndReset(
            { modelId: model.id },
            ncMeta,
          ),
        };
      }
    }

    return modelList.map((m) => new Model(m));
  }

  public static async get(id: string, ncMeta = Noco.ncMeta): Promise<Model> {
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(null, null, MetaTable.MODELS, id);

      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
    }
    return modelData && new Model(modelData);
  }

  public static async getByIdOrName(
    args:
      | {
          project_id: string;
          dataset_id: string;
          table_name: string;
        }
      | {
          id?: string;
        },
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    const k = 'id' in args ? args?.id : args;
    let modelData =
      k &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${k}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(null, null, MetaTable.MODELS, k);
      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
      }
    }
    if (modelData) {
      modelData.meta = parseMetaProp(modelData);
      await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      return new Model(modelData);
    }
    return null;
  }

  public static async getWithInfo(
    {
      table_name,
      id,
    }: {
      table_name?: string;
      id?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.MODELS,
        id || {
          table_name,
        },
      );
      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
      // modelData.filters = await Filter.getFilterObject({
      //   viewId: modelData.id
      // });
      // modelData.sorts = await Sort.list({ modelId: modelData.id });
    }
    if (modelData) {
      const m = new Model(modelData);

      await m.getViews(false, ncMeta);

      const defaultViewId = m.views.find((view) => view.is_default).id;

      const columns = await m.getColumns(ncMeta, defaultViewId);

      m.columnsById = columns.reduce((agg, c) => ({ ...agg, [c.id]: c }), {});
      return m;
    }
    return null;
  }

  public static async getBaseModelSQL(
    args: {
      id?: string;
      viewId?: string;
      dbDriver: XKnex;
      model?: Model;
      extractDefaultView?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseModelSqlv2> {
    const model = args?.model || (await this.get(args.id, ncMeta));

    if (!args?.viewId && args.extractDefaultView) {
      const view = await View.getDefaultView(model.id, ncMeta);
      args.viewId = view.id;
    }

    return new BaseModelSqlv2({
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
    });
  }

  async delete(ncMeta = Noco.ncMeta, force = false): Promise<boolean> {
    await Comment.deleteRowComments(this.id, ncMeta);

    for (const view of await this.getViews(true, ncMeta)) {
      await view.delete(ncMeta);
    }

    // delete associated hooks
    for (const hook of await Hook.list({ fk_model_id: this.id }, ncMeta)) {
      await Hook.delete(hook.id, ncMeta);
    }

    for (const col of await this.getColumns(ncMeta)) {
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
        case UITypes.MultiSelect:
        case UITypes.SingleSelect:
          colOptionTableName = MetaTable.COL_SELECT_OPTIONS;
          cacheScopeName = CacheScope.COL_SELECT_OPTION;
          break;
        case UITypes.Formula:
          colOptionTableName = MetaTable.COL_FORMULA;
          cacheScopeName = CacheScope.COL_FORMULA;
          break;
        case UITypes.QrCode:
          colOptionTableName = MetaTable.COL_QRCODE;
          cacheScopeName = CacheScope.COL_QRCODE;
          break;
        case UITypes.Barcode:
          colOptionTableName = MetaTable.COL_BARCODE;
          cacheScopeName = CacheScope.COL_BARCODE;
          break;
      }
      if (colOptionTableName && cacheScopeName) {
        await ncMeta.metaDelete(null, null, colOptionTableName, {
          fk_column_id: col.id,
        });
        await NocoCache.deepDel(
          `${cacheScopeName}:${col.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    }

    if (force) {
      const leftOverColumns = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_related_model_id: this.id,
          },
        },
      );

      for (const col of leftOverColumns) {
        await NocoCache.deepDel(
          `${CacheScope.COL_RELATION}:${col.fk_column_id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }

      await ncMeta.metaDelete(null, null, MetaTable.COL_RELATIONS, {
        fk_related_model_id: this.id,
      });
    }

    await NocoCache.deepDel(
      `${CacheScope.COLUMN}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(null, null, MetaTable.COLUMNS, {
      fk_model_id: this.id,
    });

    await NocoCache.deepDel(
      `${CacheScope.MODEL}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(null, null, MetaTable.MODELS, this.id);

    // delete alias cache
    await NocoCache.del([
      `${CacheScope.MODEL_ALIAS}:${this.project_id}:${this.id}`,
      `${CacheScope.MODEL_ALIAS}:${this.project_id}:${this.dataset_id}:${this.id}`,
      `${CacheScope.MODEL_ALIAS}:${this.project_id}:${this.title}`,
      `${CacheScope.MODEL_ALIAS}:${this.project_id}:${this.dataset_id}:${this.title}`,
    ]);
    return true;
  }

  async mapAliasToColumn(
    data,
    clientMeta = {
      isMySQL: false,
      isSqlite: false,
      isMssql: false,
      isPg: false,
    },
    knex,
    columns?: Column[],
  ) {
    const insertObj = {};
    for (const col of columns || (await this.getColumns())) {
      if (isVirtualCol(col)) continue;
      let val =
        data?.[col.column_name] !== undefined
          ? data?.[col.column_name]
          : data?.[col.title];
      if (val !== undefined) {
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
          const { isMySQL, isSqlite, isMssql, isPg } = clientMeta;
          if (
            val.indexOf('-') < 0 &&
            val.indexOf('+') < 0 &&
            val.slice(-1) !== 'Z'
          ) {
            // if no timezone is given,
            // then append +00:00 to make it as UTC
            val += '+00:00';
          }
          if (isMySQL) {
            // first convert the value to utc
            // from UI
            // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
            // from API
            // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
            // if timezone info is not found - considered as utc
            // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
            // if timezone info is found
            // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
            // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
            // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
            // then we use CONVERT_TZ to convert that in the db timezone
            val = knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
              dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
            ]);
          } else if (isSqlite) {
            // convert to UTC
            // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
            val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
          } else if (isPg) {
            // convert to UTC
            // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
            // then convert to db timezone
            val = knex.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
              dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'),
            ]);
          } else if (isMssql) {
            // convert ot UTC
            // e.g. 2023-05-10T08:49:32.000Z -> 2023-05-10 08:49:32-08:00
            // then convert to db timezone
            val = knex.raw(
              `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
              [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
            );
          } else {
            // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
            val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
          }
        }
        insertObj[sanitize(col.column_name)] = val;

        if (clientMeta.isPg && col.dt === 'bytea') {
          insertObj[sanitize(col.column_name)] = knex.raw(
            `decode(?, '${col.meta?.format === 'hex' ? 'hex' : 'escape'}')`,
            [
              col.meta?.format === 'hex' && (val + '').length % 2 === 1
                ? '0' + val
                : val,
            ],
          );
        }
      }
    }
    return insertObj;
  }

  async mapColumnToAlias(data, columns?: Column[]) {
    const res = {};
    for (const col of columns || (await this.getColumns())) {
      if (isVirtualCol(col)) continue;
      let val =
        data?.[col.title] !== undefined
          ? data?.[col.title]
          : data?.[col.column_name];
      if (val !== undefined) {
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        res[sanitize(col.title)] = val;
      }
    }
    return res;
  }

  static async updateAliasAndTableName(
    tableId,
    title: string,
    table_name: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!title) {
      NcError.badRequest("Missing 'title' property in body");
    }
    if (!table_name) {
      NcError.badRequest("Missing 'table_name' property in body");
    }

    const oldModel = await this.get(tableId, ncMeta);

    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        title,
        table_name,
      },
      tableId,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      title,
      table_name,
    });

    // delete alias cache
    await NocoCache.del([
      `${CacheScope.MODEL_ALIAS}:${oldModel.project_id}:${oldModel.id}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.project_id}:${oldModel.dataset_id}:${oldModel.id}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.dataset_id}:${oldModel.title}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.project_id}:${oldModel.dataset_id}:${oldModel.title}`,
    ]);

    // clear all the cached query under this model
    await View.clearSingleQueryCache(tableId, null, ncMeta);

    // clear all the cached query under related models
    for (const col of await this.get(tableId).then((t) => t.getColumns())) {
      if (!isLinksOrLTAR(col)) continue;

      const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>();

      if (colOptions.fk_related_model_id === tableId) continue;

      await View.clearSingleQueryCache(
        colOptions.fk_related_model_id,
        null,
        ncMeta,
      );
    }

    return res;
  }

  static async markAsMmTable(tableId, isMm = true, ncMeta = Noco.ncMeta) {
    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        mm: isMm,
      },
      tableId,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      mm: isMm,
    });

    return res;
  }

  async getAliasColMapping() {
    return (await this.getColumns()).reduce((o, c) => {
      if (c.column_name) {
        o[c.title] = c.column_name;
      }
      return o;
    }, {});
  }

  async getColAliasMapping() {
    return (await this.getColumns()).reduce((o, c) => {
      if (c.column_name) {
        o[c.column_name] = c.title;
      }
      return o;
    }, {});
  }

  static async updateOrder(
    tableId: string,
    order: number,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        order,
      },
      tableId,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      order,
    });

    return res;
  }

  static async updatePrimaryColumn(
    tableId: string,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const model = await this.getWithInfo({ id: tableId });
    const newPvCol = model.columns.find((c) => c.id === columnId);

    if (!newPvCol) NcError.fieldNotFound(columnId);

    // drop existing primary column/s
    for (const col of model.columns?.filter((c) => c.pv) || []) {
      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.COLUMNS,
        {
          pv: false,
        },
        col.id,
      );

      await NocoCache.update(`${CacheScope.COLUMN}:${col.id}`, {
        pv: false,
      });
    }

    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      {
        pv: true,
      },
      newPvCol.id,
    );

    await NocoCache.update(`${CacheScope.COLUMN}:${newPvCol.id}`, {
      pv: true,
    });

    const grid_views_with_column = await ncMeta.metaList2(
      null,
      null,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_column_id: newPvCol.id,
        },
      },
    );

    if (grid_views_with_column.length) {
      for (const gv of grid_views_with_column) {
        await View.fixPVColumnForView(gv.fk_view_id, ncMeta);
      }
    }

    // use set to avoid duplicate
    const relatedModelIds = new Set<string>();

    // clear all single query cache of related views
    for (const col of model.columns) {
      if (!isLinksOrLTAR(col)) continue;
      const colOptions = await col.getColOptions<
        LinkToAnotherRecordColumn | LinksColumn
      >();
      relatedModelIds.add(colOptions?.fk_related_model_id);
    }

    await Promise.all(
      Array.from(relatedModelIds).map(async (modelId: string) => {
        await View.clearSingleQueryCache(modelId, null, ncMeta);
      }),
    );

    return true;
  }

  static async setAsMm(id: any, ncMeta = Noco.ncMeta) {
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        mm: true,
      },
      id,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${id}`, {
      mm: true,
    });
  }

  static async getByAliasOrId(
    {
      project_id,
      dataset_id,
      aliasOrId,
    }: {
      project_id?: string;
      dataset_id?: string;
      aliasOrId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cacheKey = dataset_id
      ? `${CacheScope.MODEL_ALIAS}:${project_id}:${dataset_id}:${aliasOrId}`
      : `${CacheScope.MODEL_ALIAS}:${project_id}:${aliasOrId}`;
    const modelId =
    project_id &&
      aliasOrId &&
      (await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING));
    if (!modelId) {
      const model = dataset_id
        ? await ncMeta.metaGet2(
            null,
            null,
            MetaTable.MODELS,
            { project_id, dataset_id },
            null,
            {
              _or: [
                {
                  id: {
                    eq: aliasOrId,
                  },
                },
                {
                  title: {
                    eq: aliasOrId,
                  },
                },
              ],
            },
          )
        : await ncMeta.metaGet2(
            null,
            null,
            MetaTable.MODELS,
            { project_id },
            null,
            {
              _or: [
                {
                  id: {
                    eq: aliasOrId,
                  },
                },
                {
                  title: {
                    eq: aliasOrId,
                  },
                },
              ],
            },
          );
      if (model) {
        await NocoCache.set(cacheKey, model.id);
        await NocoCache.set(`${CacheScope.MODEL}:${model.id}`, model);
      }
      return model && new Model(model);
    }
    return modelId && this.get(modelId);
  }

  static async checkTitleAvailable(
    {
      table_name,
      project_id,
      dataset_id,
      exclude_id,
    }: { table_name; project_id; dataset_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      project_id,
      dataset_id,
      MetaTable.MODELS,
      {
        table_name,
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  static async checkAliasAvailable(
    {
      title,
      project_id,
      dataset_id,
      exclude_id,
    }: { title; project_id; dataset_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      project_id,
      dataset_id,
      MetaTable.MODELS,
      {
        title,
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  async getAliasColObjMap(columns?: Column[]) {
    return (columns || (await this.getColumns())).reduce(
      (sortAgg, c) => ({ ...sortAgg, [c.title]: c }),
      {},
    );
  }

  // For updating table meta
  static async updateMeta(
    tableId: string,
    meta: string | Record<string, any>,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      prepareForDb({
        meta,
      }),
      tableId,
    );

    await NocoCache.update(
      `${CacheScope.MODEL}:${tableId}`,
      prepareForResponse({
        meta,
      }),
    );

    return res;
  }

  static async getNonDefaultViewsCountAndReset(
    {
      modelId,
    }: {
      modelId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const model = await this.get(modelId, ncMeta);
    let modelMeta = parseMetaProp(model);

    const views = await View.list(modelId, ncMeta);
    modelMeta = {
      ...(modelMeta ?? {}),
      hasNonDefaultViews: views.length > 1,
    };

    await this.updateMeta(modelId, modelMeta, ncMeta);

    return modelMeta?.hasNonDefaultViews;
  }
}
