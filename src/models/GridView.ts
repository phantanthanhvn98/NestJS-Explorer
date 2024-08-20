import type { GridType, MetaType } from 'plus0-sdk';
import GridViewColumn from '~/models/GridViewColumn';
import View from '~/models/View';
import Noco from 'src/Plus0';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class GridView implements GridType {
  fk_view_id: string;
  project_id?: string;
  dataset_id?: string;
  meta?: MetaType;
  row_height?: number;
  columns?: GridViewColumn[];

  constructor(data: GridView) {
    Object.assign(this, data);
  }

  async getColumns(): Promise<GridViewColumn[]> {
    return (this.columns = await GridViewColumn.list(this.fk_view_id));
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GRID_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.GRID_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.GRID_VIEW}:${viewId}`, view);
    }

    return view && new GridView(view);
  }

  static async insert(view: Partial<GridView>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(view, [
      'fk_view_id',
      'project_id',
      'dataset_id',
      'row_height',
    ]);

    if (!(insertObj.project_id && insertObj.dataset_id)) {
      const viewRef = await View.get(insertObj.fk_view_id, ncMeta);
      insertObj.project_id = viewRef.project_id;
      insertObj.dataset_id = viewRef.dataset_id;
    }

    await ncMeta.metaInsert2(null, null, MetaTable.GRID_VIEW, insertObj, true);

    return this.get(view.fk_view_id, ncMeta);
  }

  static async getWithInfo(id: string, ncMeta = Noco.ncMeta) {
    const view = await this.get(id, ncMeta);
    return view;
  }

  static async update(
    viewId: string,
    body: Partial<GridView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['row_height', 'meta']);

    // update meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.GRID_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: viewId,
      },
    );

    await NocoCache.update(
      `${CacheScope.GRID_VIEW}:${viewId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
