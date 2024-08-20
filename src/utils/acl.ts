import { OrgUserRoles, ProjectRoles } from 'plus0-sdk';


const adminExclude = {
  superAdminAdd: true,
  superAdminDelete: true,
  superAdminChangeRole: true
}

const teamLeaderExclude = {
  adminChangeRole: true,
  userList: true,
  userAdd: true,
  userUpdate: true,
  userDelete: true,
  passwordChange: true,
  userInviteResend: true,
  generateResetUrl: true,
}

const userExclude = {
  apiTokenList: true,
  apiTokenCreate: true,
  apiTokenDelete: true,
  userInvite: true
}

const projectCommenterExclude= {
    //base
    extensionCreate: true,
    extensionUpdate: true,
    extensionDelete: true,
    baseApiTokenCreate: true,
    baseApiTokenDelete: true,
    nestedListCopyPasteOrDeleteAll: true,
    gridColumnUpdate: true,
    bulkDataInsert: true,
    bulkDataUpdate: true,
    bulkDataUpdateAll: true,
    bulkDataDelete: true,
    bulkDataDeleteAll: true,
    relationDataRemove: true,
    relationDataAdd: true,
    duplicateColumn: true,
    nestedDataList: true,
    nestedDataLink: true,
    auditRowUpdate: true,
    dataUpdate: true,
    dataDelete: true,
    dataInsert: true,
    viewColumnUpdate: true,
    sortCreate: true,
    sortUpdate: true,
    sortDelete: true,
    filterCreate: true,
    filterUpdate: true,
    filterDelete: true,
    baseUserMetaUpdate: true,
    galleryViewGet: true,
    kanbanViewGet: true,
    gridViewUpdate: true,
    formViewUpdate: true,
}
const projectViewerExculde = {
  commentList: true,
  commentsCount: true,
  commentDelete: true,
  commentUpdate: true,
}

const ogrViewerExculde = {
  ...{
  //org
    baseCreate: true,
    baseDelete: true,
  },
  ...projectViewerExculde
}

const projectEditorExclude = {
  baseDelete: true,
}

const rolePermissions:
  | Record<
      Exclude<OrgUserRoles, OrgUserRoles.SUPER_ADMIN> | ProjectRoles | 'guest',
      { include?: Record<string, boolean>; exclude?: Record<string, boolean> }
    >
  | Record<OrgUserRoles.SUPER_ADMIN, string> = {
  guest: {},
  [OrgUserRoles.SUPER_ADMIN]: '*',

  [OrgUserRoles.ADMIN]: {
    exclude: {...adminExclude}
  },
  [OrgUserRoles.TEAM_LEADER]: {
    exclude: {...adminExclude, ...teamLeaderExclude}
  },
  [OrgUserRoles.USER]: {
    exclude: {...adminExclude, ...teamLeaderExclude, ...userExclude}
  },
  [ProjectRoles.OWNER]: {
    exclude: {...adminExclude, ...teamLeaderExclude, ...userExclude}
  },
  [ProjectRoles.EDITOR]: {
    exclude: {...adminExclude, ...teamLeaderExclude, ...userExclude, ...projectEditorExclude}
  },
  [ProjectRoles.COMMENTER]: {
    exclude: {...adminExclude, ...teamLeaderExclude, ...userExclude, ...projectEditorExclude, ...projectEditorExclude, ...projectViewerExculde}
  },
  [ProjectRoles.VIEWER]: {
    exclude: {...adminExclude, ...teamLeaderExclude, ...userExclude, ...projectEditorExclude, ...projectEditorExclude, ...projectViewerExculde, ...projectCommenterExclude}
  }
};

export default rolePermissions;