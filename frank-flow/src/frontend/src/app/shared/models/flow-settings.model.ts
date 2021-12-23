import { ConnectionType } from '../../header/settings/options/connection-type';
import { GridConfiguration } from '../../header/settings/options/grid-configuration';

export interface FlowSettings {
  connectionType?: ConnectionType;
  verticalConnectors?: boolean;
  gridConfiguration?: GridConfiguration;
}
