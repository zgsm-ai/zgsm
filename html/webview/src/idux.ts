// idux.ts
import type { App } from 'vue';

// 如果需要 css 按需加载，移除下面 2 行代码
import '@idux/components/default.full.css';
import '@idux/components/index.full.css';
import '@idux/pro/index.css';
// 如果需要 css 按需加载，则按需添加下面的代码
// import "@idux/cdk/index.css";
// import "@idux/components/style/core/reset.css";
// import "@idux/components/style/core/reset-scroll.css";

// 如果需要 js 按需加载，移除下面 3 行代码
import IduxCdk from '@idux/cdk';
import IduxComponents from '@idux/components';
import IduxPro from '@idux/pro';

import { createGlobalConfig } from '@idux/components/config';
import {
  addIconDefinitions,
  ArrowRight,
  Calendar,
  Close,
  DislikeFilled,
  Down,
  IDUX_ICON_DEPENDENCIES,
  LikeFilled,
  More,
  Reload,
  Up
} from '@idux/components/icon';
// import { enUS } from "@idux/components/locales";

// 静态加载: `IDUX_ICON_DEPENDENCIES` 是 `@idux` 的部分组件默认所使用到图标，建议在此时静态引入。
addIconDefinitions([...IDUX_ICON_DEPENDENCIES, Reload, More, Calendar, Up, Down, LikeFilled, DislikeFilled, Close, ArrowRight]);

// 动态加载：不会被打包，可以减小包体积，需要加载的时候时候 http 请求加载
// 注意：请确认图标的 svg 资源被正确放入到 `public/idux-icons` 目录中, 可以参考下面的 vite 配置
const loadIconDynamically = (iconName: string) => {
  return fetch(`/idux-icons/${iconName}.svg`).then((res) => res.text());
};

const customConfig = { icon: { loadIconDynamically } };
const globalConfig = createGlobalConfig(customConfig);

const install = (app: App): void => {
  app.use(IduxCdk).use(IduxComponents).use(IduxPro).use(globalConfig);
};

export default { install };
