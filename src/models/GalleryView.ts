import { UITypes } from 'plus0-sdk';
import type {
  BoolType,
  GalleryColumnType,
  GalleryType,
  MetaType,
} from 'plus0-sdk';
import View from '~/models/View';
import Noco from 'src/Plus0';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class GalleryView implements GalleryType {
  fk_view_id?: string;
  deleted?: BoolType;
  order?: number;
  next_enabled?: BoolType;
  prev_enabled?: BoolType;
  cover_image_idx?: number;
  cover_image?: string;
  restrict_types?: string;
  restrict_size?: string;
  restrict_number?: string;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;
  fk_cover_image_col_id?: string;

  project_id?: string;
  dataset_id?: string;

  columns?: GalleryColumnType[];
  meta?: MetaType;

  constructor(data: GalleryView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.GALLERY_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.GALLERY_VIEW}:${viewId}`, view);
    }

    return view && new GalleryView(view);
  }

  static async insert(view: Partial<GalleryView>, ncMeta = Noco.ncMeta) {
    const columns = await View.get(view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(ncMeta))
      .then((m) => m.getColumns(ncMeta));

    const insertObj = extractProps(view, [
      'project_id',
      'dataset_id',
      'fk_view_id',
      'next_enabled',
      'prev_enabled',
      'cover_image_idx',
      'cover_image',
      'restrict_types',
      'restrict_size',
      'restrict_number',
    ]);

    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id ||
      columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    if (!(view.project_id && view.dataset_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.project_id = viewRef.project_id;
      insertObj.dataset_id = viewRef.dataset_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.GALLERY_VIEW,
      insertObj,
      true,
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    galleryId: string,
    body: Partial<GalleryView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['fk_cover_image_col_id', 'meta']);

    // update meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.GALLERY_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: galleryId,
      },
    );

    await NocoCache.update(
      `${CacheScope.GALLERY_VIEW}:${galleryId}`,
      prepareForResponse(updateObj),
    );

    const view = await View.get(galleryId);

    // on update, delete any optimised single query cache
    await View.clearSingleQueryCache(
      view.fk_model_id,
      [{ id: galleryId }],
      ncMeta,
    );

    return res;
  }
}
