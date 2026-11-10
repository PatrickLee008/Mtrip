/**
 * 打开外部链接(网址 / mailto: / tel:)
 *
 * 设备上没有能处理的 App(如没配置邮箱、web 端的 tel:)时 `Linking.openURL` 会抛错,
 * 这里吞掉并交给调用方提示,页面不用各自 try/catch。
 */

import { Linking } from 'react-native';

export async function openExternal(url: string, onFail: () => void): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    onFail();
  }
}
