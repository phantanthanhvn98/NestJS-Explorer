import * as plus0_011 from 'src/meta/migrations/v1/plus0_011';
import * as plus0_012_alter_column_data_types from 'src/meta/migrations/v1/plus0_012_alter_column_data_types';
import * as plus0_013_sync_source from 'src/meta/migrations/v1/plus0_013_sync_source';
import * as plus0_014_alter_column_data_types from 'src/meta/migrations/v1/plus0_014_alter_column_data_types';
import * as plus0_015_add_meta_col_in_column_table from 'src/meta/migrations/v1/plus0_015_add_meta_col_in_column_table';
import * as plus0_016_alter_hooklog_payload_types from 'src/meta/migrations/v1/plus0_016_alter_hooklog_payload_types';
import * as plus0_017_add_user_token_version_column from 'src/meta/migrations/v1/plus0_017_add_user_token_version_column';
import * as plus0_018_add_meta_in_view from 'src/meta/migrations/v1/plus0_018_add_meta_in_view';
import * as plus0_019_add_meta_in_meta_tables from 'src/meta/migrations/v1/plus0_019_add_meta_in_meta_tables';
import * as plus0_020_kanban_view from 'src/meta/migrations/v1/plus0_020_kanban_view';
import * as plus0_021_add_fields_in_token from 'src/meta/migrations/v1/plus0_021_add_fields_in_token';
import * as plus0_022_qr_code_column_type from 'src/meta/migrations/v1/plus0_022_qr_code_column_type';
import * as plus0_023_multiple_source from 'src/meta/migrations/v1/plus0_023_multiple_source';
import * as plus0_024_barcode_column_type from 'src/meta/migrations/v1/plus0_024_barcode_column_type';
import * as plus0_025_add_row_height from 'src/meta/migrations/v1/plus0_025_add_row_height';
import * as plus0_026_map_view from 'src/meta/migrations/v1/plus0_026_map_view';
import * as plus0_027_add_comparison_sub_op from 'src/meta/migrations/v1/plus0_027_add_comparison_sub_op';
import * as plus0_028_add_enable_scanner_in_form_columns_meta_table from 'src/meta/migrations/v1/plus0_028_add_enable_scanner_in_form_columns_meta_table';
import * as plus0_029_webhook from 'src/meta/migrations/v1/plus0_029_webhook';
import * as plus0_030_add_description_field from 'src/meta/migrations/v1/plus0_030_add_description_field';
import * as plus0_031_remove_fk_and_add_idx from 'src/meta/migrations/v1/plus0_031_remove_fk_and_add_idx';
import * as plus0_033_add_group_by from 'src/meta/migrations/v1/plus0_033_add_group_by';
import * as plus0_034_erd_filter_and_notification from 'src/meta/migrations/v1/plus0_034_erd_filter_and_notification';
import * as plus0_035_add_username_to_users from 'src/meta/migrations/v1/plus0_035_add_username_to_users';
import * as plus0_036_base_deleted from 'src/meta/migrations/v1/plus0_036_base_deleted';
import * as plus0_038_formula_parsed_tree_column from 'src/meta/migrations/v1/plus0_038_formula_parsed_tree_column';
import * as plus0_039_sqlite_alter_column_types from 'src/meta/migrations/v1/plus0_039_sqlite_alter_column_types';
import * as plus0_040_form_view_alter_column_types from 'src/meta/migrations/v1/plus0_040_form_view_alter_column_types';
import * as plus0_041_calendar_view from 'src/meta/migrations/v1/plus0_041_calendar_view';
import * as plus0_042_user_block from 'src/meta/migrations/v1/plus0_042_user_block';
import * as plus0_043_user_refresh_token from 'src/meta/migrations/v1/plus0_043_user_refresh_token';
import * as plus0_044_view_column_index from 'src/meta/migrations/v1/plus0_044_view_column_index';
import * as plus0_045_extensions from 'src/meta/migrations/v1/plus0_045_extensions';
import * as plus0_046_comment_mentions from 'src/meta/migrations/v1/plus0_046_comment_mentions';
import * as plus0_047_comment_migration from 'src/meta/migrations/v1/plus0_047_comment_migration';
import * as plus0_048_view_links from 'src/meta/migrations/v1/plus0_048_view_links';

