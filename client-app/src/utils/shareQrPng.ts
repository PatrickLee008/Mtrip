import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Svg } from 'react-native-svg';

export async function shareQrPng(svg: Svg, fileName: string): Promise<boolean> {
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) return false;
  const uri = FileSystem.cacheDirectory + fileName;
  const image = await new Promise<string>((resolve) => svg.toDataURL(resolve));
  await FileSystem.writeAsStringAsync(uri, image, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  return true;
}
