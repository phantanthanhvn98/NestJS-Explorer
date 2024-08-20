import fs from 'fs';
import path from 'path';

let packageInfo: Record<string, any> = {};

try {
  packageInfo = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'node_modules', 'plus0-service', 'package.json'),
      'utf8',
    ),
  );
} catch {
  try {
    // check within executable
    packageInfo = JSON.parse(
      fs.readFileSync(
        path.join(
          path.dirname(process['pkg']?.['defaultEntrypoint']),
          'node_modules',
          'plus0-service',
          'package.json',
        ),
        'utf8',
      ),
    );
  } catch {
    try {
      packageInfo = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
      );
    } catch {}
  }
}
const packageVersion = packageInfo?.version;

export { packageVersion, packageInfo };
