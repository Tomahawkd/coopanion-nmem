/** 包入口:默认导出 `WorldDefinition`,加载器按 `cortico.kind === 'world'` 认它。 */
import { NMEM } from './definition.ts';

export default NMEM;
export { NMEM };
export type { NmemConfigSection } from './config.ts';
