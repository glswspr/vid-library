import type { VideoProvider } from './types';
import { vidApiProvider } from './VidApiProvider';
import { vidRockProvider } from './VidRockProvider';
import { vidSrcProvider } from './VidSrcProvider';
import { peachifyProvider } from './PeachifyProvider';
import { videasyProvider } from './VideasyProvider';
import { vidCoreProvider } from './VidCoreProvider';
import { vidZeeProvider } from './VidZeeProvider';
import { mappleProvider } from './MappleProvider';
import { m111Provider } from './M111Provider';
import { streamXProvider } from './StreamXProvider';
import type { ProviderId } from '../types';

export const PROVIDERS: Record<ProviderId, VideoProvider> = {
  videasy: videasyProvider,
  vidrock: vidRockProvider,
  vidapi: vidApiProvider,
  vidsrc: vidSrcProvider,
  peachify: peachifyProvider,
  vidcore: vidCoreProvider,
  vidzee: vidZeeProvider,
  mapple: mappleProvider,
  m111: m111Provider,
  streamx: streamXProvider,
};

export function getProvider(id: ProviderId): VideoProvider {
  return PROVIDERS[id] || videasyProvider;
}
