/**
 * 评价页选图 / 选视频(expo-image-picker),产出可直接交给 `uploadReviewMedia` 的 LocalMedia
 * (「更多 → 问题反馈」页的附件也复用这一套选择 + `/user/review-media` 上传,用 `mixed` 模式)
 *
 * - 相册多选(图片、视频分开选,各自按剩余名额限制);web 没有相机入口,同样走文件选择
 * - 权限被拒返回 'denied' 由调用方提示,取消返回空数组,不抛错
 * - 单个文件超限(图片 10MB / 视频 50MB)的会被丢掉并通过 `rejected` 告诉调用方,不会白传
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import type { LocalMedia } from '@/api/review';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export interface PickMediaResult {
  items: LocalMedia[];
  /** 因超过大小上限被丢掉的个数 */
  rejected: number;
}

function extOf(mime: string, kind: 'image' | 'video'): string {
  const sub = mime.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov');
  return sub || (kind === 'video' ? 'mp4' : 'jpg');
}

/**
 * `mixed` = 图片与视频一起选(反馈页「Photos/Videos」只有一个入口),每个文件按自身类型归类,
 * 大小上限仍按各自类型判断
 */
export async function pickReviewMedia(
  pick: 'image' | 'video' | 'mixed',
  remaining: number,
): Promise<PickMediaResult | 'denied'> {
  if (remaining <= 0) return { items: [], rejected: 0 };
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'denied';
  }
  const mediaTypes =
    pick === 'mixed'
      ? ImagePicker.MediaTypeOptions.All
      : pick === 'video'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsMultipleSelection: remaining > 1,
    selectionLimit: remaining,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return { items: [], rejected: 0 };

  const items: LocalMedia[] = [];
  let rejected = 0;
  // 浏览器的文件选择不认 selectionLimit,超出名额的多余文件在这里截掉
  for (const asset of result.assets.slice(0, remaining)) {
    const kind: 'image' | 'video' =
      pick !== 'mixed' ? pick : asset.type === 'video' || asset.mimeType?.startsWith('video/') ? 'video' : 'image';
    const max = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const size = asset.fileSize ?? 0;
    if (size > max) {
      rejected += 1;
      continue;
    }
    const mimeType = asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
    const ext = extOf(mimeType, kind);
    items.push({
      uri: asset.uri,
      name: asset.fileName || `${kind}-${Date.now()}-${items.length}.${ext}`,
      mimeType,
      kind,
      size,
      // web 端 uri 是 blob:/data: 地址,FormData 要真正的 Blob;原生端靠 { uri, name, type } 描述即可
      file: Platform.OS === 'web' ? await (await fetch(asset.uri)).blob() : undefined,
    });
  }
  return { items, rejected };
}
