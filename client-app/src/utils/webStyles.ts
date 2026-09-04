/**
 * web 端的全局样式补丁(只在浏览器里生效,原生端整个函数空转)
 *
 * RN Web 会把 `TextInput` 落成真实的 `<input>`,于是浏览器的两套默认外观会盖到设计稿上:
 *
 * 1. **聚焦框**:`:focus` 时浏览器画一圈系统 outline(Chromium 蓝、部分国产内核是黄的),
 *    设计稿里没有这一圈 —— 输入框的聚焦反馈只有光标。
 * 2. **自动填充底色**:Chromium 给自动填充过的输入框铺一层 `-webkit-autofill` 底色
 *    (老版 Chrome / Edge / 部分国产浏览器是黄的),会盖掉设计稿的 `#EFF4FF` 与白底。
 *    这里用「把 background-color 过渡拖到无限久」的做法压住 —— 比 `inset box-shadow`
 *    的老写法好在**不用为每种底色各写一遍**(本项目输入框底色有 `#EFF4FF` 与纯白两种)。
 *    文字颜色用 `currentColor` 跟随 RN Web 打在元素上的行内 `color`。
 *
 * 只作用于表单控件,不动按钮/链接的焦点框(那是键盘可达性,不该一起摘掉)。
 */

import { Platform } from 'react-native';

const STYLE_ID = 'mtrip-web-global';

const CSS = `
input:focus,
textarea:focus,
select:focus {
  outline: none;
}

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  transition: background-color 100000s ease-in-out 0s;
  -webkit-text-fill-color: currentColor;
}
`;

/** 幂等:重复调用只会注入一次(Fast Refresh 下会被重复调用) */
export function applyWebGlobalStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
