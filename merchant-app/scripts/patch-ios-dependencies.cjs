const fs = require('node:fs');
const path = require('node:path');

function patch(moduleName, relativeFile, original, patched) {
  const file = path.join(path.dirname(require.resolve(`${moduleName}/package.json`)), relativeFile);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(patched)) {
    console.log(`${moduleName} iOS compatibility patch is already applied.`);
    return;
  }
  if (!source.includes(original)) {
    throw new Error(`${moduleName} source changed; review the iOS patch before building.`);
  }
  fs.writeFileSync(file, source.replace(original, patched));
  console.log(`Applied ${moduleName} iOS compatibility patch.`);
}

// Match Expo's upstream fallback for calendar identifiers added by newer iOS SDKs.
patch(
  'expo-localization',
  'ios/LocalizationModule.swift',
  '    case .iso8601:\n      return "iso8601"\n    }',
  '    case .iso8601:\n      return "iso8601"\n    @unknown default:\n      return "iso8601"\n    }',
);

// Swift no longer imports TARGET_IPHONE_SIMULATOR from the C SDK headers.
patch(
  'expo-dev-menu',
  'ios/DevMenuViewController.swift',
  '    let isSimulator = TARGET_IPHONE_SIMULATOR > 0',
  '    #if targetEnvironment(simulator)\n    let isSimulator = true\n    #else\n    let isSimulator = false\n    #endif',
);
