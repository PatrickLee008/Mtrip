
@interface MtripSceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

@implementation MtripSceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)options
{
  AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  self.window = delegate.window;
  self.window.windowScene = (UIWindowScene *)scene;
  [self.window makeKeyAndVisible];
  [self scene:scene openURLContexts:options.URLContexts];
  for (NSUserActivity *activity in options.userActivities) {
    [self scene:scene continueUserActivity:activity];
  }
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)contexts
{
  AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  for (UIOpenURLContext *context in contexts) {
    [delegate application:UIApplication.sharedApplication openURL:context.URL options:@{}];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)activity
{
  AppDelegate *delegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  [delegate application:UIApplication.sharedApplication continueUserActivity:activity restorationHandler:^(NSArray *objects) {}];
}

- (void)sceneDidBecomeActive:(UIScene *)scene
{
  id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
  if ([delegate respondsToSelector:@selector(applicationDidBecomeActive:)]) {
    [delegate applicationDidBecomeActive:UIApplication.sharedApplication];
  }
}

- (void)sceneWillResignActive:(UIScene *)scene
{
  id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
  if ([delegate respondsToSelector:@selector(applicationWillResignActive:)]) {
    [delegate applicationWillResignActive:UIApplication.sharedApplication];
  }
}

- (void)sceneWillEnterForeground:(UIScene *)scene
{
  id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
  if ([delegate respondsToSelector:@selector(applicationWillEnterForeground:)]) {
    [delegate applicationWillEnterForeground:UIApplication.sharedApplication];
  }
}

- (void)sceneDidEnterBackground:(UIScene *)scene
{
  id<UIApplicationDelegate> delegate = UIApplication.sharedApplication.delegate;
  if ([delegate respondsToSelector:@selector(applicationDidEnterBackground:)]) {
    [delegate applicationDidEnterBackground:UIApplication.sharedApplication];
  }
}

@end
