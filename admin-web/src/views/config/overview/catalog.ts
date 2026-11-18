export interface ConfigSection {
  key: string;
  icon: string;
  color: string;
  permission?: string;
  component?: string;
  fields?: { key: string; type?: 'number' | 'textarea' | 'switch' | 'password' }[];
}

/** 原型入口顺序；只有已存在的业务能力接入保存接口。 */
export const sections: ConfigSection[] = [
  { key: 'platform', icon: 'SettingOutlined', color: 'blue', permission: 'config:global:list', component: 'global' },
  { key: 'categories', icon: 'TagOutlined', color: 'purple', fields: [{ key: 'categoryName' }, { key: 'enabled', type: 'switch' }] },
  { key: 'onboarding', icon: 'TeamOutlined', color: 'green', permission: 'config:kyc:list', component: 'kyc' },
  { key: 'commission', icon: 'DollarOutlined', color: 'gold', fields: [{ key: 'standardRate', type: 'number' }, { key: 'premiumRate', type: 'number' }, { key: 'vipRate', type: 'number' }, { key: 'refundFee', type: 'number' }] },
  { key: 'settlement', icon: 'CreditCardOutlined', color: 'cyan', fields: [{ key: 'settlementCycle' }, { key: 'payoutSchedule' }, { key: 'bankRules', type: 'textarea' }] },
  { key: 'refund', icon: 'SyncOutlined', color: 'gold', fields: [{ key: 'refundWindow', type: 'number' }, { key: 'approvalThreshold', type: 'number' }, { key: 'automaticRefund', type: 'switch' }] },
  { key: 'cancellation', icon: 'CloseCircleOutlined', color: 'red', fields: [{ key: 'policyName' }, { key: 'guestCancellation', type: 'textarea' }, { key: 'merchantCancellation', type: 'textarea' }, { key: 'penaltyRules', type: 'textarea' }] },
  { key: 'notifications', icon: 'BellOutlined', color: 'purple', permission: 'merchant:list:notify' },
  { key: 'email', icon: 'MailOutlined', color: 'pink', permission: 'config:email:list', component: 'email', fields: [{ key: 'templateName' }, { key: 'emailSubject' }, { key: 'templateContent', type: 'textarea' }] },
  { key: 'sms', icon: 'MessageOutlined', color: 'green', permission: 'config:sms:list', component: 'sms' },
  { key: 'features', icon: 'ThunderboltOutlined', color: 'gold', permission: 'config:feature:list', component: 'features' },
  { key: 'pms', icon: 'LinkOutlined', color: 'purple', fields: [{ key: 'provider' }, { key: 'apiEndpoint' }, { key: 'apiCredential', type: 'password' }] },
  { key: 'channel', icon: 'GlobalOutlined', color: 'blue', fields: [{ key: 'provider' }, { key: 'apiEndpoint' }, { key: 'syncRules', type: 'textarea' }] },
  { key: 'api', icon: 'ApiOutlined', color: 'slate', permission: 'config:client:list', component: 'client', fields: [{ key: 'webhookEndpoint' }, { key: 'connectionStatus' }] },
  { key: 'maintenance', icon: 'ToolOutlined', color: 'red', fields: [{ key: 'maintenanceEnabled', type: 'switch' }, { key: 'maintenanceMessage', type: 'textarea' }, { key: 'estimatedDuration' }] },
  { key: 'announcements', icon: 'NotificationOutlined', color: 'green', permission: 'help:announcement:list', component: 'announcements' },
  { key: 'location', icon: 'EnvironmentOutlined', color: 'cyan', permission: 'config:map:list', component: 'map', fields: [
    { key: 'mapProvider' }, { key: 'connectionStatus' }, { key: 'searchRadius', type: 'number' },
    { key: 'maxSearchRadius', type: 'number' }, { key: 'distanceUnit' }, { key: 'coverageRadius', type: 'number' },
    { key: 'nearbySearch', type: 'switch' }, { key: 'geofencing', type: 'switch' }, { key: 'locationCollection', type: 'switch' },
    { key: 'defaultCountry' }, { key: 'mapCenter' }, { key: 'geofencingAreas', type: 'textarea' },
    { key: 'coordinateValidation' }, { key: 'locationChangeApproval', type: 'switch' },
    { key: 'locationPermission' }, { key: 'coordinatePrecision', type: 'number' }, { key: 'geocodeFallback' },
  ] },
];

/** 从原系统配置归入平台管理；复用既有页面及权限。 */
export const managementSections: ConfigSection[] = [
  { key: 'advanced', icon: 'SettingOutlined', color: 'blue', permission: 'config:global:list', component: 'advanced' },
  { key: 'sites', icon: 'GlobalOutlined', color: 'green', permission: 'config:site:list', component: 'site' },
  { key: 'storage', icon: 'ToolOutlined', color: 'purple', permission: 'config:storage:list', component: 'storage' },
  { key: 'payment', icon: 'CreditCardOutlined', color: 'cyan', permission: 'config:pay:list', component: 'pay' },
  { key: 'paymentAccounts', icon: 'DollarOutlined', color: 'gold', permission: 'config:payAccount:list', component: 'payAccount' },
  { key: 'permissions', icon: 'ApiOutlined', color: 'slate', permission: 'config:permtpl:list', component: 'permtpl' },
  { key: 'filters', icon: 'TagOutlined', color: 'purple', permission: 'goods:filter:list', component: 'filter' },
  { key: 'tax', icon: 'DollarOutlined', color: 'gold', permission: 'finance:tax:list', component: 'tax' },
];
