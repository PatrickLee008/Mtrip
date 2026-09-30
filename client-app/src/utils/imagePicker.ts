/**
 * 选图 / 拍照(expo-image-picker),产出可直接交给 `uploadUserImage` 的 LocalImage
 *
 * - 原生端先弹一个「拍照 / 从相册选」的系统 Alert;web 没有相机入口,直接走文件选择
 * - 权限被拒时返回 null 并由调用方提示,不抛错
 */

import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import type { LocalImage } from '@/api/user';

export type ImageSource = 'camera' | 'library';

export interface PickImageOptions {
  /** 裁成正方形(头像);证件照 / 自拍不裁 */
  square?: boolean;
  /** 自拍优先前置摄像头 */
  front?: boolean;
}

export interface PickImageLabels {
  title: string;
  camera: string;
  library: string;
  cancel: string;
  /** 相机 / 相册权限被拒时的提示 */
  denied: string;
}

/** 原生端让用户选来源;web 直接相册 */
export function chooseImageSource(labels: PickImageLabels): Promise<ImageSource | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) => {
    Alert.alert(labels.title, undefined, [
      { text: labels.camera, onPress: () => resolve('camera') },
      { text: labels.library, onPress: () => resolve('library') },
      { text: labels.cancel, style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

export async function pickImage(
  source: ImageSource,
  options: PickImageOptions = {},
): Promise<LocalImage | 'denied' | null> {
  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: !!options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 0.8,
    cameraType: options.front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return 'denied';
    result = await ImagePicker.launchCameraAsync(pickerOptions);
  } else {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return 'denied';
    }
    result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  }
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'image/jpeg';
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName || `photo-${Date.now()}.${ext}`,
    mimeType,
    // web 端 uri 是 blob:/data: 地址,FormData 要真正的 Blob;原生端靠 { uri, name, type } 描述即可
    file: Platform.OS === 'web' ? await (await fetch(asset.uri)).blob() : undefined,
  };
}
