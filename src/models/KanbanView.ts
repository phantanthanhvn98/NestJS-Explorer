import { UITypes } from 'plus0-sdk';
import type { BoolType, KanbanType, MetaType } from 'plus0-sdk';
import View from '~/models/View';
import Noco from 'src/Plus0';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class KanbanView implements KanbanType {
  fk_view_id: string;
  title: string;
  project_id?: string;
  dataset_id?: string;
  fk_grp_col_id?: string;
  fk_cover_image_col_id?: string;
  meta?: MetaType;

  // below fields are not in use at this moment
  // keep them for time being
  show?: BoolType;
  order?: number;
  uuid?: string;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: KanbanView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.KANBAN_VIEW, {
        fk_view_id: viewId,
      });

      view = prepareForResponse(view);

      await NocoCache.set(`${CacheScope.KANBAN_VIEW}:${viewId}`, view);
    }

    return view && new KanbanView(view);
  }

  public static async IsColumnBeingUsedAsGroupingField(
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return (
      (
        await ncMeta.metaList2(null, null, MetaTable.KANBAN_VIEW, {
          condition: {
            fk_grp_col_id: columnId,
          },
        })
      ).length > 0
    );
  }

  static async insert(view: Partial<KanbanView>, ncMeta = Noco.ncMeta) {
    const columns = await View.get(view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(ncMeta))
      .then((m) => m.getColumns(ncMeta));

    const insertObj = extractProps(view, [
      'project_id',
      'dataset_id',
      'fk_view_id',
      'fk_grp_col_id',
      'meta',
    ]);

    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id ||
      columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    if (!(view.project_id && view.dataset_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.project_id = viewRef.dataset_id;
      insertObj.dataset_id = viewRef.dataset_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.KANBAN_VIEW,
      insertObj,
      true,
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    kanbanId: string,
    body: Partial<KanbanView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'fk_cover_image_col_id',
      'fk_grp_col_id',
      'meta',
    ]);

    // update meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.KANBAN_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: kanbanId,
      },
    );

    await NocoCache.update(
      `${CacheScope.KANBAN_VIEW}:${kanbanId}`,
      prepareForResponse(updateObj),
    );

    const view = await View.get(kanbanId);

    // on update, delete any optimised single query cache
    await View.clearSingleQueryCache(
      view.fk_model_id,
      [{ id: kanbanId }],
      ncMeta,
    );

    return res;
  }
}
