/**
 * Web:把容器里的 SVG 序列化 → 画进 canvas(白底留边)→ 导出 PNG 下载。
 * 不依赖 react-native-svg 的 toDataURL(Web 实现各版本不一),直接走 DOM。
 */
export function downloadQrPng(containerId: string, fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }
      const svg = document.getElementById(containerId)?.querySelector('svg');
      if (!svg) {
        resolve(false);
        return;
      }
      let xml = new XMLSerializer().serializeToString(svg);
      if (!xml.includes('xmlns=')) {
        xml = xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const out = 720;
      const pad = 48;
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(img, pad, pad, out - pad * 2, out - pad * 2);
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    } catch {
      resolve(false);
    }
  });
}