// Create a custom migration source class
export default class XcMigrationSource {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve([
      'plus0_011',
      'plus0_012_alter_column_data_types',
      'plus0_013_sync_source',
      'plus0_014_alter_column_data_types',
      'plus0_015_add_meta_col_in_column_table',
      'plus0_016_alter_hooklog_payload_types',
      'plus0_017_add_user_token_version_column',
      'plus0_018_add_meta_in_view',
      'plus0_019_add_meta_in_meta_tables',
      'plus0_020_kanban_view',
      'plus0_021_add_fields_in_token',
      'plus0_022_qr_code_column_type',
      'plus0_023_multiple_source',
      'plus0_024_barcode_column_type',
      'plus0_025_add_row_height',
      'plus0_026_map_view',
      'plus0_027_add_comparison_sub_op',
      'plus0_028_add_enable_scanner_in_form_columns_meta_table',
      'plus0_029_webhook',
      'plus0_030_add_description_field',
      'plus0_031_remove_fk_and_add_idx',
      'plus0_033_add_group_by',
      'plus0_034_erd_filter_and_notification',
      'plus0_035_add_username_to_users',
      'plus0_036_base_deleted',
      // 'plus0_037_rename_project_and_base',
      'plus0_038_formula_parsed_tree_column',
      'plus0_039_sqlite_alter_column_types',
      'plus0_040_form_view_alter_column_types',
      'plus0_041_calendar_view',
      'plus0_042_user_block',
      'plus0_043_user_refresh_token',
      'plus0_044_view_column_index',
      'plus0_045_extensions',
      'plus0_046_comment_mentions',
      'plus0_047_comment_migration',
      'plus0_048_view_links',
    ]);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'plus0_011':
        return plus0_011;
      case 'plus0_012_alter_column_data_types':
        return plus0_012_alter_column_data_types;
      case 'plus0_013_sync_source':
        return plus0_013_sync_source;
      case 'plus0_014_alter_column_data_types':
        return plus0_014_alter_column_data_types;
      case 'plus0_015_add_meta_col_in_column_table':
        return plus0_015_add_meta_col_in_column_table;
      case 'plus0_016_alter_hooklog_payload_types':
        return plus0_016_alter_hooklog_payload_types;
      case 'plus0_017_add_user_token_version_column':
        return plus0_017_add_user_token_version_column;
      case 'plus0_018_add_meta_in_view':
        return plus0_018_add_meta_in_view;
      case 'plus0_019_add_meta_in_meta_tables':
        return plus0_019_add_meta_in_meta_tables;
      case 'plus0_020_kanban_view':
        return plus0_020_kanban_view;
      case 'plus0_021_add_fields_in_token':
        return plus0_021_add_fields_in_token;
      case 'plus0_022_qr_code_column_type':
        return plus0_022_qr_code_column_type;
      case 'plus0_023_multiple_source':
        return plus0_023_multiple_source;
      case 'plus0_024_barcode_column_type':
        return plus0_024_barcode_column_type;
      case 'plus0_025_add_row_height':
        return plus0_025_add_row_height;
      case 'plus0_026_map_view':
        return plus0_026_map_view;
      case 'plus0_027_add_comparison_sub_op':
        return plus0_027_add_comparison_sub_op;
      case 'plus0_028_add_enable_scanner_in_form_columns_meta_table':
        return plus0_028_add_enable_scanner_in_form_columns_meta_table;
      case 'plus0_029_webhook':
        return plus0_029_webhook;
      case 'plus0_030_add_description_field':
        return plus0_030_add_description_field;
      case 'plus0_031_remove_fk_and_add_idx':
        return plus0_031_remove_fk_and_add_idx;
      case 'plus0_033_add_group_by':
        return plus0_033_add_group_by;
      case 'plus0_034_erd_filter_and_notification':
        return plus0_034_erd_filter_and_notification;
      case 'plus0_035_add_username_to_users':
        return plus0_035_add_username_to_users;
      case 'plus0_036_base_deleted':
        return plus0_036_base_deleted;
      case 'plus0_038_formula_parsed_tree_column':
        return plus0_038_formula_parsed_tree_column;
      case 'plus0_039_sqlite_alter_column_types':
        return plus0_039_sqlite_alter_column_types;
      case 'plus0_040_form_view_alter_column_types':
        return plus0_040_form_view_alter_column_types;
      case 'plus0_041_calendar_view':
        return plus0_041_calendar_view;
      case 'plus0_042_user_block':
        return plus0_042_user_block;
      case 'plus0_043_user_refresh_token':
        return plus0_043_user_refresh_token;
      case 'plus0_044_view_column_index':
        return plus0_044_view_column_index;
      case 'plus0_045_extensions':
        return plus0_045_extensions;
      case 'plus0_046_comment_mentions':
        return plus0_046_comment_mentions;
      case 'plus0_047_comment_migration':
        return plus0_047_comment_migration;
      case 'plus0_048_view_links':
        return plus0_048_view_links;
    }
  }
}
