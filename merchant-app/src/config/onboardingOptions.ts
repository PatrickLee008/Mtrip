/**
 * 入驻表单的静态选项(不是臆造数据,来源都在仓库里)。
 *
 * - `ONBOARDING_BUSINESS_TYPES`:必须与后端 `MerchantAppOnboardingService::BUSINESS_TYPES` 完全一致
 *   (`hotel/car_rental/restaurant/airline/attraction`,共 5 个)。取值不合法时 `application/save` 会以
 *   「businessType 不受支持」拒绝。注意 merchant-web 的语言包里多一个 `other`,后端并不接受,不要照抄。
 *   展示文案由 i18n `register.businessDetails.businessTypeOptions.*` 提供。
 * - `ONBOARDING_CITIES`:取自仓库既有的平台目的地种子
 *   `database/merchant/14-merchant-ranking.sql`(ranking_destination 8 条)。静态阶段先内置,
 *   接入站点字典/目的地接口后应改为远程获取(后端 `city` 本身是自由文本,无强校验)。
 * - `ONBOARDING_BUSINESS_COUNTS`:Business Details 会按这个数量渲染对应张数的业务卡片。
 */

export const ONBOARDING_BUSINESS_TYPES = ['hotel', 'car_rental', 'restaurant', 'airline', 'attraction'] as const;

export const ONBOARDING_CITIES = [
  'Yangon',
  'Bagan',
  'Inle Lake',
  'Mandalay',
  'Ngapali Beach',
  'Naypyidaw',
  'Kyaiktiyo (Golden Rock)',
  'Mrauk U',
] as const;

export const ONBOARDING_BUSINESS_COUNTS = [1, 2, 3, 4, 5] as const;
