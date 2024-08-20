import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DATASETS, (table) => {
    table.boolean('deleted').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DATASETS, (table) => {
    table.dropColumn('deleted');
  });
};

export { up, down };
