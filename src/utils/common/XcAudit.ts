import type Noco from 'src/Plus0';

export default class XcAudit {
  public static init(app: Noco) {
    this.app = app;
  }

  // @ts-ignore
  private static app: Noco;

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async log(data: { base }) {}
}
