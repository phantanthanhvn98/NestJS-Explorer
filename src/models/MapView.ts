import type { MetaType } from 'plus0-sdk';
import type { MapType } from 'plus0-sdk';
import View from '~/models/View';
import MapViewColumn from '~/models/MapViewColumn';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Noco from 'src/Plus0';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class MapView implements MapType {
  fk_view_id: string;
  title: string;
  project_id?: string;
  dataset_id?: string;
  fk_geo_data_col_id?: string;
  meta?: MetaType;

  // below fields are not in use at this moment
  // keep them for time being
  show?: boolean;
  uuid?: string;
  public?: boolean;
  password?: string;
  show_all_fields?: boolean;

  constructor(data: MapView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.MAP_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.MAP_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.MAP_VIEW}:${viewId}`, view);
    }

    return view && new MapView(view);
  }

  static async insert(view: Partial<MapView>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      project_id: view.project_id,
      dataset_id: view.dataset_id,
      fk_view_id: view.fk_view_id,
      fk_geo_data_col_id: view.fk_geo_data_col_id,
      meta: view.meta,
    };

    const viewRef = await View.get(view.fk_view_id);

    if (!(view.project_id && view.dataset_id)) {
      insertObj.project_id = viewRef.project_id;
      insertObj.dataset_id = viewRef.dataset_id;
    }

    await ncMeta.metaInsert2(null, null, MetaTable.MAP_VIEW, insertObj, true);

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    mapId: string,
    body: Partial<MapView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['fk_geo_data_col_id', 'meta']);

    if (body.fk_geo_data_col_id != null) {
      const mapViewColumns = await MapViewColumn.list(mapId);
      const mapViewMappedByColumn = mapViewColumns.find(
        (mapViewColumn) =>
          mapViewColumn.fk_column_id === body.fk_geo_data_col_id,
      );
      await View.updateColumn(body.fk_view_id, mapViewMappedByColumn.id, {
        show: true,
      });
    }

    // update meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MAP_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: mapId,
      },
    );

    await NocoCache.update(
      `${CacheScope.MAP_VIEW}:${mapId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
