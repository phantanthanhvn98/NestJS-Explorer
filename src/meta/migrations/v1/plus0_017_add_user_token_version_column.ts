import type { Knex } from 'knex';
import { MetaTable } from 'src/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('token_version');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumns('token_version');
  });
};

export { up, down };
