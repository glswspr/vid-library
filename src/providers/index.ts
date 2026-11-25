import type { VideoProvider } from './types';
import { vidLinkProvider } from './VidLinkProvider';
import { vidPrimeProvider } from './VidPrimeProvider';
import { vixSrcProvider } from './VixSrcProvider';
import { vidNestProvider } from './VidNestProvider';
import { vidSrcProvider } from './VidSrcProvider';
import { mappleProvider } from './MappleProvider';
import { vidZeeProvider } from './VidZeeProvider';
import { vidCoreProvider } from './VidCoreProvider';
import { peachifyProvider } from './PeachifyProvider';
import { vidApiProvider } from './VidApiProvider';
import { m111Provider } from './M111Provider';
import type { ProviderId } from '../types';

export { PROVIDER_IDS, isProviderId } from './ids';

export const PROVIDERS: Record<ProviderId, VideoProvider> = {
  vidprime: vidPrimeProvider,
  vixsrc: vixSrcProvider,
  vidnest: vidNestProvider,
  vidlink: vidLinkProvider,
  vidsrc: vidSrcProvider,
  mapple: mappleProvider,
  vidzee: vidZeeProvider,
  vidcore: vidCoreProvider,
  peachify: peachifyProvider,
  vidapi: vidApiProvider,
  m111: m111Provider,
};

export function getProvider(id: ProviderId): VideoProvider {
  return PROVIDERS[id] || vidPrimeProvider;
}
