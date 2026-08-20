import type { VideoProvider } from './types';
import { vidApiProvider } from './VidApiProvider';
import { vidRockProvider } from './VidRockProvider';
import { vidSrcProvider } from './VidSrcProvider';
import { peachifyProvider } from './PeachifyProvider';
import { videasyProvider } from './VideasyProvider';
import { vidCoreProvider } from './VidCoreProvider';
import { vidZeeProvider } from './VidZeeProvider';
import type { ProviderId } from '../types';

export const PROVIDERS: Record<ProviderId, VideoProvider> = {
  videasy: videasyProvider,
  vidrock: vidRockProvider,
  vidapi: vidApiProvider,
  vidsrc: vidSrcProvider,
  peachify: peachifyProvider,
  vidcore: vidCoreProvider,
  vidzee: vidZeeProvider,
};

export function getProvider(id: ProviderId): VideoProvider {
  return PROVIDERS[id] || videasyProvider;
}
