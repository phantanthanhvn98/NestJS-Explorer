import type { ModelRoleVisibilityType } from 'plus0-sdk';
import View from '~/models/View';
import Noco from 'src/Plus0';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

export default class ModelRoleVisibility implements ModelRoleVisibilityType {
  id?: string;
  project_id?: string;
  dataset_id?: string;
  // fk_model_id?: string;
  fk_view_id?: string;
  role?: string;
  disabled?: boolean;

  constructor(body: Partial<ModelRoleVisibilityType>) {
    Object.assign(this, body);
  }

  static async list(baseId): Promise<ModelRoleVisibility[]> {
    const cachedList = await NocoCache.getList(
      CacheScope.MODEL_ROLE_VISIBILITY,
      [baseId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !data.length) {
      data = await Noco.ncMeta.metaList2(
        baseId,
        null,
        MetaTable.MODEL_ROLE_VISIBILITY,
      );
      await NocoCache.setList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [baseId],
        data,
        ['fk_view_id', 'role'],
      );
    }
    return data?.map((baseData) => new ModelRoleVisibility(baseData));
  }

  static async get(
    args: { role: string; fk_view_id: any },
    ncMeta = Noco.ncMeta,
  ) {
    let data =
      args.fk_view_id &&
      args.role &&
      (await NocoCache.get(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.MODEL_ROLE_VISIBILITY,
        // args.fk_model_id
        //   ? {
        //       fk_model_id: args.fk_model_id,
        //       role: args.role
        //     }
        //   :
        {
          fk_view_id: args.fk_view_id,
          role: args.role,
        },
      );
      await NocoCache.set(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        data,
      );
    }
    return data && new ModelRoleVisibility(data);
  }

  static async update(
    fk_view_id: string,
    role: string,
    body: { disabled: any },
  ) {
    // set meta
    const res = await Noco.ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        disabled: body.disabled,
      },
      {
        fk_view_id,
        role,
      },
    );

    await NocoCache.update(
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      {
        disabled: body.disabled,
      },
    );

    return res;
  }

  async delete() {
    return await ModelRoleVisibility.delete(this.fk_view_id, this.role);
  }
  static async delete(fk_view_id: string, role: string) {
    const res = await Noco.ncMeta.metaDelete(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        fk_view_id,
        role,
      },
    );
    await NocoCache.deepDel(
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return res;
  }

  static async insert(
    body: Partial<ModelRoleVisibilityType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(body, [
      'role',
      'disabled',
      'fk_view_id',
      'project_id',
      'dataset_id',
    ]);

    if (!(insertObj.project_id && insertObj.dataset_id)) {
      const view = await View.get(body.fk_view_id, ncMeta);
      insertObj.project_id = view.project_id;
      insertObj.dataset_id = view.dataset_id;
    }

    const result = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      insertObj,
    );

    insertObj.id = result.id;

    return this.get(
      {
        fk_view_id: body.fk_view_id,
        role: body.role,
      },
      ncMeta,
    ).then(async (modelRoleVisibility) => {
      const key = `${CacheScope.MODEL_ROLE_VISIBILITY}:${body.fk_view_id}:${body.role}`;
      await NocoCache.appendToList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [insertObj.project_id],
        key,
      );
      return modelRoleVisibility;
    });
  }
}
