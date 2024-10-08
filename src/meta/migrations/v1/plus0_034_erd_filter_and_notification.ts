import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (!(await knex.schema.hasColumn(MetaTable.DATASETS, 'erd_uuid'))) {
    await knex.schema.alterTable(MetaTable.DATASETS, (table) => {
      table.string('erd_uuid');
    });
  }

  if (!(await knex.schema.hasTable(MetaTable.NOTIFICATION))) {
    await knex.schema.createTable(MetaTable.NOTIFICATION, (table) => {
      table.string('id', 64).primary().notNullable();
      table.string('type', 64);
      table.text('body');
      table.boolean('is_read').defaultTo(false);
      table.boolean('is_deleted').defaultTo(false);
      table.string('fk_user_id', 64).index();
      table.timestamps(true, true);
      table.index('created_at');
    });
  }

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.text('value').alter();
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.DATASETS, (table) => {
    table.dropColumn('erd_uuid');
  });

  knex.schema.dropTable(MetaTable.NOTIFICATION);

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('value', 255).alter();
  });
};

export { up, down };
