const fs = require('node:fs');
const path = require('node:path');
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// Expo SDK 51 creates its window in AppDelegate; newer iOS requires a scene.
module.exports = function withIosScene(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: 'MtripSceneDelegate',
        }],
      },
    };
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'objcpp') {
      throw new Error('Review the SDK 51 scene adapter before using a different AppDelegate template.');
    }
    if (!mod.modResults.contents.includes('@interface MtripSceneDelegate')) {
      mod.modResults.contents += fs.readFileSync(path.join(__dirname, 'MtripSceneDelegate.mm'), 'utf8');
    }
    return mod;
  });
};
